import {
  DIRECTIONS,
  EMPTY
} from "./game-core.js";
import {
  STORAGE_KEYS
} from "./storage-player-core.js";
import {
  TUTORIAL_STEP_IDS,
  TUTORIAL_STEPS,
  advanceTutorialSession,
  applyTutorialAction,
  completeTutorialProgress,
  createTutorialSession,
  normalizeTutorialProgress,
  shouldLaunchTutorial,
  skipTutorialProgress,
  startTutorialProgress,
  tutorialHint
} from "./tutorial-core.js";

const BUILD_VERSION = "1.6.0";
const state = {
  progress: loadProgress(),
  session: createTutorialSession("welcome"),
  active: false,
  forced: false,
  replay: false,
  inputLocked: false,
  hint: null
};

injectTutorialInterface();
wireTutorialInterface();
installReplayButton();
initializeTutorial();

function loadProgress() {
  try {
    return normalizeTutorialProgress(
      JSON.parse(
        localStorage.getItem(STORAGE_KEYS.tutorial) || "{}"
      )
    );
  } catch {
    return normalizeTutorialProgress();
  }
}

function saveProgress() {
  localStorage.setItem(
    STORAGE_KEYS.tutorial,
    JSON.stringify(state.progress)
  );
}

function queryOptions() {
  return {
    force: false,
    bypass: false
  };
}

function initializeTutorial() {
  if (document.body.classList.contains("opening-active")) {
    globalThis.addEventListener(
      "paperflock:opening-finished",
      initializeTutorial,
      { once: true }
    );
    return;
  }

  const options = queryOptions();
  state.forced = options.force;

  const hasExistingSave =
    localStorage.getItem(STORAGE_KEYS.save) !== null ||
    localStorage.getItem(STORAGE_KEYS.saveBackup) !== null;

  if (
    shouldLaunchTutorial({
      progress: state.progress,
      hasExistingSave,
      force: options.force,
      bypass: options.bypass
    })
  ) {
    openTutorial({
      replay: options.force,
      resume:
        state.progress.status === "active" &&
        !options.force
    });
  }
}

function injectTutorialInterface() {
  document.body.insertAdjacentHTML(
    "beforeend",
    `
      <div
        class="first-launch-tutorial"
        id="first-launch-tutorial"
        hidden
      >
        <section
          class="tutorial-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tutorial-title"
          aria-describedby="tutorial-instruction"
        >
          <header class="tutorial-header">
            <div>
              <span class="tutorial-kicker">
                Paper Flock v${BUILD_VERSION}
              </span>
              <h2 id="tutorial-title">
                Welcome to Paper Flock
              </h2>
            </div>
            <button
              class="tutorial-skip"
              id="tutorial-skip-button"
              type="button"
            >
              Skip tutorial
            </button>
          </header>

          <div
            class="tutorial-progress"
            id="tutorial-progress"
            aria-label="Tutorial progress"
          ></div>

          <p
            class="tutorial-instruction"
            id="tutorial-instruction"
          ></p>

          <div
            class="tutorial-board-wrap"
            id="tutorial-board-wrap"
            hidden
          >
            <div
              class="tutorial-board"
              id="tutorial-board"
              role="group"
              aria-label="Tutorial origami bird grid"
              aria-describedby="tutorial-instruction tutorial-feedback"
            ></div>
          </div>

          <div
            class="tutorial-welcome-art"
            id="tutorial-welcome-art"
            aria-hidden="true"
          >
            <svg viewBox="0 0 180 116">
              <path
                d="M14 73 66 45 87 9 105 47 165 27 129 79 88 105 50 80Z"
              ></path>
              <path
                d="M66 45 105 47 88 105M50 80 87 9 129 79"
              ></path>
            </svg>
          </div>

          <p
            class="tutorial-feedback"
            id="tutorial-feedback"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          ></p>

          <div class="tutorial-actions">
            <button
              class="secondary-button"
              id="tutorial-hint-button"
              type="button"
              hidden
            >
              Show next bird
            </button>
            <button
              class="secondary-button"
              id="tutorial-restart-button"
              type="button"
              hidden
            >
              Restart practice
            </button>
            <button
              class="primary-button"
              id="tutorial-continue-button"
              type="button"
            >
              Start tutorial
            </button>
          </div>

          <p class="tutorial-note">
            No score, feathers, or campaign progress is changed here.
          </p>
        </section>
      </div>
    `
  );
}

