import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  finalGate,
  generateTestPlan,
  initProject,
  scanProject,
  startRun,
  updateRunStage,
} from "../src/index.js";

async function tempRepo() {
  return mkdtemp(join(tmpdir(), "runwise-core-"));
}

test("initProject creates local Runwise project metadata without cloud settings", async () => {
  const root = await tempRepo();

  const result = await initProject(root, { name: "demo" });

  assert.equal(result.projectDir, join(root, ".runwise"));
  const project = await readFile(join(root, ".runwise", "project.yaml"), "utf8");
  assert.match(project, /name: demo/);
  assert.match(project, /privacy_mode: local_only/);
});

test("startRun creates a deterministic local run ledger from templates", async () => {
  const root = await tempRepo();
  await initProject(root, { name: "demo" });

  const result = await startRun(root, {
    title: "Add billing guard",
    now: new Date("2026-07-22T10:00:00Z"),
  });

  assert.match(result.runId, /^20260722-100000-add-billing-guard$/);
  const run = await readFile(join(result.runDir, "run.yaml"), "utf8");
  assert.match(run, /title: Add billing guard/);
  for (const file of [
    "intake.md",
    "grill.md",
    "facts.md",
    "TECH_SPEC.md",
    "subtasks.json",
    "test_plan.md",
    "verification.md",
    "archive.md",
    "final_report.md",
    "memory_capture.md",
  ]) {
    await readFile(join(result.runDir, file), "utf8");
  }
});

