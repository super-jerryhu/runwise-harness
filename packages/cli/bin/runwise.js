#!/usr/bin/env node
import {
  artifactPath,
  finalGate,
  getStatus,
  initProject,
  recordArchiveGap,
  recordVerification,
  resolveRunDir,
  scanProject,
  startRun,
  writeFinalGateReport,
} from "../../core/src/index.js";

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
  runwise test-plan <run-id-or-dir>
  runwise verify <run-id-or-dir> --command <command> [--exit-code <code>] [--notes <notes>]
  runwise archive-gap <run-id-or-dir> --reason <reason>
  runwise final-gate <run-id-or-dir> [--write-report]
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
    const path = artifactPath(resolveRunDir(process.cwd(), target), "test_plan.md");
    console.log(path);
    return 0;
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
