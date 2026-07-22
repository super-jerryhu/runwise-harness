import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { join, resolve } from "node:path";

import { finalGate, getStatus, resolveRunDir } from "../../core/src/index.js";

const ARTIFACT_FILES = [
  "intake.md",
  "grill.md",
  "facts.md",
  "TECH_SPEC.md",
  "subtasks.json",
  "test_plan.md",
  "verification.md",
  "test_run.json",
  "archive.md",
  "final_report.md",
  "memory_capture.md",
  "final_gate.json",
];

const WORKFLOW_STAGES = [
  { id: "intake", label: "Intake" },
  { id: "grill", label: "Grill" },
  { id: "context", label: "Context" },
  { id: "design", label: "Design" },
  { id: "implementation", label: "Implementation" },
  { id: "test_plan", label: "Test Plan" },
  { id: "testing", label: "Testing" },
  { id: "final_gate", label: "Final Gate" },
  { id: "archive", label: "Archive" },
  { id: "memory", label: "Memory" },
  { id: "done", label: "Done" },
];

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function statusClass(status) {
  if (status === "pass") return "ok";
  if (status === "pass_with_gaps") return "warn";
  return "fail";
}

function artifactHref(runId, artifactName) {
  return `/runs/${encodeURIComponent(runId)}/artifacts/${encodeURIComponent(artifactName)}`;
}

function listArtifacts(runId, runDir) {
  return ARTIFACT_FILES.map((name) => ({
    name,
    exists: existsSync(join(runDir, name)),
    href: artifactHref(runId, name),
  }));
}

function progressForStage(stage) {
  const index = Math.max(
    0,
    WORKFLOW_STAGES.findIndex((item) => item.id === stage),
  );
  const current = WORKFLOW_STAGES[index] || WORKFLOW_STAGES[0];
  return {
    currentIndex: index,
    total: WORKFLOW_STAGES.length,
    percent: Math.round((index / WORKFLOW_STAGES.length) * 100),
    label: current.label,
  };
}

function blockersForGate(gate = {}) {
  return [
    ...(gate.missing || []).map((item) => `missing: ${item}`),
    ...(gate.gaps || []).map((item) => `gap: ${item}`),
    ...(gate.invalid || []).map((item) => `invalid: ${item}`),
  ];
}

function nextActionForGate(gate = {}) {
  const missing = gate.missing || [];
  const gaps = gate.gaps || [];
  const invalid = gate.invalid || [];
  if (invalid.includes("test_run_failed")) return "Fix failing tests, rerun test-run, then run final gate.";
  if (invalid.length > 0) return `Fix invalid artifact: ${invalid[0]}.`;
  if (missing.includes("verification_evidence")) return "Record verification evidence or run test-run.";
  if (missing.includes("test_cases")) return "Generate or write test cases in test_plan.md.";
  if (missing.length > 0) return `Complete missing artifact: ${missing[0]}.`;
  if (gaps.includes("archive")) return "Review archive gap or record canonical archive link.";
  if (gaps.length > 0) return `Resolve or accept gap: ${gaps[0]}.`;
  if (gate.status === "pass") return "Ready for archive, memory capture, or done stage.";
  return "Run final gate and review blockers.";
}

export async function loadConsoleState(root = process.cwd()) {
  const projectRoot = resolve(root);
  const status = await getStatus(projectRoot);
  const runs = [];

  for (const run of status.runs) {
    const runDir = resolveRunDir(projectRoot, run.id);
    const gate = await finalGate(runDir);
    runs.push({
      ...run,
      runDir,
      finalGate: gate,
      progress: progressForStage(run.stage),
      blockers: blockersForGate(gate),
      nextAction: nextActionForGate(gate),
      artifacts: listArtifacts(run.id, runDir),
    });
  }

  return {
    projectRoot,
    privacy: {
      mode: "local_only",
      sourceUpload: false,
    },
    runs,
  };
}

export async function loadArtifactContent(root = process.cwd(), runId, artifactName) {
  if (!ARTIFACT_FILES.includes(artifactName)) {
    throw new Error(`Unknown artifact: ${artifactName}`);
  }
  const runDir = resolveRunDir(resolve(root), runId);
  const path = join(runDir, artifactName);
  if (!existsSync(path)) {
    throw new Error(`Artifact not found: ${artifactName}`);
  }
  return {
    runId,
    artifactName,
    path,
    content: await readFile(path, "utf8"),
  };
}

