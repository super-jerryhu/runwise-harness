import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

import { createConsoleServer, loadArtifactContent, renderConsoleHtml, loadConsoleState } from "../src/index.js";
import { recordArchiveGap, recordVerification, startRun, updateRunStage } from "../../core/src/index.js";

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
  await recordArchiveGap(started.runDir, "local-only console test");
  await writeFile(join(started.runDir, "TECH_SPEC.md"), "# TECH_SPEC\n\nConsole design details.\n", "utf8");
  await writeFile(join(started.runDir, "test_run.json"), `${JSON.stringify({ status: "pass", results: [] })}\n`, "utf8");
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
  assert.match(state.runs[0].nextAction, /archive/i);
  assert.deepEqual(state.runs[0].blockers, ["gap: archive"]);
  assert.ok(state.runs[0].artifacts.some((artifact) => artifact.name === "TECH_SPEC.md" && artifact.exists));
  assert.ok(state.runs[0].artifacts.some((artifact) => artifact.name === "verification.md" && artifact.exists));
  assert.ok(state.runs[0].artifacts.some((artifact) => artifact.name === "test_plan.md" && artifact.exists));
  assert.ok(state.runs[0].artifacts.some((artifact) => artifact.name === "test_run.json" && artifact.exists));
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
        nextAction: "Review archive gap or record canonical archive link.",
        blockers: ["gap: archive"],
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
  assert.match(html, /testing/);
  assert.match(html, /55%/);
  assert.match(html, /Review archive gap/);
  assert.match(html, /gap: archive/);
  assert.match(html, /pass_with_gaps/);
  assert.match(html, /TECH_SPEC\.md/);
  assert.match(html, /verification\.md/);
  assert.match(html, /source upload: false/i);
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
