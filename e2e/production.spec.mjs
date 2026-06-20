import fs from "node:fs";
import {
  expect,
  test
} from "@playwright/test";

async function waitForAppReady(page) {
  await page.waitForFunction(() =>
    document.documentElement.classList.contains("ui-ready")
  );
  await expect(page.locator("#board")).toBeVisible();
  await expect(page.locator("#settings-button")).toBeAttached();
}

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
  await page.goto("/", {
    waitUntil: "domcontentloaded"
  });
  await waitForAppReady(page);
}

async function openSettings(page) {
  const settings = page.locator("#settings-button");
  if (!(await settings.isVisible())) {
    await page.locator("#mobile-game-menu-button").click();
  }
  await settings.click();
  await expect(page.locator("#settings-page")).toBeVisible();
}

async function openJournal(page) {
  const journal = page.locator("#journal-button");
  if (!(await journal.isVisible())) {
    await page.locator("#mobile-game-menu-button").click();
  }
  await journal.click();
  await expect(
    page.locator("#achievement-journal")
  ).toBeVisible();
}


async function openRemixPlayerGame(page) {
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
    localStorage.setItem(
      "paper-flock-save",
      JSON.stringify({
        saveVersion: 12,
        buildVersion: "1.6.0",
        currentLevel: 6,
        unlockedLevel: 6,
        completedLevels: [1, 2, 3, 4, 5],
        bestFeathers: {
          1: 3,
          2: 3,
          3: 3,
          4: 2,
          5: 2
        },
        dailyFeathers: {},
        selectedTheme: "dawn",
        soundEnabled: true,
        hapticsEnabled: true,
        effectsPreference: "minimal"
      })
    );
  });
  await page.goto("/", {
    waitUntil: "domcontentloaded"
  });
  await waitForAppReady(page);
}

async function openRemixSelector(page) {
  const remix = page.locator("#remix-button");
  if (!(await remix.isVisible())) {
    await page.locator("#mobile-game-menu-button").click();
  }
  await remix.click();
  await expect(page.locator("#remix-overlay")).toBeVisible();
}

