import {
  calculateMobileBoardSize,
  estimateFixedGameplayHeight,
  shouldLockGameplayViewport,
  viewportHeightClass
} from "./mobile-viewport-core.js";

const BUILD_VERSION = "1.4.2";
const MOBILE_QUERY =
  "(max-width: 760px), (display-mode: standalone)";
const media = globalThis.matchMedia(MOBILE_QUERY);

const state = {
  locked: false,
  menuOpen: false,
  relocated: [],
  resizeFrame: 0,
  lastFocused: null
};

injectViewportInterface();
wireViewportInterface();
synchronizeViewportMode();

function injectViewportInterface() {
  const controls = document.querySelector(".controls");
  controls?.insertAdjacentHTML(
    "afterend",
    `
      <button
        class="mobile-game-menu-button"
        id="mobile-game-menu-button"
        type="button"
        aria-haspopup="dialog"
        aria-controls="mobile-game-menu"
        aria-expanded="false"
      >
        <span aria-hidden="true">☰</span>
        <span>More</span>
      </button>
    `
  );

  document.body.insertAdjacentHTML(
    "beforeend",
    `
      <div
        class="mobile-game-menu-overlay"
        id="mobile-game-menu"
        hidden
      >
        <section
          class="mobile-game-menu-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mobile-game-menu-title"
        >
          <header class="mobile-game-menu-header">
            <div>
              <span class="mobile-game-menu-kicker">
                Paper Flock v${BUILD_VERSION}
              </span>
              <h2 id="mobile-game-menu-title">Game menu</h2>
            </div>
            <button
              class="mobile-game-menu-close"
              id="mobile-game-menu-close"
              type="button"
              aria-label="Close game menu"
            >
              ×
            </button>
          </header>

          <p class="mobile-game-menu-help">
            Levels, settings, themes, support, and game information remain
            available here without making the puzzle screen scroll.
          </p>

          <div
            class="mobile-game-menu-content"
            id="mobile-game-menu-content"
          ></div>
        </section>
      </div>
    `
  );
}

function elements() {
  return {
    html: document.documentElement,
    body: document.body,
    shell: document.querySelector(".app-shell"),
    card: document.querySelector(".game-card"),
    hero: document.querySelector(".hero"),
    hud: document.querySelector(".hud"),
    lesson: document.querySelector(".lesson-banner"),
    journey: document.querySelector(".journey-strip"),
    journeyRail: document.querySelector(".journey-rail"),
    personalBest: document.querySelector(".personal-best"),
    masteryGoal: document.querySelector(".mastery-goal"),
    boardWrap: document.querySelector(".board-wrap"),
    controls: document.querySelector(".controls"),
    more: document.querySelector("#mobile-game-menu-button"),
    overlay: document.querySelector("#mobile-game-menu"),
    panel: document.querySelector(".mobile-game-menu-panel"),
    close: document.querySelector("#mobile-game-menu-close"),
    content: document.querySelector("#mobile-game-menu-content")
  };
}

function wireViewportInterface() {
  const el = elements();

  el.more?.addEventListener("click", openMenu);
  el.close?.addEventListener("click", closeMenu);
  el.overlay?.addEventListener("click", (event) => {
    if (event.target === el.overlay) {
      closeMenu();
    }
  });

  media.addEventListener?.("change", synchronizeViewportMode);
  globalThis.addEventListener("resize", scheduleLayout);
  globalThis.addEventListener(
    "orientationchange",
    scheduleLayout
  );
  globalThis.visualViewport?.addEventListener(
    "resize",
    scheduleLayout
  );
  globalThis.visualViewport?.addEventListener(
    "scroll",
    scheduleLayout
  );

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      scheduleLayout();
    }
  });
}

function mobileLike() {
  return (
    navigator.maxTouchPoints > 0 ||
    globalThis.matchMedia?.("(pointer: coarse)").matches === true
  );
}

function standalone() {
  return (
    globalThis.matchMedia?.("(display-mode: standalone)").matches === true ||
    navigator.standalone === true
  );
}

function viewportDimensions() {
  const visual = globalThis.visualViewport;
  return {
    width: Math.round(
      visual?.width || globalThis.innerWidth
    ),
    height: Math.round(
      visual?.height || globalThis.innerHeight
    ),
    offsetTop: Math.round(visual?.offsetTop || 0),
    offsetLeft: Math.round(visual?.offsetLeft || 0)
  };
}

function synchronizeViewportMode() {
  const viewport = viewportDimensions();
  const force = new URLSearchParams(
    globalThis.location.search
  ).get("viewportlock") === "1";
  const shouldLock = shouldLockGameplayViewport({
    width: viewport.width,
    height: viewport.height,
    isMobileLike: mobileLike(),
    isStandalone: standalone(),
    force
  });

  if (shouldLock && !state.locked) {
    enableViewportLock();
  } else if (!shouldLock && state.locked) {
    disableViewportLock();
  } else if (shouldLock) {
    scheduleLayout();
  }
}

function enableViewportLock() {
  state.locked = true;
  relocateSecondaryInterface();

  const el = elements();
  el.html.classList.add("mobile-gameplay-lock");
  el.body.classList.add("mobile-gameplay-lock");
  el.more.hidden = false;

  scheduleLayout();
  globalThis.dispatchEvent(
    new CustomEvent("paperflock:viewport-lock-changed", {
      detail: { locked: true }
    })
  );
}

