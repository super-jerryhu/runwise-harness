import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";

const RUNWISE_DIR = ".runwise";
const RUN_FILES = [
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
];

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatRunDate(date) {
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
    "-",
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
    pad(date.getUTCSeconds()),
  ].join("");
}

export function slugify(value) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72)
    .replace(/-+$/g, "");
  return slug || "requirement";
}

function yamlString(value) {
  if (value === undefined || value === null) return "";
  return String(value).replace(/\n/g, " ");
}

async function writeIfMissing(path, content) {
  if (!existsSync(path)) {
    await writeFile(path, content, "utf8");
  }
}

async function readJsonIfExists(path) {
  if (!existsSync(path)) return undefined;
  return JSON.parse(await readFile(path, "utf8"));
}

export async function initProject(root = process.cwd(), options = {}) {
  const projectRoot = resolve(root);
  const projectDir = join(projectRoot, RUNWISE_DIR);
  await mkdir(join(projectDir, "runs"), { recursive: true });
  await mkdir(join(projectDir, "wiki"), { recursive: true });

  const name = options.name || basename(projectRoot);
  const projectYaml = [
    `name: ${yamlString(name)}`,
    "privacy_mode: local_only",
    "source_upload: false",
    "version: 1",
    "",
  ].join("\n");
  await writeIfMissing(join(projectDir, "project.yaml"), projectYaml);

  return { projectRoot, projectDir };
}

