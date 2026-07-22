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

const WORKFLOW_STAGES = new Set([
  "intake",
  "grill",
  "context",
  "design",
  "implementation",
  "test_plan",
  "testing",
  "final_gate",
  "archive",
  "memory",
  "done",
]);

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

function scoreText(text, words) {
  const value = String(text || "").toLowerCase();
  return words.reduce((score, word) => (value.includes(word) ? score + 1 : score), 0);
}

function inferRequirementType(title, scan = {}) {
  const scores = {
    backend: scoreText(title, ["api", "backend", "server", "webhook", "auth", "permission", "database", "db", "queue"]),
    frontend: scoreText(title, ["ui", "frontend", "page", "screen", "component", "form", "layout", "mobile"]),
    data: scoreText(title, ["data", "analytics", "report", "metric", "schema", "migration", "warehouse", "etl"]),
    ops: scoreText(title, ["deploy", "release", "rollback", "monitor", "alert", "incident", "ci", "pipeline"]),
  };

  if (Array.isArray(scan.apiHints) && scan.apiHints.length > 0) scores.backend += 1;
  if (Array.isArray(scan.serviceHints) && scan.serviceHints.length > 0) scores.backend += 1;
  if (Array.isArray(scan.dbHints) && scan.dbHints.length > 0) scores.data += 1;
  if (Array.isArray(scan.frameworks)) {
    if (scan.frameworks.some((framework) => ["express", "fastify"].includes(framework))) scores.backend += 1;
    if (scan.frameworks.some((framework) => ["next", "react", "vite", "vue", "svelte"].includes(framework))) {
      scores.frontend += 1;
    }
  }

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  return ranked[0][1] > 0 ? ranked[0][0] : "generic";
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

  const scan = (await readJsonIfExists(join(projectRoot, RUNWISE_DIR, "scan.json"))) || {};
  const grillType = options.grillType || inferRequirementType(options.title, scan);
  const grill = await generateGrillQuestions(projectRoot, runDir, { type: grillType });

  return { runId, runDir, grill };
}

export async function updateRunStage(runDir, stage) {
  if (!WORKFLOW_STAGES.has(stage)) {
    throw new Error(`Invalid stage: ${stage}`);
  }
  const root = resolve(runDir);
  const runYamlPath = join(root, "run.yaml");
  const runYaml = await readFile(runYamlPath, "utf8");
  const nextYaml = /^stage:\s*.+$/m.test(runYaml)
    ? runYaml.replace(/^stage:\s*.+$/m, `stage: ${stage}`)
    : `${runYaml.trimEnd()}\nstage: ${stage}\n`;
  await writeFile(runYamlPath, nextYaml.endsWith("\n") ? nextYaml : `${nextYaml}\n`, "utf8");
  return { runDir: root, stage };
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

const DEFAULT_EXCLUDED_DIRS = new Set([".git", ".runwise", "node_modules", "dist", "build", "coverage", "privity"]);
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

async function validateGrill(runRoot, missing) {
  const path = join(runRoot, "grill.md");
  if (!existsSync(path)) return;
  const content = await readFile(path, "utf8");
  if (!hasAnsweredGrill(content)) {
    missing.push("grill_evidence");
  }
}

function hasAnsweredGrill(text) {
  if (/^A:\s*\S.+$/m.test(text)) return true;
  return text.split("\n").some((line) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("| GRILL-")) return false;
    const cells = trimmed
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    return Boolean(cells[3]);
  });
}

