const state = {
  snapshot: null,
  activeCategory: "all"
};

injectJournal();
wireJournal();
requestJournalState();

function injectJournal() {
  const entry = document.querySelector(".settings-entry");
  if (entry) {
    const button = document.createElement("button");
    button.id = "journal-button";
    button.className = "journal-button";
    button.type = "button";
    button.setAttribute("aria-haspopup", "dialog");
    button.setAttribute("aria-controls", "achievement-journal");
    button.innerHTML = `
      <span aria-hidden="true">✦</span>
      <span>Journal</span>
      <span
        class="journal-unseen-badge"
        id="journal-unseen-badge"
        hidden
      ></span>
    `;
    entry.append(button);
  }

  document.body.insertAdjacentHTML(
    "beforeend",
    `
      <div
        class="journal-page"
        id="achievement-journal"
        hidden
      >
        <section
          class="journal-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="journal-title"
        >
          <header class="journal-header">
            <div>
              <span class="journal-kicker">
                Paper Flock journey
              </span>
              <h2 id="journal-title">Achievement Journal</h2>
              <p>
                Permanent milestones, player statistics, and the next
                meaningful goal. No streaks or expiring rewards.
              </p>
            </div>
            <button
              class="journal-close"
              id="journal-close-button"
              type="button"
              aria-label="Close achievement journal"
            >
              ×
            </button>
          </header>

          <div class="journal-content">
            <section
              class="journal-overview"
              aria-labelledby="journal-overview-title"
            >
              <div class="journal-summary">
                <span>Achievements</span>
                <strong id="journal-summary-value">0/20</strong>
                <div
                  class="journal-summary-rail"
                  role="progressbar"
                  aria-label="Achievement completion"
                  aria-valuemin="0"
                  aria-valuemax="20"
                  aria-valuenow="0"
                >
                  <span id="journal-summary-fill"></span>
                </div>
              </div>

              <article class="journal-next-goal">
                <span>Recommended next goal</span>
                <h3 id="journal-goal-title">Continue the journey</h3>
                <p id="journal-goal-description">
                  Your next goal will appear here.
                </p>
                <button
                  id="journal-goal-button"
                  type="button"
                >
                  Continue
                </button>
              </article>
            </section>

            <section
              aria-labelledby="journal-statistics-title"
            >
              <div class="journal-section-heading">
                <span>Lifetime record</span>
                <h3 id="journal-statistics-title">Player statistics</h3>
              </div>
              <div
                class="journal-stat-grid"
                id="journal-stat-grid"
              ></div>
            </section>

            <section
              aria-labelledby="journal-achievements-title"
            >
              <div class="journal-section-heading">
                <span>Milestones</span>
                <h3 id="journal-achievements-title">Achievements</h3>
              </div>

              <div
                class="journal-filters"
                id="journal-filters"
                role="group"
                aria-label="Achievement categories"
              ></div>

              <div
                class="achievement-grid"
                id="achievement-grid"
              ></div>
            </section>
          </div>

          <p
            class="journal-status"
            id="journal-status"
            role="status"
            aria-live="polite"
          ></p>
        </section>
      </div>

      <div
        class="achievement-toast"
        id="achievement-toast"
        role="status"
        aria-live="polite"
        hidden
      >
        <span aria-hidden="true" id="achievement-toast-icon">✦</span>
        <span>
          <small>Achievement unlocked</small>
          <strong id="achievement-toast-title"></strong>
        </span>
      </div>
    `
  );
}

function elements() {
  return {
    open: document.querySelector("#journal-button"),
    unseenBadge: document.querySelector("#journal-unseen-badge"),
    page: document.querySelector("#achievement-journal"),
    panel: document.querySelector(".journal-panel"),
    close: document.querySelector("#journal-close-button"),
    summaryValue: document.querySelector("#journal-summary-value"),
    summaryRail: document.querySelector(".journal-summary-rail"),
    summaryFill: document.querySelector("#journal-summary-fill"),
    goalTitle: document.querySelector("#journal-goal-title"),
    goalDescription: document.querySelector(
      "#journal-goal-description"
    ),
    goalButton: document.querySelector("#journal-goal-button"),
    statGrid: document.querySelector("#journal-stat-grid"),
    filters: document.querySelector("#journal-filters"),
    achievementGrid: document.querySelector("#achievement-grid"),
    status: document.querySelector("#journal-status"),
    toast: document.querySelector("#achievement-toast"),
    toastIcon: document.querySelector("#achievement-toast-icon"),
    toastTitle: document.querySelector("#achievement-toast-title")
  };
}

