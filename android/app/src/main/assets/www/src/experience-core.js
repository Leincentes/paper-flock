export const EFFECTS_PREFERENCES = Object.freeze([
  "auto",
  "full",
  "lite",
  "minimal"
]);

export const DEFAULT_ONBOARDING = Object.freeze({
  successfulEscapes: 0,
  rotationEventsSeen: 0,
  blockedExplained: false,
  feathersIntroduced: false,
  hintPenaltyExplained: false,
  restartPenaltyExplained: false,
  deadlockExplained: false,
  undoExplained: false
});

export function normalizeOnboarding(value) {
  const source =
    value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    successfulEscapes: Math.max(
      0,
      Number.isInteger(source.successfulEscapes)
        ? source.successfulEscapes
        : 0
    ),
    rotationEventsSeen: Math.max(
      0,
      Number.isInteger(source.rotationEventsSeen)
        ? source.rotationEventsSeen
        : 0
    ),
    blockedExplained: Boolean(source.blockedExplained),
    feathersIntroduced: Boolean(source.feathersIntroduced),
    hintPenaltyExplained: Boolean(source.hintPenaltyExplained),
    restartPenaltyExplained: Boolean(source.restartPenaltyExplained),
    deadlockExplained: Boolean(source.deadlockExplained),
    level11RecoveryExplained: Boolean(source.level11RecoveryExplained),
    undoExplained: Boolean(source.undoExplained)
  };
}

export function recordOnboardingEvent(onboarding, eventName, data = {}) {
  const next = normalizeOnboarding(onboarding);

  switch (eventName) {
    case "successful_escape":
      next.successfulEscapes += 1;
      if (Number(data.rotatedBirds) > 0) {
        next.rotationEventsSeen += 1;
      }
      break;
    case "blocked_explained":
      next.blockedExplained = true;
      break;
    case "feathers_introduced":
      next.feathersIntroduced = true;
      break;
    case "hint_penalty_explained":
      next.hintPenaltyExplained = true;
      break;
    case "restart_penalty_explained":
      next.restartPenaltyExplained = true;
      break;
    case "deadlock_explained":
      next.deadlockExplained = true;
      break;
    case "level11_recovery_explained":
      next.level11RecoveryExplained = true;
      break;
    case "undo_explained":
      next.undoExplained = true;
      break;
    default:
      break;
  }

  return next;
}

export function adaptivePuzzleInstruction({
  onboarding,
  levelInstruction,
  levelNumber,
  mode = "campaign"
}) {
  const current = normalizeOnboarding(onboarding);

  if (mode === "daily") {
    return "Free every bird. There is no timer, streak, or penalty for skipping.";
  }
  if (levelNumber === 1 && current.successfulEscapes === 0) {
    return levelInstruction;
  }
  if (levelNumber <= 2 && current.rotationEventsSeen === 0) {
    return "A bird can fly when its beak has a clear path. Touching birds fold clockwise.";
  }
  if (current.successfulEscapes >= 2 && current.rotationEventsSeen >= 1) {
    return "Read the beaks, predict the folds, and free the flock.";
  }
  return levelInstruction;
}

export function feedbackMessage({
  kind,
  onboarding,
  rotatedBirds = 0,
  legalMoves = 0,
  levelNumber = 1
}) {
  const current = normalizeOnboarding(onboarding);

  if (kind === "blocked") {
    return current.blockedExplained
      ? "Blocked. The highlighted bird is in the flight path."
      : "Blocked: follow the glowing beak-to-edge line to see the bird in the way.";
  }

  if (kind === "escape") {
    if (rotatedBirds > 0 && current.rotationEventsSeen <= 1) {
      return `${rotatedBirds} touching ${rotatedBirds === 1 ? "bird folded" : "birds folded"} clockwise.`;
    }
    return `${legalMoves} clear ${legalMoves === 1 ? "path remains" : "paths remain"}.`;
  }

  if (kind === "hint") {
    return current.hintPenaltyExplained
      ? "The glow marks a verified safe bird."
      : "Hint used: this attempt can now earn one feather. The glow marks a safe bird.";
  }

  if (kind === "restart") {
    return current.restartPenaltyExplained
      ? "Flock restarted."
      : "Restart used: this attempt can earn up to two feathers.";
  }

  if (kind === "deadlock") {
    if (levelNumber === 11 && !current.level11RecoveryExplained) {
      return "More open paths are not always safer. Undo the last move and watch which neighboring bird turns.";
    }
    if (levelNumber === 4 && !current.deadlockExplained) {
      return "Dead end. Undo to recover and try the other opening. This attempt can earn up to two feathers.";
    }
    return current.deadlockExplained
      ? "No clear path remains. Undo or restart."
      : "Dead end: no clear path remains. Undo can recover your previous board.";
  }

  if (kind === "undo") {
    return current.undoExplained
      ? "Move undone."
      : "Undo restores the exact board before your last flight.";
  }

  return "";
}

export function normalizeEffectsPreference(value) {
  return EFFECTS_PREFERENCES.includes(value) ? value : "auto";
}

export function resolveEffectsMode({
  preference = "auto",
  reducedMotion = false,
  deviceMemory = null,
  hardwareConcurrency = null,
  saveData = false
} = {}) {
  const normalized = normalizeEffectsPreference(preference);

  if (reducedMotion) {
    return "minimal";
  }
  if (normalized !== "auto") {
    return normalized;
  }

  const lowMemory =
    Number.isFinite(deviceMemory) && Number(deviceMemory) <= 4;
  const lowCpu =
    Number.isFinite(hardwareConcurrency) &&
    Number(hardwareConcurrency) <= 4;

  return lowMemory || lowCpu || Boolean(saveData) ? "lite" : "full";
}

export function nextEffectsPreference(current) {
  const normalized = normalizeEffectsPreference(current);
  const index = EFFECTS_PREFERENCES.indexOf(normalized);
  return EFFECTS_PREFERENCES[(index + 1) % EFFECTS_PREFERENCES.length];
}

export function effectsLabel(preference, resolved) {
  const normalized = normalizeEffectsPreference(preference);
  if (normalized === "auto") {
    return `Effects auto · ${resolved}`;
  }
  return `Effects ${normalized}`;
}

export function hapticPattern(kind, feathers = 1) {
  const patterns = {
    touch: [5],
    escape: [9],
    fold: [7, 18, 7],
    blocked: [18, 28, 12],
    undo: [8, 20, 8],
    deadlock: [28, 34, 28],
    restart: [12, 20, 12],
    hint: [6, 14, 6],
    complete:
      feathers >= 3
        ? [12, 30, 12, 30, 24]
        : feathers === 2
          ? [12, 28, 18]
          : [18]
  };
  return patterns[kind] ?? [];
}
