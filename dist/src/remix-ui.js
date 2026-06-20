import {
  REMIX_FLIGHTS,
  REMIX_MODIFIERS,
  REMIX_ROUTES,
  REMIX_TRAILS,
  REMIX_REQUIRED_CAMPAIGN_LEVEL,
  REMIX_UNLOCK_LEVEL,
  remixProgressSummary
} from "./remix-core.js";

const state = {
  unlockedLevel: 1,
  progress: null,
  active: null,
  lastResult: null,
  returnFocus: null
};

injectInterface();
wireInterface();
requestState();

function injectInterface() {
  const modeActions = document.querySelector(".mode-actions");
  const lessonBanner = document.querySelector(".lesson-banner");
  const completionActions = document.querySelector(".completion-actions");

  if (!modeActions || !lessonBanner || !completionActions) {
    return;
  }

  const button = document.createElement("button");
  button.className = "mode-button remix-entry-button";
  button.id = "remix-button";
  button.type = "button";
  button.disabled = true;
  button.innerHTML = `
    <span aria-hidden="true" class="mode-icon">✧</span>
    <span>Remix opens after Level ${REMIX_REQUIRED_CAMPAIGN_LEVEL}</span>
  `;
  modeActions.append(button);

  const badge = document.createElement("div");
  badge.className = "remix-modifier-badge";
  badge.id = "remix-modifier-badge";
  badge.hidden = true;
  lessonBanner.append(badge);

  const share = document.createElement("button");
  share.className = "secondary-game-button";
  share.id = "remix-share-button";
  share.type = "button";
  share.hidden = true;
  share.textContent = "Share result";
  completionActions.insertBefore(
    share,
    completionActions.lastElementChild
  );

  const overlay = document.createElement("div");
  overlay.className = "remix-overlay";
  overlay.id = "remix-overlay";
  overlay.hidden = true;
  overlay.innerHTML = `
    <section
      aria-labelledby="remix-title"
      aria-modal="true"
      class="remix-panel"
      role="dialog"
    >
      <header class="remix-header">
        <div>
          <span class="remix-kicker">Optional replay mode</span>
          <h2 id="remix-title">Remix Flights</h2>
          <p>
            Choose a three-puzzle route. Every modifier is explained
            before play, and missing a route has no penalty.
          </p>
        </div>
        <button
          aria-label="Close Remix Flights"
          class="close-map-button"
          id="remix-close-button"
          type="button"
        >×</button>
      </header>
      <div
        aria-live="polite"
        class="remix-summary"
        id="remix-summary"
      ></div>
      <div class="remix-flight-list" id="remix-flight-list"></div>
      <section
        aria-labelledby="remix-trails-title"
        class="remix-trails"
      >
        <div class="section-heading">
          <span>Cosmetic collection</span>
          <h3 id="remix-trails-title">Fold trails</h3>
        </div>
        <p>
          Trails change the escape glow only. They never affect puzzle
          difficulty or rewards.
        </p>
        <div class="remix-trail-grid" id="remix-trail-grid"></div>
      </section>
      <button
        class="map-bottom-close"
        id="remix-close-bottom-button"
        type="button"
      >Back to puzzle</button>
    </section>
  `;
  document.body.append(overlay);
}

function elements() {
  return {
    button: document.querySelector("#remix-button"),
    overlay: document.querySelector("#remix-overlay"),
    close: document.querySelector("#remix-close-button"),
    closeBottom: document.querySelector("#remix-close-bottom-button"),
    summary: document.querySelector("#remix-summary"),
    flights: document.querySelector("#remix-flight-list"),
    trails: document.querySelector("#remix-trail-grid"),
    badge: document.querySelector("#remix-modifier-badge"),
    share: document.querySelector("#remix-share-button")
  };
}

function wireInterface() {
  const ui = elements();
  ui.button?.addEventListener("click", open);
  ui.close?.addEventListener("click", close);
  ui.closeBottom?.addEventListener("click", close);
  ui.overlay?.addEventListener("click", (event) => {
    if (event.target === ui.overlay) {
      close();
    }
  });
  ui.share?.addEventListener("click", shareResult);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !ui.overlay?.hidden) {
      close();
    }
  });

  globalThis.addEventListener(
    "paperflock:remix-state",
    (event) => {
      const detail = event.detail ?? {};
      state.unlockedLevel = Number(detail.unlockedLevel) || 1;
      state.progress = detail.progress ?? null;
      state.active = detail.active ?? null;
      render();
    }
  );

  globalThis.addEventListener(
    "paperflock:remix-result",
    (event) => {
      state.lastResult = event.detail ?? null;
      if (ui.share) {
        ui.share.hidden = !state.lastResult;
      }
      requestState();
    }
  );

  globalThis.addEventListener(
    "paperflock:open-remix",
    open
  );

  globalThis.addEventListener(
    "paperflock:remix-left",
    () => {
      state.active = null;
      state.lastResult = null;
      if (ui.share) {
        ui.share.hidden = true;
      }
      renderBadge();
    }
  );
}