export function renderConsoleHtml(state) {
  const rows = state.runs
    .map((run) => {
      const gateStatus = run.finalGate?.status || "unknown";
      const missing = run.finalGate?.missing || [];
      const gaps = run.finalGate?.gaps || [];
      const invalid = run.finalGate?.invalid || [];
      const issues = run.blockers || [...missing.map((item) => `missing: ${item}`), ...gaps.map((item) => `gap: ${item}`), ...invalid.map((item) => `invalid: ${item}`)];
      const progress = run.progress || progressForStage(run.stage);
      const artifactLinks = (run.artifacts || [])
        .filter((artifact) => artifact.exists)
        .map((artifact) => `<a href="${escapeHtml(artifact.href)}">${escapeHtml(artifact.name)}</a>`)
        .join("");
      return `<tr>
        <td><code>${escapeHtml(run.id)}</code></td>
        <td>${escapeHtml(run.title)}</td>
        <td>
          <span class="pill">${escapeHtml(run.stage)}</span>
          <div class="progress" aria-label="${escapeHtml(progress.label)} progress">
            <div class="progress-bar" style="width: ${escapeHtml(progress.percent)}%"></div>
          </div>
          <div class="progress-label">${escapeHtml(progress.percent)}% ${escapeHtml(progress.label)}</div>
        </td>
        <td><span class="gate ${statusClass(gateStatus)}">${escapeHtml(gateStatus)}</span></td>
        <td>
          <div>${issues.length ? escapeHtml(issues.join(", ")) : "ready"}</div>
          <div class="next-action">${escapeHtml(run.nextAction || nextActionForGate(run.finalGate))}</div>
          <div class="artifacts">${artifactLinks || "no artifacts"}</div>
        </td>
      </tr>`;
    })
    .join("");

  const empty = `<tr><td colspan="5" class="empty">No Runwise runs found. Start one with <code>runwise start "Requirement title"</code>.</td></tr>`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Runwise Console</title>
  <style>
    :root {
      color-scheme: light;
      --ink: #202124;
      --muted: #5f6368;
      --line: #dadce0;
      --surface: #ffffff;
      --wash: #f8fafd;
      --ok: #137333;
      --warn: #b06000;
      --fail: #b3261e;
      --accent: #0b57d0;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--wash);
      color: var(--ink);
      font: 14px/1.45 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    header {
      border-bottom: 1px solid var(--line);
      background: var(--surface);
      padding: 18px 24px;
    }
    main {
      padding: 24px;
      max-width: 1180px;
      margin: 0 auto;
    }
    h1 {
      margin: 0 0 6px;
      font-size: 22px;
      font-weight: 700;
      letter-spacing: 0;
    }
    .meta {
      color: var(--muted);
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 12px;
      margin-bottom: 18px;
    }
    .metric {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 14px;
    }
    .metric strong {
      display: block;
      font-size: 22px;
      line-height: 1.2;
    }
    .metric span {
      color: var(--muted);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 8px;
      overflow: hidden;
    }
    th, td {
      text-align: left;
      padding: 11px 12px;
      border-bottom: 1px solid var(--line);
      vertical-align: top;
    }
    th {
      color: var(--muted);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: .04em;
      background: #f1f4f9;
    }
    tr:last-child td { border-bottom: 0; }
    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 12px;
    }
    .pill, .gate {
      display: inline-flex;
      align-items: center;
      min-height: 24px;
      border-radius: 999px;
      padding: 2px 9px;
      font-size: 12px;
      font-weight: 650;
      white-space: nowrap;
    }
    .pill {
      background: #e8f0fe;
      color: var(--accent);
    }
    .gate.ok {
      background: #e6f4ea;
      color: var(--ok);
    }
    .gate.warn {
      background: #fef7e0;
      color: var(--warn);
    }
    .gate.fail {
      background: #fce8e6;
      color: var(--fail);
    }
    .progress {
      width: 120px;
      height: 6px;
      border-radius: 999px;
      background: #edf1f7;
      margin-top: 8px;
      overflow: hidden;
    }
    .progress-bar {
      height: 100%;
      background: var(--accent);
    }
    .progress-label, .next-action {
      color: var(--muted);
      font-size: 12px;
      margin-top: 5px;
    }
    .artifacts {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 10px;
      margin-top: 8px;
    }
    .artifacts a {
      color: var(--accent);
      text-decoration: none;
      border-bottom: 1px solid transparent;
      font-size: 12px;
    }
    .artifacts a:hover {
      border-bottom-color: currentColor;
    }
    .empty {
      color: var(--muted);
      padding: 28px 12px;
      text-align: center;
    }
    @media (max-width: 720px) {
      header, main { padding-left: 14px; padding-right: 14px; }
      table { display: block; overflow-x: auto; }
      th, td { min-width: 140px; }
    }
  </style>
</head>
<body>
  <header>
    <h1>Runwise Console</h1>
    <div class="meta">
      <span>project: <code>${escapeHtml(state.projectRoot)}</code></span>
      <span>privacy: ${escapeHtml(state.privacy?.mode || "local_only")}</span>
      <span>source upload: ${escapeHtml(String(state.privacy?.sourceUpload ?? false))}</span>
    </div>
  </header>
  <main>
    <section class="summary" aria-label="Run summary">
      <div class="metric"><strong>${state.runs.length}</strong><span>runs</span></div>
      <div class="metric"><strong>${state.runs.filter((run) => run.finalGate?.status === "pass").length}</strong><span>passing gates</span></div>
      <div class="metric"><strong>${state.runs.filter((run) => run.finalGate?.status === "pass_with_gaps").length}</strong><span>gated gaps</span></div>
      <div class="metric"><strong>${state.runs.filter((run) => run.finalGate?.status === "fail").length}</strong><span>blocked gates</span></div>
    </section>
    <table>
      <thead>
        <tr>
          <th>Run</th>
          <th>Requirement</th>
          <th>Stage</th>
          <th>Final Gate</th>
          <th>Evidence</th>
        </tr>
      </thead>
      <tbody>
        ${rows || empty}
      </tbody>
    </table>
  </main>
</body>
</html>`;
}

export function createConsoleServer(options = {}) {
  const root = options.root || process.cwd();

  return createServer(async (request, response) => {
    try {
      if (request.url === "/api/state") {
        const state = await loadConsoleState(root);
        response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
        response.end(`${JSON.stringify(state, null, 2)}\n`);
        return;
      }

      const artifactMatch = request.url?.match(/^\/runs\/([^/]+)\/artifacts\/([^/?#]+)$/);
      if (artifactMatch) {
        const runId = decodeURIComponent(artifactMatch[1]);
        const artifactName = decodeURIComponent(artifactMatch[2]);
        const artifact = await loadArtifactContent(root, runId, artifactName);
        response.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
        response.end(artifact.content);
        return;
      }

      if (request.url === "/" || request.url === "/index.html") {
        const state = await loadConsoleState(root);
        response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        response.end(renderConsoleHtml(state));
        return;
      }

      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("Not found\n");
    } catch (error) {
      response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      response.end(`${error.message}\n`);
    }
  });
}
