import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("Pi adapter package declares pi resources", async () => {
  const pkg = JSON.parse(await readFile("packages/pi-adapter/package.json", "utf8"));

  assert.equal(pkg.name, "@runwise/harness-pi");
  assert.deepEqual(pkg.keywords.includes("pi-package"), true);
  assert.deepEqual(pkg.pi.extensions, ["extensions"]);
  assert.deepEqual(pkg.pi.skills, ["skills"]);
  assert.deepEqual(pkg.pi.prompts, ["prompts"]);
});

test("Pi adapter extension exposes Runwise commands and tools", async () => {
  const source = await readFile("packages/pi-adapter/extensions/index.ts", "utf8");

  for (const command of ["runwise-init", "runwise-scan", "runwise-start", "runwise-status", "runwise-final-gate"]) {
    assert.match(source, new RegExp(`registerCommand\\(\"${command}\"`));
  }

  for (const tool of [
    "runwise_create_run",
    "runwise_get_status",
    "runwise_record_verification",
    "runwise_final_gate",
  ]) {
    assert.match(source, new RegExp(`name:\\s*\"${tool}\"`));
  }
});

test("Pi adapter skill documents local-first workflow", async () => {
  const skill = await readFile("packages/pi-adapter/skills/runwise-harness/SKILL.md", "utf8");

  assert.match(skill, /^name: runwise-harness/m);
  assert.match(skill, /local-first/i);
  assert.match(skill, /final gate/i);
  assert.match(skill, /Do not upload source code/i);
});