function requestState() {
  globalThis.dispatchEvent(
    new CustomEvent("paperflock:remix-state-request")
  );
}

function open() {
  const ui = elements();
  if (!ui.overlay || state.unlockedLevel < REMIX_UNLOCK_LEVEL) {
    return;
  }
  state.returnFocus = document.activeElement;
  requestState();
  render();
  ui.overlay.hidden = false;
  ui.close?.focus();
  globalThis.dispatchEvent(
    new CustomEvent("paperflock:diagnostic", {
      detail: {
        name: "remix_selector_opened",
        data: {
          completedRoutes:
            remixProgressSummary(state.progress).completedRoutes
        }
      }
    })
  );
}

function close() {
  const ui = elements();
  if (!ui.overlay) {
    return;
  }
  ui.overlay.hidden = true;
  const target =
    state.returnFocus instanceof HTMLElement &&
    !state.returnFocus.hidden &&
    state.returnFocus.offsetParent !== null
      ? state.returnFocus
      : ui.button;
  target?.focus();
}

function render() {
  const ui = elements();
  if (!ui.button) {
    return;
  }

  const unlocked = state.unlockedLevel >= REMIX_UNLOCK_LEVEL;
  ui.button.disabled = !unlocked;
  const label = ui.button.querySelector("span:last-child");
  if (label) {
    label.textContent = unlocked
      ? "Remix Flights"
      : `Remix opens after Level ${REMIX_REQUIRED_CAMPAIGN_LEVEL}`;
  }

  const summary = remixProgressSummary(state.progress);
  if (ui.summary) {
    ui.summary.textContent =
      `${summary.completedPuzzles}/${summary.totalPuzzles} remix puzzles · ` +
      `${summary.completedRoutes}/${summary.totalRoutes} routes · ` +
      `${summary.unlockedTrails}/${summary.totalTrails} trails`;
  }

  renderFlights();
  renderTrails();
  renderBadge();
}

function renderFlights() {
  const ui = elements();
  if (!ui.flights) {
    return;
  }
  ui.flights.replaceChildren();

  for (const flight of REMIX_FLIGHTS) {
    const section = document.createElement("section");
    section.className = "remix-flight";
    section.innerHTML = `
      <div class="remix-flight-heading">
        <span>Branching flight</span>
        <h3>${flight.name}</h3>
        <p>${flight.description}</p>
      </div>
      <div class="remix-route-grid"></div>
    `;
    const grid = section.querySelector(".remix-route-grid");

    for (const routeId of flight.branches) {
      const route = REMIX_ROUTES.find((item) => item.id === routeId);
      const completed = Boolean(
        state.progress?.completedRoutes?.includes(route.id)
      );
      const completedPuzzles = route.puzzleIds.filter((id) =>
        state.progress?.completedPuzzles?.includes(id)
      ).length;
      const modifierNames = route.modifierIds
        .map((id) => REMIX_MODIFIERS[id].name)
        .join(" · ");

      const card = document.createElement("article");
      card.className = "remix-route-card";
      card.classList.toggle("completed", completed);
      card.innerHTML = `
        <span class="remix-route-tone">${route.tone}</span>
        <h4>${route.name}</h4>
        <p>${route.description}</p>
        <small>${modifierNames}</small>
        <div class="remix-route-progress">
          ${completedPuzzles}/3 puzzles
          ${completed ? " · Route cleared" : ""}
        </div>
        <button
          class="primary-button remix-route-button"
          type="button"
        >
          ${completed ? "Replay route" : completedPuzzles ? "Continue route" : "Choose route"}
        </button>
      `;
      card
        .querySelector("button")
        .addEventListener("click", () => {
          const firstIncomplete = route.puzzleIds.findIndex(
            (id) =>
              !state.progress?.completedPuzzles?.includes(id)
          );
          close();
          globalThis.dispatchEvent(
            new CustomEvent("paperflock:start-remix", {
              detail: {
                routeId: route.id,
                puzzleIndex:
                  firstIncomplete === -1 ? 0 : firstIncomplete
              }
            })
          );
        });
      grid.append(card);
    }
    ui.flights.append(section);
  }
}

function renderTrails() {
  const ui = elements();
  if (!ui.trails) {
    return;
  }
  ui.trails.replaceChildren();
  const unlocked = new Set(
    state.progress?.unlockedTrails ?? ["plain"]
  );
  const selected = state.progress?.selectedTrail ?? "plain";

  for (const trail of REMIX_TRAILS) {
    const available = unlocked.has(trail.id);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "remix-trail-choice";
    button.disabled = !available;
    button.classList.toggle("selected", selected === trail.id);
    button.dataset.trail = trail.id;
    button.setAttribute(
      "aria-label",
      available
        ? `${trail.name}${selected === trail.id ? ", selected" : ""}`
        : `${trail.name}, locked`
    );
    button.innerHTML = `
      <span
        aria-hidden="true"
        class="remix-trail-preview remix-trail-${trail.id}"
      ></span>
      <span>
        <strong>${trail.name}</strong>
        <small>${
          available
            ? trail.description
            : `Complete ${
                REMIX_ROUTES.find(
                  (route) => route.rewardTrailId === trail.id
                )?.name ?? "a route"
              }`
        }</small>
      </span>
    `;
    if (available) {
      button.addEventListener("click", () => {
        globalThis.dispatchEvent(
          new CustomEvent("paperflock:remix-trail-selected", {
            detail: { trailId: trail.id }
          })
        );
      });
    }
    ui.trails.append(button);
  }
}