async function validateTestRun(runRoot, invalid) {
  const path = join(runRoot, "test_run.json");
  if (!existsSync(path)) return;
  try {
    const parsed = JSON.parse(await readFile(path, "utf8"));
    if (parsed.status !== "pass") invalid.push("test_run_failed");
    if (!Array.isArray(parsed.results)) {
      invalid.push("test_run.json");
      return;
    }
    if (parsed.results.some((result) => result.exitCode !== 0 || result.status === "failed")) {
      invalid.push("test_run_failed");
    }
  } catch {
    invalid.push("test_run.json");
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
  await validateGrill(root, missing);
  await validateTestPlan(root, missing);
  await validateTestRun(root, invalid);

  let status = "pass";
  if (missing.length > 0 || invalid.length > 0) status = "fail";
  else if (gaps.length > 0) status = "pass_with_gaps";

  return { status, missing, gaps, invalid };
}

export async function writeFinalGateReport(runDir, result) {
  const root = resolve(runDir);
  const report = {
    ...result,
    generatedAt: new Date().toISOString(),
  };
  const path = join(root, "final_gate.json");
  await writeFile(path, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return { path, report };
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

export async function recordGrillAnswer(runDir, options = {}) {
  if (!options.question) throw new Error("recordGrillAnswer requires a question");
  if (!options.answer) throw new Error("recordGrillAnswer requires an answer");
  const root = resolve(runDir);
  await mkdir(root, { recursive: true });
  const path = join(root, "grill.md");
  const existing = existsSync(path) ? await readFile(path, "utf8") : "# Grill\n\n";
  const next = [
    existing.trimEnd(),
    "",
    "## Q&A",
    "",
    `### Q: ${options.question}`,
    "",
    `A: ${options.answer}`,
    "",
  ].join("\n");
  await writeFile(path, next, "utf8");
  return { path };
}

const COMMON_GRILL_QUESTIONS = [
  {
    category: "business",
    text: "What business outcome must this requirement improve, and how will we know it worked?",
  },
  {
    category: "user",
    text: "Who is the primary user or operator affected by this change?",
  },
  {
    category: "scope",
    text: "What is explicitly out of scope for this iteration?",
  },
  {
    category: "acceptance",
    text: "What acceptance signal must be true before implementation can be considered complete?",
  },
];

const GRILL_QUESTIONS_BY_TYPE = {
  generic: [
    {
      category: "risk",
      text: "What failure mode would make this change harmful or misleading?",
    },
    {
      category: "rollout",
      text: "How should this change be rolled out, paused, or rolled back?",
    },
  ],
  backend: [
    {
      category: "data",
      text: "What data invariant must the backend preserve across create, update, retry, and rollback paths?",
    },
    {
      category: "api",
      text: "Which API contracts, permissions, and error responses must remain stable?",
    },
    {
      category: "consistency",
      text: "What async jobs, webhooks, or external services can create race conditions?",
    },
    {
      category: "observability",
      text: "What logs, metrics, or alerts are needed to detect production failure?",
    },
  ],
  frontend: [
    {
      category: "workflow",
      text: "What is the user's primary path through the interface, including empty, loading, and error states?",
    },
    {
      category: "accessibility",
      text: "What keyboard, responsive, and accessibility expectations must be preserved?",
    },
    {
      category: "state",
      text: "Which local state, server state, or cache behavior could become stale or inconsistent?",
    },
  ],
  data: [
    {
      category: "lineage",
      text: "What is the source of truth for each field this requirement reads or writes?",
    },
    {
      category: "quality",
      text: "What data quality checks are required before downstream users can trust the output?",
    },
    {
      category: "privacy",
      text: "What private, regulated, or customer-sensitive data must stay excluded?",
    },
  ],
  ops: [
    {
      category: "runbook",
      text: "What manual operator action or runbook step changes after this requirement ships?",
    },
    {
      category: "rollback",
      text: "What is the fastest safe rollback path if production behavior regresses?",
    },
    {
      category: "ownership",
      text: "Who owns triage if the workflow gets stuck or produces conflicting evidence?",
    },
  ],
};

function normalizeGrillType(type) {
  if (!type) return "generic";
  const normalized = String(type).toLowerCase();
  if (Object.hasOwn(GRILL_QUESTIONS_BY_TYPE, normalized)) return normalized;
  return "generic";
}

function escapeTableCell(value) {
  return String(value).replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function readTitleFromRunYaml(runYaml) {
  return runYaml.match(/^title:\s*(.+)$/m)?.[1] || "requirement";
}

function formatGrillQuestions(title, type, questions) {
  return [
    "# Grill",
    "",
    `Task: ${title}`,
    "",
    "## Generated Questions",
    "",
    `Type: ${type}`,
    "",
    "| ID | Category | Question | Answer |",
    "| --- | --- | --- | --- |",
    ...questions.map(
      (question) =>
        `| ${question.id} | ${escapeTableCell(question.category)} | ${escapeTableCell(question.text)} |  |`,
    ),
    "",
    "## Q&A",
    "",
    "Record answers with `runwise grill <run-id> --question <question> --answer <answer>`.",
    "",
  ].join("\n");
}

export async function generateGrillQuestions(root = process.cwd(), runIdOrDir, options = {}) {
  if (!runIdOrDir) throw new Error("generateGrillQuestions requires a run id or run directory");
  const projectRoot = resolve(root);
  const runDir = resolveRunDir(projectRoot, runIdOrDir);
  const type = normalizeGrillType(options.type);
  const runYamlPath = join(runDir, "run.yaml");
  const title = existsSync(runYamlPath) ? readTitleFromRunYaml(await readFile(runYamlPath, "utf8")) : "requirement";
  const selected = [...COMMON_GRILL_QUESTIONS, ...GRILL_QUESTIONS_BY_TYPE[type]].map((question, index) => ({
    id: `GRILL-${String(index + 1).padStart(3, "0")}`,
    ...question,
  }));
  const path = join(runDir, "grill.md");
  await writeFile(path, formatGrillQuestions(title, type, selected), "utf8");
  return { path, type, questions: selected };
}

export async function recordArchiveLink(runDir, options = {}) {
  if (!options.url) {
    throw new Error("recordArchiveLink requires a url");
  }
  const root = resolve(runDir);
  await mkdir(root, { recursive: true });
  const title = options.title || "Archive Link";
  const content = [
    "# Archive",
    "",
    "Canonical archive recorded.",
    "",
    `Title: ${title}`,
    `URL: ${options.url}`,
    "",
  ].join("\n");
  const path = join(root, "archive.md");
  await writeFile(path, content, "utf8");
  return { path };
}

function commandForScript(packageManager, script) {
  if (script === "test") return `${packageManager} test`;
  if (packageManager === "npm") return `npm run ${script}`;
  return `${packageManager} ${script}`;
}

function titleForScript(script) {
  if (script === "test") return "Run automated test suite";
  if (script === "build") return "Run build verification";
  if (script === "lint") return "Run lint verification";
  return `Run ${script} script`;
}

function formatTestCases(cases) {
  return cases
    .map((testCase) =>
      [
        `| ${testCase.id}`,
        testCase.title,
        testCase.source,
        testCase.risk,
        testCase.type,
        testCase.command,
        testCase.status,
        "|",
      ].join(" | "),
    )
    .join("\n");
}

export async function generateTestPlan(root = process.cwd(), runIdOrDir) {
  if (!runIdOrDir) throw new Error("generateTestPlan requires a run id or run directory");
  const projectRoot = resolve(root);
  const runDir = resolveRunDir(projectRoot, runIdOrDir);
  let scan = await readJsonIfExists(join(projectRoot, RUNWISE_DIR, "scan.json"));
  if (!scan) scan = await scanProject(projectRoot);

  const packageManager = scan.packageManager === "unknown" ? "npm" : scan.packageManager;
  const scripts = Array.isArray(scan.scripts) ? scan.scripts : [];
  const preferredScripts = ["test", "build", "lint"].filter((script) => scripts.includes(script));
  const selectedScripts = preferredScripts.length ? preferredScripts : scripts.slice(0, 3);
  const cases = selectedScripts.map((script, index) => ({
    id: `TC-${String(index + 1).padStart(3, "0")}`,
    title: titleForScript(script),
    source: "local_scan_scripts",
    risk: script === "test" ? "regression" : "release",
    type: "automated",
    command: commandForScript(packageManager, script),
    status: "pending",
  }));

  if (cases.length === 0) {
    cases.push({
      id: "TC-001",
      title: "Define manual verification for this requirement",
      source: "requirement_review",
      risk: "unknown",
      type: "manual",
      command: "",
      status: "pending",
    });
  }

  const content = [
    "# Test Plan",
    "",
    "Generated from local Runwise scan metadata.",
    "",
    "## Test Cases",
    "",
    "| ID | Title | Source | Risk | Type | Command | Status |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    formatTestCases(cases),
    "",
    "## Execution",
    "",
    "Run the listed commands, then record evidence with `runwise verify`.",
    "",
  ].join("\n");
  const path = join(runDir, "test_plan.md");
  await writeFile(path, content, "utf8");
  return { path, cases };
}

export async function parseTestPlanCommands(runDir) {
  const root = resolve(runDir);
  const plan = await readFile(join(root, "test_plan.md"), "utf8");
  const commands = [];
  for (const line of plan.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("| TC-")) continue;
    const cells = trimmed
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    const [id, title, source, risk, type, command, status] = cells;
    if (!id || !command) continue;
    commands.push({ id, title, source, risk, type, command, status });
  }
  return commands;
}

function truncateOutput(value) {
  const text = String(value || "");
  if (text.length <= 4000) return text;
  return `${text.slice(0, 4000)}\n[truncated]\n`;
}

export async function recordTestRunResults(runDir, results) {
  const root = resolve(runDir);
  const status = results.every((result) => result.exitCode === 0) ? "pass" : "fail";
  const report = {
    status,
    generatedAt: new Date().toISOString(),
    results: results.map((result) => ({
      id: result.id,
      title: result.title,
      command: result.command,
      exitCode: result.exitCode,
      status: result.exitCode === 0 ? "passed" : "failed",
      durationMs: result.durationMs,
      stdout: truncateOutput(result.stdout),
      stderr: truncateOutput(result.stderr),
    })),
  };
  const reportPath = join(root, "test_run.json");
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  const verification = [
    "# Verification",
    "",
    "## Commands",
    "",
    "| Test Case | Command | Exit Code | Result | Notes |",
    "| --- | --- | ---: | --- | --- |",
    ...report.results.map((result) =>
      `| ${result.id} | ${result.command} | ${result.exitCode} | ${result.status} | ${result.title || ""} |`,
    ),
    "",
    "## Evidence",
    "",
    ...report.results.flatMap((result) => [
      `- ${result.id}: ${result.command}`,
      `  - Result: ${result.status}`,
      `  - Exit code: ${result.exitCode}`,
    ]),
    "",
  ].join("\n");
  const verificationPath = join(root, "verification.md");
  await writeFile(verificationPath, verification, "utf8");

  return { status, reportPath, verificationPath, results: report.results };
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
