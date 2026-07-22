import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

import { createConsoleServer, renderConsoleHtml, loadConsoleState } from "../src/index.js";
import { recordArchiveGap, recordVerification, startRun } from "../../core/src/index.js";

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

  const state = await loadConsoleState(root);

  assert.equal(state.projectRoot, root);
  assert.equal(state.privacy.sourceUpload, false);
  assert.equal(state.runs.length, 1);
  assert.equal(state.runs[0].id, "20260722-111000-console-flow");
  assert.equal(state.runs[0].title, "Console flow");
  assert.equal(state.runs[0].stage, "intake");
  assert.equal(state.runs[0].finalGate.status, "pass_with_gaps");
  assert.deepEqual(state.runs[0].finalGate.gaps, ["archive"]);
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
        finalGate: { status: "pass_with_gaps", missing: [], gaps: ["archive"], invalid: [] },
      },
    ],
  });

  assert.match(html, /Runwise Console/);
  assert.match(html, /Console &lt;flow&gt;/);
  assert.match(html, /testing/);
  assert.match(html, /pass_with_gaps/);
  assert.match(html, /source upload: false/i);
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
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
  }
});

test("CLI documents the local console command", () => {
  const help = run(["--help"], process.cwd());

  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /runwise console/);
});
