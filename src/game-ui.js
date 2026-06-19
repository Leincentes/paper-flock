import {
  EMPTY,
  DIRECTIONS,
  applyMove,
  boardStatus,
  cloneBoard,
  countBirds,
  createDailyLevel,
  createLevel,
  findSolution,
  getLegalMoves,
  tracePath
} from "./game-core.js";
import {
  aggregateSessions,
  appendSessionEvent,
  completeResearchSession,
  createResearchSession,
  isValidParticipantCode,
  normalizeParticipantCode,
  sessionsToCsv
} from "./research-core.js";
import {
  isDailyUnlocked,
  localDateKey
} from "./progress-core.js";
import {
  DEFAULT_ONBOARDING,
  adaptivePuzzleInstruction,
  effectsLabel,
  feedbackMessage,
  hapticPattern,
  nextEffectsPreference,
  normalizeEffectsPreference,
  normalizeOnboarding,
  recordOnboardingEvent,
  resolveEffectsMode
} from "./experience-core.js";
import {
  THEMES,
  calculateFeathers,
  currentFeatherPotential,
  featherText,
  isThemeUnlocked,
  nextThemeUnlock,
  normalizeFeatherMap,
  totalFeathers,
  trimFeatherRecords,
  unlockedThemes,
  updateFeatherRecord
} from "./mastery-core.js";
import {
  LEGACY_STORAGE_KEYS,
  STORAGE_KEYS,
  loadRecoverableJson,
  migrateLegacyStorage,
  normalizeCheckpoint,
  writeRecoverableJson
} from "./storage-core.js";

const BUILD_VERSION = "0.21";
const STORAGE_KEY = STORAGE_KEYS.save;
const EVENT_KEY = STORAGE_KEYS.events;
const RESEARCH_KEY = STORAGE_KEYS.research;
const MAX_LEVEL = 20;

const storageMigration = migrateLegacyStorage(localStorage);

const elements = {
  board: document.querySelector("#board"),
  level: document.querySelector("#level-number"),
  modeLabel: document.querySelector("#mode-label"),
  best: document.querySelector("#best-feathers"),
  feathers: document.querySelector("#feather-count"),
  chapter: document.querySelector("#chapter-name"),
  journeyProgress: document.querySelector("#journey-progress"),
  journeyFill: document.querySelector("#journey-progress-fill"),
  journeyRail: document.querySelector(".journey-rail"),
  remaining: document.querySelector("#remaining-count"),
  lesson: document.querySelector("#lesson-label"),
  message: document.querySelector("#message"),
  undo: document.querySelector("#undo-button"),
  restart: document.querySelector("#restart-button"),
  hint: document.querySelector("#hint-button"),
  previous: document.querySelector("#previous-button"),
  next: document.querySelector("#next-button"),
  sound: document.querySelector("#sound-button"),
  effects: document.querySelector("#effects-button"),
  openMap: document.querySelector("#open-map-button"),
  daily: document.querySelector("#daily-button"),
  dailyInfo: document.querySelector("#daily-info"),
  dailyConfirm: document.querySelector("#daily-confirm-button"),
  dailyDecline: document.querySelector("#daily-decline-button"),
  levelMap: document.querySelector("#level-map"),
  levelGrid: document.querySelector("#level-grid"),
  themePicker: document.querySelector("#theme-picker"),
  closeMap: document.querySelector("#close-map-button"),
  closeMapBottom: document.querySelector("#close-map-bottom-button"),
  replay: document.querySelector("#replay-button"),
  researchWelcome: document.querySelector("#research-welcome"),
  startResearch: document.querySelector("#start-research-button"),
  normalPlay: document.querySelector("#normal-play-button"),
  participantCode: document.querySelector("#participant-code"),
  participantSegment: document.querySelector("#participant-segment"),
  participantConsent: document.querySelector("#participant-consent"),
  consentError: document.querySelector("#consent-error"),
  researchRibbon: document.querySelector("#research-ribbon"),
  researchCode: document.querySelector("#research-code-label"),
  endResearch: document.querySelector("#end-research-button"),
  survey: document.querySelector("#research-survey"),
  surveyForm: document.querySelector("#research-survey-form"),
  surveyError: document.querySelector("#survey-error"),
  sessionComplete: document.querySelector("#session-complete"),
  sessionCompleteSummary: document.querySelector("#session-complete-summary"),
  downloadSession: document.querySelector("#download-session-button"),
  nextParticipant: document.querySelector("#next-participant-button"),
  exportResearchJson: document.querySelector("#export-research-json-button"),
  exportResearchCsv: document.querySelector("#export-research-csv-button"),
  researchAggregate: document.querySelector("#research-aggregate"),
  launchResearch: document.querySelector("#launch-research-button"),
  exportLog: document.querySelector("#export-log-button"),
  resetProgress: document.querySelector("#reset-progress-button"),
  completion: document.querySelector("#completion"),
  completionTitle: document.querySelector("#completion-title"),
  completionBody: document.querySelector("#completion-body"),
  completionFeathers: document.querySelector("#completion-feathers"),
  completionUnlock: document.querySelector("#completion-unlock"),
  continue: document.querySelector("#continue-button")
};

const state = {
  mode: "campaign",
  currentLevel: 1,
  dailyDateKey: null,
  unlockedLevel: 1,
  completedLevels: [],
  bestFeathers: {},
  dailyFeathers: {},
  selectedTheme: "dawn",
  pendingThemeUnlock: null,
  pendingCheckpoint: null,
  puzzleCompleted: false,
  boardRevealPending: true,
  board: [],
  initialBoard: [],
  levelMeta: null,
  history: [],
  moves: 0,
  soundEnabled: false,
  effectsPreference: "auto",
  resolvedEffects: "full",
  onboarding: normalizeOnboarding(DEFAULT_ONBOARDING),
  pathFeedbackTimer: null,
  inputLocked: false,
  hintedCell: null,
  deadlocked: false,
  hintsUsed: 0,
  restarts: 0,
  deadlocks: 0,
  undosUsed: 0,
  dailyUnlockLogged: false,
  researchActive: false,
  researchSessionId: null,
  researchArchive: { schemaVersion: 1, sessions: [] },
  sessionId: createSessionId(),
  sessionStartedAt: Date.now()
};

function createSessionId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}


function normalizeSavePayload(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const currentLevel = clamp(value.currentLevel ?? 1, 1, MAX_LEVEL);
  const unlockedLevel = clamp(value.unlockedLevel ?? 1, 1, MAX_LEVEL);
  const completedLevels = Array.isArray(value.completedLevels)
    ? value.completedLevels
        .filter(
          (level) =>
            Number.isInteger(level) &&
            level >= 1 &&
            level <= MAX_LEVEL
        )
    : [];

  return {
    saveVersion: 10,
    buildVersion: String(value.buildVersion ?? ""),
    currentLevel,
    unlockedLevel,
    completedLevels,
    bestFeathers: normalizeFeatherMap(value.bestFeathers),
    dailyFeathers: trimFeatherRecords(value.dailyFeathers),
    selectedTheme: String(value.selectedTheme ?? "dawn"),
    soundEnabled: Boolean(value.soundEnabled),
    effectsPreference: normalizeEffectsPreference(
      value.effectsPreference
    ),
    onboarding: normalizeOnboarding(value.onboarding),
    checkpoint: value.checkpoint ?? null
  };
}

