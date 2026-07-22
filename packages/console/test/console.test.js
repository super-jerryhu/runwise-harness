import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

import {
  createConsoleServer,
  loadArtifactContent,
  renderConsoleHtml,
  renderRunDetailHtml,
  loadConsoleState,
} from "../src/index.js";
import {
  recordArchiveGap,
  recordArchiveLink,
  recordGrillAnswer,
  recordVerification,
  startRun,
  updateRunStage,
} from "../../core/src/index.js";

const cli = resolve("packages/cli/bin/runwise.js");

function run(args, cwd) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd,
    encoding: "utf8",
  });
}

test("loadConsoleState returns local run progress and gate state", async () => {
  const root = await mkdtemp(join(tmpdir(), "runwise-console-state-"));
  const started = await startRun(root, {
    title: "Console flow",
    now: "2026-07-22T11:10:00Z",
  });
  await recordVerification(started.runDir, {
    command: "npm test",
    exitCode: 0,
    notes: "console state verification",
  });
  await recordGrillAnswer(started.runDir, {
    question: "What console flow should be visible?",
    answer: "Stage progress and archive gap.",
  });
  await recordArchiveGap(started.runDir, "local-only console test");
  await writeFile(join(started.runDir, "TECH_SPEC.md"), "# TECH_SPEC\n\nConsole design details.\n", "utf8");
  await writeFile(
    join(started.runDir, "test_plan.md"),
    [
      "# Test Plan",
      "",
      "Generated from local Runwise scan metadata.",
      "",
      "| ID | Title | Source | Risk | Type | Command | Status |",
      "| --- | --- | --- | --- | --- | --- | --- |",
      "| TC-001 | Run unit tests | acceptance_criteria | regression | automated | npm test | pending |",
      "| TC-002 | Run build | acceptance_criteria | release | automated | npm run build | pending |",
      "| TC-003 | Review console copy | acceptance_criteria | usability | manual | | pending |",
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    join(started.runDir, "test_run.json"),
    `${JSON.stringify({
      status: "pass",
      results: [
        { id: "TC-001", exitCode: 0 },
        { id: "TC-002", exitCode: 0, status: "passed" },
      ],
    })}\n`,
    "utf8",
  );
  await updateRunStage(started.runDir, "testing");

  const state = await loadConsoleState(root);

  assert.equal(state.projectRoot, root);
  assert.equal(state.privacy.sourceUpload, false);
  assert.equal(state.runs.length, 1);
  assert.equal(state.runs[0].id, "20260722-111000-console-flow");
  assert.equal(state.runs[0].title, "Console flow");
  assert.equal(state.runs[0].stage, "testing");
  assert.equal(state.runs[0].finalGate.status, "pass_with_gaps");
  assert.deepEqual(state.runs[0].finalGate.gaps, ["archive"]);
  assert.equal(state.runs[0].progress.currentIndex, 6);
  assert.equal(state.runs[0].progress.total, 11);
  assert.equal(state.runs[0].grill.type, "generic");
  assert.equal(state.runs[0].grill.questionCount, 6);
  assert.equal(state.runs[0].grill.answered, true);
  assert.equal(state.runs[0].grill.answerCount, 1);
  assert.deepEqual(state.runs[0].testPlan, {
    exists: true,
    generated: true,
    caseCount: 3,
    automatedCount: 2,
    manualCount: 1,
  });
  assert.deepEqual(state.runs[0].testRun, {
    exists: true,
    status: "pass",
    total: 2,
    passed: 2,
    failed: 0,
  });
  assert.match(state.runs[0].nextAction, /archive/i);
  assert.deepEqual(state.runs[0].blockers, ["gap: archive"]);
  assert.deepEqual(state.runs[0].archive, { exists: true, status: "gap", url: undefined });
  assert.deepEqual(state.runs[0].memory, { exists: true, captured: false });
  assert.ok(state.runs[0].artifacts.some((artifact) => artifact.name === "TECH_SPEC.md" && artifact.exists));
  assert.ok(state.runs[0].artifacts.some((artifact) => artifact.name === "verification.md" && artifact.exists));
  assert.ok(state.runs[0].artifacts.some((artifact) => artifact.name === "test_plan.md" && artifact.exists));
  assert.ok(state.runs[0].artifacts.some((artifact) => artifact.name === "test_run.json" && artifact.exists));
});

test("loadConsoleState reports archive links, missing archives, and memory capture", async () => {
  const root = await mkdtemp(join(tmpdir(), "runwise-console-insights-"));
  const empty = await startRun(root, {
    title: "Empty insights",
    now: "2026-07-22T11:13:00Z",
  });
  const linked = await startRun(root, {
    title: "Linked archive",
    now: "2026-07-22T11:14:00Z",
  });
  const recorded = await startRun(root, {
    title: "Recorded archive",
    now: "2026-07-22T11:14:30Z",
  });
  const missing = await startRun(root, {
    title: "Missing insights",
    now: "2026-07-22T11:15:00Z",
  });

  await recordArchiveLink(linked.runDir, {
    title: "Console archive",
    url: "https://linear.app/demo/issue/ENG-123/show-console-insights",
  });
  await writeFile(
    join(linked.runDir, "memory_capture.md"),
    "# Memory Capture\n\nTask: Linked archive\n\n- Console should surface archive and memory progress.\n",
    "utf8",
  );
  await writeFile(join(recorded.runDir, "archive.md"), "# Archive\n\n- Local archive recorded.\n", "utf8");
  await rm(join(missing.runDir, "archive.md"));
  await rm(join(missing.runDir, "memory_capture.md"));

  const state = await loadConsoleState(root);
  const byTitle = new Map(state.runs.map((run) => [run.title, run]));

  assert.deepEqual(byTitle.get("Empty insights").archive, { exists: true, status: "empty", url: undefined });
  assert.deepEqual(byTitle.get("Empty insights").memory, { exists: true, captured: false });
  assert.deepEqual(byTitle.get("Linked archive").archive, {
    exists: true,
    status: "linked",
    url: "https://linear.app/demo/issue/ENG-123/show-console-insights",
  });
  assert.deepEqual(byTitle.get("Linked archive").memory, { exists: true, captured: true });
  assert.deepEqual(byTitle.get("Recorded archive").archive, { exists: true, status: "recorded", url: undefined });
  assert.deepEqual(byTitle.get("Missing insights").archive, { exists: false, status: "missing", url: undefined });
  assert.deepEqual(byTitle.get("Missing insights").memory, { exists: false, captured: false });
});

test("renderConsoleHtml includes run list, progress, and local-first boundary", async () => {
  const html = renderConsoleHtml({
    projectRoot: "/workspace/demo",
    privacy: { sourceUpload: false, mode: "local_only" },
    runs: [
      {
        id: "20260722-111000-console-flow",
        title: "Console <flow>",
        stage: "testing",
        progress: { currentIndex: 6, total: 11, percent: 55, label: "Testing" },
        grill: { type: "backend", questionCount: 8, answerCount: 2, answered: true },
        testPlan: { exists: true, generated: true, caseCount: 3, automatedCount: 2, manualCount: 1 },
        testRun: { exists: true, status: "pass", total: 2, passed: 2, failed: 0 },
        nextAction: "Review archive gap or record canonical archive link.",
        blockers: ["gap: archive"],
        archive: { exists: true, status: "gap", url: undefined },
        memory: { exists: true, captured: false },
        finalGate: { status: "pass_with_gaps", missing: [], gaps: ["archive"], invalid: [] },
        artifacts: [
          { name: "TECH_SPEC.md", exists: true, href: "/runs/20260722-111000-console-flow/artifacts/TECH_SPEC.md" },
          { name: "verification.md", exists: true, href: "/runs/20260722-111000-console-flow/artifacts/verification.md" },
        ],
      },
    ],
  });

  assert.match(html, /Runwise Console/);
  assert.match(html, /Console &lt;flow&gt;/);
  assert.match(html, /\/runs\/20260722-111000-console-flow/);
  assert.match(html, /testing/);
  assert.match(html, /55%/);
  assert.match(html, /backend/);
  assert.match(html, /2\/8 answered/);
  assert.match(html, /3 cases/);
  assert.match(html, /2 automated/);
  assert.match(html, /1 manual/);
  assert.match(html, /pass 2\/2/);
  assert.match(html, /Review archive gap/);
  assert.match(html, /gap: archive/);
  assert.match(html, /archive gap/i);
  assert.match(html, /memory missing/i);
  assert.match(html, /pass_with_gaps/);
  assert.match(html, /TECH_SPEC\.md/);
  assert.match(html, /verification\.md/);
  assert.match(html, /source upload: false/i);
});

test("renderConsoleHtml does not label archive evidence without a URL as a link", async () => {
  const html = renderConsoleHtml({
    projectRoot: "/workspace/demo",
    privacy: { sourceUpload: false, mode: "local_only" },
    runs: [
      {
        id: "20260722-111600-recorded-archive",
        title: "Recorded archive",
        stage: "archive",
        archive: { exists: true, status: "recorded", url: undefined },
        memory: { exists: true, captured: true },
        finalGate: { status: "pass", missing: [], gaps: [], invalid: [] },
      },
    ],
  });

  assert.match(html, /archive recorded/i);
  assert.doesNotMatch(html, /archive link/i);
});

test("renderRunDetailHtml shows one run with insights and artifact links", async () => {
  const html = renderRunDetailHtml({
    projectRoot: "/workspace/demo",
    privacy: { sourceUpload: false, mode: "local_only" },
    run: {
      id: "20260722-111700-detail-flow",
      title: "Detail <flow>",
      stage: "testing",
      progress: { currentIndex: 6, total: 11, percent: 55, label: "Testing" },
      grill: { type: "backend", questionCount: 8, answerCount: 3, answered: true },
      testPlan: { exists: true, generated: true, caseCount: 4, automatedCount: 3, manualCount: 1 },
      testRun: { exists: true, status: "fail", total: 4, passed: 3, failed: 1 },
      archive: { exists: true, status: "linked", url: "https://linear.app/demo/issue/ENG-123/detail-flow" },
      memory: { exists: true, captured: true },
      nextAction: "Fix failing tests, rerun test-run, then run final gate.",
      blockers: ["invalid: test_run_failed"],
      finalGate: { status: "fail", missing: [], gaps: [], invalid: ["test_run_failed"] },
      artifacts: [
        { name: "TECH_SPEC.md", exists: true, href: "/runs/20260722-111700-detail-flow/artifacts/TECH_SPEC.md" },
        { name: "test_run.json", exists: true, href: "/runs/20260722-111700-detail-flow/artifacts/test_run.json" },
      ],
    },
  });

  assert.match(html, /Run Detail/);
  assert.match(html, /Detail &lt;flow&gt;/);
  assert.match(html, /backend/);
  assert.match(html, /3\/8 answered/);
  assert.match(html, /4 cases/);
  assert.match(html, /fail 1\/4/);
  assert.match(html, /archive link/);
  assert.match(html, /memory captured/);
  assert.match(html, /Fix failing tests/);
  assert.match(html, /TECH_SPEC\.md/);
  assert.match(html, /test_run\.json/);
  assert.match(html, /Back to runs/);
});

test("loadConsoleState reports missing and invalid test run evidence without crashing", async () => {
  const root = await mkdtemp(join(tmpdir(), "runwise-console-test-run-"));
  const missing = await startRun(root, {
    title: "Missing test run",
    now: "2026-07-22T11:13:00Z",
  });
  const invalid = await startRun(root, {
    title: "Invalid test run",
    now: "2026-07-22T11:14:00Z",
  });
  await writeFile(join(invalid.runDir, "test_run.json"), "{ bad json", "utf8");

  const state = await loadConsoleState(root);

  assert.equal(state.runs.find((run) => run.id === missing.runId).testRun.status, "missing");
  assert.deepEqual(state.runs.find((run) => run.id === invalid.runId).testRun, {
    exists: true,
    status: "invalid",
    total: 0,
    passed: 0,
    failed: 0,
  });
});

test("loadConsoleState counts status-passed test run results", async () => {
  const root = await mkdtemp(join(tmpdir(), "runwise-console-test-run-count-"));
  const started = await startRun(root, {
    title: "Status passed test run",
    now: "2026-07-22T11:15:00Z",
  });
  await writeFile(
    join(started.runDir, "test_run.json"),
    `${JSON.stringify({ status: "pass", results: [{ id: "TC-001", status: "passed" }] })}\n`,
    "utf8",
  );

  const state = await loadConsoleState(root);

  assert.equal(state.runs[0].testRun.total, 1);
  assert.equal(state.runs[0].testRun.passed, 1);
  assert.equal(state.runs[0].testRun.failed, 0);
});

test("loadArtifactContent reads only known local run artifacts", async () => {
  const root = await mkdtemp(join(tmpdir(), "runwise-console-artifact-"));
  const started = await startRun(root, {
    title: "Artifact flow",
    now: "2026-07-22T11:12:00Z",
  });
  await writeFile(join(started.runDir, "TECH_SPEC.md"), "# TECH_SPEC\n\nArtifact detail.\n", "utf8");

  const artifact = await loadArtifactContent(root, "20260722-111200-artifact-flow", "TECH_SPEC.md");

  assert.equal(artifact.content, "# TECH_SPEC\n\nArtifact detail.\n");
  await assert.rejects(() => loadArtifactContent(root, "20260722-111200-artifact-flow", "../run.yaml"), /Unknown artifact/);
});

test("createConsoleServer serves HTML and API state locally", async () => {
  const root = await mkdtemp(join(tmpdir(), "runwise-console-server-"));
  await startRun(root, {
    title: "Serve console",
    now: "2026-07-22T11:11:00Z",
  });

  const server = createConsoleServer({ root });
  await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const address = server.address();
  try {
    const html = await fetch(`http://127.0.0.1:${address.port}/`).then((response) => response.text());
    assert.match(html, /Runwise Console/);
    assert.match(html, /Serve console/);

    const state = await fetch(`http://127.0.0.1:${address.port}/api/state`).then((response) => response.json());
    assert.equal(state.runs[0].id, "20260722-111100-serve-console");

    const detail = await fetch(`http://127.0.0.1:${address.port}/runs/20260722-111100-serve-console`).then((response) =>
      response.text(),
    );
    assert.match(detail, /Run Detail/);
    assert.match(detail, /Serve console/);
    assert.match(detail, /Back to runs/);

    const artifact = await fetch(
      `http://127.0.0.1:${address.port}/runs/20260722-111100-serve-console/artifacts/intake.md`,
    ).then((response) => response.text());
    assert.match(artifact, /Task: Serve console/);
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
  }
});

test("CLI documents the local console command", () => {
  const help = run(["--help"], process.cwd());

  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /runwise console/);
});