test("scanProject records local metadata and does not require source upload", async () => {
  const root = await tempRepo();
  await writeFile(
    join(root, "package.json"),
    JSON.stringify({ scripts: { test: "node --test", build: "node build.js" }, dependencies: { vite: "1.0.0" } }),
  );
  await writeFile(join(root, "README.md"), "# Demo\n");
  await initProject(root, { name: "demo" });

  const result = await scanProject(root);

  assert.equal(result.packageManager, "npm");
  assert.deepEqual(result.scripts.sort(), ["build", "test"]);
  assert.equal(result.privacy.sourceUpload, false);
  const overview = await readFile(join(root, ".runwise", "wiki", "overview.md"), "utf8");
  assert.match(overview, /# Project Overview/);
  assert.match(overview, /package manager: npm/);
});

test("scanProject recursively detects docs, service hints, api hints, db hints, and excludes private paths", async () => {
  const root = await tempRepo();
  await writeFile(
    join(root, "package.json"),
    JSON.stringify({ scripts: { test: "vitest" }, dependencies: { next: "1.0.0" } }),
  );
  await mkdir(join(root, "docs"), { recursive: true });
  await mkdir(join(root, "src", "api"), { recursive: true });
  await mkdir(join(root, "src", "services", "billing"), { recursive: true });
  await mkdir(join(root, "db", "migrations"), { recursive: true });
  await mkdir(join(root, "node_modules", "secret-package"), { recursive: true });
  await mkdir(join(root, ".runwise", "old"), { recursive: true });
  await mkdir(join(root, "privity", "notes"), { recursive: true });
  await writeFile(join(root, "docs", "architecture.md"), "# Architecture\n");
  await writeFile(join(root, "src", "api", "routes.js"), "export const routes = [];\n");
  await writeFile(join(root, "src", "services", "billing", "index.js"), "export function bill() {}\n");
  await writeFile(join(root, "db", "migrations", "001.sql"), "select 1;\n");
  await writeFile(join(root, ".env"), "SECRET=1\n");
  await writeFile(join(root, "node_modules", "secret-package", "README.md"), "# Ignore me\n");
  await writeFile(join(root, ".runwise", "old", "note.md"), "# Ignore me\n");
  await writeFile(join(root, "privity", "notes", "private.md"), "# Private notes\n");

  const result = await scanProject(root);

  assert.deepEqual(result.docs, ["docs/architecture.md"]);
  assert.deepEqual(result.apiHints, ["src/api/routes.js"]);
  assert.deepEqual(result.dbHints, ["db/migrations/001.sql"]);
  assert.deepEqual(result.serviceHints, ["src/services/billing/index.js"]);
  assert.ok(result.excludedPaths.includes(".env"));
  assert.ok(result.excludedPaths.includes("privity"));
  assert.ok(!JSON.stringify(result).includes("SECRET=1"));
  assert.ok(!JSON.stringify(result).includes("Private notes"));
  assert.ok(!JSON.stringify(result).includes("privity/notes"));
  assert.ok(!JSON.stringify(result).includes("secret-package"));
  assert.ok(!JSON.stringify(result).includes(".runwise/old"));
});

test("finalGate fails when verification evidence is missing and passes with explicit gaps", async () => {
  const root = await tempRepo();
  await initProject(root, { name: "demo" });
  const { runDir } = await startRun(root, {
    title: "Add guarded feature",
    now: new Date("2026-07-22T10:01:00Z"),
  });

  const failing = await finalGate(runDir);
  assert.equal(failing.status, "fail");
  assert.ok(failing.missing.includes("verification_evidence"));

  await writeFile(join(runDir, "verification.md"), "# Verification\n\n## Verification Gaps\n\n- Manual verification required.\n");
  await writeFile(join(runDir, "archive.md"), "# Archive\n\nArchive gap: local-only bootstrap.\n");

  const passingWithGaps = await finalGate(runDir);
  assert.equal(passingWithGaps.status, "pass_with_gaps");
});

test("finalGate validates structured subtasks and test plan artifacts", async () => {
  const root = await tempRepo();
  await initProject(root, { name: "demo" });
  const { runDir } = await startRun(root, {
    title: "Add structured gate",
    now: new Date("2026-07-22T10:04:00Z"),
  });
  await writeFile(join(runDir, "verification.md"), "# Verification\n\n- Command recorded: npm test\n- Exit code: 0\n");
  await writeFile(join(runDir, "archive.md"), "# Archive\n\n- Local archive recorded.\n");
  await writeFile(join(runDir, "subtasks.json"), "{ bad json");

  const invalidJson = await finalGate(runDir);
  assert.equal(invalidJson.status, "fail");
  assert.ok(invalidJson.invalid.includes("subtasks.json"));

  await writeFile(join(runDir, "subtasks.json"), JSON.stringify({ task: "x", subtasks: "not-array" }));
  const invalidShape = await finalGate(runDir);
  assert.equal(invalidShape.status, "fail");
  assert.ok(invalidShape.invalid.includes("subtasks.json"));

  await writeFile(join(runDir, "subtasks.json"), JSON.stringify({ task: "x", subtasks: [] }));
  await writeFile(join(runDir, "test_plan.md"), "# Test Plan\n\nNo cases yet.\n");
  const missingCases = await finalGate(runDir);
  assert.equal(missingCases.status, "fail");
  assert.ok(missingCases.missing.includes("test_cases"));

  await writeFile(join(runDir, "test_plan.md"), "# Test Plan\n\n| TC-001 | basic | acceptance_criteria | | unit | npm test | pending |\n");
  const passing = await finalGate(runDir);
  assert.equal(passing.status, "pass");
});

test("finalGate blocks failed or invalid test run reports", async () => {
  const root = await tempRepo();
  await initProject(root, { name: "demo" });
  const { runDir } = await startRun(root, {
    title: "Gate test run",
    now: new Date("2026-07-22T12:05:00Z"),
  });
  await writeFile(join(runDir, "archive.md"), "# Archive\n\n- Local archive recorded.\n");
  await writeFile(join(runDir, "verification.md"), "# Verification\n\n- Command recorded: npm test\n- Exit code: 1\n");
  await writeFile(
    join(runDir, "test_run.json"),
    JSON.stringify({
      status: "fail",
      results: [{ id: "TC-001", command: "npm test", exitCode: 1, status: "failed" }],
    }),
  );

  const failedRun = await finalGate(runDir);
  assert.equal(failedRun.status, "fail");
  assert.ok(failedRun.invalid.includes("test_run_failed"));

  await writeFile(join(runDir, "test_run.json"), "{ bad json");
  const invalidRun = await finalGate(runDir);
  assert.equal(invalidRun.status, "fail");
  assert.ok(invalidRun.invalid.includes("test_run.json"));
});

test("generateTestPlan creates executable cases from local scan scripts", async () => {
  const root = await tempRepo();
  await writeFile(
    join(root, "package.json"),
    JSON.stringify({ scripts: { test: "node --test", build: "node build.js" } }),
  );
  await scanProject(root);
  const { runDir } = await startRun(root, {
    title: "Generate test plan",
    now: new Date("2026-07-22T12:00:00Z"),
  });

  const result = await generateTestPlan(root, runDir);

  assert.equal(result.path, join(runDir, "test_plan.md"));
  assert.deepEqual(result.cases.map((testCase) => testCase.id), ["TC-001", "TC-002"]);
  assert.deepEqual(result.cases.map((testCase) => testCase.command), ["npm test", "npm run build"]);

  const plan = await readFile(join(runDir, "test_plan.md"), "utf8");
  assert.match(plan, /TC-001/);
  assert.match(plan, /npm test/);
  assert.match(plan, /TC-002/);
  assert.match(plan, /npm run build/);
});

test("updateRunStage updates run.yaml with a valid workflow stage", async () => {
  const root = await tempRepo();
  const { runDir } = await startRun(root, {
    title: "Update stage",
    now: new Date("2026-07-22T12:04:00Z"),
  });

  const result = await updateRunStage(runDir, "testing");

  assert.equal(result.stage, "testing");
  const runYaml = await readFile(join(runDir, "run.yaml"), "utf8");
  assert.match(runYaml, /^stage: testing$/m);
  await assert.rejects(() => updateRunStage(runDir, "random-stage"), /Invalid stage/);
});