function renderBadge() {
  const ui = elements();
  if (!ui.badge) {
    return;
  }
  if (!state.active?.modifier) {
    ui.badge.hidden = true;
    ui.badge.replaceChildren();
    return;
  }

  const modifier = REMIX_MODIFIERS[state.active.modifier];
  const wind =
    state.active.modifier === "tailwind"
      ? `<span class="remix-wind-counter">${
          state.active.windMovesRemaining
        } move${
          state.active.windMovesRemaining === 1 ? "" : "s"
        } to wind</span>`
      : "";

  ui.badge.innerHTML = `
    <span aria-hidden="true" class="remix-modifier-symbol">${modifier.symbol}</span>
    <span>
      <strong>${modifier.name}</strong>
      <small>${modifier.summary}</small>
    </span>
    ${wind}
  `;
  ui.badge.hidden = false;
}

async function shareResult() {
  if (!state.lastResult) {
    return;
  }

  const result = state.lastResult;
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1080;
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  const gradient = context.createLinearGradient(0, 0, 1080, 1080);
  gradient.addColorStop(0, "#151a32");
  gradient.addColorStop(1, "#313968");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 1080, 1080);

  context.fillStyle = "rgba(255,255,255,.08)";
  context.beginPath();
  context.arc(870, 170, 250, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#fffaf0";
  context.font = "700 68px system-ui, sans-serif";
  context.fillText("PAPER FLOCK", 90, 140);

  context.fillStyle = "#ffd68f";
  context.font = "700 38px system-ui, sans-serif";
  context.fillText("REMIX FLIGHT", 92, 205);

  context.fillStyle = "#fffaf0";
  context.font = "700 82px system-ui, sans-serif";
  wrapText(context, result.routeName, 90, 350, 900, 96);

  context.fillStyle = "#dce4ff";
  context.font = "500 42px system-ui, sans-serif";
  wrapText(
    context,
    `${result.puzzlesCompleted} puzzles · ${result.totalFeathers}/9 feathers`,
    92,
    590,
    880,
    58
  );
  wrapText(
    context,
    `${result.totalMoves} moves · ${result.totalHints} hints · ${result.totalUndos} undos`,
    92,
    675,
    880,
    58
  );

  context.fillStyle = "#ffd68f";
  context.font = "700 46px system-ui, sans-serif";
  context.fillText(
    result.routeComplete
      ? "ROUTE CLEARED"
      : `PUZZLE ${result.puzzleNumber} CLEARED`,
    92,
    835
  );

  context.fillStyle = "#fffaf0";
  context.font = "500 34px system-ui, sans-serif";
  context.fillText("Find the path. Turn the flock.", 92, 955);

  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/png")
  );
  if (!blob) {
    return;
  }

  const filename =
    `paper-flock-${result.routeId}-result.png`;
  const file =
    typeof File === "function"
      ? new File(
          [blob],
          filename,
          { type: "image/png" }
        )
      : null;

  try {
    if (
      globalThis.PaperFlockAndroid?.shareImage
    ) {
      globalThis.PaperFlockAndroid.shareImage(
        filename,
        canvas.toDataURL("image/png")
      );
    } else if (
      file &&
      navigator.share &&
      navigator.canShare?.({ files: [file] })
    ) {
      await navigator.share({
        title: "Paper Flock Remix Flight",
        text: `${result.routeName}: ${result.totalFeathers}/9 feathers`,
        files: [file]
      });
    } else {
      downloadBlob(blob, filename);
    }

    globalThis.dispatchEvent(
      new CustomEvent("paperflock:diagnostic", {
        detail: {
          name: "remix_result_shared",
          data: {
            routeId: result.routeId,
            routeComplete: result.routeComplete
          }
        }
      })
    );
  } catch (error) {
    if (error?.name !== "AbortError") {
      downloadBlob(blob, filename);
    }
  }
}

function wrapText(context, text, x, y, maxWidth, lineHeight) {
  const words = String(text).split(/\s+/);
  let line = "";
  let offset = 0;
  for (const word of words) {
    const candidate = `${line}${line ? " " : ""}${word}`;
    if (
      line &&
      context.measureText(candidate).width > maxWidth
    ) {
      context.fillText(line, x, y + offset);
      line = word;
      offset += lineHeight;
    } else {
      line = candidate;
    }
  }
  if (line) {
    context.fillText(line, x, y + offset);
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