function installReplayButton() {
  const nav = document.querySelector(".app-footer nav");
  if (!nav || document.querySelector("#tutorial-replay-button")) {
    return;
  }

  const button = document.createElement("button");
  button.id = "tutorial-replay-button";
  button.type = "button";
  button.textContent = "How to play";
  button.addEventListener("click", () => {
    openTutorial({ replay: true });
  });

  nav.append(button);
}

function elements() {
  return {
    overlay: document.querySelector("#first-launch-tutorial"),
    panel: document.querySelector(".tutorial-panel"),
    title: document.querySelector("#tutorial-title"),
    instruction: document.querySelector("#tutorial-instruction"),
    progress: document.querySelector("#tutorial-progress"),
    boardWrap: document.querySelector("#tutorial-board-wrap"),
    board: document.querySelector("#tutorial-board"),
    welcomeArt: document.querySelector("#tutorial-welcome-art"),
    feedback: document.querySelector("#tutorial-feedback"),
    skip: document.querySelector("#tutorial-skip-button"),
    hint: document.querySelector("#tutorial-hint-button"),
    restart: document.querySelector("#tutorial-restart-button"),
    continueButton: document.querySelector(
      "#tutorial-continue-button"
    )
  };
}

function wireTutorialInterface() {
  const el = elements();

  el.skip?.addEventListener("click", skipTutorial);
  el.hint?.addEventListener("click", showHint);
  el.restart?.addEventListener("click", restartPractice);
  el.continueButton?.addEventListener(
    "click",
    continueTutorial
  );
  el.board?.addEventListener(
    "keydown",
    handleBoardKeydown
  );

  globalThis.addEventListener(
    "paperflock:tutorial-reset",
    () => {
      state.progress = normalizeTutorialProgress();
      openTutorial({ replay: false });
    }
  );
}

function openTutorial({
  replay = false,
  resume = false
} = {}) {
  state.replay = replay;
  state.progress = startTutorialProgress(
    state.progress,
    {
      replay,
      startedAt: new Date().toISOString()
    }
  );

  const stepId =
    resume &&
    TUTORIAL_STEP_IDS.includes(state.progress.lastStepId)
      ? state.progress.lastStepId
      : "welcome";

  state.session = createTutorialSession(stepId);
  state.progress.lastStepId = stepId;
  state.hint = null;
  state.active = true;
  state.inputLocked = false;
  saveProgress();

  document.body.classList.add("tutorial-active");
  elements().overlay.hidden = false;
  renderTutorial();

  requestAnimationFrame(() => {
    elements().continueButton.focus({
      preventScroll: true
    });
  });
}

function closeTutorial() {
  state.active = false;
  state.inputLocked = false;
  document.body.classList.remove("tutorial-active");
  elements().overlay.hidden = true;
  globalThis.dispatchEvent(new Event("resize"));

  const board = document.querySelector("#board");
  requestAnimationFrame(() =>
    board?.focus({ preventScroll: true })
  );
}

function skipTutorial() {
  state.progress = skipTutorialProgress(state.progress);
  saveProgress();
  closeTutorial();

  globalThis.dispatchEvent(
    new CustomEvent("paperflock:tutorial-finished", {
      detail: {
        status: state.progress.status,
        replay: state.replay
      }
    })
  );
}

function continueTutorial() {
  const stepId = state.session.stepId;

  if (stepId === "welcome") {
    moveToNextStep();
    return;
  }

  if (!state.session.stepComplete) {
    elements().feedback.textContent =
      "Complete the highlighted lesson before continuing.";
    elements().board
      .querySelector(".tutorial-target:not(:disabled)")
      ?.focus();
    return;
  }

  if (stepId === "practice") {
    finishTutorial();
    return;
  }

  moveToNextStep();
}

function moveToNextStep() {
  const next = advanceTutorialSession(state.session);
  if (!next) {
    finishTutorial();
    return;
  }

  state.session = next;
  state.progress.lastStepId = next.stepId;
  state.hint = tutorialHint(next);
  saveProgress();
  renderTutorial();

  requestAnimationFrame(() => {
    elements().board
      .querySelector(".tutorial-target:not(:disabled)")
      ?.focus({ preventScroll: true });
  });
}

