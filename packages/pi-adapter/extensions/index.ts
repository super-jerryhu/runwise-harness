import { spawn } from "node:child_process";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

type RunwiseResult = {
  code: number;
  stdout: string;
  stderr: string;
};

function runRunwise(args: string[], cwd: string): Promise<RunwiseResult> {
  return new Promise((resolve) => {
    const child = spawn("runwise", args, { cwd, shell: false });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("close", (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
    child.on("error", (error) => {
      resolve({ code: 1, stdout, stderr: error.message });
    });
  });
}

function textResult(result: RunwiseResult) {
  return {
    content: [
      {
        type: "text" as const,
        text: result.stdout || result.stderr || `runwise exited with code ${result.code}`,
      },
    ],
    details: result,
    isError: result.code !== 0,
  };
}

export default function runwisePiAdapter(pi: ExtensionAPI) {
  pi.registerCommand("runwise-init", {
    description: "Initialize Runwise in the current project",
    handler: async (args, ctx) => {
      const name = args.trim();
      const result = await runRunwise(name ? ["init", "--name", name] : ["init"], ctx.cwd);
      ctx.ui.notify(result.stdout || result.stderr, result.code === 0 ? "info" : "warning");
    },
  });

  pi.registerCommand("runwise-scan", {
    description: "Scan the current project with Runwise",
    handler: async (_args, ctx) => {
      const result = await runRunwise(["scan"], ctx.cwd);
      ctx.ui.notify(result.stdout || result.stderr, result.code === 0 ? "info" : "warning");
    },
  });

  pi.registerCommand("runwise-start", {
    description: "Create a Runwise requirement run",
    handler: async (args, ctx) => {
      const title = args.trim();
      const result = await runRunwise(["start", title, "--json"], ctx.cwd);
      ctx.ui.notify(result.stdout || result.stderr, result.code === 0 ? "info" : "warning");
    },
  });

  pi.registerCommand("runwise-status", {
    description: "Show Runwise requirement runs",
    handler: async (_args, ctx) => {
      const result = await runRunwise(["status"], ctx.cwd);
      ctx.ui.notify(result.stdout || result.stderr, result.code === 0 ? "info" : "warning");
    },
  });

  pi.registerCommand("runwise-stage", {
    description: "Update a Runwise run workflow stage",
    handler: async (args, ctx) => {
      const [runId = "", stage = ""] = args.trim().split(/\s+/, 2);
      const result = await runRunwise(["stage", runId, stage, "--json"], ctx.cwd);
      ctx.ui.notify(result.stdout || result.stderr, result.code === 0 ? "info" : "warning");
    },
  });

  pi.registerCommand("runwise-test-plan", {
    description: "Generate a Runwise test plan for a requirement run",
    handler: async (args, ctx) => {
      const result = await runRunwise(["test-plan", args.trim(), "--generate"], ctx.cwd);
      ctx.ui.notify(result.stdout || result.stderr, result.code === 0 ? "info" : "warning");
    },
  });

  pi.registerCommand("runwise-test-run", {
    description: "Execute Runwise test plan commands and record evidence",
    handler: async (args, ctx) => {
      const result = await runRunwise(["test-run", args.trim(), "--json"], ctx.cwd);
      ctx.ui.notify(result.stdout || result.stderr, result.code === 0 ? "info" : "warning");
    },
  });

  pi.registerCommand("runwise-archive", {
    description: "Record a canonical archive link for a Runwise run",
    handler: async (args, ctx) => {
      const [runId = "", url = "", ...titleParts] = args.trim().split(/\s+/);
      const title = titleParts.join(" ");
      const result = await runRunwise(
        title ? ["archive", runId, "--url", url, "--title", title] : ["archive", runId, "--url", url],
        ctx.cwd,
      );
      ctx.ui.notify(result.stdout || result.stderr, result.code === 0 ? "info" : "warning");
    },
  });

  pi.registerCommand("runwise-final-gate", {
    description: "Run Runwise final gate for a requirement run",
    handler: async (args, ctx) => {
      const result = await runRunwise(["final-gate", args.trim(), "--write-report"], ctx.cwd);
      ctx.ui.notify(result.stdout || result.stderr, result.code === 0 ? "info" : "warning");
    },
  });

  pi.registerTool({
    name: "runwise_create_run",
    label: "Runwise Create Run",
    description: "Create a local Runwise requirement run for the current project.",
    parameters: Type.Object({
      title: Type.String({ description: "Requirement title" }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      return textResult(await runRunwise(["start", params.title, "--json"], ctx.cwd));
    },
  });

  pi.registerTool({
    name: "runwise_get_status",
    label: "Runwise Status",
    description: "Get local Runwise run status for the current project.",
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
      return textResult(await runRunwise(["status", "--json"], ctx.cwd));
    },
  });

  pi.registerTool({
    name: "runwise_update_stage",
    label: "Runwise Update Stage",
    description: "Update the workflow stage for a local Runwise requirement run.",
    parameters: Type.Object({
      runId: Type.String({ description: "Runwise run id" }),
      stage: Type.String({ description: "Workflow stage" }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      return textResult(await runRunwise(["stage", params.runId, params.stage, "--json"], ctx.cwd));
    },
  });

  pi.registerTool({
    name: "runwise_generate_test_plan",
    label: "Runwise Generate Test Plan",
    description: "Generate local Runwise test cases from scanner metadata for a requirement run.",
    parameters: Type.Object({
      runId: Type.String({ description: "Runwise run id" }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      return textResult(await runRunwise(["test-plan", params.runId, "--generate"], ctx.cwd));
    },
  });

  pi.registerTool({
    name: "runwise_execute_test_run",
    label: "Runwise Execute Test Run",
    description: "Execute commands from a local Runwise test plan and record verification evidence.",
    parameters: Type.Object({
      runId: Type.String({ description: "Runwise run id" }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      return textResult(await runRunwise(["test-run", params.runId, "--json"], ctx.cwd));
    },
  });

  pi.registerTool({
    name: "runwise_record_verification",
    label: "Runwise Record Verification",
    description: "Record verification evidence for a local Runwise run.",
    parameters: Type.Object({
      runId: Type.String({ description: "Runwise run id" }),
      command: Type.String({ description: "Verification command" }),
      exitCode: Type.String({ description: "Command exit code" }),
      notes: Type.Optional(Type.String({ description: "Verification notes" })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      return textResult(
        await runRunwise(
          ["verify", params.runId, "--command", params.command, "--exit-code", params.exitCode, "--notes", params.notes ?? ""],
          ctx.cwd,
        ),
      );
    },
  });

  pi.registerTool({
    name: "runwise_record_archive",
    label: "Runwise Record Archive",
    description: "Record a canonical archive link for a local Runwise run.",
    parameters: Type.Object({
      runId: Type.String({ description: "Runwise run id" }),
      url: Type.String({ description: "Canonical archive URL" }),
      title: Type.Optional(Type.String({ description: "Archive title" })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      return textResult(
        await runRunwise(
          params.title
            ? ["archive", params.runId, "--url", params.url, "--title", params.title]
            : ["archive", params.runId, "--url", params.url],
          ctx.cwd,
        ),
      );
    },
  });

  pi.registerTool({
    name: "runwise_final_gate",
    label: "Runwise Final Gate",
    description: "Run the deterministic Runwise final gate and write a local report.",
    parameters: Type.Object({
      runId: Type.String({ description: "Runwise run id" }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      return textResult(await runRunwise(["final-gate", params.runId, "--write-report"], ctx.cwd));
    },
  });
}
