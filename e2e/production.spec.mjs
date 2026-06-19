import {
  expect,
  test
} from "@playwright/test";

test.beforeEach(async ({ context, page }) => {
  await context.clearCookies();
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
});

test("game starts without uncaught page errors", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/");
  await expect(page).toHaveTitle(/Paper Flock v0\.19/);
  await expect(page.locator("#board")).toBeVisible();
  await expect(page.locator(".cell:not(.empty)").first()).toBeVisible();
  await page.evaluate(() =>
    new Promise((resolve) => {
      if (document.documentElement.classList.contains("ui-ready")) {
        resolve();
        return;
      }
      addEventListener("paperflock:ready", resolve, { once: true });
    })
  );

  expect(errors).toEqual([]);
});

test("mobile layout has no horizontal overflow", async ({ page }) => {
  await page.goto("/");
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth
  }));

  expect(dimensions.scroll).toBeLessThanOrEqual(
    dimensions.viewport + 1
  );
});

test("keyboard arrow navigation moves between birds", async ({ page }) => {
  await page.goto("/");
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
  for (const path of [
    "/privacy.html",
    "/terms.html",
    "/support.html",
    "/accessibility.html",
    "/credits.html",
    "/release-notes.html",
    "/known-issues.html"
  ]) {
    const response = await page.goto(path);
    expect(response?.ok()).toBeTruthy();
    await expect(page.locator("main")).toBeVisible();
  }
});

test("manifest and release metadata are valid JSON", async ({ request }) => {
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBeTruthy();
  expect((await manifest.json()).display).toBe("standalone");

  const release = await request.get("/release.json");
  expect(release.ok()).toBeTruthy();
  expect((await release.json()).buildVersion).toBe("0.19");
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

  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });

  await expect(page.locator("#board")).toBeVisible();
  await expect(page).toHaveTitle(/Paper Flock/);
});

test("first move persists local progress across reload", async ({ page }) => {
  await page.goto("/");
  await page.locator("#beta-disclosure-continue").click();

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


test("mobile gameplay is locked to the visible viewport", async ({
  page,
  isMobile
}) => {
  test.skip(!isMobile, "Mobile viewport test.");

  await page.goto("/?viewportlock=1");
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
      viewportHeight: window.visualViewport?.height ??
        window.innerHeight,
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

test("short phone viewport keeps board and controls reachable without page scroll", async ({
  page,
  isMobile
}) => {
  test.skip(!isMobile, "Mobile viewport test.");

  await page.setViewportSize({
    width: 360,
    height: 640
  });
  await page.goto("/?viewportlock=1");
  await page.waitForFunction(() =>
    document.documentElement.classList.contains(
      "mobile-height-tight"
    )
  );

  const result = await page.evaluate(() => {
    const board = document.querySelector("#board")
      .getBoundingClientRect();
    const controls = document.querySelector(".controls")
      .getBoundingClientRect();
    const more = document.querySelector(
      "#mobile-game-menu-button"
    ).getBoundingClientRect();

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

test("mobile game menu scrolls internally while the page stays locked", async ({
  page,
  isMobile
}) => {
  test.skip(!isMobile, "Mobile viewport test.");

  await page.goto("/?viewportlock=1");
  await page.locator("#mobile-game-menu-button").click();
  await expect(page.locator("#mobile-game-menu")).toBeVisible();

  const result = await page.evaluate(() => {
    const content = document.querySelector(
      "#mobile-game-menu-content"
    );
    const before = document.documentElement.scrollTop;
    content.scrollTop = content.scrollHeight;
    return {
      pageScrollBefore: before,
      pageScrollAfter: document.documentElement.scrollTop,
      contentScrollTop: content.scrollTop,
      contentScrollHeight: content.scrollHeight,
      contentClientHeight: content.clientHeight,
      contentOverflowY: getComputedStyle(content).overflowY
    };
  });

  expect(result.pageScrollBefore).toBe(0);
  expect(result.pageScrollAfter).toBe(0);
  expect(result.contentOverflowY).toBe("auto");
  expect(result.contentScrollHeight).toBeGreaterThanOrEqual(
    result.contentClientHeight
  );
  expect(result.contentScrollTop).toBeGreaterThanOrEqual(0);
});
