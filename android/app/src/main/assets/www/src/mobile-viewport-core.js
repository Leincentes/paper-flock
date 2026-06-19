export const MOBILE_GAMEPLAY_BREAKPOINT = 760;

export function shouldLockGameplayViewport({
  width,
  height,
  isMobileLike = false,
  isStandalone = false,
  force = false
} = {}) {
  if (force) {
    return true;
  }

  const numericWidth = Number(width);
  const numericHeight = Number(height);
  if (
    !Number.isFinite(numericWidth) ||
    !Number.isFinite(numericHeight) ||
    numericWidth <= 0 ||
    numericHeight <= 0
  ) {
    return false;
  }

  return (
    numericWidth <= MOBILE_GAMEPLAY_BREAKPOINT &&
    (isMobileLike || isStandalone || numericWidth <= 520)
  );
}

export function viewportHeightClass(height) {
  const value = Number(height);
  if (!Number.isFinite(value)) {
    return "normal";
  }
  if (value < 590) {
    return "critical";
  }
  if (value < 700) {
    return "tight";
  }
  return "normal";
}

export function calculateMobileBoardSize({
  viewportWidth,
  viewportHeight,
  horizontalChrome = 40,
  verticalChrome = 320,
  minimum = 150,
  maximum = 520
} = {}) {
  const width = Number(viewportWidth);
  const height = Number(viewportHeight);
  const horizontal = Number(horizontalChrome);
  const vertical = Number(verticalChrome);

  if (
    ![width, height, horizontal, vertical].every(
      Number.isFinite
    )
  ) {
    return minimum;
  }

  const availableWidth = Math.max(0, width - horizontal);
  const availableHeight = Math.max(0, height - vertical);
  return Math.round(
    Math.max(
      minimum,
      Math.min(maximum, availableWidth, availableHeight)
    )
  );
}

export function estimateFixedGameplayHeight({
  hero = 0,
  hud = 0,
  lesson = 0,
  journey = 0,
  controls = 0,
  moreButton = 0,
  shellPadding = 0,
  cardPadding = 0,
  gaps = 0
} = {}) {
  return [
    hero,
    hud,
    lesson,
    journey,
    controls,
    moreButton,
    shellPadding,
    cardPadding,
    gaps
  ].reduce(
    (sum, value) =>
      sum + (Number.isFinite(Number(value)) ? Number(value) : 0),
    0
  );
}
