import {
  calculateMobileBoardSize,
  estimateFixedGameplayHeight,
  shouldLockGameplayViewport,
  viewportHeightClass
} from "./mobile-viewport-core.js";

const BUILD_VERSION = "1.6.0";
const MOBILE_QUERY =
  "(max-width: 760px), (display-mode: standalone)";
const media = globalThis.matchMedia(MOBILE_QUERY);

const MOBILE_MENU_SECTIONS = Object.freeze([
  {
    selector: ".level-nav",
    label: "Level navigation",
    description: "Move between unlocked campaign levels."
  },
  {
    selector: ".settings-entry",
    label: "Player tools",
    description: "Open Settings or review your Achievement Journal."
  },
  {
    selector: ".mode-actions",
    label: "Explore",
    description: "Choose a level, paper theme, or optional Daily Flock."
  },
  {
    selector: ".app-footer",
    label: "Information",
    description: "Privacy, support, accessibility, and release details."
  }
]);

const state = {
  locked: false,
  menuOpen: false,
  relocated: [],
  resizeFrame: 0
};

injectViewportInterface();
wireViewportInterface();
synchronizeViewportMode();

function injectViewportInterface() {
  const controls = document.querySelector(".controls");
  controls?.insertAdjacentHTML(
    "beforeend",
    `
      <button
        class="mobile-game-menu-button"
        id="mobile-game-menu-button"
        type="button"
        aria-haspopup="dialog"
        aria-controls="mobile-game-menu"
        aria-expanded="false"
        hidden
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
          aria-describedby="mobile-game-menu-help"
        >
          <header class="mobile-game-menu-header">
            <div>
              <span class="mobile-game-menu-kicker">
                Paper Flock v${BUILD_VERSION}
              </span>
              <h2 id="mobile-game-menu-title">More</h2>
            </div>
            <button
              class="mobile-game-menu-close"
              id="mobile-game-menu-close"
              type="button"
              aria-label="Close game menu"
              data-modal-close
            >
              ×
            </button>
          </header>

          <p
            class="mobile-game-menu-help"
            id="mobile-game-menu-help"
          >
            Levels, Journal, Settings, themes, and support.
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
  el.content?.addEventListener("click", handleMenuAction);

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

function handleMenuAction(event) {
  const action = event.target.closest("button, a[href]");
  if (
    !action ||
    action.disabled ||
    action.getAttribute("aria-disabled") === "true"
  ) {
    return;
  }

  // Let the selected action run, then remove the menu layer so lower
  // gameplay surfaces such as the level map and Daily Flock are visible.
  queueMicrotask(closeMenu);
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
  const shouldLock = shouldLockGameplayViewport({
    width: viewport.width,
    height: viewport.height,
    isMobileLike: mobileLike(),
    isStandalone: standalone(),
    force: false
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
  if (el.more) {
    el.more.hidden = false;
  }

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
  if (el.more) {
    el.more.hidden = true;
  }

  state.locked = false;
  globalThis.dispatchEvent(
    new CustomEvent("paperflock:viewport-lock-changed", {
      detail: { locked: false }
    })
  );
}

function createMenuSection(definition, node) {
  const section = document.createElement("section");
  section.className = "mobile-game-menu-section";
  section.dataset.mobileMenuSection =
    definition.selector.replace(/^[.#]/, "");

  const heading = document.createElement("div");
  heading.className = "mobile-game-menu-section-heading";
  heading.innerHTML = `
    <h3>${definition.label}</h3>
    <p>${definition.description}</p>
  `;

  section.append(heading, node);
  return section;
}

function relocateSecondaryInterface() {
  if (state.relocated.length > 0) {
    return;
  }

  const content = elements().content;
  if (!content) {
    return;
  }

  for (const definition of MOBILE_MENU_SECTIONS) {
    const node = document.querySelector(definition.selector);
    if (!node || content.contains(node)) {
      continue;
    }

    const placeholder = document.createComment(
      `paper-flock-mobile-placeholder:${definition.selector}`
    );
    node.parentNode.insertBefore(placeholder, node);

    const section = createMenuSection(definition, node);
    content.append(section);
    state.relocated.push({
      node,
      placeholder,
      section
    });
  }
}

function restoreSecondaryInterface() {
  for (const {
    node,
    placeholder,
    section
  } of state.relocated) {
    placeholder.parentNode?.insertBefore(node, placeholder);
    placeholder.remove();
    section.remove();
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
  if (
    !node ||
    node.hidden ||
    getComputedStyle(node).display === "none"
  ) {
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

function compactLandscape(viewport) {
  return (
    viewport.width > viewport.height &&
    viewport.height <= 520
  );
}

function fitBoard(viewport) {
  const el = elements();
  if (!state.locked || !el.boardWrap) {
    return;
  }

  let boardSize;

  if (compactLandscape(viewport)) {
    const sideRail = Math.max(
      240,
      Math.min(340, viewport.width * 0.38)
    );
    boardSize = calculateMobileBoardSize({
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
      horizontalChrome: sideRail + 36,
      verticalChrome: 28,
      minimum: 160,
      maximum: 520
    });
  } else {
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
      moreButton:
        el.controls?.contains(el.more)
          ? 0
          : outerHeight(el.more),
      shellPadding: verticalPadding(el.shell),
      cardPadding: verticalPadding(el.card),
      gaps: 24
    });

    boardSize = calculateMobileBoardSize({
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
      horizontalChrome: 40,
      verticalChrome: fixedHeight,
      minimum:
        viewport.height < 590 ? 150 : 170,
      maximum: 520
    });
  }

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
  if (!el.overlay || !el.more) {
    return;
  }

  state.menuOpen = true;
  el.overlay.hidden = false;
  el.more.setAttribute("aria-expanded", "true");
}

function closeMenu() {
  const el = elements();
  if (!el.overlay || el.overlay.hidden) {
    return;
  }

  el.overlay.hidden = true;
  el.more?.setAttribute("aria-expanded", "false");
  state.menuOpen = false;
}