function loadSave() {
  const result = loadRecoverableJson(localStorage, {
    primaryKey: STORAGE_KEYS.save,
    backupKey: STORAGE_KEYS.saveBackup,
    legacyKeys: LEGACY_STORAGE_KEYS.save,
    defaultValue: normalizeSavePayload({}),
    normalize: normalizeSavePayload
  });
  const parsed = result.value ?? normalizeSavePayload({});

  state.currentLevel = clamp(parsed.currentLevel ?? 1, 1, MAX_LEVEL);
  state.unlockedLevel = clamp(parsed.unlockedLevel ?? 1, 1, MAX_LEVEL);
  state.completedLevels = Array.isArray(parsed.completedLevels)
    ? parsed.completedLevels.filter(Number.isInteger)
    : [];
  state.bestFeathers = normalizeFeatherMap(parsed.bestFeathers);
  state.dailyFeathers = trimFeatherRecords(parsed.dailyFeathers);
  state.selectedTheme = isThemeUnlocked(
    parsed.selectedTheme,
    state.completedLevels
  )
    ? parsed.selectedTheme
    : "dawn";
  state.soundEnabled = Boolean(parsed.soundEnabled);
  state.effectsPreference = normalizeEffectsPreference(
    parsed.effectsPreference
  );
  state.onboarding = normalizeOnboarding(parsed.onboarding);
  state.pendingCheckpoint = normalizeCheckpoint(
    parsed.checkpoint,
    {
      todayKey: localDateKey(),
      maximumLevel: MAX_LEVEL,
      unlockedLevel: state.unlockedLevel
    }
  );

  applyTheme(state.selectedTheme);
  applyEffectsMode();

  return result;
}

function createCheckpoint() {
  if (
    state.puzzleCompleted ||
    !Array.isArray(state.board) ||
    state.board.length === 0 ||
    countBirds(state.board) === 0
  ) {
    return null;
  }

  return {
    checkpointVersion: 1,
    savedAt: new Date().toISOString(),
    mode: state.mode,
    currentLevel: state.currentLevel,
    dailyDateKey: state.dailyDateKey,
    board: cloneBoard(state.board),
    initialBoard: cloneBoard(state.initialBoard),
    history: state.history.slice(-100).map((item) => ({
      board: cloneBoard(item.board),
      moves: item.moves,
      deadlocked: Boolean(item.deadlocked)
    })),
    moves: state.moves,
    hintedCell: state.hintedCell
      ? {
          row: state.hintedCell.row,
          col: state.hintedCell.col
        }
      : null,
    deadlocked: state.deadlocked,
    hintsUsed: state.hintsUsed,
    restarts: state.restarts,
    deadlocks: state.deadlocks,
    undosUsed: state.undosUsed
  };
}

function saveProgress() {
  const payload = {
    saveVersion: 10,
    buildVersion: BUILD_VERSION,
    currentLevel: state.currentLevel,
    unlockedLevel: state.unlockedLevel,
    completedLevels: [...new Set(state.completedLevels)].sort(
      (a, b) => a - b
    ),
    bestFeathers: normalizeFeatherMap(state.bestFeathers),
    dailyFeathers: trimFeatherRecords(state.dailyFeathers),
    selectedTheme: state.selectedTheme,
    soundEnabled: state.soundEnabled,
    effectsPreference: state.effectsPreference,
    onboarding: normalizeOnboarding(state.onboarding),
    checkpoint: createCheckpoint()
  };

  writeRecoverableJson(localStorage, payload, {
    primaryKey: STORAGE_KEYS.save,
    backupKey: STORAGE_KEYS.saveBackup
  });
}


function loadResearchArchive() {
  try {
    const parsed = JSON.parse(localStorage.getItem(RESEARCH_KEY) || "{}");
    state.researchArchive = {
      schemaVersion: 1,
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : []
    };

    const active = [...state.researchArchive.sessions]
      .reverse()
      .find((session) => session.status === "active");
    if (active) {
      state.researchActive = true;
      state.researchSessionId = active.sessionId;
      elements.researchRibbon.hidden = false;
      elements.researchCode.textContent = active.participantCode;
    }
  } catch {
    localStorage.removeItem(RESEARCH_KEY);
    state.researchArchive = { schemaVersion: 1, sessions: [] };
  }
  updateResearchAggregate();
}

function saveResearchArchive() {
  localStorage.setItem(RESEARCH_KEY, JSON.stringify(state.researchArchive));
  updateResearchAggregate();
}

function currentResearchSessionIndex() {
  return state.researchArchive.sessions.findIndex(
    (session) => session.sessionId === state.researchSessionId
  );
}

function updateResearchAggregate() {
  if (!elements.researchAggregate) {
    return;
  }
  const aggregate = aggregateSessions(state.researchArchive.sessions);
  const completed = aggregate.completedSessions;
  elements.researchAggregate.textContent =
    completed === 0
      ? "No completed research sessions saved."
      : `${completed} completed session${completed === 1 ? "" : "s"} saved locally.`;
}

function appendResearchEvent(event) {
  if (!state.researchActive) {
    return;
  }
  const index = currentResearchSessionIndex();
  if (index < 0) {
    return;
  }
  state.researchArchive.sessions[index] = appendSessionEvent(
    state.researchArchive.sessions[index],
    event
  );
  saveResearchArchive();
}

