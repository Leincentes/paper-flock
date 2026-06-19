import {
  STORAGE_KEYS
} from "./storage-core.js";
import {
  DEFAULT_PERFORMANCE_BUDGETS,
  evaluatePerformanceSample
} from "./release-core.js";

const BUILD_VERSION = "1.4.4";
const MAX_SAMPLES = 30;
const state = {
  lcp: 0,
  cls: 0,
  interactions: [],
  longTasks: 0,
  finalized: false
};

observeLargestContentfulPaint();
observeLayoutShift();
observeInteractions();
observeLongTasks();

globalThis.addEventListener("pagehide", finalizeSample, {
  once: true
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    finalizeSample();
  }
});

function supportsObserver(type) {
  return (
    "PerformanceObserver" in globalThis &&
    PerformanceObserver.supportedEntryTypes?.includes(type)
  );
}

function observeLargestContentfulPaint() {
  if (!supportsObserver("largest-contentful-paint")) {
    return;
  }
  const observer = new PerformanceObserver((list) => {
    const entries = list.getEntries();
    const last = entries.at(-1);
    if (last) {
      state.lcp = Math.max(state.lcp, last.startTime);
    }
  });
  observer.observe({
    type: "largest-contentful-paint",
    buffered: true
  });
}

function observeLayoutShift() {
  if (!supportsObserver("layout-shift")) {
    return;
  }
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (!entry.hadRecentInput) {
        state.cls += entry.value;
      }
    }
  });
  observer.observe({
    type: "layout-shift",
    buffered: true
  });
}

function observeInteractions() {
  if (!supportsObserver("event")) {
    return;
  }
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (
        entry.interactionId &&
        Number.isFinite(entry.duration)
      ) {
        state.interactions.push(entry.duration);
      }
    }
  });
  observer.observe({
    type: "event",
    buffered: true,
    durationThreshold: 16
  });
}

function observeLongTasks() {
  if (!supportsObserver("longtask")) {
    return;
  }
  const observer = new PerformanceObserver((list) => {
    state.longTasks += list.getEntries().length;
  });
  observer.observe({
    type: "longtask",
    buffered: true
  });
}

function approximateInp() {
  if (state.interactions.length === 0) {
    return 0;
  }
  return Math.max(...state.interactions);
}

function loadHistory() {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.performanceHistory) || "[]"
    );
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function finalizeSample() {
  if (state.finalized) {
    return;
  }
  state.finalized = true;

  const sample = {
    buildVersion: BUILD_VERSION,
    recordedAt: new Date().toISOString(),
    largestContentfulPaintMs: Math.round(state.lcp),
    interactionToNextPaintMs: Math.round(approximateInp()),
    cumulativeLayoutShift: Number(state.cls.toFixed(4)),
    longTaskCount: state.longTasks,
    navigationType:
      performance.getEntriesByType("navigation")[0]?.type ?? "",
    evaluation: evaluatePerformanceSample(
      {
        largestContentfulPaintMs: state.lcp,
        interactionToNextPaintMs: approximateInp(),
        cumulativeLayoutShift: state.cls,
        longTaskCount: state.longTasks
      },
      DEFAULT_PERFORMANCE_BUDGETS
    )
  };

  const history = [...loadHistory(), sample].slice(-MAX_SAMPLES);
  try {
    localStorage.setItem(
      STORAGE_KEYS.performanceHistory,
      JSON.stringify(history)
    );
  } catch {
    // Performance collection is optional and must never block play.
  }
}
