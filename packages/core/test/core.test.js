import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  finalGate,
  initProject,
  scanProject,
  startRun,
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

