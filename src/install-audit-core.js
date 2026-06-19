export const INSTALL_AUDIT_VERSION = 1;
export const INSTALL_CERTIFICATION_KEY =
  "paper-flock-install-certification";
export const REQUIRED_ICON_SIZES = Object.freeze([192, 512]);
export const REQUIRED_DISPLAY_MODES = Object.freeze([
  "standalone",
  "fullscreen",
  "minimal-ui"
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeUrl(value, baseUrl) {
  try {
    return new URL(String(value), String(baseUrl)).href;
  } catch {
    return null;
  }
}

export function parseIconSizes(value) {
  return String(value ?? "")
    .split(/\s+/)
    .map((entry) => entry.match(/^(\d+)x(\d+)$/i))
    .filter(Boolean)
    .map((match) => ({
      width: Number(match[1]),
      height: Number(match[2])
    }));
}

export function validateManifest(
  manifest,
  {
    manifestUrl = "https://example.test/manifest.webmanifest",
    documentUrl = "https://example.test/"
  } = {}
) {
  const checks = [];
  const add = (id, passed, message, severity = "required") => {
    checks.push({
      id,
      passed: Boolean(passed),
      message: String(message),
      severity
    });
  };

  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    add("manifest-object", false, "Manifest is not a JSON object.");
    return {
      valid: false,
      checks,
      resolved: {}
    };
  }

  const appName = String(manifest.name ?? manifest.short_name ?? "").trim();
  add(
    "name",
    appName.length > 0,
    appName
      ? `App name is “${appName}”.`
      : "Manifest needs name or short_name."
  );

  const startUrl = normalizeUrl(manifest.start_url, manifestUrl);
  const scopeUrl = normalizeUrl(manifest.scope ?? "./", manifestUrl);
  const documentResolved = normalizeUrl(documentUrl, documentUrl);

  add(
    "start-url",
    Boolean(startUrl),
    startUrl ? `Start URL resolves to ${startUrl}.` : "start_url is invalid."
  );
  add(
    "scope",
    Boolean(scopeUrl),
    scopeUrl ? `Scope resolves to ${scopeUrl}.` : "scope is invalid."
  );

  const sameOrigin =
    startUrl &&
    scopeUrl &&
    new URL(startUrl).origin === new URL(scopeUrl).origin;
  add(
    "same-origin",
    sameOrigin,
    sameOrigin
      ? "start_url and scope use the same origin."
      : "start_url and scope must use the same origin."
  );

  const startInsideScope =
    startUrl &&
    scopeUrl &&
    new URL(startUrl).pathname.startsWith(new URL(scopeUrl).pathname);
  add(
    "start-in-scope",
    startInsideScope,
    startInsideScope
      ? "start_url is inside manifest scope."
      : "start_url must be inside manifest scope."
  );

  const documentInsideScope =
    documentResolved &&
    scopeUrl &&
    new URL(documentResolved).pathname.startsWith(new URL(scopeUrl).pathname);
  add(
    "document-in-scope",
    documentInsideScope,
    documentInsideScope
      ? "Current page is inside manifest scope."
      : "Current page is outside manifest scope."
  );

  add(
    "display",
    REQUIRED_DISPLAY_MODES.includes(String(manifest.display)),
    REQUIRED_DISPLAY_MODES.includes(String(manifest.display))
      ? `Display mode is ${manifest.display}.`
      : "display should be standalone, fullscreen, or minimal-ui."
  );

  const icons = asArray(manifest.icons);
  const squareSizes = new Set();
  let hasMaskable = false;
  let invalidIcon = false;

  for (const icon of icons) {
    const source = normalizeUrl(icon?.src, manifestUrl);
    const sizes = parseIconSizes(icon?.sizes);
    const type = String(icon?.type ?? "");
    const purposes = String(icon?.purpose ?? "any").split(/\s+/);

    if (!source || sizes.length === 0) {
      invalidIcon = true;
      continue;
    }

    for (const size of sizes) {
      if (size.width === size.height) {
        squareSizes.add(size.width);
      }
    }

    if (purposes.includes("maskable")) {
      hasMaskable = true;
    }

    if (type && !/^image\/(png|webp|svg\+xml)$/i.test(type)) {
      invalidIcon = true;
    }
  }

  for (const required of REQUIRED_ICON_SIZES) {
    add(
      `icon-${required}`,
      squareSizes.has(required),
      squareSizes.has(required)
        ? `${required}×${required} icon is declared.`
        : `${required}×${required} icon is required.`
    );
  }

  add(
    "icon-records",
    icons.length > 0 && !invalidIcon,
    icons.length > 0 && !invalidIcon
      ? `${icons.length} manifest icon record(s) are structurally valid.`
      : "Manifest icon records are missing or malformed."
  );

  add(
    "maskable-icon",
    hasMaskable,
    hasMaskable
      ? "A maskable icon is declared."
      : "Add a maskable icon for better Android icon presentation.",
    "recommended"
  );

  const background = String(manifest.background_color ?? "");
  const theme = String(manifest.theme_color ?? "");
  add(
    "colors",
    Boolean(background && theme),
    background && theme
      ? "Theme and background colors are declared."
      : "theme_color and background_color should be declared.",
    "recommended"
  );

  const description = String(manifest.description ?? "").trim();
  add(
    "description",
    description.length >= 20,
    description.length >= 20
      ? "Manifest description supports richer install UI."
      : "Add a useful manifest description.",
    "recommended"
  );

  const screenshots = asArray(manifest.screenshots);
  add(
    "screenshots",
    screenshots.length > 0,
    screenshots.length > 0
      ? `${screenshots.length} install screenshot(s) declared.`
      : "Add screenshots for richer install UI.",
    "recommended"
  );

  const requiredPassed = checks
    .filter((check) => check.severity === "required")
    .every((check) => check.passed);

  return {
    valid: requiredPassed,
    checks,
    resolved: {
      appName,
      startUrl,
      scopeUrl,
      iconUrls: icons
        .map((icon) => normalizeUrl(icon?.src, manifestUrl))
        .filter(Boolean),
      screenshotUrls: screenshots
        .map((shot) => normalizeUrl(shot?.src, manifestUrl))
        .filter(Boolean)
    }
  };
}

export function evaluateRuntimeInstallability(runtime = {}) {
  const checks = [];
  const add = (id, passed, message, severity = "required") => {
    checks.push({
      id,
      passed: Boolean(passed),
      message: String(message),
      severity
    });
  };

  add(
    "secure-context",
    runtime.secureContext === true,
    runtime.secureContext
      ? "Page is served from HTTPS or localhost."
      : "Installation requires HTTPS or localhost."
  );
  add(
    "manifest-linked",
    runtime.manifestLinked === true,
    runtime.manifestLinked
      ? "A web app manifest is linked."
      : "No web app manifest link was found."
  );
  add(
    "manifest-valid",
    runtime.manifestValid === true,
    runtime.manifestValid
      ? "Manifest passes required structural checks."
      : "Manifest has required-field failures."
  );
  add(
    "icons-accessible",
    runtime.iconsAccessible === true,
    runtime.iconsAccessible
      ? "Required icons were fetched successfully."
      : "One or more required icons could not be fetched."
  );
  add(
    "service-worker-supported",
    runtime.serviceWorkerSupported === true,
    runtime.serviceWorkerSupported
      ? "Service workers are supported."
      : "This browser does not support service workers."
  );
  add(
    "service-worker-active",
    runtime.serviceWorkerActive === true,
    runtime.serviceWorkerActive
      ? "Offline service worker is active."
      : "Offline service worker is not active."
  );
  add(
    "offline-cache-complete",
    runtime.offlineCacheComplete === true,
    runtime.offlineCacheComplete
      ? "Offline app shell cache is complete."
      : "Offline app shell cache is incomplete."
  );

  const installationPathAvailable =
    runtime.standalone === true ||
    runtime.installPromptAvailable === true ||
    runtime.iosManualInstallAvailable === true;

  add(
    "installation-path",
    installationPathAvailable,
    runtime.standalone
      ? "App is running in installed standalone mode."
      : runtime.installPromptAvailable
        ? "Browser install prompt is available."
        : runtime.iosManualInstallAvailable
          ? "Safari Add to Home Screen installation is available."
          : "No supported installation path was detected."
  );

  add(
    "update-safe",
    runtime.updateHandlingReady === true,
    runtime.updateHandlingReady
      ? "Update handling is initialized."
      : "Update handling is not confirmed.",
    "recommended"
  );

  const requiredPassed = checks
    .filter((check) => check.severity === "required")
    .every((check) => check.passed);

  return {
    eligible: requiredPassed,
    checks
  };
}

export function normalizeCertification(value = {}) {
  return {
    schemaVersion: INSTALL_AUDIT_VERSION,
    installedStandalone: Boolean(value.installedStandalone),
    offlineLaunchPassed: Boolean(value.offlineLaunchPassed),
    exactResumePassed: Boolean(value.exactResumePassed),
    updatePassed: Boolean(value.updatePassed),
    androidTested: Boolean(value.androidTested),
    iosTested: Boolean(value.iosTested),
    lastUpdatedAt: String(value.lastUpdatedAt ?? "")
  };
}

export function updateCertification(current, patch = {}, timestamp) {
  return normalizeCertification({
    ...normalizeCertification(current),
    ...clone(patch),
    lastUpdatedAt: String(timestamp ?? new Date().toISOString())
  });
}

export function evaluateMobileCertification({
  runtimeEligible = false,
  certification = {},
  requireBothPlatforms = true
} = {}) {
  const normalized = normalizeCertification(certification);
  const checks = [
    {
      id: "runtime-installable",
      passed: Boolean(runtimeEligible),
      message: "Automatic installability audit passes."
    },
    {
      id: "installed-standalone",
      passed: normalized.installedStandalone,
      message: "App has launched from a Home Screen or installed app icon."
    },
    {
      id: "offline-launch",
      passed: normalized.offlineLaunchPassed,
      message: "Installed app launched and played while offline."
    },
    {
      id: "exact-resume",
      passed: normalized.exactResumePassed,
      message: "Exact active puzzle survived close and relaunch."
    },
    {
      id: "update",
      passed: normalized.updatePassed,
      message: "A deployed update preserved progress and relaunched correctly."
    },
    {
      id: "android",
      passed: normalized.androidTested,
      message: "Android installation path was tested."
    },
    {
      id: "ios",
      passed: normalized.iosTested,
      message: "iPhone or iPad Add to Home Screen path was tested."
    }
  ];

  const required = checks.filter(
    (check) =>
      requireBothPlatforms ||
      !["android", "ios"].includes(check.id)
  );
  const certified = required.every((check) => check.passed);

  return {
    certified,
    decision: certified
      ? "MOBILE INSTALLATION CERTIFIED"
      : "MOBILE INSTALLATION TESTING REQUIRED",
    checks,
    certification: normalized
  };
}

export function createInstallReport({
  buildVersion = "1.4.4",
  generatedAt = new Date().toISOString(),
  pageUrl = "",
  platform = "",
  runtime = {},
  manifest = {},
  cache = {},
  certification = {}
} = {}) {
  const runtimeEvaluation = evaluateRuntimeInstallability(runtime);
  const mobileEvaluation = evaluateMobileCertification({
    runtimeEligible: runtimeEvaluation.eligible,
    certification
  });

  return {
    product: "Paper Flock",
    buildVersion: String(buildVersion),
    reportVersion: INSTALL_AUDIT_VERSION,
    generatedAt: String(generatedAt),
    pageUrl: String(pageUrl),
    platform: String(platform),
    runtime,
    manifest,
    cache,
    runtimeEvaluation,
    mobileEvaluation,
    closedAlphaApproved: false,
    releaseGate: "real-field-evidence-required"
  };
}
