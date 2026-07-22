#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import {
  artifactPath,
  finalGate,
  generateTestPlan,
  getStatus,
  parseTestPlanCommands,
  initProject,
  recordTestRunResults,
  recordArchiveGap,
  recordVerification,
  resolveRunDir,
  scanProject,
  startRun,
  writeFinalGateReport,
} from "../../core/src/index.js";
import { createConsoleServer } from "../../console/src/index.js";

function parseOption(args, name) {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  return args[index + 1];
}

function hasFlag(args, name) {
  return args.includes(name);
}

function printHelp() {
  console.log(`Runwise Harness

Usage:
  runwise init [--name <name>]
  runwise scan
  runwise start <title> [--now <iso-date>] [--json]
  runwise status [--json]
  runwise test-plan <run-id-or-dir> [--generate]
  runwise test-run <run-id-or-dir> [--json]
  runwise verify <run-id-or-dir> --command <command> [--exit-code <code>] [--notes <notes>]
  runwise archive-gap <run-id-or-dir> --reason <reason>
  runwise final-gate <run-id-or-dir> [--write-report]
  runwise console [--host <host>] [--port <port>]
`);
}

async function main(argv) {
  const [command, ...args] = argv;
  if (!command || command === "--help" || command === "-h") {
    printHelp();
    return 0;
  }

  if (command === "init") {
    const name = parseOption(args, "--name");
    const result = await initProject(process.cwd(), { name });
    console.log(`Initialized Runwise project at ${result.projectDir}`);
    return 0;
  }

  if (command === "scan") {
    const result = await scanProject(process.cwd());
    console.log(JSON.stringify(result, null, 2));
    return 0;
  }

  if (command === "start") {
    const titleParts = [];
    for (const arg of args) {
      if (arg.startsWith("--")) break;
      titleParts.push(arg);
    }
    const title = titleParts.join(" ").trim();
    const now = parseOption(args, "--now");
    const result = await startRun(process.cwd(), { title, now });
    if (hasFlag(args, "--json")) {
      console.log(JSON.stringify(result, null, 2));
      return 0;
    }
    console.log(`Run created: ${result.runId}`);
    console.log(result.runDir);
    return 0;
  }

  if (command === "status") {
    const status = await getStatus(process.cwd());
    if (hasFlag(args, "--json")) {
      console.log(JSON.stringify(status, null, 2));
      return 0;
    }
    if (status.runs.length === 0) {
      console.log("No Runwise runs found.");
      return 0;
    }
    for (const run of status.runs) {
      console.log(`${run.id}\t${run.stage}\t${run.title}`);
    }
    return 0;
  }

  if (command === "test-plan") {
    const target = args[0];
    if (!target) throw new Error("test-plan requires a run id or run directory");
    if (hasFlag(args, "--generate")) {
      const result = await generateTestPlan(process.cwd(), target);
      console.log(`Generated ${result.cases.length} test cases: ${result.path}`);
      return 0;
    }
    const path = artifactPath(resolveRunDir(process.cwd(), target), "test_plan.md");
    console.log(path);
    return 0;
  }

  if (command === "test-run") {
    const target = args[0];
    if (!target) throw new Error("test-run requires a run id or run directory");
    const runDir = resolveRunDir(process.cwd(), target);
    const commands = await parseTestPlanCommands(runDir);
    if (commands.length === 0) throw new Error("test-run found no executable test plan commands");
    const results = commands.map((testCase) => {
      const startedAt = Date.now();
      const execution = spawnSync(testCase.command, {
        cwd: process.cwd(),
        shell: true,
        encoding: "utf8",
        maxBuffer: 1024 * 1024,
      });
      return {
        ...testCase,
        exitCode: execution.status ?? 1,
        durationMs: Date.now() - startedAt,
        stdout: execution.stdout,
        stderr: execution.stderr,
      };
    });
    const report = await recordTestRunResults(runDir, results);
    if (hasFlag(args, "--json")) {
      console.log(JSON.stringify(report, null, 2));
      return report.status === "pass" ? 0 : 1;
    }
    const passed = report.results.filter((result) => result.exitCode === 0).length;
    const total = report.results.length;
    if (report.status === "pass") {
      console.log(`Test run passed ${passed}/${total}: ${report.reportPath}`);
      return 0;
    }
    console.log(`Test run failed ${total - passed}/${total}: ${report.reportPath}`);
    return report.status === "pass" ? 0 : 1;
  }

  if (command === "verify") {
    const target = args[0];
    if (!target) throw new Error("verify requires a run id or run directory");
    const result = await recordVerification(resolveRunDir(process.cwd(), target), {
      command: parseOption(args, "--command"),
      exitCode: parseOption(args, "--exit-code"),
      notes: parseOption(args, "--notes"),
    });
    console.log(`Verification recorded: ${result.path}`);
    return 0;
  }

  if (command === "archive-gap") {
    const target = args[0];
    if (!target) throw new Error("archive-gap requires a run id or run directory");
    const result = await recordArchiveGap(resolveRunDir(process.cwd(), target), parseOption(args, "--reason"));
    console.log(`Archive gap recorded: ${result.path}`);
    return 0;
  }

  if (command === "final-gate") {
    const target = args[0];
    if (!target) throw new Error("final-gate requires a run id or run directory");
    const runDir = resolveRunDir(process.cwd(), target);
    const result = await finalGate(runDir);
    if (hasFlag(args, "--write-report")) {
      await writeFinalGateReport(runDir, result);
    }
    console.log(JSON.stringify(result, null, 2));
    return result.status === "fail" || result.status === "blocked" ? 1 : 0;
  }

  if (command === "console") {
    const host = parseOption(args, "--host") || "127.0.0.1";
    const port = Number.parseInt(parseOption(args, "--port") || "8787", 10);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error("console requires a valid --port between 1 and 65535");
    }
    const server = createConsoleServer({ root: process.cwd() });
    server.listen(port, host, () => {
      console.log(`Runwise Console: http://${host}:${port}`);
    });
    return undefined;
  }

  throw new Error(`Unknown command: ${command}`);
}

main(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