function templateFor(file, title) {
  if (file === "subtasks.json") {
    return `${JSON.stringify({ task: title, subtasks: [] }, null, 2)}\n`;
  }
  if (file === "test_plan.md") {
    return [
      "# Test Plan",
      "",
      `Task: ${title}`,
      "",
      "## Test Cases",
      "",
      "| ID | Title | Source | Risk | Type | Command | Status |",
      "| --- | --- | --- | --- | --- | --- | --- |",
      "| TC-001 | Define verification for this requirement | acceptance_criteria |  | manual |  | pending |",
      "",
    ].join("\n");
  }
  const heading = file
    .replace(".md", "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return `# ${heading}\n\nTask: ${title}\n\n`;
}

export async function startRun(root = process.cwd(), options = {}) {
  if (!options.title) {
    throw new Error("startRun requires a title");
  }
  const now = options.now ? new Date(options.now) : new Date();
  const projectRoot = resolve(root);
  await initProject(projectRoot, {});

  const runId = `${formatRunDate(now)}-${slugify(options.title)}`;
  const runDir = join(projectRoot, RUNWISE_DIR, "runs", runId);
  await mkdir(runDir, { recursive: true });

  const runYaml = [
    `id: ${runId}`,
    `title: ${yamlString(options.title)}`,
    `created_at: ${now.toISOString()}`,
    "stage: intake",
    "status: active",
    `needs_design_doc: ${options.needsDesignDoc ? "true" : "false"}`,
    "",
  ].join("\n");
  await writeFile(join(runDir, "run.yaml"), runYaml, "utf8");

  for (const file of RUN_FILES) {
    await writeIfMissing(join(runDir, file), templateFor(file, options.title));
  }

  return { runId, runDir };
}

function detectPackageManager(root) {
  if (existsSync(join(root, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(root, "yarn.lock"))) return "yarn";
  if (existsSync(join(root, "bun.lockb")) || existsSync(join(root, "bun.lock"))) return "bun";
  if (existsSync(join(root, "package-lock.json")) || existsSync(join(root, "package.json"))) return "npm";
  return "unknown";
}

function detectFrameworks(pkg) {
  const deps = { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) };
  return Object.keys(deps).filter((name) =>
    ["next", "react", "vite", "vue", "svelte", "express", "fastify", "typescript", "vitest"].includes(name),
  );
}

const DEFAULT_EXCLUDED_DIRS = new Set([".git", ".runwise", "node_modules", "dist", "build", "coverage"]);
const DEFAULT_EXCLUDED_FILES = new Set([".env"]);

function toPosixPath(path) {
  return path.split("\\").join("/");
}

async function walkProject(root, current = root, files = [], excludedPaths = []) {
  const entries = await readdir(current, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(current, entry.name);
    const relPath = toPosixPath(relative(root, fullPath));
    if (entry.isDirectory()) {
      if (DEFAULT_EXCLUDED_DIRS.has(entry.name)) {
        excludedPaths.push(relPath);
        continue;
      }
      await walkProject(root, fullPath, files, excludedPaths);
      continue;
    }
    if (DEFAULT_EXCLUDED_FILES.has(entry.name)) {
      excludedPaths.push(relPath);
      continue;
    }
    files.push(relPath);
  }
  return { files: files.sort(), excludedPaths: excludedPaths.sort() };
}

function detectPathHints(files) {
  return {
    docs: files.filter((file) => /\.md$/i.test(file)).sort(),
    apiHints: files.filter((file) => /(^|\/)(api|routes?)(\/|\.|-|_)/i.test(file)).sort(),
    dbHints: files.filter((file) => /(^|\/)(db|database|migrations?|schema)(\/|\.|-|_)/i.test(file)).sort(),
    serviceHints: files.filter((file) => /(^|\/)(services?|modules?)(\/|\.|-|_)/i.test(file)).sort(),
  };
}

export async function scanProject(root = process.cwd()) {
  const projectRoot = resolve(root);
  await initProject(projectRoot, {});

  const packageJsonPath = join(projectRoot, "package.json");
  const pkg = await readJsonIfExists(packageJsonPath);
  const packageManager = detectPackageManager(projectRoot);
  const scripts = Object.keys(pkg?.scripts || {}).sort();
  const frameworks = detectFrameworks(pkg).sort();
  const { files, excludedPaths } = await walkProject(projectRoot);
  const pathHints = detectPathHints(files);
  const scan = {
    packageManager,
    scripts,
    frameworks,
    ...pathHints,
    excludedPaths,
    privacy: {
      sourceUpload: false,
      mode: "local_only",
    },
  };

  const runwiseDir = join(projectRoot, RUNWISE_DIR);
  await writeFile(join(runwiseDir, "scan.json"), `${JSON.stringify(scan, null, 2)}\n`, "utf8");

  await writeFile(
    join(runwiseDir, "wiki", "overview.md"),
    [
      "# Project Overview",
      "",
      `- package manager: ${packageManager}`,
      `- frameworks: ${frameworks.length ? frameworks.join(", ") : "unknown"}`,
      `- docs: ${pathHints.docs.length ? pathHints.docs.join(", ") : "none"}`,
      `- api hints: ${pathHints.apiHints.length ? pathHints.apiHints.join(", ") : "none"}`,
      `- db hints: ${pathHints.dbHints.length ? pathHints.dbHints.join(", ") : "none"}`,
      `- service hints: ${pathHints.serviceHints.length ? pathHints.serviceHints.join(", ") : "none"}`,
      "- source upload: false",
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    join(runwiseDir, "wiki", "testing.md"),
    ["# Testing", "", scripts.length ? `Available scripts: ${scripts.join(", ")}` : "No scripts detected.", ""].join("\n"),
    "utf8",
  );

  return scan;
}

function hasMeaningfulEvidence(text) {
  const compact = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("#"))
    .filter((line) => !/^(Task:|Command:|Result:|Notes:|\|)/.test(line))
    .filter((line) => !/^-{3,}$/.test(line));
  return compact.length > 0;
}

function hasGap(text) {
  return /\bgap\b|verification required|manual verification|required|not run|skipped/i.test(text);
}

async function validateSubtasks(runRoot, invalid) {
  const path = join(runRoot, "subtasks.json");
  if (!existsSync(path)) return;
  try {
    const parsed = JSON.parse(await readFile(path, "utf8"));
    if (!Array.isArray(parsed.subtasks)) invalid.push("subtasks.json");
  } catch {
    invalid.push("subtasks.json");
  }
}

async function validateTestPlan(runRoot, missing) {
  const path = join(runRoot, "test_plan.md");
  if (!existsSync(path)) return;
  const content = await readFile(path, "utf8");
  if (!/\bTC-\d{3}\b/.test(content)) {
    missing.push("test_cases");
  }
}

export async function finalGate(runDir) {
  const root = resolve(runDir);
  const missing = [];
  const gaps = [];
  const invalid = [];

  for (const file of ["run.yaml", "intake.md", "grill.md", "test_plan.md", "final_report.md"]) {
    if (!existsSync(join(root, file))) missing.push(file);
  }

  const verificationPath = join(root, "verification.md");
  if (!existsSync(verificationPath)) {
    missing.push("verification.md");
    missing.push("verification_evidence");
  } else {
    const verification = await readFile(verificationPath, "utf8");
    if (!hasMeaningfulEvidence(verification)) {
      if (hasGap(verification)) gaps.push("verification");
      else missing.push("verification_evidence");
    } else if (hasGap(verification)) {
      gaps.push("verification");
    }
  }

  const archivePath = join(root, "archive.md");
  if (!existsSync(archivePath)) {
    missing.push("archive.md");
  } else {
    const archive = await readFile(archivePath, "utf8");
    if (!hasMeaningfulEvidence(archive)) missing.push("archive_evidence");
    else if (hasGap(archive)) gaps.push("archive");
  }

  await validateSubtasks(root, invalid);
  await validateTestPlan(root, missing);

  let status = "pass";
  if (missing.length > 0 || invalid.length > 0) status = "fail";
  else if (gaps.length > 0) status = "pass_with_gaps";

  return { status, missing, gaps, invalid };
}

export function artifactPath(runDir, artifactName) {
  return join(resolve(runDir), artifactName);
}

export async function recordVerification(runDir, options = {}) {
  const root = resolve(runDir);
  await mkdir(root, { recursive: true });
  const command = options.command || "";
  const exitCode = options.exitCode ?? "";
  const notes = options.notes || "";
  const content = [
    "# Verification",
    "",
    "## Commands",
    "",
    "| Command | Exit Code | Result | Notes |",
    "| --- | ---: | --- | --- |",
    `| ${command} | ${exitCode} | ${String(exitCode) === "0" ? "passed" : "recorded"} | ${notes} |`,
    "",
    "## Evidence",
    "",
    `- Command recorded: ${command}`,
    `- Exit code: ${exitCode}`,
    notes ? `- Notes: ${notes}` : "- Notes: none",
    "",
  ].join("\n");
  const path = join(root, "verification.md");
  await writeFile(path, content, "utf8");
  return { path };
}

export async function recordArchiveGap(runDir, reason) {
  const root = resolve(runDir);
  await mkdir(root, { recursive: true });
  const content = [
    "# Archive",
    "",
    "Archive gap recorded.",
    "",
    `Reason: ${reason || "not specified"}`,
    "",
  ].join("\n");
  const path = join(root, "archive.md");
  await writeFile(path, content, "utf8");
  return { path };
}

export async function getStatus(root = process.cwd()) {
  const runsDir = join(resolve(root), RUNWISE_DIR, "runs");
  if (!existsSync(runsDir)) return { runs: [] };
  const entries = await readdir(runsDir, { withFileTypes: true });
  const runs = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const runYamlPath = join(runsDir, entry.name, "run.yaml");
    if (!existsSync(runYamlPath)) continue;
    const runYaml = await readFile(runYamlPath, "utf8");
    const title = runYaml.match(/^title:\s*(.+)$/m)?.[1] || entry.name;
    const stage = runYaml.match(/^stage:\s*(.+)$/m)?.[1] || "unknown";
    runs.push({ id: entry.name, title, stage });
  }
  runs.sort((a, b) => a.id.localeCompare(b.id));
  return { runs };
}

export function resolveRunDir(root, runId) {
  const projectRoot = resolve(root);
  const direct = resolve(projectRoot, runId);
  if (existsSync(join(direct, "run.yaml"))) return direct;
  return join(projectRoot, RUNWISE_DIR, "runs", runId);
}