function finishTutorial() {
  state.progress = completeTutorialProgress(state.progress);
  saveProgress();
  closeTutorial();

  globalThis.dispatchEvent(
    new CustomEvent("paperflock:tutorial-finished", {
      detail: {
        status: "completed",
        replay: state.replay,
        moves: state.session.moves
      }
    })
  );
}

function restartPractice() {
  if (state.session.stepId !== "practice") {
    return;
  }

  state.session = createTutorialSession("practice");
  state.hint = tutorialHint(state.session);
  renderTutorial();
  elements().feedback.textContent =
    "Practice restarted. Try a different order.";
}

function showHint() {
  state.hint = tutorialHint(state.session);
  renderBoard();

  if (state.hint) {
    elements().feedback.textContent =
      "The glowing bird is a verified safe move.";
    elements().board
      .querySelector(
        `[data-row="${state.hint.row}"][data-col="${state.hint.col}"]`
      )
      ?.focus();
  }
}

function renderTutorial() {
  const el = elements();
  const step = TUTORIAL_STEPS[state.session.stepId];

  el.title.textContent = step.title;
  el.instruction.textContent = step.instruction;
  el.feedback.textContent = state.session.feedback;
  el.welcomeArt.hidden = step.id !== "welcome";
  el.boardWrap.hidden = step.id === "welcome";
  el.skip.textContent = state.replay
    ? "Close tutorial"
    : "Skip tutorial";

  renderProgress();

  if (step.id !== "welcome") {
    if (!state.hint) {
      state.hint = tutorialHint(state.session);
    }
    renderBoard();
  } else {
    el.board.replaceChildren();
  }

  el.hint.hidden =
    !["practice"].includes(step.id) ||
    state.session.stepComplete;
  el.restart.hidden =
    step.id !== "practice" ||
    (!state.session.deadlocked && state.session.moves === 0);

  el.continueButton.disabled =
    step.id !== "welcome" &&
    !state.session.stepComplete;
  el.continueButton.textContent =
    step.id === "welcome"
      ? "Start tutorial"
      : step.id === "practice"
        ? state.session.stepComplete
          ? "Start journey"
          : "Complete practice"
        : "Continue";
}

function renderProgress() {
  const container = elements().progress;
  container.replaceChildren();

  TUTORIAL_STEP_IDS.forEach((id, index) => {
    const step = document.createElement("span");
    const active = id === state.session.stepId;
    const currentIndex = TUTORIAL_STEP_IDS.indexOf(
      state.session.stepId
    );
    step.className = "tutorial-progress-step";
    step.classList.toggle("active", active);
    step.classList.toggle("complete", index < currentIndex);
    step.setAttribute(
      "aria-label",
      `Tutorial step ${index + 1} of ${TUTORIAL_STEP_IDS.length}` +
        (active ? ", current" : "")
    );
    container.append(step);
  });
}

function birdMarkup(direction) {
  return `
    <span
      class="bird-rotation"
      style="--bird-angle:${DIRECTIONS[direction].angle}deg"
    >
      <span class="direction-marker" aria-hidden="true">▲</span>
      <svg class="bird" viewBox="-8 -10 116 120" aria-hidden="true">
        <path class="bird-beak" d="M50 -7 L40 13 L60 13 Z"></path>
        <path class="bird-wing bird-wing-left" d="M48 45 L12 21 L27 60 Z"></path>
        <path class="bird-wing bird-wing-right" d="M52 45 L88 21 L73 60 Z"></path>
        <path class="bird-body" d="M50 8 L69 52 L50 88 L31 52 Z"></path>
        <path class="bird-highlight" d="M50 9 L59 48 L50 39 L41 48 Z"></path>
        <path class="bird-fold" d="M50 8 L50 88 M31 52 L69 52"></path>
        <path class="bird-heading" d="M43 23 L50 15 L57 23"></path>
        <circle class="bird-eye" cx="43" cy="31" r="2.6"></circle>
        <circle class="bird-eye" cx="57" cy="31" r="2.6"></circle>
      </svg>
    </span>
  `;
}