function logEvent(name, data = {}) {
  const event = {
    name,
    buildVersion: BUILD_VERSION,
    occurredAt: new Date().toISOString(),
    sessionId: state.sessionId,
    mode: state.mode,
    puzzleId:
      state.mode === "daily" ? state.dailyDateKey : `level-${state.currentLevel}`,
    level: state.mode === "campaign" ? state.currentLevel : null,
    elapsedMs: Date.now() - state.sessionStartedAt,
    ...data
  };

  appendResearchEvent(event);
  globalThis.dispatchEvent(
    new CustomEvent("paperflock:event", {
      detail: JSON.parse(JSON.stringify(event))
    })
  );

  try {
    const events = JSON.parse(localStorage.getItem(EVENT_KEY) || "[]");
    events.push(event);
    localStorage.setItem(EVENT_KEY, JSON.stringify(events.slice(-750)));
  } catch {
    localStorage.setItem(EVENT_KEY, JSON.stringify([event]));
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}



function deviceCapabilities() {
  return {
    reducedMotion: prefersReducedMotion(),
    deviceMemory: Number.isFinite(navigator.deviceMemory)
      ? navigator.deviceMemory
      : null,
    hardwareConcurrency: Number.isFinite(navigator.hardwareConcurrency)
      ? navigator.hardwareConcurrency
      : null,
    saveData: Boolean(navigator.connection?.saveData)
  };
}

function applyEffectsMode() {
  state.resolvedEffects = resolveEffectsMode({
    preference: state.effectsPreference,
    ...deviceCapabilities()
  });
  document.documentElement.dataset.effects = state.resolvedEffects;
  document.documentElement.dataset.effectsPreference =
    state.effectsPreference;
}

function cycleEffectsMode() {
  state.effectsPreference = nextEffectsPreference(
    state.effectsPreference
  );
  applyEffectsMode();
  saveProgress();
  updateHud();
  logEvent("effects_preference_changed", {
    preference: state.effectsPreference,
    resolved: state.resolvedEffects,
    ...deviceCapabilities()
  });
}

function updateOnboarding(eventName, data = {}) {
  state.onboarding = recordOnboardingEvent(
    state.onboarding,
    eventName,
    data
  );
  saveProgress();
}

function effectsAreMinimal() {
  return state.resolvedEffects === "minimal";
}

function applyTheme(themeId) {
  const selected = THEMES.find((theme) => theme.id === themeId) ?? THEMES[0];
  document.documentElement.classList.add("theme-transitioning");
  document.documentElement.dataset.theme = selected.id;
  state.selectedTheme = selected.id;
  globalThis.setTimeout(
    () => document.documentElement.classList.remove("theme-transitioning"),
    prefersReducedMotion() ? 0 : 420
  );
}

function chapterForLevel(levelNumber) {
  if (levelNumber <= 5) return "Dawn Flight";
  if (levelNumber <= 10) return "Meadow Crossing";
  if (levelNumber <= 15) return "Twilight Fold";
  return "Lantern Sky";
}

function currentRecord() {
  if (state.mode === "daily") {
    return state.dailyFeathers[state.dailyDateKey] ?? 0;
  }
  return state.bestFeathers[String(state.currentLevel)] ?? 0;
}

function renderThemePicker() {
  elements.themePicker.replaceChildren();
  const available = unlockedThemes(state.completedLevels);

  for (const theme of THEMES) {
    const unlocked = available.some((item) => item.id === theme.id);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "theme-chip";
    button.dataset.themeChoice = theme.id;
    button.disabled = !unlocked;
    button.classList.toggle("selected", state.selectedTheme === theme.id);
    button.setAttribute(
      "aria-label",
      unlocked
        ? `${theme.name}${state.selectedTheme === theme.id ? ", selected" : ""}`
        : `${theme.name}, locked until ${theme.requirement} campaign levels are complete`
    );
    button.innerHTML = `
      <span class="theme-swatch theme-swatch-${theme.id}" aria-hidden="true"></span>
      <span>
        <strong>${theme.name}</strong>
        <small>${unlocked ? theme.description : `Unlock after ${theme.requirement} levels`}</small>
      </span>
    `;

    if (unlocked) {
      button.addEventListener("click", () => {
        applyTheme(theme.id);
        saveProgress();
        renderThemePicker();
        logEvent("theme_selected", { themeId: theme.id });
      });
    }
    elements.themePicker.append(button);
  }
}

function currentBest() {
  return currentRecord();
}


function restoreCheckpoint(checkpoint) {
  const normalized = normalizeCheckpoint(checkpoint, {
    todayKey: localDateKey(),
    maximumLevel: MAX_LEVEL,
    unlockedLevel: state.unlockedLevel
  });

  if (!normalized) {
    return false;
  }

  clearPathFeedback();
  state.mode = normalized.mode;
  state.currentLevel = normalized.currentLevel;
  state.dailyDateKey = normalized.dailyDateKey;
  state.levelMeta =
    normalized.mode === "daily"
      ? createDailyLevel(normalized.dailyDateKey)
      : createLevel(normalized.currentLevel);
  state.board = cloneBoard(normalized.board);
  state.initialBoard = cloneBoard(normalized.initialBoard);
  state.history = normalized.history.map((item) => ({
    board: cloneBoard(item.board),
    moves: item.moves,
    deadlocked: item.deadlocked
  }));
  state.moves = normalized.moves;
  state.hintedCell = normalized.hintedCell;
  state.deadlocked = normalized.deadlocked;
  state.hintsUsed = normalized.hintsUsed;
  state.restarts = normalized.restarts;
  state.deadlocks = normalized.deadlocks;
  state.undosUsed = normalized.undosUsed;
  state.pendingThemeUnlock = null;
  state.boardRevealPending = false;
  state.inputLocked = false;
  state.puzzleCompleted = false;

  elements.completion.hidden = true;
  elements.completion.classList.remove("completion-visible");
  elements.levelMap.hidden = true;
  elements.undo.classList.toggle(
    "attention",
    state.deadlocked && state.history.length > 0
  );

  renderBoard();
  renderLevelMap();
  renderThemePicker();
  updateHud();
  elements.lesson.textContent = state.levelMeta.title;
  setMessage(
    state.mode === "daily"
      ? "Today’s flock resumed where you left it."
      : `Level ${state.currentLevel} resumed where you left it.`
  );
  logEvent("puzzle_resumed", {
    checkpointSavedAt: normalized.savedAt,
    moves: state.moves,
    remainingBirds: countBirds(state.board),
    mode: state.mode
  });

  return true;
}

function beginPuzzle(level, reason) {
  clearPathFeedback();
  state.levelMeta = level;
  state.board = cloneBoard(level.board);
  state.initialBoard = cloneBoard(level.board);
  state.history = [];
  state.moves = 0;
  state.hintedCell = null;
  state.deadlocked = false;
  state.hintsUsed = 0;
  state.restarts = 0;
  state.deadlocks = 0;
  state.undosUsed = 0;
  state.pendingThemeUnlock = null;
  state.puzzleCompleted = false;
  state.boardRevealPending = true;
  state.inputLocked = false;
  elements.completion.hidden = true;
  elements.completion.classList.remove("completion-visible");
  elements.levelMap.hidden = true;
  elements.undo.classList.remove("attention");

  saveProgress();
  logEvent("puzzle_start", {
    reason,
    title: level.title,
    tutorial: level.tutorial,
    difficulty: level.difficulty,
    boardSize: level.size,
    birdCount: level.targetBirds,
    generatedSeed: level.seed
  });
  renderBoard();
  renderLevelMap();
  renderThemePicker();
  updateHud();
  elements.lesson.textContent = level.title;
  setMessage(
    adaptivePuzzleInstruction({
      onboarding: state.onboarding,
      levelInstruction: level.instruction,
      levelNumber: state.currentLevel,
      mode: state.mode
    })
  );
}

function startLevel(levelNumber, reason = "navigation") {
  state.mode = "campaign";
  state.dailyDateKey = null;
  state.currentLevel = clamp(levelNumber, 1, state.unlockedLevel);
  beginPuzzle(createLevel(state.currentLevel), reason);
}

function startDaily(reason = "daily_button") {
  if (!isDailyUnlocked(state.unlockedLevel)) {
    setMessage("Complete Level 5 to unlock the optional Daily Flock.");
    return;
  }

  state.mode = "daily";
  state.dailyDateKey = localDateKey();
  logEvent("daily_started", { reason, dateKey: state.dailyDateKey });
  elements.dailyInfo.hidden = true;
  beginPuzzle(createDailyLevel(state.dailyDateKey), reason);
}

function openDailyInvitation() {
  if (!isDailyUnlocked(state.unlockedLevel)) {
    setMessage("Complete Level 5 to unlock the optional Daily Flock.");
    return;
  }
  logEvent("daily_invitation_opened");
  elements.dailyInfo.hidden = false;
  elements.dailyConfirm.focus();
}

function closeDailyInvitation({ declined = false } = {}) {
  elements.dailyInfo.hidden = true;
  if (declined) {
    logEvent("daily_declined");
  }
  elements.daily.focus();
}

function renderLevelMap() {
  elements.levelGrid.replaceChildren();

  for (let levelNumber = 1; levelNumber <= MAX_LEVEL; levelNumber += 1) {
    const button = document.createElement("button");
    const unlocked = levelNumber <= state.unlockedLevel;
    const completed = state.completedLevels.includes(levelNumber);
    const feathers = state.bestFeathers[String(levelNumber)] ?? 0;

    button.type = "button";
    button.className = "level-tile";
    button.disabled = !unlocked;
    button.setAttribute(
      "aria-label",
      unlocked
        ? `Level ${levelNumber}${completed ? ", completed" : ""}${feathers ? `, ${feathers} of 3 feathers` : ""}`
        : `Level ${levelNumber}, locked`
    );

    if (completed) {
      button.classList.add("completed");
    }
    if (state.mode === "campaign" && state.currentLevel === levelNumber) {
      button.classList.add("current");
    }

    button.innerHTML = `
      <strong>${levelNumber}</strong>
      <span class="tile-feathers" aria-hidden="true">${featherText(feathers)}</span>
      <small>${!unlocked ? "Locked" : completed ? "Cleared" : "Open"}</small>
    `;

    if (unlocked) {
      button.addEventListener("click", () => {
        logEvent("map_level_selected", {
          selectedLevel: levelNumber,
          replaySelection: state.completedLevels.includes(levelNumber)
        });
        startLevel(
          levelNumber,
          state.completedLevels.includes(levelNumber)
            ? "map_replay"
            : "level_map"
        );
      });
    }
    elements.levelGrid.append(button);
  }
}

function openLevelMap() {
  renderLevelMap();
  elements.levelMap.hidden = false;
  elements.closeMap.focus();
  logEvent("level_map_opened");
}

function closeLevelMap() {
  elements.levelMap.hidden = true;
  elements.openMap.focus();
}

function birdMarkup(direction) {
  return `
    <span class="bird-rotation" style="--bird-angle:${DIRECTIONS[direction].angle}deg">
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

function renderBoard(previousBoard = null, rotated = []) {
  const size = state.board.length;
  elements.board.replaceChildren();
  elements.board.style.setProperty("--board-size", String(size));

  const rotatedLookup = new Map(
    rotated.map((item) => [`${item.row}:${item.col}`, item])
  );

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const direction = state.board[row][col];
      const cell = document.createElement("button");
      cell.className = "cell";
      const cellIndex = row * size + col;
      cell.style.setProperty("--cell-index", String(cellIndex));
      if (state.boardRevealPending) {
        cell.classList.add("cell-enter");
      }
      cell.dataset.row = String(row);
      cell.dataset.col = String(col);
      cell.setAttribute("aria-rowindex", String(row + 1));
      cell.setAttribute("aria-colindex", String(col + 1));

      if (direction === EMPTY) {
        cell.classList.add("empty");
        cell.disabled = true;
        cell.setAttribute("aria-label", "Empty paper tile");
      } else {
        const directionName = DIRECTIONS[direction].name;
        cell.dataset.direction = directionName;
        cell.innerHTML = birdMarkup(direction);
        cell.setAttribute(
          "aria-label",
          `Row ${row + 1}, column ${col + 1}. Origami bird facing ${directionName}. Activate to attempt an escape.`
        );
        cell.addEventListener("click", () => handleCellClick(row, col, cell));

        if (
          state.hintedCell &&
          state.hintedCell.row === row &&
          state.hintedCell.col === col
        ) {
          cell.classList.add("hinted");
        }

        const change = rotatedLookup.get(`${row}:${col}`);
        if (change && previousBoard) {
          const wrapper = cell.querySelector(".bird-rotation");
          const from = DIRECTIONS[change.from].angle;
          const to = from + 90;
          wrapper.animate(
            [
              {
                transform: `rotate(${from}deg) scale(1)`,
                offset: 0
              },
              {
                transform: `rotate(${from + 104}deg) scale(1.08)`,
                offset: 0.72
              },
              {
                transform: `rotate(${to - 4}deg) scale(0.99)`,
                offset: 0.9
              },
              {
                transform: `rotate(${to}deg) scale(1)`,
                offset: 1
              }
            ],
            {
              duration: state.currentLevel <= 3 ? 520 : 420,
              easing: "cubic-bezier(.22,.9,.22,1)",
              fill: "both"
            }
          );
        }
      }

      elements.board.append(cell);
    }
  }

  if (state.boardRevealPending) {
    state.boardRevealPending = false;
    requestAnimationFrame(() => {
      elements.board.classList.add("board-is-visible");
    });
  }
}

function queryCell(row, col) {
  return elements.board.querySelector(
    `[data-row="${row}"][data-col="${col}"]`
  );
}

function clearPathFeedback() {
  if (state.pathFeedbackTimer !== null) {
    globalThis.clearTimeout(state.pathFeedbackTimer);
    state.pathFeedbackTimer = null;
  }
  elements.board
    .querySelectorAll(
      ".blocked-source, .blocked-path-segment, .blocked-path-blocker"
    )
    .forEach((cell) => {
      cell.classList.remove(
        "blocked-source",
        "blocked-path-segment",
        "blocked-path-blocker"
      );
      cell.style.removeProperty("--trace-index");
    });
}

function showBlockedPath(row, col, direction) {
  clearPathFeedback();
  const trace = tracePath(state.board, row, col, direction);
  const source = queryCell(row, col);
  source?.classList.add("blocked-source");

  trace.cells.forEach((item, index) => {
    const traced = queryCell(item.row, item.col);
    if (!traced) {
      return;
    }
    traced.style.setProperty("--trace-index", String(index));
    traced.classList.add("blocked-path-segment");
    if (
      trace.blocker &&
      trace.blocker.row === item.row &&
      trace.blocker.col === item.col
    ) {
      traced.classList.add("blocked-path-blocker");
    }
  });

  const duration =
    state.resolvedEffects === "full"
      ? 900
      : state.resolvedEffects === "lite"
        ? 650
        : 500;

  state.pathFeedbackTimer = globalThis.setTimeout(
    clearPathFeedback,
    duration
  );

  return trace;
}

function acknowledgeTap(cell, startedAt) {
  cell.classList.remove("tap-ack");
  void cell.offsetWidth;
  cell.classList.add("tap-ack");
  playFeedback("touch");
  vibrateFeedback("touch");

  requestAnimationFrame(() => {
    logEvent("tap_feedback_visible", {
      latencyMs: Number(
        (performance.now() - startedAt).toFixed(2)
      ),
      effectsMode: state.resolvedEffects
    });
  });

  globalThis.setTimeout(
    () => cell.classList.remove("tap-ack"),
    state.resolvedEffects === "minimal" ? 90 : 180
  );
}

async function previewMove(direction, result, cell) {
  const previewDuration =
    state.resolvedEffects === "minimal"
      ? 110
      : state.resolvedEffects === "lite"
        ? 180
        : state.currentLevel <= 3
          ? 360
          : state.currentLevel <= 5
            ? 250
            : 130;

  cell.classList.add("flight-preview");
  cell.style.setProperty(
    "--preview-angle",
    `${DIRECTIONS[direction].angle - 90}deg`
  );

  const rotatingCells = result.rotated
    .map(({ row, col }) => queryCell(row, col))
    .filter(Boolean);
  rotatingCells.forEach((neighbor) =>
    neighbor.classList.add("will-rotate")
  );

  if (state.currentLevel <= 2 && result.rotated.length > 0) {
    setMessage(
      `${result.rotated.length} touching ${
        result.rotated.length === 1
          ? "bird will fold"
          : "birds will fold"
      } clockwise.`
    );
  }

  logEvent("move_preview_shown", {
    rotatedBirds: result.rotated.length,
    previewDurationMs: previewDuration,
    effectsMode: state.resolvedEffects
  });

  await delay(previewDuration);
  cell.classList.remove("flight-preview");
  rotatingCells.forEach((neighbor) =>
    neighbor.classList.remove("will-rotate")
  );
}

async function handleCellClick(row, col, cell) {
  if (state.inputLocked) {
    return;
  }

  const feedbackStartedAt = performance.now();
  acknowledgeTap(cell, feedbackStartedAt);
  clearPathFeedback();
  state.hintedCell = null;

  const direction = state.board[row][col];
  const result = applyMove(state.board, row, col);

  if (!result.ok) {
    const trace = showBlockedPath(row, col, direction);
    const message = feedbackMessage({
      kind: "blocked",
      onboarding: state.onboarding,
      levelNumber: state.currentLevel
    });
    setMessage(message);
    playFeedback("blocked");
    vibrateFeedback("blocked");

    logEvent("blocked_tap", {
      row,
      col,
      direction: DIRECTIONS[direction]?.name ?? "unknown",
      blocker: trace.blocker,
      pathCells: trace.cells.length
    });

    if (!state.onboarding.blockedExplained) {
      updateOnboarding("blocked_explained");
    }
    return;
  }

  state.inputLocked = true;
  elements.undo.classList.remove("attention");
  await previewMove(direction, result, cell);

  state.history.push({
    board: cloneBoard(state.board),
    moves: state.moves,
    deadlocked: state.deadlocked
  });
  state.deadlocked = false;
  const previousBoard = cloneBoard(state.board);
  state.board = result.board;
  state.moves += 1;
  saveProgress();

  const vector = DIRECTIONS[direction];
  cell.style.setProperty("--fly-x", `${vector.dc * 170}%`);
  cell.style.setProperty("--fly-y", `${vector.dr * 170}%`);
  cell.classList.add("escaping");
  playFeedback("escape", {
    rotatedBirds: result.rotated.length
  });
  vibrateFeedback("escape");

  if (result.rotated.length > 0) {
    globalThis.setTimeout(() => {
      playFeedback("fold", {
        rotatedBirds: result.rotated.length
      });
      if (state.resolvedEffects === "full") {
        vibrateFeedback("fold");
      }
    }, state.resolvedEffects === "full" ? 95 : 35);
  }

  logEvent("bird_escape", {
    row,
    col,
    direction: DIRECTIONS[direction].name,
    rotatedBirds: result.rotated.length,
    moveNumber: state.moves,
    feedbackLatencyMs: Number(
      (performance.now() - feedbackStartedAt).toFixed(2)
    )
  });

  const escapeDuration =
    state.resolvedEffects === "full"
      ? 330
      : state.resolvedEffects === "lite"
        ? 210
        : 45;
  await delay(escapeDuration);

  state.onboarding = recordOnboardingEvent(
    state.onboarding,
    "successful_escape",
    { rotatedBirds: result.rotated.length }
  );
  saveProgress();

  renderBoard(previousBoard, result.rotated);
  updateHud();

  const status = boardStatus(state.board);
  if (status === "complete") {
    completeLevel();
  } else if (status === "deadlock") {
    state.deadlocked = true;
    state.deadlocks += 1;
    updateHud();
    elements.undo.classList.add("attention");

    setMessage(
      feedbackMessage({
        kind: "deadlock",
        onboarding: state.onboarding,
        levelNumber: state.currentLevel
      })
    );
    playFeedback("deadlock");
    vibrateFeedback("deadlock");

    logEvent("level_deadlock", {
      moves: state.moves,
      remainingBirds: countBirds(state.board)
    });

    if (!state.onboarding.deadlockExplained) {
      updateOnboarding("deadlock_explained");
    }
  } else {
    const legalCount = getLegalMoves(state.board).length;
    setMessage(
      feedbackMessage({
        kind: "escape",
        onboarding: state.onboarding,
        rotatedBirds: result.rotated.length,
        legalMoves: legalCount,
        levelNumber: state.currentLevel
      })
    );
  }

  state.inputLocked = false;
  saveProgress();
}

function completeLevel() {
  const beforeThemes = new Set(
    unlockedThemes(state.completedLevels).map((theme) => theme.id)
  );
  const earnedFeathers = calculateFeathers({
    completed: true,
    hintsUsed: state.hintsUsed,
    restarts: state.restarts,
    deadlocks: state.deadlocks
  });
  let featherResult;

  if (state.mode === "campaign") {
    if (!state.completedLevels.includes(state.currentLevel)) {
      state.completedLevels.push(state.currentLevel);
    }
    state.unlockedLevel = Math.max(
      state.unlockedLevel,
      Math.min(MAX_LEVEL, state.currentLevel + 1)
    );
    featherResult = updateFeatherRecord(
      state.bestFeathers,
      String(state.currentLevel),
      earnedFeathers
    );
    state.bestFeathers = featherResult.records;
  } else {
    featherResult = updateFeatherRecord(
      state.dailyFeathers,
      state.dailyDateKey,
      earnedFeathers
    );
    state.dailyFeathers = trimFeatherRecords(featherResult.records);
  }

  const afterThemes = unlockedThemes(state.completedLevels);
  state.pendingThemeUnlock =
    afterThemes.find((theme) => !beforeThemes.has(theme.id)) ?? null;

  const firstFeatherIntroduction =
    !state.onboarding.feathersIntroduced;
  if (firstFeatherIntroduction) {
    state.onboarding = recordOnboardingEvent(
      state.onboarding,
      "feathers_introduced"
    );
  }

  state.puzzleCompleted = true;
  saveProgress();
  renderLevelMap();
  renderThemePicker();
  updateHud();

  state.deadlocked = false;
  elements.undo.classList.remove("attention");
  setMessage("The whole flock is free.");
  playFeedback("complete", { feathers: earnedFeathers });
  vibrateFeedback("complete", earnedFeathers);
  celebrate();

  logEvent("puzzle_complete", {
    moves: state.moves,
    feathersEarned: earnedFeathers,
    newBestFeathers: featherResult.improved,
    previousBestFeathers: featherResult.previousBest,
    bestFeathers: featherResult.best,
    hintsUsed: state.hintsUsed,
    restarts: state.restarts,
    deadlocks: state.deadlocks,
    undosUsed: state.undosUsed,
    themeUnlocked: state.pendingThemeUnlock?.id ?? null,
    sessionDurationMs: Date.now() - state.sessionStartedAt,
    completedCount: state.completedLevels.length
  });

  if (state.mode === "daily") {
    elements.completionTitle.textContent = "Daily flock freed";
  } else if (state.currentLevel === MAX_LEVEL) {
    elements.completionTitle.textContent = "Journey complete";
  } else {
    elements.completionTitle.textContent = `Level ${state.currentLevel} cleared`;
  }

  elements.completionFeathers.textContent = featherText(earnedFeathers);
  elements.completionFeathers.setAttribute(
    "aria-label",
    `${earnedFeathers} of 3 feathers earned`
  );

  const improvementMessage = featherResult.improved
    ? featherResult.previousBest === 0
      ? `You earned ${earnedFeathers} of 3 feathers.`
      : `You improved this flock from ${featherResult.previousBest} to ${earnedFeathers} feathers.`
    : `You earned ${earnedFeathers} of 3 feathers. Your best is ${featherResult.best}.`;

  elements.completionBody.textContent =
    state.mode === "daily"
      ? `${improvementMessage} A different optional flock arrives on your next local calendar day.`
      : state.currentLevel === MAX_LEVEL
        ? `${improvementMessage} You completed the full paper journey.`
        : `${improvementMessage} Continue when you are ready.`;

  if (firstFeatherIntroduction) {
    elements.completionBody.textContent +=
      " Feathers show mastery: finish, avoid hints, and avoid restarts or dead ends.";
  }

  elements.completionUnlock.textContent = state.pendingThemeUnlock
    ? `New paper style unlocked: ${state.pendingThemeUnlock.name}.`
    : "";
  elements.completionUnlock.hidden = !state.pendingThemeUnlock;

  elements.continue.textContent =
    state.mode === "daily" || state.currentLevel === MAX_LEVEL
      ? "Choose a level"
      : "Next level";
  elements.completion.hidden = false;
  requestAnimationFrame(() => {
    elements.completion.classList.add("completion-visible");
  });
  logEvent("completion_screen_shown", {
    displayedFeathers: earnedFeathers,
    newBestFeathers: featherResult.improved,
    themeUnlocked: state.pendingThemeUnlock?.id ?? null
  });
}

function undoMove() {
  if (state.inputLocked || state.history.length === 0) {
    return;
  }

  clearPathFeedback();
  const recoveredFromDeadlock = state.deadlocked;
  state.undosUsed += 1;
  const previous = state.history.pop();
  state.board = previous.board;
  state.moves = previous.moves;
  state.deadlocked = previous.deadlocked;
  state.hintedCell = null;
  elements.undo.classList.remove("attention");
  renderBoard();
  updateHud();
  setMessage(
    recoveredFromDeadlock
      ? "Dead end recovered. Try a different bird."
      : feedbackMessage({
          kind: "undo",
          onboarding: state.onboarding
        })
  );
  playFeedback("undo");
  vibrateFeedback("undo");

  logEvent("undo", {
    recoveredFromDeadlock,
    moveNumber: state.moves,
    remainingBirds: countBirds(state.board)
  });

  if (!state.onboarding.undoExplained) {
    updateOnboarding("undo_explained");
  }
  saveProgress();
}

function restartLevel() {
  if (state.inputLocked) {
    return;
  }

  clearPathFeedback();
  state.restarts += 1;
  state.board = cloneBoard(state.initialBoard);
  state.history = [];
  state.moves = 0;
  state.deadlocked = false;
  state.hintedCell = null;
  state.boardRevealPending = state.resolvedEffects === "full";
  elements.undo.classList.remove("attention");
  elements.completion.hidden = true;
  elements.completion.classList.remove("completion-visible");
  renderBoard();
  updateHud();
  setMessage(
    feedbackMessage({
      kind: "restart",
      onboarding: state.onboarding
    })
  );
  playFeedback("restart");
  vibrateFeedback("restart");
  logEvent("level_restart", {
    restartCount: state.restarts
  });

  if (!state.onboarding.restartPenaltyExplained) {
    updateOnboarding("restart_penalty_explained");
  }
  saveProgress();
}

function showHint() {
  if (state.inputLocked) {
    return;
  }

  clearPathFeedback();
  const result = findSolution(state.board, { nodeLimit: 150000 });
  if (!result.solution || result.solution.length === 0) {
    setMessage(
      result.exhausted
        ? "A safe hint took too long to verify. Undo or restart."
        : "This flock cannot be completed from here. Undo or restart."
    );
    if (!result.exhausted) {
      elements.undo.classList.add("attention");
    }
    logEvent("hint_unavailable", {
      exhausted: result.exhausted,
      visitedNodes: result.visitedNodes
    });
    return;
  }

  const hint = result.solution[0];
  state.hintsUsed += 1;
  state.hintedCell = hint;
  renderBoard();
  updateHud();
  setMessage(
    feedbackMessage({
      kind: "hint",
      onboarding: state.onboarding
    })
  );
  playFeedback("hint");
  vibrateFeedback("hint");
  logEvent("safe_hint_used", {
    row: hint.row,
    col: hint.col,
    solutionLength: result.solution.length,
    visitedNodes: result.visitedNodes
  });

  if (!state.onboarding.hintPenaltyExplained) {
    updateOnboarding("hint_penalty_explained");
  }
  saveProgress();
}

function updateHud() {
  elements.modeLabel.textContent =
    state.mode === "daily" ? "Daily" : "Level";
  elements.level.textContent =
    state.mode === "daily" ? "Today" : String(state.currentLevel);

  const record = currentRecord();
  const potential = currentFeatherPotential({
    hintsUsed: state.hintsUsed,
    restarts: state.restarts,
    deadlocks: state.deadlocks
  });
  const feathersVisible =
    state.onboarding.feathersIntroduced ||
    state.completedLevels.length > 0 ||
    state.mode === "daily";

  if (!feathersVisible) {
    elements.best.textContent =
      "Complete your first flock to reveal mastery feathers.";
    elements.feathers.textContent = "—";
    elements.feathers.setAttribute(
      "aria-label",
      "Mastery feathers unlock after the first completed flock"
    );
  } else {
    elements.best.textContent =
      record === 0
        ? "Complete the flock to earn up to three feathers."
        : `Best flight: ${featherText(record)} (${record}/3)`;
    elements.feathers.textContent = `${potential}/3`;
    elements.feathers.setAttribute(
      "aria-label",
      `Up to ${potential} of 3 feathers available on this attempt`
    );
  }

  elements.chapter.textContent =
    state.mode === "daily"
      ? "Daily paper sky"
      : chapterForLevel(state.currentLevel);

  const journeyFeathers = totalFeathers(state.bestFeathers);
  elements.journeyProgress.textContent =
    `${journeyFeathers} of 60 journey feathers`;
  const journeyPercent = Math.min(
    100,
    (journeyFeathers / 60) * 100
  );
  elements.journeyFill.style.width = `${journeyPercent}%`;
  elements.journeyRail.setAttribute(
    "aria-valuenow",
    String(journeyFeathers)
  );

  elements.remaining.textContent = String(countBirds(state.board));
  elements.undo.disabled =
    state.history.length === 0 || state.inputLocked;
  elements.previous.disabled =
    state.mode === "daily" || state.currentLevel <= 1;
  elements.next.disabled =
    state.mode === "daily" ||
    state.currentLevel >= state.unlockedLevel ||
    state.currentLevel >= MAX_LEVEL;

  const dailyUnlocked = isDailyUnlocked(state.unlockedLevel);
  elements.daily.disabled = !dailyUnlocked;
  const dailyLabel = elements.daily.querySelector("span:last-child");
  if (dailyLabel) {
    dailyLabel.textContent = dailyUnlocked
      ? "Today’s optional flock"
      : "Daily opens after Level 5";
  }
  if (dailyUnlocked && !state.dailyUnlockLogged) {
    state.dailyUnlockLogged = true;
    logEvent("daily_unlock_presented");
  }

  const soundLabel =
    elements.sound.querySelector("span:last-child") ??
    elements.sound;
  soundLabel.textContent =
    state.soundEnabled ? "Sound on" : "Sound off";
  elements.sound.setAttribute(
    "aria-pressed",
    String(state.soundEnabled)
  );

  const effectsText =
    elements.effects.querySelector("span:last-child") ??
    elements.effects;
  effectsText.textContent = effectsLabel(
    state.effectsPreference,
    state.resolvedEffects
  );
  elements.effects.setAttribute(
    "aria-label",
    `Visual effects setting: ${effectsText.textContent}`
  );
}

function setMessage(text) {
  elements.message.textContent = text;
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function prefersReducedMotion() {
  return globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

function vibrateFeedback(kind, feathers = 1) {
  const pattern = hapticPattern(kind, feathers);
  if (pattern.length > 0) {
    navigator.vibrate?.(pattern);
  }
}

let audioContext = null;

function ensureAudioContext() {
  if (!state.soundEnabled) {
    return null;
  }

  const AudioContextClass =
    globalThis.AudioContext ?? globalThis.webkitAudioContext;
  if (!AudioContextClass) {
    return null;
  }

  audioContext ??= new AudioContextClass();
  if (audioContext.state === "suspended") {
    void audioContext.resume();
  }
  return audioContext;
}

function playNoiseBurst({
  context,
  start,
  duration,
  volume,
  frequency,
  type = "bandpass"
}) {
  const frameCount = Math.max(
    1,
    Math.floor(context.sampleRate * duration)
  );
  const buffer = context.createBuffer(
    1,
    frameCount,
    context.sampleRate
  );
  const channel = buffer.getChannelData(0);

  for (let index = 0; index < frameCount; index += 1) {
    const envelope = 1 - index / frameCount;
    channel[index] =
      (Math.random() * 2 - 1) * envelope * envelope;
  }

  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();

  source.buffer = buffer;
  filter.type = type;
  filter.frequency.setValueAtTime(frequency, start);
  filter.Q.setValueAtTime(0.7, start);
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    start + duration
  );

  source.connect(filter);
  filter.connect(gain);
  gain.connect(context.destination);
  source.start(start);
  source.stop(start + duration);
}

function playOscillator({
  context,
  start,
  duration,
  startFrequency,
  endFrequency,
  volume,
  type = "sine"
}) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(startFrequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(
    Math.max(1, endFrequency),
    start + duration
  );
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    start + duration
  );

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration);
}

function playFeedback(kind, {
  rotatedBirds = 0,
  feathers = 1
} = {}) {
  const context = ensureAudioContext();
  if (!context) {
    return;
  }

  const now = context.currentTime;

  if (kind === "touch") {
    playNoiseBurst({
      context,
      start: now,
      duration: 0.025,
      volume: 0.018,
      frequency: 2100,
      type: "highpass"
    });
    return;
  }

  if (kind === "escape") {
    playNoiseBurst({
      context,
      start: now,
      duration: 0.11,
      volume: 0.04,
      frequency: 1500,
      type: "highpass"
    });
    playOscillator({
      context,
      start: now,
      duration: 0.13,
      startFrequency: 280,
      endFrequency: 620,
      volume: 0.026
    });
    return;
  }

  if (kind === "fold") {
    const folds = Math.max(1, Math.min(3, rotatedBirds));
    for (let index = 0; index < folds; index += 1) {
      playNoiseBurst({
        context,
        start: now + index * 0.035,
        duration: 0.055,
        volume: 0.022,
        frequency: 950 + index * 130
      });
    }
    return;
  }

  if (kind === "blocked") {
    playNoiseBurst({
      context,
      start: now,
      duration: 0.07,
      volume: 0.026,
      frequency: 420,
      type: "lowpass"
    });
    playOscillator({
      context,
      start: now,
      duration: 0.11,
      startFrequency: 155,
      endFrequency: 108,
      volume: 0.026,
      type: "triangle"
    });
    return;
  }

  if (kind === "deadlock") {
    [0, 0.13].forEach((offset, index) => {
      playOscillator({
        context,
        start: now + offset,
        duration: 0.13,
        startFrequency: 180 - index * 28,
        endFrequency: 112 - index * 18,
        volume: 0.027,
        type: "triangle"
      });
    });
    return;
  }

  if (kind === "undo") {
    playOscillator({
      context,
      start: now,
      duration: 0.12,
      startFrequency: 430,
      endFrequency: 260,
      volume: 0.025
    });
    return;
  }

  if (kind === "restart") {
    playNoiseBurst({
      context,
      start: now,
      duration: 0.09,
      volume: 0.025,
      frequency: 820
    });
    playOscillator({
      context,
      start: now,
      duration: 0.15,
      startFrequency: 240,
      endFrequency: 390,
      volume: 0.02
    });
    return;
  }

  if (kind === "hint") {
    [660, 880].forEach((frequency, index) => {
      playOscillator({
        context,
        start: now + index * 0.055,
        duration: 0.12,
        startFrequency: frequency,
        endFrequency: frequency * 1.08,
        volume: 0.018
      });
    });
    return;
  }

  if (kind === "complete") {
    const notes =
      feathers >= 3
        ? [440, 554, 659, 880]
        : feathers === 2
          ? [440, 554, 740]
          : [440, 659];

    notes.forEach((frequency, index) => {
      playOscillator({
        context,
        start: now + index * 0.085,
        duration: 0.28,
        startFrequency: frequency,
        endFrequency: frequency * 1.035,
        volume: 0.024
      });
    });
    playNoiseBurst({
      context,
      start: now,
      duration: 0.22,
      volume: 0.018,
      frequency: 2400,
      type: "highpass"
    });
  }
}

function celebrate() {
  if (prefersReducedMotion()) {
    return;
  }

  const celebration = document.querySelector("#celebration");
  celebration.replaceChildren();

  for (let index = 0; index < 18; index += 1) {
    const piece = document.createElement("span");
    piece.style.setProperty("--x", `${(Math.random() - 0.5) * 88}vw`);
    piece.style.setProperty("--y", `${-20 - Math.random() * 45}vh`);
    piece.style.setProperty("--spin", `${Math.random() * 540 - 270}deg`);
    piece.style.setProperty("--delay", `${Math.random() * 120}ms`);
    celebration.append(piece);
  }

  setTimeout(() => celebration.replaceChildren(), 1300);
}


function resetGameStateForParticipant() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(STORAGE_KEYS.saveBackup);
  localStorage.removeItem(EVENT_KEY);
  state.mode = "campaign";
  state.currentLevel = 1;
  state.dailyDateKey = null;
  state.unlockedLevel = 1;
  state.completedLevels = [];
  state.bestFeathers = {};
  state.dailyFeathers = {};
  state.selectedTheme = "dawn";
  state.soundEnabled = false;
  state.effectsPreference = "auto";
  state.onboarding = normalizeOnboarding(DEFAULT_ONBOARDING);
  applyTheme("dawn");
  applyEffectsMode();
  state.dailyUnlockLogged = false;
  state.sessionId = createSessionId();
  state.sessionStartedAt = Date.now();
}

function startResearchSession() {
  const participantCode = normalizeParticipantCode(
    elements.participantCode.value
  );
  const consented = elements.participantConsent.checked;

  if (!isValidParticipantCode(participantCode)) {
    elements.consentError.textContent =
      "Enter a 2–16 character anonymous code using letters, numbers, hyphens, or underscores.";
    elements.participantCode.focus();
    return;
  }
  if (!consented) {
    elements.consentError.textContent =
      "Consent is required before research mode can begin.";
    elements.participantConsent.focus();
    return;
  }

  const alreadyUsed = state.researchArchive.sessions.some(
    (session) => session.participantCode === participantCode
  );
  if (alreadyUsed) {
    elements.consentError.textContent =
      "That anonymous code is already saved on this device. Use a new code.";
    elements.participantCode.focus();
    return;
  }

  resetGameStateForParticipant();
  const startedAt = new Date().toISOString();
  const session = createResearchSession({
    participantCode,
    segment: elements.participantSegment.value,
    sessionId: state.sessionId,
    startedAt
  });
  state.researchArchive.sessions.push(session);
  state.researchActive = true;
  state.researchSessionId = session.sessionId;
  saveResearchArchive();

  elements.consentError.textContent = "";
  elements.researchWelcome.hidden = true;
  elements.researchRibbon.hidden = false;
  elements.researchCode.textContent = participantCode;
  logEvent("research_session_started", {
    segment: session.segment,
    consentedAt: session.consentedAt
  });
  startLevel(1, "research_start");
}

function startNormalPlay() {
  state.researchActive = false;
  state.researchSessionId = null;
  elements.researchWelcome.hidden = true;
  elements.researchRibbon.hidden = true;
  logEvent("normal_play_selected");
}

function openResearchSurvey() {
  if (!state.researchActive) {
    return;
  }
  logEvent("research_end_requested");
  elements.survey.hidden = false;
  elements.survey.querySelector("textarea, select, input")?.focus();
}

function collectSurveyResponses(form) {
  const data = new FormData(form);
  return {
    featherMeaning: String(data.get("featherMeaning") ?? "").trim(),
    featherEffect: String(data.get("featherEffect") ?? ""),
    dailyExpectation: String(data.get("dailyExpectation") ?? "").trim(),
    dailyOptionalRequired: String(data.get("dailyOptionalRequired") ?? ""),
    returnReason: String(data.get("returnReason") ?? "").trim(),
    stopReason: String(data.get("stopReason") ?? "").trim(),
    additionalComments: String(data.get("additionalComments") ?? "").trim()
  };
}

function submitResearchSurvey(event) {
  event.preventDefault();
  const responses = collectSurveyResponses(elements.surveyForm);
  if (
    responses.featherMeaning.length < 2 ||
    !responses.featherEffect ||
    !responses.dailyOptionalRequired
  ) {
    elements.surveyError.textContent =
      "Please answer the required questions before ending the session.";
    return;
  }

  logEvent("research_survey_submitted", {
    featherEffect: responses.featherEffect,
    dailyOptionalRequired: responses.dailyOptionalRequired
  });

  const index = currentResearchSessionIndex();
  const completed = completeResearchSession(
    state.researchArchive.sessions[index],
    {
      endedAt: new Date().toISOString(),
      responses
    }
  );
  state.researchArchive.sessions[index] = completed;
  saveResearchArchive();

  state.researchActive = false;
  state.researchSessionId = null;
  elements.researchRibbon.hidden = true;
  elements.survey.hidden = true;
  elements.surveyError.textContent = "";
  elements.sessionCompleteSummary.textContent =
    `Session ${completed.participantCode} saved locally. ` +
    `Highest campaign level completed: ${completed.summary.highestCampaignLevelCompleted}.`;
  elements.sessionComplete.hidden = false;
}

function downloadBlob(filename, type, content) {
  const blob = new Blob([content], { type });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function exportCurrentResearchSession() {
  const completed = [...state.researchArchive.sessions]
    .reverse()
    .find((session) => session.status === "complete");
  if (!completed) {
    return;
  }
  downloadBlob(
    `paper-flock-v${BUILD_VERSION}-${completed.participantCode}.json`,
    "application/json",
    JSON.stringify(
      {
        buildVersion: BUILD_VERSION,
        exportedAt: new Date().toISOString(),
        privacy:
          "Anonymous playtest session stored locally and exported with participant consent.",
        session: completed
      },
      null,
      2
    )
  );
}

function exportResearchJson() {
  const aggregate = aggregateSessions(state.researchArchive.sessions);
  downloadBlob(
    `paper-flock-v${BUILD_VERSION}-research-sessions.json`,
    "application/json",
    JSON.stringify(
      {
        buildVersion: BUILD_VERSION,
        exportedAt: new Date().toISOString(),
        privacy:
          "Anonymous research sessions stored locally. No server or tracking SDK was used.",
        aggregate,
        sessions: state.researchArchive.sessions
      },
      null,
      2
    )
  );
}

function exportResearchCsv() {
  downloadBlob(
    `paper-flock-v${BUILD_VERSION}-research-sessions.csv`,
    "text/csv;charset=utf-8",
    sessionsToCsv(state.researchArchive.sessions)
  );
}

function prepareNextParticipant() {
  elements.sessionComplete.hidden = true;
  elements.surveyForm.reset();
  elements.participantCode.value = "";
  elements.participantSegment.value = "casual-puzzle";
  elements.participantConsent.checked = false;
  elements.researchWelcome.hidden = false;
  elements.participantCode.focus();
}

function exportEventLog() {
  const payload = {
    buildVersion: BUILD_VERSION,
    exportedAt: new Date().toISOString(),
    privacy: "All events were stored locally in this browser.",
    save: JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"),
    researchAggregate: aggregateSessions(state.researchArchive.sessions),
    events: JSON.parse(localStorage.getItem(EVENT_KEY) || "[]")
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json"
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `paper-flock-v${BUILD_VERSION}-test-log-${new Date()
    .toISOString()
    .slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
  logEvent("test_log_exported");
}

function resetProgress() {
  const confirmed = globalThis.confirm(
    "Reset all local Paper Flock v0.21 progress, onboarding, feedback settings, feathers, themes, and test events?"
  );
  if (!confirmed) {
    return;
  }

  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(STORAGE_KEYS.saveBackup);
  localStorage.removeItem(EVENT_KEY);
  state.mode = "campaign";
  state.currentLevel = 1;
  state.dailyDateKey = null;
  state.unlockedLevel = 1;
  state.completedLevels = [];
  state.bestFeathers = {};
  state.dailyFeathers = {};
  state.selectedTheme = "dawn";
  state.soundEnabled = false;
  state.effectsPreference = "auto";
  state.onboarding = normalizeOnboarding(DEFAULT_ONBOARDING);
  applyTheme("dawn");
  applyEffectsMode();
  state.sessionId = createSessionId();
  state.sessionStartedAt = Date.now();
  startLevel(1, "progress_reset");
}

elements.undo.addEventListener("click", undoMove);
elements.restart.addEventListener("click", restartLevel);
elements.hint.addEventListener("click", showHint);
elements.previous.addEventListener("click", () =>
  startLevel(state.currentLevel - 1, "previous")
);
elements.next.addEventListener("click", () =>
  startLevel(state.currentLevel + 1, "next")
);
elements.openMap.addEventListener("click", openLevelMap);
elements.closeMap.addEventListener("click", closeLevelMap);
elements.closeMapBottom.addEventListener("click", closeLevelMap);
elements.levelMap.addEventListener("click", (event) => {
  if (event.target === elements.levelMap) {
    closeLevelMap();
  }
});
elements.daily.addEventListener("click", openDailyInvitation);
elements.dailyConfirm.addEventListener("click", () =>
  startDaily("daily_confirmation")
);
elements.dailyDecline.addEventListener("click", () =>
  closeDailyInvitation({ declined: true })
);
elements.dailyInfo.addEventListener("click", (event) => {
  if (event.target === elements.dailyInfo) {
    closeDailyInvitation({ declined: true });
  }
});
elements.replay.addEventListener("click", () => {
  logEvent("replay_started", {
    replayMode: state.mode,
    replayLevel: state.mode === "campaign" ? state.currentLevel : null
  });
  elements.completion.hidden = true;
  if (state.mode === "daily") {
    startDaily("completion_replay");
  } else {
    startLevel(state.currentLevel, "completion_replay");
  }
});
elements.sound.addEventListener("click", () => {
  state.soundEnabled = !state.soundEnabled;
  saveProgress();
  updateHud();
  logEvent("sound_preference_changed", {
    enabled: state.soundEnabled,
    audioContextAvailable: Boolean(
      globalThis.AudioContext ?? globalThis.webkitAudioContext
    )
  });
  if (state.soundEnabled) {
    playFeedback("hint");
  }
});
elements.effects.addEventListener("click", cycleEffectsMode);
elements.startResearch.addEventListener("click", startResearchSession);
elements.normalPlay.addEventListener("click", startNormalPlay);
elements.endResearch.addEventListener("click", openResearchSurvey);
elements.surveyForm.addEventListener("submit", submitResearchSurvey);
elements.downloadSession.addEventListener("click", exportCurrentResearchSession);
elements.nextParticipant.addEventListener("click", prepareNextParticipant);
elements.exportResearchJson.addEventListener("click", exportResearchJson);
elements.exportResearchCsv.addEventListener("click", exportResearchCsv);
elements.launchResearch.addEventListener("click", () => {
  globalThis.location.href = `${globalThis.location.pathname}?research=1`;
});
elements.exportLog.addEventListener("click", exportEventLog);
elements.resetProgress.addEventListener("click", resetProgress);
elements.continue.addEventListener("click", () => {
  elements.completion.hidden = true;
  if (state.mode === "daily" || state.currentLevel === MAX_LEVEL) {
    openLevelMap();
  } else {
    startLevel(state.currentLevel + 1, "completion_continue");
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (!elements.dailyInfo.hidden) {
      closeDailyInvitation({ declined: true });
      return;
    }
    if (!elements.levelMap.hidden) {
      closeLevelMap();
      return;
    }
  }
  if (event.key.toLowerCase() === "z" && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    undoMove();
  }
  if (event.key.toLowerCase() === "r") {
    restartLevel();
  }
  if (event.key.toLowerCase() === "h") {
    showHint();
  }
});

globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")
  .addEventListener?.("change", () => {
    applyEffectsMode();
    updateHud();
  });
navigator.connection?.addEventListener?.("change", () => {
  if (state.effectsPreference === "auto") {
    applyEffectsMode();
    updateHud();
  }
});


function persistForLifecycle(reason) {
  saveProgress();
  if (state.researchActive) {
    saveResearchArchive();
  }
  logEvent("lifecycle_persist", {
    reason,
    moves: state.moves,
    remainingBirds: countBirds(state.board)
  });
}

globalThis.addEventListener("paperflock:persist-now", (event) => {
  persistForLifecycle(event.detail?.reason ?? "custom");
});

globalThis.addEventListener("paperflock:resume", (event) => {
  renderBoard();
  renderLevelMap();
  renderThemePicker();
  updateHud();
  logEvent("app_resumed", {
    reason: event.detail?.reason ?? "visible",
    persisted: Boolean(event.detail?.persisted)
  });
});

const saveLoadResult = loadSave();
loadResearchArchive();
logEvent("prototype_open", {
  viewportWidth: globalThis.innerWidth,
  viewportHeight: globalThis.innerHeight,
  userAgent: navigator.userAgent,
  soundEnabled: state.soundEnabled,
  effectsPreference: state.effectsPreference,
  effectsMode: state.resolvedEffects
});
const restoredCheckpoint = restoreCheckpoint(
  state.pendingCheckpoint
);
if (!restoredCheckpoint) {
  startLevel(state.currentLevel, "initial_load");
}
logEvent("storage_ready", {
  source: saveLoadResult.source,
  recovered: saveLoadResult.recovered,
  migrated: saveLoadResult.migrated,
  repaired: saveLoadResult.repaired,
  legacyMigration: storageMigration
});
requestAnimationFrame(() => {
  document.documentElement.classList.add("ui-ready");
  globalThis.dispatchEvent(
    new CustomEvent("paperflock:ready", {
      detail: {
        buildVersion: BUILD_VERSION,
        mode: state.mode,
        level: state.currentLevel
      }
    })
  );
});

const researchRequested =
  new URLSearchParams(globalThis.location.search).get("research") === "1";

if (state.researchActive || researchRequested) {
  elements.researchWelcome.hidden = state.researchActive;
  elements.researchRibbon.hidden = !state.researchActive;
} else {
  elements.researchWelcome.hidden = true;
  elements.researchRibbon.hidden = true;
}
