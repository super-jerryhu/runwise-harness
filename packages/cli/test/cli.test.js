import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const cli = resolve("packages/cli/bin/runwise.js");

function run(args, cwd) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd,
    encoding: "utf8",
  });
}

test("CLI can init, start, status, and final-gate a local project", async () => {
  const root = await mkdtemp(join(tmpdir(), "runwise-cli-"));

  assert.equal(run(["init", "--name", "cli-demo"], root).status, 0);

  const start = run(["start", "Add cli flow", "--now", "2026-07-22T10:02:00Z"], root);
  assert.equal(start.status, 0, start.stderr);
  assert.match(start.stdout, /20260722-100200-add-cli-flow/);

  const status = run(["status"], root);
  assert.equal(status.status, 0, status.stderr);
  assert.match(status.stdout, /Add cli flow/);

  const gate = run(["final-gate", "20260722-100200-add-cli-flow"], root);
  assert.equal(gate.status, 1);
  assert.match(gate.stdout, /fail/);

  const runYaml = await readFile(
    join(root, ".runwise", "runs", "20260722-100200-add-cli-flow", "run.yaml"),
    "utf8",
  );
  assert.match(runYaml, /stage: intake/);
});

test("CLI can record test planning, verification, and archive gaps for final gate", async () => {
  const root = await mkdtemp(join(tmpdir(), "runwise-cli-gate-"));

  assert.equal(run(["init", "--name", "cli-demo"], root).status, 0);
  assert.equal(run(["start", "Add verified flow", "--now", "2026-07-22T10:03:00Z"], root).status, 0);

  const plan = run(["test-plan", "20260722-100300-add-verified-flow"], root);
  assert.equal(plan.status, 0, plan.stderr);
  assert.match(plan.stdout, /test_plan.md/);

  const verify = run(
    [
      "verify",
      "20260722-100300-add-verified-flow",
      "--command",
      "npm test",
      "--exit-code",
      "0",
      "--notes",
      "5 tests passed",
    ],
    root,
  );
  assert.equal(verify.status, 0, verify.stderr);

  const archive = run(
    ["archive-gap", "20260722-100300-add-verified-flow", "--reason", "local-only bootstrap"],
    root,
  );
  assert.equal(archive.status, 0, archive.stderr);

  const gate = run(["final-gate", "20260722-100300-add-verified-flow"], root);
  assert.equal(gate.status, 0, gate.stdout);
  assert.match(gate.stdout, /pass_with_gaps/);
});
