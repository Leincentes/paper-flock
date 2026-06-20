export const ACCESSIBILITY_SCHEMA_VERSION = 1;

export const DEFAULT_ACCESSIBILITY_PREFERENCES = Object.freeze({
  textSize: "standard",
  contrast: "auto",
  motion: "auto",
  focusStyle: "strong"
});

const TEXT_SIZES = new Set(["standard", "large", "extra-large"]);
const CONTRASTS = new Set(["auto", "high"]);
const MOTIONS = new Set(["auto", "reduced"]);
const FOCUS_STYLES = new Set(["strong"]);

function accepted(value, choices, fallback) {
  return choices.has(value) ? value : fallback;
}

export function normalizeAccessibilityPreferences(value = {}) {
  return {
    schemaVersion: ACCESSIBILITY_SCHEMA_VERSION,
    textSize: accepted(
      value.textSize,
      TEXT_SIZES,
      DEFAULT_ACCESSIBILITY_PREFERENCES.textSize
    ),
    contrast: accepted(
      value.contrast,
      CONTRASTS,
      DEFAULT_ACCESSIBILITY_PREFERENCES.contrast
    ),
    motion: accepted(
      value.motion,
      MOTIONS,
      DEFAULT_ACCESSIBILITY_PREFERENCES.motion
    ),
    focusStyle: accepted(
      value.focusStyle,
      FOCUS_STYLES,
      DEFAULT_ACCESSIBILITY_PREFERENCES.focusStyle
    )
  };
}

export function resolveAccessibilityPreferences(
  preferences = {},
  system = {}
) {
  const normalized = normalizeAccessibilityPreferences(preferences);

  return {
    ...normalized,
    effectiveContrast:
      normalized.contrast === "high" || Boolean(system.prefersMoreContrast)
        ? "high"
        : "standard",
    effectiveMotion:
      normalized.motion === "reduced" || Boolean(system.prefersReducedMotion)
        ? "reduced"
        : "standard",
    forcedColors: Boolean(system.forcedColors)
  };
}

export function createGridNavigationModel(cells = []) {
  return cells
    .filter(
      (cell) =>
        Number.isInteger(cell.row) &&
        Number.isInteger(cell.col) &&
        cell.disabled !== true
    )
    .map((cell) => ({
      row: cell.row,
      col: cell.col,
      disabled: false
    }));
}

function sortCells(cells) {
  return [...cells].sort((left, right) =>
    left.row === right.row
      ? left.col - right.col
      : left.row - right.row
  );
}

export function nextGridCell(cells = [], current, key) {
  const enabled = sortCells(createGridNavigationModel(cells));
  if (enabled.length === 0) {
    return null;
  }

  const currentCell =
    enabled.find(
      (cell) =>
        cell.row === current?.row &&
        cell.col === current?.col
    ) ?? enabled[0];

  if (key === "Home") {
    return enabled[0];
  }
  if (key === "End") {
    return enabled.at(-1);
  }

  const deltas = {
    ArrowUp: [-1, 0],
    ArrowDown: [1, 0],
    ArrowLeft: [0, -1],
    ArrowRight: [0, 1]
  };
  const delta = deltas[key];
  if (!delta) {
    return currentCell;
  }

  const sameLine = enabled.filter((cell) =>
    delta[0] === 0
      ? cell.row === currentCell.row
      : cell.col === currentCell.col
  );

  const candidates = sameLine.filter((cell) =>
    delta[0] < 0
      ? cell.row < currentCell.row
      : delta[0] > 0
        ? cell.row > currentCell.row
        : delta[1] < 0
          ? cell.col < currentCell.col
          : cell.col > currentCell.col
  );

  if (candidates.length === 0) {
    return currentCell;
  }

  candidates.sort((left, right) => {
    const leftDistance =
      Math.abs(left.row - currentCell.row) +
      Math.abs(left.col - currentCell.col);
    const rightDistance =
      Math.abs(right.row - currentCell.row) +
      Math.abs(right.col - currentCell.col);
    return leftDistance - rightDistance;
  });

  return candidates[0];
}

export function eventAnnouncement(event = {}) {
  const level = Number(event.level);
  const levelSuffix = Number.isFinite(level)
    ? ` Level ${level}.`
    : "";

  switch (event.name) {
    case "bird_escape":
      return `Bird escaped.${levelSuffix}`;
    case "blocked_tap":
      return "That bird is blocked by another bird in its flight path.";
    case "safe_hint_used":
      return "Hint shown. The recommended bird is highlighted.";
    case "undo":
      return "Last move undone.";
    case "level_restart":
      return "Puzzle restarted.";
    case "level_deadlock":
      return "No safe escapes remain. Undo or restart is available.";
    case "puzzle_complete": {
      const feathers = Number(event.feathersEarned);
      return Number.isInteger(feathers)
        ? `Flock freed. ${feathers} of 3 feathers earned.${levelSuffix}`
        : `Flock freed.${levelSuffix}`;
    }
    case "theme_selected":
      return event.themeId
        ? `${String(event.themeId)} paper theme selected.`
        : "Paper theme selected.";
    default:
      return "";
  }
}

export function sanitizeAccessibilityLabel(value, maximum = 240) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}
