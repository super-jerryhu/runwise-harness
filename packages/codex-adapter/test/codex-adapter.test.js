import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("Codex adapter package documents its resources", async () => {
  const pkg = JSON.parse(await readFile("packages/codex-adapter/package.json", "utf8"));

  assert.equal(pkg.name, "@runwise/harness-codex");
  assert.equal(pkg.runwise.runtime, "codex");
  assert.deepEqual(pkg.runwise.skills, ["skills/runwise-harness"]);
});

test("Codex adapter skill defines Runwise workflow and CLI bridge", async () => {
  const skill = await readFile("packages/codex-adapter/skills/runwise-harness/SKILL.md", "utf8");

  assert.match(skill, /^name: runwise-harness/m);
  assert.match(skill, /runwise start/i);
  assert.match(skill, /runwise final-gate/i);
  assert.match(skill, /Do not upload source code/i);
  assert.match(skill, /local-first/i);
});

test("Codex adapter docs explain installation and privacy boundary", async () => {
  const docs = await readFile("docs/codex-adapter.md", "utf8");

  assert.match(docs, /Codex Adapter/);
  assert.match(docs, /CLI bridge/i);
  assert.match(docs, /source code stays local/i);
});
