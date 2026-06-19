import {
  expect,
  test
} from "@playwright/test";

async function resetPlayerStorage(page) {
  await page.goto("/404.html");
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

async function markTutorialComplete(page) {
  await resetPlayerStorage(page);
  await page.evaluate(() => {
    localStorage.setItem(
      "paper-flock-tutorial",
      JSON.stringify({
        schemaVersion: 1,
        status: "completed",
        lastStepId: "practice",
        replayCount: 0
      })
    );
  });
}

async function openReturningPlayerGame(page) {
  await markTutorialComplete(page);
  await page.goto("/");
  await expect(page.locator("#board")).toBeVisible();
}

async function openSettings(page) {
  const settings = page.locator("#settings-button");
  if (!(await settings.isVisible())) {
    await page.locator("#mobile-game-menu-button").click();
  }
  await settings.click();
  await expect(page.locator("#settings-page")).toBeVisible();
}

test("game starts without uncaught page errors", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await openReturningPlayerGame(page);
  await expect(page).toHaveTitle(/Paper Flock v1\.2/);
  await expect(
    page.locator(".cell:not(.empty)").first()
  ).toBeVisible();

  await page.evaluate(() =>
    new Promise((resolve) => {
      if (document.documentElement.classList.contains("ui-ready")) {
        resolve();
        return;
      }
      addEventListener("paperflock:ready", resolve, {
        once: true
      });
    })
  );

  expect(errors).toEqual([]);
});

test("production page exposes no internal quality controls", async ({
  page
}) => {
  await openReturningPlayerGame(page);

  for (const selector of [
    ".prototype-tools",
    "#research-welcome",
    "#research-ribbon",
    "#beta-feedback-button",
    "#production-release-title",
    "#a11y-cert-launch-button",
    "#mobile-cert-launch-button"
  ]) {
    await expect(page.locator(selector)).toHaveCount(0);
  }

  const scripts = await page.locator("script[src]").evaluateAll(
    (nodes) => nodes.map((node) => node.getAttribute("src"))
  );
  expect(
    scripts.some((src) =>
      /test|audit|certification|beta-operations|quality-evidence|production-release/.test(
        src ?? ""
      )
    )
  ).toBe(false);
});

test("mobile layout has no horizontal overflow", async ({ page }) => {
  await openReturningPlayerGame(page);

  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth
  }));

  expect(dimensions.scroll).toBeLessThanOrEqual(
    dimensions.viewport + 1
  );
});

test("keyboard arrow navigation moves between birds", async ({
  page
}) => {
  await openReturningPlayerGame(page);
  const first = page.locator(".cell:not(.empty)").first();
  await first.focus();

  const before = await page.evaluate(() => ({
    row: document.activeElement?.dataset?.row,
    col: document.activeElement?.dataset?.col
  }));

  await page.keyboard.press("ArrowRight");

  const after = await page.evaluate(() => ({
    row: document.activeElement?.dataset?.row,
    col: document.activeElement?.dataset?.col
  }));

  expect(after).not.toEqual(before);
});

test("public information pages are available", async ({ page }) => {
  for (const pathname of [
    "/privacy.html",
    "/terms.html",
    "/support.html",
    "/accessibility.html",
    "/credits.html",
    "/release-notes.html",
    "/known-issues.html"
  ]) {
    const response = await page.goto(pathname);
    expect(response?.ok()).toBeTruthy();
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("body")).not.toContainText(
      "Prototype testing tools"
    );
  }
});

test("manifest and release metadata are valid production JSON", async ({
  request
}) => {
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBeTruthy();
  expect((await manifest.json()).display).toBe("standalone");

  const release = await request.get("/release.json");
  expect(release.ok()).toBeTruthy();
  const releasePayload = await release.json();
  expect(releasePayload.buildVersion).toBe("1.2");
  expect(releasePayload.releaseChannel).toBe("production");

  const config = await request.get("/app-config.json");
  const configPayload = await config.json();
  expect(configPayload.releaseChannel).toBe("production");
  expect(configPayload.internalToolsIncludedInProduction).toBeUndefined();

  const buildInfo = await request.get("/build-info.json");
  const buildPayload = await buildInfo.json();
  expect(buildPayload.productionRuntimeClean).toBe(true);
  expect(buildPayload.internalToolsIncluded).toBe(false);
});