test("game starts without uncaught page errors", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await openReturningPlayerGame(page);
  await expect(page).toHaveTitle(/Paper Flock v1\.6/);
  await expect(
    page.locator(".cell:not(.empty)").first()
  ).toBeVisible();

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
  expect(releasePayload.buildVersion).toBe("1.6.0");
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

test("new player sound is enabled by default", async ({ page }) => {
  await openReturningPlayerGame(page);
  await openSettings(page);

  await expect(page.locator("#settings-sound")).toBeChecked();

  const saved = await page.evaluate(() => {
    const raw = localStorage.getItem("paper-flock-save");
    return raw ? JSON.parse(raw).payload.soundEnabled : null;
  });
  expect(saved).toBe(true);
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


test("mobile controls stay in one touch-friendly action bar", async ({
  page,
  isMobile
}) => {
  test.skip(!isMobile, "Mobile viewport test.");

  await page.setViewportSize({
    width: 360,
    height: 640
  });
  await openReturningPlayerGame(page);

  const result = await page.evaluate(() => {
    const controls = document.querySelector(".controls");
    const buttons = [...controls.querySelectorAll("button")]
      .filter((button) => getComputedStyle(button).display !== "none")
      .map((button) => {
        const rect = button.getBoundingClientRect();
        return {
          id: button.id,
          top: rect.top,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height
        };
      });

    return {
      controlsBottom: controls.getBoundingClientRect().bottom,
      viewportHeight:
        window.visualViewport?.height ?? window.innerHeight,
      buttons
    };
  });

  expect(result.buttons.map(({ id }) => id)).toEqual([
    "undo-button",
    "hint-button",
    "restart-button",
    "mobile-game-menu-button"
  ]);
  expect(
    new Set(result.buttons.map(({ top }) => Math.round(top))).size
  ).toBe(1);
  for (const button of result.buttons) {
    expect(button.height).toBeGreaterThanOrEqual(44);
    expect(button.width).toBeGreaterThanOrEqual(44);
  }
  expect(result.controlsBottom).toBeLessThanOrEqual(
    result.viewportHeight + 1
  );
});

test("mobile menu actions reveal gameplay surfaces instead of staying above them", async ({
  page,
  isMobile
}) => {
  test.skip(!isMobile, "Mobile viewport test.");

  await openReturningPlayerGame(page);
  await page.locator("#mobile-game-menu-button").click();

  await expect(page.locator("#mobile-game-menu")).toBeVisible();
  await expect(
    page.locator(".mobile-game-menu-section")
  ).toHaveCount(4);

  await page.locator("#open-map-button").click();

  await expect(page.locator("#mobile-game-menu")).toBeHidden();
  await expect(page.locator("#level-map")).toBeVisible();
  await expect(page.locator("#close-map-button")).toBeVisible();

  const containment = await page.evaluate(() => {
    const overlay = document
      .querySelector("#level-map")
      .getBoundingClientRect();
    const panel = document
      .querySelector(".level-map-panel")
      .getBoundingClientRect();
    const viewportHeight =
      window.visualViewport?.height ?? window.innerHeight;
    return {
      overlayTop: overlay.top,
      overlayBottom: overlay.bottom,
      panelTop: panel.top,
      panelBottom: panel.bottom,
      viewportHeight
    };
  });

  expect(containment.overlayTop).toBeGreaterThanOrEqual(-1);
  expect(containment.overlayBottom).toBeLessThanOrEqual(
    containment.viewportHeight + 1
  );
  expect(containment.panelTop).toBeGreaterThanOrEqual(-1);
  expect(containment.panelBottom).toBeLessThanOrEqual(
    containment.viewportHeight + 1
  );

  await page.locator(".level-tile:not(:disabled)").first().click();
  await expect(page.locator("#level-map")).toBeHidden();
  await expect(page.locator("#board")).toBeVisible();
});

test("mobile utility surfaces expose 44-pixel touch targets", async ({
  page,
  isMobile
}) => {
  test.skip(!isMobile, "Mobile viewport test.");

  await openReturningPlayerGame(page);
  await page.locator("#mobile-game-menu-button").click();

  const menuTargets = await page.evaluate(() =>
    [...document.querySelectorAll(
      "#mobile-game-menu-content button:not(:disabled), " +
      "#mobile-game-menu-content a[href]"
    )].map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        text: element.textContent.trim(),
        width: rect.width,
        height: rect.height
      };
    })
  );

  for (const target of menuTargets) {
    expect(target.height, target.text).toBeGreaterThanOrEqual(44);
    expect(target.width, target.text).toBeGreaterThanOrEqual(44);
  }

  await page.locator("#settings-button").click();
  await expect(page.locator("#mobile-game-menu")).toBeHidden();
  await expect(page.locator("#settings-page")).toBeVisible();

  const settingsTargets = await page.evaluate(() =>
    [...document.querySelectorAll(
      "#settings-page button:not(:disabled), " +
      "#settings-page select, #settings-page input"
    )]
      .filter((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          rect.width > 0 &&
          rect.height > 0
        );
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          id: element.id,
          type: element.getAttribute("type"),
          width: rect.width,
          height: rect.height
        };
      })
  );

  for (const target of settingsTargets) {
    if (target.type === "checkbox") {
      // The whole labelled row is the touch target for checkboxes.
      continue;
    }
    expect(target.height, target.id).toBeGreaterThanOrEqual(44);
  }
});