function wireJournal() {
  const el = elements();

  el.open?.addEventListener("click", openJournal);
  el.close?.addEventListener("click", closeJournal);
  el.page?.addEventListener("click", (event) => {
    if (event.target === el.page) {
      closeJournal();
    }
  });
  el.goalButton?.addEventListener("click", runRecommendedGoal);

  globalThis.addEventListener(
    "paperflock:journal-state",
    (event) => {
      state.snapshot = event.detail ?? null;
      renderJournal();
    }
  );

  globalThis.addEventListener(
    "paperflock:achievement-unlocked",
    (event) => {
      const achievements = Array.isArray(event.detail?.achievements)
        ? event.detail.achievements
        : [];
      if (achievements.length === 0) {
        return;
      }
      showAchievementToast(achievements[0]);
      requestJournalState();
    }
  );
}

function requestJournalState() {
  globalThis.dispatchEvent(
    new CustomEvent("paperflock:journal-state-request")
  );
}

function openJournal() {
  const el = elements();

  requestJournalState();
  el.page.hidden = false;
  document.body.classList.add("journal-open");
  globalThis.dispatchEvent(
    new CustomEvent("paperflock:journal-opened")
  );
}

function closeJournal() {
  const el = elements();
  if (el.page.hidden) {
    return;
  }

  el.page.hidden = true;
  document.body.classList.remove("journal-open");
}

function renderJournal() {
  const snapshot = state.snapshot;
  if (!snapshot) {
    return;
  }

  const el = elements();
  const summary = snapshot.summary ?? {
    unlocked: 0,
    total: 20,
    unseen: 0,
    percent: 0
  };

  el.summaryValue.textContent =
    `${summary.unlocked}/${summary.total}`;
  el.summaryRail.setAttribute(
    "aria-valuemax",
    String(summary.total)
  );
  el.summaryRail.setAttribute(
    "aria-valuenow",
    String(summary.unlocked)
  );
  el.summaryFill.style.width = `${summary.percent}%`;

  el.unseenBadge.hidden = summary.unseen === 0;
  el.unseenBadge.textContent =
    summary.unseen > 9 ? "9+" : String(summary.unseen);
  el.open?.setAttribute(
    "aria-label",
    summary.unseen > 0
      ? `Achievement Journal, ${summary.unseen} new`
      : "Achievement Journal"
  );

  renderRecommendation(snapshot.recommendation);
  renderStatistics(snapshot);
  renderFilters(snapshot.categories ?? []);
  renderAchievements(snapshot.achievements ?? []);
}

function renderRecommendation(recommendation) {
  const el = elements();
  const goal = recommendation ?? {
    kind: "complete",
    title: "Review achievements",
    description: "Your journey record is ready.",
    actionLabel: "Review achievements",
    level: null
  };

  el.goalTitle.textContent = goal.title;
  el.goalDescription.textContent = goal.description;
  el.goalButton.textContent = goal.actionLabel;
  el.goalButton.dataset.kind = goal.kind;
  el.goalButton.dataset.level =
    Number.isInteger(goal.level)
      ? String(goal.level)
      : "";
  el.goalButton.hidden = goal.kind === "complete";
}

