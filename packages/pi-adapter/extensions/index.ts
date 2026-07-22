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