function disableViewportLock() {
  closeMenu();
  restoreSecondaryInterface();

  const el = elements();
  el.html.classList.remove(
    "mobile-gameplay-lock",
    "mobile-height-tight",
    "mobile-height-critical"
  );
  el.body.classList.remove("mobile-gameplay-lock");
  el.html.style.removeProperty("--mobile-viewport-height");
  el.html.style.removeProperty("--mobile-viewport-width");
  el.html.style.removeProperty("--mobile-viewport-top");
  el.html.style.removeProperty("--mobile-viewport-left");
  el.html.style.removeProperty("--mobile-board-size");
  el.more.hidden = true;

  state.locked = false;
  globalThis.dispatchEvent(
    new CustomEvent("paperflock:viewport-lock-changed", {
      detail: { locked: false }
    })
  );
}

function relocateSecondaryInterface() {
  if (state.relocated.length > 0) {
    return;
  }

  const content = elements().content;
  const selectors = [
    ".level-nav",
    ".settings-entry",
    ".mode-actions",
    ".app-footer"
  ];

  for (const selector of selectors) {
    const node = document.querySelector(selector);
    if (!node || content.contains(node)) {
      continue;
    }

    const placeholder = document.createComment(
      `paper-flock-mobile-placeholder:${selector}`
    );
    node.parentNode.insertBefore(placeholder, node);
    state.relocated.push({
      node,
      placeholder
    });
    content.append(node);
  }
}

function restoreSecondaryInterface() {
  for (const { node, placeholder } of state.relocated) {
    placeholder.parentNode?.insertBefore(node, placeholder);
    placeholder.remove();
  }
  state.relocated = [];
}

function scheduleLayout() {
  cancelAnimationFrame(state.resizeFrame);
  state.resizeFrame = requestAnimationFrame(updateLayout);
}

function updateLayout() {
  if (!state.locked) {
    synchronizeViewportMode();
    return;
  }

  const el = elements();
  const viewport = viewportDimensions();
  const root = el.html;

  root.style.setProperty(
    "--mobile-viewport-height",
    `${viewport.height}px`
  );
  root.style.setProperty(
    "--mobile-viewport-width",
    `${viewport.width}px`
  );
  root.style.setProperty(
    "--mobile-viewport-top",
    `${viewport.offsetTop}px`
  );
  root.style.setProperty(
    "--mobile-viewport-left",
    `${viewport.offsetLeft}px`
  );

  const heightClass = viewportHeightClass(viewport.height);
  root.classList.toggle(
    "mobile-height-tight",
    heightClass === "tight"
  );
  root.classList.toggle(
    "mobile-height-critical",
    heightClass === "critical"
  );

  requestAnimationFrame(() => fitBoard(viewport));
}

function outerHeight(node) {
  if (!node || node.hidden) {
    return 0;
  }
  const rect = node.getBoundingClientRect();
  const style = getComputedStyle(node);
  return (
    rect.height +
    parseFloat(style.marginTop || 0) +
    parseFloat(style.marginBottom || 0)
  );
}

function verticalPadding(node) {
  if (!node) {
    return 0;
  }
  const style = getComputedStyle(node);
  return (
    parseFloat(style.paddingTop || 0) +
    parseFloat(style.paddingBottom || 0)
  );
}

function fitBoard(viewport) {
  const el = elements();
  if (!state.locked || !el.boardWrap) {
    return;
  }

  const journeyHeight =
    outerHeight(el.journey) +
    outerHeight(el.journeyRail) +
    outerHeight(el.personalBest) +
    outerHeight(el.masteryGoal);

  const fixedHeight = estimateFixedGameplayHeight({
    hero: outerHeight(el.hero),
    hud: outerHeight(el.hud),
    lesson: outerHeight(el.lesson),
    journey: journeyHeight,
    controls: outerHeight(el.controls),
    moreButton: outerHeight(el.more),
    shellPadding: verticalPadding(el.shell),
    cardPadding: verticalPadding(el.card),
    gaps: 34
  });

  const boardSize = calculateMobileBoardSize({
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
    horizontalChrome: 46,
    verticalChrome: fixedHeight,
    minimum:
      viewport.height < 590 ? 138 : 160,
    maximum: 520
  });

  el.html.style.setProperty(
    "--mobile-board-size",
    `${boardSize}px`
  );
}

function openMenu() {
  if (!state.locked) {
    return;
  }

  const el = elements();
  state.menuOpen = true;
  state.lastFocused =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

  el.overlay.hidden = false;
  el.more.setAttribute("aria-expanded", "true");
  requestAnimationFrame(() => el.close.focus());
}

function closeMenu() {
  const el = elements();
  if (!el.overlay || el.overlay.hidden) {
    return;
  }

  el.overlay.hidden = true;
  el.more?.setAttribute("aria-expanded", "false");
  state.menuOpen = false;

  if (
    state.lastFocused &&
    state.lastFocused.isConnected
  ) {
    requestAnimationFrame(() =>
      state.lastFocused.focus({ preventScroll: true })
    );
  }
  state.lastFocused = null;
}