test("installed app shell reloads offline", async ({
  browserName,
  context,
  page
}) => {
  test.skip(
    browserName !== "chromium",
    "Offline service-worker smoke test runs on Chromium."
  );

  await openReturningPlayerGame(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await context.setOffline(true);
  await page.reload({
    waitUntil: "domcontentloaded"
  });

  await expect(page.locator("#board")).toBeVisible();
  await expect(page).toHaveTitle(/Paper Flock/);
});

test("first move persists player progress across reload", async ({
  page
}) => {
  await openReturningPlayerGame(page);

  const bird = page.locator(".cell:not(.empty)").first();
  await bird.click();
  await page.waitForTimeout(700);

  const before = await page.evaluate(() =>
    localStorage.getItem("paper-flock-save")
  );
  expect(before).toBeTruthy();

  await page.reload();

  const after = await page.evaluate(() =>
    localStorage.getItem("paper-flock-save")
  );
  expect(after).toBe(before);
});

test("Settings exposes production game, accessibility, data, and about sections", async ({
  page
}) => {
  await openReturningPlayerGame(page);
  await openSettings(page);

  for (const tab of [
    "game",
    "accessibility",
    "data",
    "about"
  ]) {
    await page
      .locator(`[data-settings-tab="${tab}"]`)
      .click();
    await expect(
      page.locator(`[data-settings-section="${tab}"]`)
    ).toBeVisible();
  }

  await expect(
    page.locator("#settings-sound")
  ).toHaveCount(1);
  await expect(
    page.locator("#settings-haptics")
  ).toHaveCount(1);
  await expect(
    page.locator("#settings-effects")
  ).toHaveCount(1);
  await expect(
    page.locator("#settings-export-button")
  ).toHaveCount(1);
});

test("game settings persist inside the player save", async ({ page }) => {
  await openReturningPlayerGame(page);
  await openSettings(page);

  await page.locator("#settings-sound").check();
  await page.locator("#settings-haptics").uncheck();
  await page.locator("#settings-effects").selectOption("lite");

  const values = await page.evaluate(() => {
    const raw = localStorage.getItem("paper-flock-save");
    const envelope = JSON.parse(raw);
    return {
      soundEnabled: envelope.payload.soundEnabled,
      hapticsEnabled: envelope.payload.hapticsEnabled,
      effectsPreference: envelope.payload.effectsPreference
    };
  });

  expect(values).toEqual({
    soundEnabled: true,
    hapticsEnabled: false,
    effectsPreference: "lite"
  });
});

test("accessibility settings persist and affect the document", async ({
  page
}) => {
  await openReturningPlayerGame(page);
  await openSettings(page);
  await page
    .locator('[data-settings-tab="accessibility"]')
    .click();

  await page
    .locator("#settings-text-size")
    .selectOption("large");
  await page
    .locator("#settings-contrast")
    .selectOption("high");
  await page
    .locator("#settings-motion")
    .selectOption("reduced");

  await expect(page.locator("html")).toHaveAttribute(
    "data-text-size",
    "large"
  );
  await expect(page.locator("html")).toHaveAttribute(
    "data-contrast",
    "high"
  );
  await expect(page.locator("html")).toHaveAttribute(
    "data-motion",
    "reduced"
  );

  const stored = await page.evaluate(() =>
    JSON.parse(
      localStorage.getItem("paper-flock-accessibility")
    )
  );
  expect(stored.textSize).toBe("large");
  expect(stored.contrast).toBe("high");
  expect(stored.motion).toBe("reduced");
});

test("Settings traps focus and restores it after closing", async ({
  page
}) => {
  await openReturningPlayerGame(page);
  await openSettings(page);

  await expect(page.locator("#settings-close-button")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator("#settings-page")).toBeHidden();
  await expect(page.locator("#settings-button")).toBeFocused();
});

test("mobile gameplay is locked to the visible viewport", async ({
  page,
  isMobile
}) => {
  test.skip(!isMobile, "Mobile viewport test.");

  await openReturningPlayerGame(page);
  await page.waitForFunction(() =>
    document.documentElement.classList.contains(
      "mobile-gameplay-lock"
    )
  );

  const result = await page.evaluate(() => {
    const shell = document.querySelector(".app-shell");
    const board = document.querySelector("#board");
    const controls = document.querySelector(".controls");
    const shellRect = shell.getBoundingClientRect();
    const boardRect = board.getBoundingClientRect();
    const controlsRect = controls.getBoundingClientRect();

    return {
      htmlOverflow:
        getComputedStyle(document.documentElement).overflow,
      bodyOverflow: getComputedStyle(document.body).overflow,
      bodyPosition: getComputedStyle(document.body).position,
      documentScrollHeight:
        document.documentElement.scrollHeight,
      documentClientHeight:
        document.documentElement.clientHeight,
      shellTop: shellRect.top,
      shellBottom: shellRect.bottom,
      viewportHeight:
        window.visualViewport?.height ?? window.innerHeight,
      boardTop: boardRect.top,
      boardBottom: boardRect.bottom,
      controlsBottom: controlsRect.bottom
    };
  });

  expect(result.htmlOverflow).toBe("hidden");
  expect(result.bodyOverflow).toBe("hidden");
  expect(result.bodyPosition).toBe("fixed");
  expect(result.documentScrollHeight).toBeLessThanOrEqual(
    result.documentClientHeight + 1
  );
  expect(result.shellTop).toBeGreaterThanOrEqual(-1);
  expect(result.shellBottom).toBeLessThanOrEqual(
    result.viewportHeight + 1
  );
  expect(result.boardTop).toBeGreaterThanOrEqual(0);
  expect(result.boardBottom).toBeLessThanOrEqual(
    result.viewportHeight + 1
  );
  expect(result.controlsBottom).toBeLessThanOrEqual(
    result.viewportHeight + 1
  );
});

test("short phone keeps board and controls reachable without page scroll", async ({
  page,
  isMobile
}) => {
  test.skip(!isMobile, "Mobile viewport test.");

  await page.setViewportSize({
    width: 360,
    height: 640
  });
  await openReturningPlayerGame(page);
  await page.waitForFunction(() =>
    document.documentElement.classList.contains(
      "mobile-height-tight"
    )
  );

  const result = await page.evaluate(() => {
    const board = document
      .querySelector("#board")
      .getBoundingClientRect();
    const controls = document
      .querySelector(".controls")
      .getBoundingClientRect();
    const more = document
      .querySelector("#mobile-game-menu-button")
      .getBoundingClientRect();

    return {
      scrollHeight:
        document.documentElement.scrollHeight,
      clientHeight:
        document.documentElement.clientHeight,
      boardWidth: board.width,
      boardHeight: board.height,
      boardBottom: board.bottom,
      controlsBottom: controls.bottom,
      moreBottom: more.bottom,
      viewportHeight:
        window.visualViewport?.height ?? window.innerHeight
    };
  });

  expect(result.scrollHeight).toBeLessThanOrEqual(
    result.clientHeight + 1
  );
  expect(result.boardWidth).toBeGreaterThan(130);
  expect(result.boardHeight).toBeGreaterThan(130);
  expect(result.boardBottom).toBeLessThanOrEqual(
    result.viewportHeight + 1
  );
  expect(result.controlsBottom).toBeLessThanOrEqual(
    result.viewportHeight + 1
  );
  expect(result.moreBottom).toBeLessThanOrEqual(
    result.viewportHeight + 1
  );
});

test("mobile More and Settings scroll internally while page stays locked", async ({
  page,
  isMobile
}) => {
  test.skip(!isMobile, "Mobile viewport test.");

  await openReturningPlayerGame(page);
  await page.locator("#mobile-game-menu-button").click();
  await expect(page.locator("#mobile-game-menu")).toBeVisible();

  const menuResult = await page.evaluate(() => {
    const content = document.querySelector(
      "#mobile-game-menu-content"
    );
    content.scrollTop = content.scrollHeight;
    return {
      pageScroll: document.documentElement.scrollTop,
      contentOverflowY: getComputedStyle(content).overflowY
    };
  });

  expect(menuResult.pageScroll).toBe(0);
  expect(menuResult.contentOverflowY).toBe("auto");

  await page.locator("#settings-button").click();
  await expect(page.locator("#settings-page")).toBeVisible();

  const settingsResult = await page.evaluate(() => ({
    pageScroll: document.documentElement.scrollTop,
    contentOverflowY: getComputedStyle(
      document.querySelector(".settings-content")
    ).overflowY
  }));

  expect(settingsResult.pageScroll).toBe(0);
  expect(settingsResult.contentOverflowY).toBe("auto");
});

test("new player sees the tutorial before normal play", async ({
  page
}) => {
  await resetPlayerStorage(page);
  await page.goto("/");

  await expect(
    page.locator("#first-launch-tutorial")
  ).toBeVisible();
  await expect(
    page.locator("#tutorial-title")
  ).toHaveText("Welcome to Paper Flock");
  await expect(page.locator("#board")).not.toBeVisible();
});

test("tutorial can be skipped and does not return on reload", async ({
  page
}) => {
  await resetPlayerStorage(page);
  await page.goto("/");
  await page.locator("#tutorial-skip-button").click();

  await expect(
    page.locator("#first-launch-tutorial")
  ).toBeHidden();

  await page.reload();

  await expect(
    page.locator("#first-launch-tutorial")
  ).toBeHidden();
  await expect(page.locator("#board")).toBeVisible();
});

test("tutorial lessons can be completed with guided actions", async ({
  page
}) => {
  await resetPlayerStorage(page);
  await page.goto("/");
  await page.locator("#tutorial-continue-button").click();

  await page
    .locator('.tutorial-cell[data-row="1"][data-col="1"]')
    .click();
  await page.locator("#tutorial-continue-button").click();

  await page
    .locator('.tutorial-cell[data-row="1"][data-col="0"]')
    .click();
  await page.locator("#tutorial-continue-button").click();

  await page
    .locator('.tutorial-cell[data-row="1"][data-col="0"]')
    .click();
  await page.locator("#tutorial-continue-button").click();

  for (let index = 0; index < 8; index += 1) {
    if (
      await page
        .locator("#tutorial-continue-button")
        .isEnabled()
    ) {
      break;
    }
    await page.locator("#tutorial-hint-button").click();
    await page.locator(".tutorial-hint").click();
  }

  await expect(
    page.locator("#tutorial-continue-button")
  ).toBeEnabled();
  await page.locator("#tutorial-continue-button").click();

  await expect(
    page.locator("#first-launch-tutorial")
  ).toBeHidden();
  await expect(page.locator("#board")).toBeVisible();
});

test("Settings can replay the tutorial for returning players", async ({
  page
}) => {
  await openReturningPlayerGame(page);
  await openSettings(page);
  await page.locator("#settings-tutorial-button").click();

  await expect(
    page.locator("#first-launch-tutorial")
  ).toBeVisible();
});

test("mobile tutorial stays inside the visible viewport", async ({
  page,
  isMobile
}) => {
  test.skip(!isMobile, "Mobile tutorial viewport test.");

  await resetPlayerStorage(page);
  await page.goto("/");

  const result = await page.evaluate(() => {
    const overlay = document
      .querySelector("#first-launch-tutorial")
      .getBoundingClientRect();
    const panel = document
      .querySelector(".tutorial-panel")
      .getBoundingClientRect();
    const viewportHeight =
      window.visualViewport?.height ?? window.innerHeight;

    return {
      overlayTop: overlay.top,
      overlayBottom: overlay.bottom,
      panelTop: panel.top,
      panelBottom: panel.bottom,
      viewportHeight,
      documentScrollHeight:
        document.documentElement.scrollHeight,
      documentClientHeight:
        document.documentElement.clientHeight
    };
  });

  expect(result.overlayTop).toBeGreaterThanOrEqual(-1);
  expect(result.overlayBottom).toBeLessThanOrEqual(
    result.viewportHeight + 1
  );
  expect(result.panelTop).toBeGreaterThanOrEqual(-1);
  expect(result.panelBottom).toBeLessThanOrEqual(
    result.viewportHeight + 1
  );
  expect(result.documentScrollHeight).toBeLessThanOrEqual(
    result.documentClientHeight + 1
  );
});
