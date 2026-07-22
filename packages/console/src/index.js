import { createServer } from "node:http";
import { resolve } from "node:path";

import { finalGate, getStatus, resolveRunDir } from "../../core/src/index.js";

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

export async function loadConsoleState(root = process.cwd()) {
  const projectRoot = resolve(root);
  const status = await getStatus(projectRoot);
  const runs = [];

  for (const run of status.runs) {
    const runDir = resolveRunDir(projectRoot, run.id);
    runs.push({
      ...run,
      runDir,
      finalGate: await finalGate(runDir),
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

export function renderConsoleHtml(state) {
  const rows = state.runs
    .map((run) => {
      const gateStatus = run.finalGate?.status || "unknown";
      const missing = run.finalGate?.missing || [];
      const gaps = run.finalGate?.gaps || [];
      const invalid = run.finalGate?.invalid || [];
      const issues = [...missing.map((item) => `missing: ${item}`), ...gaps.map((item) => `gap: ${item}`), ...invalid.map((item) => `invalid: ${item}`)];
      return `<tr>
        <td><code>${escapeHtml(run.id)}</code></td>
        <td>${escapeHtml(run.title)}</td>
        <td><span class="pill">${escapeHtml(run.stage)}</span></td>
        <td><span class="gate ${statusClass(gateStatus)}">${escapeHtml(gateStatus)}</span></td>
        <td>${issues.length ? escapeHtml(issues.join(", ")) : "ready"}</td>
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
