import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { cp } from "node:fs/promises";
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

test("CLI can generate a test plan from scanner output", async () => {
  const root = await mkdtemp(join(tmpdir(), "runwise-cli-generate-tests-"));
  await cp(resolve("fixtures/basic-node"), root, { recursive: true });

  assert.equal(run(["scan"], root).status, 0);
  assert.equal(run(["start", "Generate CLI tests", "--now", "2026-07-22T12:01:00Z"], root).status, 0);

  const generated = run(["test-plan", "20260722-120100-generate-cli-tests", "--generate"], root);
  assert.equal(generated.status, 0, generated.stderr);
  assert.match(generated.stdout, /generated 2 test cases/i);

  const plan = await readFile(
    join(root, ".runwise", "runs", "20260722-120100-generate-cli-tests", "test_plan.md"),
    "utf8",
  );
  assert.match(plan, /TC-001/);
  assert.match(plan, /npm test/);
  assert.match(plan, /TC-002/);
  assert.match(plan, /npm run build/);
});

test("CLI can update a run stage for progress tracking", async () => {
  const root = await mkdtemp(join(tmpdir(), "runwise-cli-stage-"));

  assert.equal(run(["start", "Track stage", "--now", "2026-07-22T12:04:00Z"], root).status, 0);

  const updated = run(["stage", "20260722-120400-track-stage", "testing", "--json"], root);
  assert.equal(updated.status, 0, updated.stderr);
  const payload = JSON.parse(updated.stdout);
  assert.equal(payload.stage, "testing");

  const status = JSON.parse(run(["status", "--json"], root).stdout);
  assert.equal(status.runs[0].stage, "testing");
});

test("CLI can execute generated test plan commands and record verification evidence", async () => {
  const root = await mkdtemp(join(tmpdir(), "runwise-cli-test-run-"));
  await writeFile(
    join(root, "package.json"),
    JSON.stringify({
      scripts: {
        test: "node test.js",
        build: "node build.js",
      },
    }),
  );
  await writeFile(join(root, "test.js"), "console.log('test ok');\n");
  await writeFile(join(root, "build.js"), "console.log('build ok');\n");

  assert.equal(run(["scan"], root).status, 0);
  assert.equal(run(["start", "Execute test plan", "--now", "2026-07-22T12:02:00Z"], root).status, 0);
  assert.equal(run(["test-plan", "20260722-120200-execute-test-plan", "--generate"], root).status, 0);

  const executed = run(["test-run", "20260722-120200-execute-test-plan"], root);

  assert.equal(executed.status, 0, executed.stderr);
  assert.match(executed.stdout, /passed 2\/2/i);

  const runDir = join(root, ".runwise", "runs", "20260722-120200-execute-test-plan");
  const verification = await readFile(join(runDir, "verification.md"), "utf8");
  assert.match(verification, /npm test/);
  assert.match(verification, /npm run build/);
  assert.match(verification, /passed/);

  const report = JSON.parse(await readFile(join(runDir, "test_run.json"), "utf8"));
  assert.equal(report.status, "pass");
  assert.deepEqual(report.results.map((result) => result.exitCode), [0, 0]);
});

test("CLI test-run returns failure and still records evidence when a command fails", async () => {
  const root = await mkdtemp(join(tmpdir(), "runwise-cli-test-run-fail-"));
  await writeFile(
    join(root, "package.json"),
    JSON.stringify({
      scripts: {
        test: "node fail.js",
      },
    }),
  );
  await writeFile(join(root, "fail.js"), "process.exit(7);\n");

  assert.equal(run(["scan"], root).status, 0);
  assert.equal(run(["start", "Failing test plan", "--now", "2026-07-22T12:03:00Z"], root).status, 0);
  assert.equal(run(["test-plan", "20260722-120300-failing-test-plan", "--generate"], root).status, 0);

  const executed = run(["test-run", "20260722-120300-failing-test-plan"], root);

  assert.equal(executed.status, 1);
  assert.match(executed.stdout, /failed 1\/1/i);

  const runDir = join(root, ".runwise", "runs", "20260722-120300-failing-test-plan");
  const verification = await readFile(join(runDir, "verification.md"), "utf8");
  assert.match(verification, /npm test/);
  assert.match(verification, /failed/);

  const report = JSON.parse(await readFile(join(runDir, "test_run.json"), "utf8"));
  assert.equal(report.status, "fail");
  assert.equal(report.results[0].exitCode, 7);
});

test("CLI scan emits fixture project metadata without private file contents", async () => {
  const root = await mkdtemp(join(tmpdir(), "runwise-cli-scan-"));
  await cp(resolve("fixtures/basic-node"), root, { recursive: true });

  assert.equal(run(["init", "--name", "fixture"], root).status, 0);
  const scan = run(["scan"], root);

  assert.equal(scan.status, 0, scan.stderr);
  const payload = JSON.parse(scan.stdout);
  assert.equal(payload.packageManager, "npm");
  assert.deepEqual(payload.scripts, ["build", "test"]);
  assert.ok(payload.apiHints.includes("docs/api.md"));
  assert.ok(payload.apiHints.includes("src/api/routes.js"));
  assert.deepEqual(payload.dbHints, ["db/migrations/001_init.sql"]);
  assert.deepEqual(payload.serviceHints, ["src/services/orders.js"]);
  assert.ok(payload.excludedPaths.includes(".env"));
  assert.ok(!scan.stdout.includes("SHOULD_NOT_BE_SCANNED"));
});

test("CLI emits adapter-friendly JSON and writes final gate reports", async () => {
  const root = await mkdtemp(join(tmpdir(), "runwise-cli-json-"));

  assert.equal(run(["init", "--name", "json-demo"], root).status, 0);
  const start = run(["start", "Adapter JSON flow", "--now", "2026-07-22T10:05:00Z", "--json"], root);
  assert.equal(start.status, 0, start.stderr);
  const started = JSON.parse(start.stdout);
  assert.equal(started.runId, "20260722-100500-adapter-json-flow");
  assert.ok(started.runDir.endsWith(".runwise/runs/20260722-100500-adapter-json-flow"));

  const status = run(["status", "--json"], root);
  assert.equal(status.status, 0, status.stderr);
  const statusPayload = JSON.parse(status.stdout);
  assert.equal(statusPayload.runs[0].id, "20260722-100500-adapter-json-flow");

  assert.equal(
    run(
      [
        "verify",
        "20260722-100500-adapter-json-flow",
        "--command",
        "npm test",
        "--exit-code",
        "0",
        "--notes",
        "adapter verification",
      ],
      root,
    ).status,
    0,
  );
  assert.equal(
    run(["archive-gap", "20260722-100500-adapter-json-flow", "--reason", "local-only adapter test"], root).status,
    0,
  );

  const gate = run(["final-gate", "20260722-100500-adapter-json-flow", "--write-report"], root);
  assert.equal(gate.status, 0, gate.stdout);
  const gatePayload = JSON.parse(gate.stdout);
  assert.equal(gatePayload.status, "pass_with_gaps");

  const report = JSON.parse(
    await readFile(join(root, ".runwise", "runs", "20260722-100500-adapter-json-flow", "final_gate.json"), "utf8"),
  );
  assert.equal(report.status, "pass_with_gaps");
  assert.deepEqual(report.gaps, ["archive"]);
});
