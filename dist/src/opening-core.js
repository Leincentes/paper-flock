export const OPENING_SCHEMA_VERSION = 1;

export const DEFAULT_OPENING_PREFERENCE = Object.freeze({
  schemaVersion: OPENING_SCHEMA_VERSION,
  seen: false,
  showOnLaunch: false
});

export function normalizeOpeningPreference(value = {}) {
  const source =
    value && typeof value === "object" && !Array.isArray(value)
      ? value
      : {};

  return {
    schemaVersion: OPENING_SCHEMA_VERSION,
    seen: source.seen === true,
    showOnLaunch: source.showOnLaunch === true
  };
}

export function shouldShowOpening({
  preference = {},
  hasExistingSave = false,
  force = false
} = {}) {
  if (force) {
    return true;
  }

  const normalized = normalizeOpeningPreference(preference);
  if (normalized.showOnLaunch) {
    return true;
  }

  return !hasExistingSave && !normalized.seen;
}

export function markOpeningSeen(preference = {}) {
  return {
    ...normalizeOpeningPreference(preference),
    seen: true
  };
}

export function setOpeningLaunchPreference(
  preference = {},
  showOnLaunch = false
) {
  return {
    ...normalizeOpeningPreference(preference),
    showOnLaunch: showOnLaunch === true
  };
}