function renderStatistics(snapshot) {
  const el = elements();
  const stats = snapshot.stats ?? {};
  const metrics = snapshot.metrics ?? {};
  const items = [
    ["Campaign", `${metrics.campaignCompleted ?? 0}/40`],
    ["Mastered", `${metrics.masteredLevels ?? 0}/40`],
    ["Feathers", `${metrics.campaignFeathers ?? 0}/120`],
    ["Daily flocks", String(metrics.dailyCompleted ?? 0)],
    ["Puzzle finishes", String(stats.puzzleCompletions ?? 0)],
    ["Clean finishes", String(stats.cleanCompletions ?? 0)],
    ["Moves", String(stats.totalMoves ?? 0)],
    ["Hints", String(stats.totalHints ?? 0)],
    ["Restarts", String(stats.totalRestarts ?? 0)],
    ["Undo actions", String(stats.totalUndos ?? 0)]
  ];

  el.statGrid.replaceChildren();
  for (const [label, value] of items) {
    const card = document.createElement("div");
    card.className = "journal-stat";
    const strong = document.createElement("strong");
    strong.textContent = value;
    const span = document.createElement("span");
    span.textContent = label;
    card.append(strong, span);
    el.statGrid.append(card);
  }
}

function renderFilters(categories) {
  const el = elements();
  el.filters.replaceChildren();

  const options = [
    {
      id: "all",
      name: "All"
    },
    ...categories
  ];

  for (const option of options) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = option.name;
    button.dataset.journalFilter = option.id;
    const active = state.activeCategory === option.id;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
    button.addEventListener("click", () => {
      state.activeCategory = option.id;
      renderJournal();
    });
    el.filters.append(button);
  }
}

function renderAchievements(achievements) {
  const el = elements();
  el.achievementGrid.replaceChildren();

  const visible = achievements.filter(
    (achievement) =>
      state.activeCategory === "all" ||
      achievement.category === state.activeCategory
  );

  for (const achievement of visible) {
    const card = document.createElement("article");
    card.className = "achievement-card";
    card.classList.toggle("unlocked", achievement.unlocked);
    card.classList.toggle(
      "new",
      achievement.unlocked && !achievement.seen
    );

    const icon = document.createElement("span");
    icon.className = "achievement-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = achievement.icon;

    const copy = document.createElement("div");
    copy.className = "achievement-copy";

    const heading = document.createElement("div");
    heading.className = "achievement-heading";
    const title = document.createElement("h4");
    title.textContent = achievement.title;
    const status = document.createElement("span");
    status.textContent = achievement.unlocked
      ? achievement.seen
        ? "Unlocked"
        : "New"
      : `${achievement.current}/${achievement.target}`;
    heading.append(title, status);

    const description = document.createElement("p");
    description.textContent = achievement.description;

    const rail = document.createElement("div");
    rail.className = "achievement-progress";
    rail.setAttribute("role", "progressbar");
    rail.setAttribute(
      "aria-label",
      `${achievement.title} progress`
    );
    rail.setAttribute("aria-valuemin", "0");
    rail.setAttribute(
      "aria-valuemax",
      String(achievement.target)
    );
    rail.setAttribute(
      "aria-valuenow",
      String(achievement.current)
    );
    const fill = document.createElement("span");
    fill.style.width = `${achievement.percent}%`;
    rail.append(fill);

    copy.append(heading, description, rail);
    card.append(icon, copy);
    el.achievementGrid.append(card);
  }
}

function runRecommendedGoal() {
  const button = elements().goalButton;
  const kind = button.dataset.kind;
  const level = Number(button.dataset.level);

  closeJournal();
  globalThis.dispatchEvent(
    new CustomEvent("paperflock:journal-action", {
      detail: {
        kind,
        level: Number.isInteger(level) ? level : null
      }
    })
  );
}

let toastTimer = null;

function showAchievementToast(achievement) {
  const el = elements();
  clearTimeout(toastTimer);

  el.toastIcon.textContent = achievement.icon ?? "✦";
  el.toastTitle.textContent =
    achievement.title ?? "New achievement";
  el.toast.hidden = false;
  requestAnimationFrame(() =>
    el.toast.classList.add("visible")
  );

  toastTimer = setTimeout(() => {
    el.toast.classList.remove("visible");
    setTimeout(() => {
      el.toast.hidden = true;
    }, 250);
  }, 4200);
}