function renderBoard() {
  const el = elements();
  const board = state.session.board;

  el.board.replaceChildren();
  el.board.style.setProperty(
    "--board-size",
    String(board.length)
  );

  const traced = new Set(
    state.session.lastTrace?.cells?.map(
      (cell) => `${cell.row}:${cell.col}`
    ) ?? []
  );
  const blocker = state.session.lastTrace?.blocker;
  const target = TUTORIAL_STEPS[state.session.stepId].target;

  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board.length; col += 1) {
      const direction = board[row][col];
      const button = document.createElement("button");
      button.type = "button";
      button.className = "tutorial-cell";
      button.dataset.row = String(row);
      button.dataset.col = String(col);

      if (direction === EMPTY) {
        button.disabled = true;
        button.classList.add("empty");
        button.setAttribute("aria-label", "Empty paper tile");
      } else {
        button.innerHTML = birdMarkup(direction);
        button.setAttribute(
          "aria-label",
          `Row ${row + 1}, column ${col + 1}. Bird facing ${DIRECTIONS[direction].name}.`
        );
        button.addEventListener(
          "click",
          () => handleTutorialCell(row, col, button)
        );
      }

      if (
        target &&
        row === target.row &&
        col === target.col &&
        !state.session.stepComplete
      ) {
        button.classList.add("tutorial-target");
      }

      if (
        state.hint &&
        row === state.hint.row &&
        col === state.hint.col &&
        !state.session.stepComplete
      ) {
        button.classList.add("tutorial-hint");
      }

      if (traced.has(`${row}:${col}`)) {
        button.classList.add("tutorial-path");
      }
      if (
        blocker &&
        blocker.row === row &&
        blocker.col === col
      ) {
        button.classList.add("tutorial-blocker");
      }

      el.board.append(button);
    }
  }
}

async function handleTutorialCell(row, col, button) {
  if (state.inputLocked || button.disabled) {
    return;
  }

  state.inputLocked = true;
  state.hint = null;
  button.classList.add("tutorial-tap");

  const previousBoard = state.session.board
    ? state.session.board.map((line) => [...line])
    : null;
  const next = applyTutorialAction(
    state.session,
    row,
    col
  );
  state.session = next;

  if (next.accepted && next.board && previousBoard) {
    button.classList.add("tutorial-flight");
    await delay(220);
  } else {
    await delay(90);
  }

  renderTutorial();
  state.inputLocked = false;

  if (state.session.stepComplete) {
    elements().continueButton.focus({
      preventScroll: true
    });
  }
}

function handleBoardKeydown(event) {
  if (
    ![
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "Home",
      "End"
    ].includes(event.key)
  ) {
    return;
  }

  const buttons = [
    ...elements().board.querySelectorAll(
      ".tutorial-cell:not(:disabled)"
    )
  ];
  if (buttons.length === 0) {
    return;
  }

  const current =
    event.target.closest(".tutorial-cell:not(:disabled)") ??
    buttons[0];
  let index = buttons.indexOf(current);

  if (event.key === "Home") {
    index = 0;
  } else if (event.key === "End") {
    index = buttons.length - 1;
  } else {
    const currentRow = Number(current.dataset.row);
    const currentCol = Number(current.dataset.col);
    const delta = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1]
    }[event.key];
    const candidates = buttons
      .map((candidate) => ({
        candidate,
        row: Number(candidate.dataset.row),
        col: Number(candidate.dataset.col)
      }))
      .filter((item) =>
        delta[0] === 0
          ? item.row === currentRow &&
            (delta[1] < 0
              ? item.col < currentCol
              : item.col > currentCol)
          : item.col === currentCol &&
            (delta[0] < 0
              ? item.row < currentRow
              : item.row > currentRow)
      )
      .sort((left, right) => {
        const leftDistance =
          Math.abs(left.row - currentRow) +
          Math.abs(left.col - currentCol);
        const rightDistance =
          Math.abs(right.row - currentRow) +
          Math.abs(right.col - currentCol);
        return leftDistance - rightDistance;
      });

    if (candidates[0]) {
      index = buttons.indexOf(candidates[0].candidate);
    }
  }

  event.preventDefault();
  buttons[index]?.focus();
}

function delay(duration) {
  return new Promise((resolve) =>
    globalThis.setTimeout(resolve, duration)
  );
}