test("compact landscape keeps a large board and non-stretched controls", async ({
  page,
  isMobile
}) => {
  test.skip(!isMobile, "Mobile viewport test.");

  await page.setViewportSize({
    width: 844,
    height: 390
  });
  await openReturningPlayerGame(page);

  const result = await page.evaluate(() => {
    const board = document.querySelector("#board")
      .getBoundingClientRect();
    const buttons = [...document.querySelectorAll(
      ".controls button"
    )]
      .filter((button) => getComputedStyle(button).display !== "none")
      .map((button) => button.getBoundingClientRect());

    return {
      boardWidth: board.width,
      boardHeight: board.height,
      boardBottom: board.bottom,
      viewportHeight:
        window.visualViewport?.height ?? window.innerHeight,
      buttonHeights: buttons.map(({ height }) => height),
      buttonRows: new Set(
        buttons.map(({ top }) => Math.round(top))
      ).size
    };
  });

  expect(result.boardWidth).toBeGreaterThanOrEqual(280);
  expect(result.boardHeight).toBeGreaterThanOrEqual(280);
  expect(result.boardBottom).toBeLessThanOrEqual(
    result.viewportHeight + 1
  );
  expect(result.buttonRows).toBe(2);
  for (const height of result.buttonHeights) {
    expect(height).toBeGreaterThanOrEqual(44);
    expect(height).toBeLessThanOrEqual(72);
  }
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


test("completed v1.2 players automatically receive Level 21 access", async ({
  page
}) => {
  await resetPlayerStorage(page);
  await page.evaluate(() => {
    localStorage.setItem(
      "paper-flock-save",
      JSON.stringify({
        saveVersion: 10,
        buildVersion: "1.2",
        currentLevel: 20,
        unlockedLevel: 20,
        completedLevels: Array.from(
          { length: 20 },
          (_, index) => index + 1
        ),
        bestFeathers: Object.fromEntries(
          Array.from(
            { length: 20 },
            (_, index) => [String(index + 1), 2]
          )
        ),
        dailyFeathers: {},
        selectedTheme: "aurora",
        soundEnabled: false,
        hapticsEnabled: true,
        effectsPreference: "auto",
        onboarding: {},
        checkpoint: null
      })
    );
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

  await page.goto("/");
  await page.locator("#open-map-button").click();

  await expect(
    page.locator(".level-map-chapter")
  ).toHaveCount(2);
  await expect(
    page.locator(
      '.level-tile strong',
      { hasText: "21" }
    )
  ).toBeVisible();

  const level21 = page.locator(
    '.level-tile[data-chapter="twilight-flock"]'
  ).first();
  await expect(level21).toBeEnabled();
  await level21.click();

  await expect(page.locator("#level-number")).toHaveText("21");
  await expect(page.locator("#chapter-name")).toContainText(
    "Twilight Flock"
  );
  await expect(page.locator("html")).toHaveAttribute(
    "data-chapter-atmosphere",
    "twilight-flock"
  );
});

test("Chapter 2 exposes progress percentage and mastery guidance", async ({
  page
}) => {
  await resetPlayerStorage(page);
  await page.evaluate(() => {
    localStorage.setItem(
      "paper-flock-save",
      JSON.stringify({
        saveVersion: 11,
        buildVersion: "1.6.0",
        currentLevel: 23,
        unlockedLevel: 24,
        completedLevels: [
          ...Array.from(
            { length: 20 },
            (_, index) => index + 1
          ),
          21,
          22,
          23
        ],
        bestFeathers: {
          21: 3,
          22: 2,
          23: 3
        },
        dailyFeathers: {},
        selectedTheme: "aurora",
        soundEnabled: false,
        hapticsEnabled: true,
        effectsPreference: "auto",
        onboarding: {},
        checkpoint: null
      })
    );
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

  await page.goto("/");

  await expect(
    page.locator("#journey-progress")
  ).toContainText("3/20 levels");
  await expect(
    page.locator("#journey-progress")
  ).toContainText("15%");
  await expect(
    page.locator("#journey-progress")
  ).toContainText("2 mastered");
  await expect(
    page.locator("#mastery-goal")
  ).toContainText("Twilight warm-up");
});

test("production metadata advertises the forty-level campaign", async ({
  request
}) => {
  const config = await (
    await request.get("/app-config.json")
  ).json();
  const build = await (
    await request.get("/build-info.json")
  ).json();

  expect(config.campaignLevels).toBe(40);
  expect(config.campaignChapters).toBe(2);
  expect(config.chapterTwoName).toBe("Twilight Flock");
  expect(build.campaignLevelCount).toBe(40);
  expect(build.levelSolverValidationConfigured).toBe(true);
  expect(build.duplicateLevelDetectionConfigured).toBe(true);
});


test("Achievement Journal exposes statistics, milestones, and a replay goal", async ({
  page
}) => {
  await openReturningPlayerGame(page);
  await openJournal(page);

  await expect(
    page.locator("#journal-summary-value")
  ).toContainText("/20");
  await expect(
    page.locator("#journal-stat-grid .journal-stat")
  ).toHaveCount(10);
  await expect(
    page.locator("#achievement-grid .achievement-card")
  ).toHaveCount(20);
  await expect(
    page.locator("#journal-goal-title")
  ).toContainText("Level 1");
  await expect(
    page.locator(".journal-header")
  ).toContainText("No streaks or expiring rewards");
});

test("Achievement Journal derives milestones from an existing save", async ({
  page
}) => {
  await resetPlayerStorage(page);
  await page.evaluate(() => {
    localStorage.setItem(
      "paper-flock-save",
      JSON.stringify({
        saveVersion: 11,
        buildVersion: "1.3",
        currentLevel: 21,
        unlockedLevel: 21,
        completedLevels: Array.from(
          { length: 20 },
          (_, index) => index + 1
        ),
        bestFeathers: Object.fromEntries(
          Array.from(
            { length: 10 },
            (_, index) => [String(index + 1), 3]
          )
        ),
        dailyFeathers: {
          "2026-06-17": 2,
          "2026-06-18": 3
        },
        selectedTheme: "aurora",
        soundEnabled: false,
        hapticsEnabled: true,
        effectsPreference: "auto",
        onboarding: {},
        checkpoint: null
      })
    );
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

  await page.goto("/");
  await openJournal(page);

  await expect(
    page.locator("#journal-summary-value")
  ).not.toHaveText("0/20");
  await expect(
    page.locator(".achievement-card.unlocked")
  ).toHaveCount(9);
  await expect(
    page.locator("#journal-stat-grid")
  ).toContainText("20/40");
  await expect(
    page.locator("#journal-stat-grid")
  ).toContainText("10/40");
});

test("recommended Journal goal opens the correct campaign level", async ({
  page
}) => {
  await resetPlayerStorage(page);
  await page.evaluate(() => {
    localStorage.setItem(
      "paper-flock-save",
      JSON.stringify({
        saveVersion: 12,
        buildVersion: "1.6.0",
        currentLevel: 4,
        unlockedLevel: 4,
        completedLevels: [1, 2, 3],
        bestFeathers: {
          1: 2,
          2: 3,
          3: 2
        },
        dailyFeathers: {},
        selectedTheme: "dawn",
        soundEnabled: false,
        hapticsEnabled: true,
        effectsPreference: "auto",
        onboarding: {},
        playerStats: {},
        achievementState: {},
        checkpoint: null
      })
    );
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

  await page.goto("/");
  await openJournal(page);
  await expect(
    page.locator("#journal-goal-title")
  ).toHaveText("Continue Level 4");
  await page.locator("#journal-goal-button").click();

  await expect(page.locator("#achievement-journal")).toBeHidden();
  await expect(page.locator("#level-number")).toHaveText("4");
});

test("Journal state persists in the recoverable player save", async ({
  page
}) => {
  await openReturningPlayerGame(page);
  await openJournal(page);
  await page.locator("#journal-close-button").click();

  const saved = await page.evaluate(() => {
    const raw = localStorage.getItem("paper-flock-save");
    const envelope = JSON.parse(raw);
    return {
      saveVersion: envelope.payload.saveVersion,
      stats: envelope.payload.playerStats,
      achievements: envelope.payload.achievementState
    };
  });

  expect(saved.saveVersion).toBe(12);
  expect(saved.stats.launches).toBeGreaterThanOrEqual(1);
  expect(saved.achievements.schemaVersion).toBe(1);
  expect(Array.isArray(saved.achievements.seen)).toBe(true);
});

test("mobile Journal scrolls internally while gameplay remains locked", async ({
  page,
  isMobile
}) => {
  test.skip(!isMobile, "Mobile Journal viewport test.");

  await openReturningPlayerGame(page);
  await openJournal(page);

  const result = await page.evaluate(() => {
    const content = document.querySelector(".journal-content");
    content.scrollTop = content.scrollHeight;
    return {
      pageScroll: document.documentElement.scrollTop,
      contentOverflowY: getComputedStyle(content).overflowY,
      panelBottom:
        document
          .querySelector(".journal-panel")
          .getBoundingClientRect().bottom,
      viewportHeight:
        window.visualViewport?.height ?? window.innerHeight
    };
  });

  expect(result.pageScroll).toBe(0);
  expect(result.contentOverflowY).toBe("auto");
  expect(result.panelBottom).toBeLessThanOrEqual(
    result.viewportHeight + 1
  );
});

test("production metadata advertises ethical achievement progression", async ({
  request
}) => {
  const config = await (
    await request.get("/app-config.json")
  ).json();
  const build = await (
    await request.get("/build-info.json")
  ).json();

  expect(config.achievementJournalAvailable).toBe(true);
  expect(config.achievementCount).toBe(20);
  expect(config.lifetimePlayerStatistics).toBe(true);
  expect(config.streaksEnabled).toBe(false);
  expect(config.expiringRewardsEnabled).toBe(false);
  expect(build.saveSchemaVersion).toBe(12);
  expect(build.achievementJournal).toBe(true);
  expect(build.ethicalReplayGoals).toBe(true);
});


test("tester report exports a privacy-safe local summary", async ({
  page
}) => {
  await openReturningPlayerGame(page);
  await openSettings(page);
  await page.locator('[data-settings-tab="data"]').click();

  const downloadPromise = page.waitForEvent("download");
  await page.locator("#settings-test-report-button").click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  expect(download.suggestedFilename()).toContain(
    "closed-test-report.json"
  );
  expect(downloadPath).toBeTruthy();

  const report = JSON.parse(
    fs.readFileSync(downloadPath, "utf8")
  );
  expect(report.kind).toBe("closed-test-report");
  expect(report.buildVersion).toBe("1.6.0");
  expect(report.diagnostics.eventCount).toBeGreaterThan(0);
  expect(report.storageValues).toBeUndefined();
  expect(report.board).toBeUndefined();
  expect(JSON.stringify(report)).not.toContain(
    "paper-flock-save"
  );
});

test("safe start does not overwrite the recoverable player save", async ({
  page
}) => {
  await openReturningPlayerGame(page);
  const before = await page.evaluate(() =>
    localStorage.getItem("paper-flock-save")
  );
  expect(before).toBeTruthy();

  await page.evaluate(() => {
    sessionStorage.setItem("paper-flock-safe-start", "1");
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppReady(page);

  await expect(page.locator(".safe-mode-notice")).toBeVisible();
  await page.locator("#hint-button").click();
  await page.locator("#restart-button").click();

  const after = await page.evaluate(() =>
    localStorage.getItem("paper-flock-save")
  );
  expect(after).toBe(before);
});


test("Remix selector exposes two branching flights and four routes", async ({
  page
}) => {
  await openRemixPlayerGame(page);
  await openRemixSelector(page);

  await expect(page.locator(".remix-flight")).toHaveCount(2);
  await expect(page.locator(".remix-route-card")).toHaveCount(4);
  await expect(page.locator(".remix-trail-choice")).toHaveCount(5);

  const dimensions = await page.locator("#remix-overlay").evaluate(
    (overlay) => ({
      width: overlay.scrollWidth,
      viewport: overlay.clientWidth
    })
  );
  expect(dimensions.width).toBeLessThanOrEqual(
    dimensions.viewport + 1
  );
});

test("starting a Remix route shows its explained modifier", async ({
  page
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await openRemixPlayerGame(page);
  await openRemixSelector(page);
  await page
    .locator(".remix-route-card")
    .filter({ hasText: "Gentle Thread" })
    .locator("button")
    .click();

  await expect(page.locator("#mode-label")).toHaveText("Remix");
  await expect(page.locator("#level-number")).toHaveText("1/3");
  await expect(
    page.locator("#remix-modifier-badge")
  ).toContainText("Linked Folds");
  await expect(page.locator(".cell.remix-linked")).toHaveCount(2);
  expect(errors).toEqual([]);
});

test("a solver-guided Remix clear persists progress and exposes a result card", async ({
  page
}) => {
  await openRemixPlayerGame(page);
  await openRemixSelector(page);
  await page
    .locator(".remix-route-card")
    .filter({ hasText: "Gentle Thread" })
    .locator("button")
    .click();

  const solution = await page.evaluate(async () => {
    const {
      createRemixPuzzle,
      findRemixSolution
    } = await import("/src/remix-core.js");
    const puzzle = createRemixPuzzle("gentle-thread", 0);
    return findRemixSolution(
      puzzle.board,
      puzzle,
      { nodeLimit: 500000 }
    ).solution;
  });

  for (const move of solution) {
    await page
      .locator(
        `.cell[data-row="${move.row}"][data-col="${move.col}"]`
      )
      .click();
    await page.waitForTimeout(110);
  }

  await expect(page.locator("#completion")).toBeVisible();
  await expect(page.locator("#remix-share-button")).toBeVisible();

  const progress = await page.evaluate(() => {
    const raw = localStorage.getItem("paper-flock-remix");
    return raw ? JSON.parse(raw).payload : null;
  });
  expect(progress.completedPuzzles).toContain("linked-01");
  expect(progress.bestFeathers["linked-01"]).toBeGreaterThan(0);
});
