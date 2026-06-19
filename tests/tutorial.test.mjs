import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  TUTORIAL_STEP_IDS,
  advanceTutorialSession,
  applyTutorialAction,
  completeTutorialProgress,
  createTutorialSession,
  normalizeTutorialProgress,
  shouldLaunchTutorial,
  skipTutorialProgress,
  startTutorialProgress,
  tutorialHint
} from "../src/tutorial-core.js";

const root = path.resolve(new URL("..", import.meta.url).pathname);

test("new players see the tutorial while existing players are not forced", () => {
  assert.equal(
    shouldLaunchTutorial({
      progress: {},
      hasExistingSave: false
    }),
    true
  );
  assert.equal(
    shouldLaunchTutorial({
      progress: {},
      hasExistingSave: true
    }),
    false
  );
  assert.equal(
    shouldLaunchTutorial({
      progress: { status: "completed" },
      hasExistingSave: false
    }),
    false
  );
  assert.equal(
    shouldLaunchTutorial({
      progress: { status: "completed" },
      force: true
    }),
    true
  );
});

test("tutorial progress records completion, skip, and replay", () => {
  const active = startTutorialProgress(
    normalizeTutorialProgress(),
    {
      replay: true,
      startedAt: "2026-06-19T00:00:00.000Z"
    }
  );
  assert.equal(active.status, "active");
  assert.equal(active.replayCount, 1);

  const skipped = skipTutorialProgress(active, {
    skippedAt: "2026-06-19T00:02:00.000Z"
  });
  assert.equal(skipped.status, "skipped");

  const completed = completeTutorialProgress(active, {
    completedAt: "2026-06-19T00:03:00.000Z"
  });
  assert.equal(completed.status, "completed");
  assert.equal(completed.lastStepId, "practice");
});

test("tutorial advances through all five steps", () => {
  let session = createTutorialSession("welcome");
  const visited = [session.stepId];

  while (advanceTutorialSession(session)) {
    session = advanceTutorialSession(session);
    visited.push(session.stepId);
  }

  assert.deepEqual(visited, TUTORIAL_STEP_IDS);
});

test("clear-path lesson accepts only the highlighted bird", () => {
  const session = createTutorialSession("escape");

  const wrong = applyTutorialAction(session, 0, 0);
  assert.equal(wrong.accepted, false);

  const correct = applyTutorialAction(session, 1, 1);
  assert.equal(correct.accepted, true);
  assert.equal(correct.stepComplete, true);
  assert.equal(correct.board[1][1], -1);
});

test("blocked-path lesson requires a real blocker", () => {
  const session = createTutorialSession("blocked");
  const result = applyTutorialAction(session, 1, 0);

  assert.equal(result.accepted, true);
  assert.equal(result.stepComplete, true);
  assert.deepEqual(result.lastTrace.blocker, {
    row: 1,
    col: 2
  });
});

test("rotation lesson verifies that a touching bird turns clockwise", () => {
  const session = createTutorialSession("rotation");
  const result = applyTutorialAction(session, 1, 0);

  assert.equal(result.accepted, true);
  assert.equal(result.stepComplete, true);
  assert.equal(result.rotated.length, 1);
  assert.equal(result.board[1][1], 1);
});

test("practice board is solvable with the supplied safe hints", () => {
  let session = createTutorialSession("practice");
  let safety = 20;

  while (!session.practiceComplete && safety > 0) {
    const hint = tutorialHint(session);
    assert.ok(hint);
    session = applyTutorialAction(
      session,
      hint.row,
      hint.col
    );
    safety -= 1;
  }

  assert.equal(session.practiceComplete, true);
  assert.equal(session.stepComplete, true);
  assert.ok(session.moves > 0);
});

test("runtime loads and caches both tutorial modules", () => {
  const html = fs.readFileSync(
    path.join(root, "index.html"),
    "utf8"
  );
  const worker = fs.readFileSync(
    path.join(root, "service-worker.js"),
    "utf8"
  );

  assert.match(
    html,
    /src="\.\/src\/tutorial-player-ui\.js"/
  );
  assert.ok(
    html.indexOf("./src/tutorial-player-ui.js") <
      html.indexOf("./src/game-player-ui.js"),
    "tutorial should load before the normal game runtime"
  );
  assert.match(worker, /\.\/src\/tutorial-core\.js/);
  assert.match(worker, /\.\/src\/tutorial-player-ui\.js/);
});

test("tutorial is full-screen, internally scrollable, and replayable", () => {
  const css = fs.readFileSync(
    path.join(root, "styles.css"),
    "utf8"
  );
  const ui = fs.readFileSync(
    path.join(root, "src/tutorial-ui.js"),
    "utf8"
  );

  assert.match(css, /\.first-launch-tutorial/);
  assert.match(css, /overscroll-behavior:\s*none/);
  assert.match(
    css,
    /\.tutorial-panel[\s\S]*overflow-y:\s*auto/
  );
  assert.match(ui, /tutorial-replay-button/);
  assert.match(ui, /How to play/);
});
