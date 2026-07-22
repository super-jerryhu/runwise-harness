---
name: runwise-harness
description: Use Runwise Harness in Codex for local-first requirement runs, demand clarification, verification evidence, and deterministic final gate checks.
---

# Runwise Harness For Codex

Use this skill when a Codex task represents a real coding requirement that should be tracked as a Runwise requirement run.

Runwise is local-first. Do not upload source code, secrets, logs, embeddings, or detailed traces by default. Use the local `runwise` CLI as the deterministic bridge.

## Operating Model

Apply the lightest workflow that safely fits the task.

1. Classify the requirement and risk.
2. Create or locate a local Runwise run.
3. Ask the few highest-leverage demand-grill questions.
4. Align context against current project files and `.runwise/` scanner output.
5. Write or update design artifacts for substantial or risky work.
6. Implement scoped changes.
7. Generate and run the test plan when local commands are available.
8. Record verification evidence.
9. Record an archive link or archive gap.
10. Run `runwise final-gate <run-id> --write-report`.
11. Do not claim completion unless final gate output supports it.

## CLI Bridge

Use these commands from the repository root:

```bash
runwise init
runwise scan
runwise start "<requirement title>" --json
runwise status --json
runwise stage <run-id> <stage> --json
runwise grill <run-id> --generate --type <generic|backend|frontend|data|ops>
runwise grill <run-id> --question "<question>" --answer "<answer>"
runwise test-plan <run-id> --generate
runwise test-run <run-id>
runwise verify <run-id> --command "<command>" --exit-code <code> --notes "<notes>"
runwise archive <run-id> --url "<canonical-url>" --title "<title>"
runwise archive-gap <run-id> --reason "<reason>"
runwise final-gate <run-id> --write-report
```

## Rules

- Do not upload source code by default.
- Do not treat memory as source of truth.
- Do not skip demand clarification for ambiguous or high-risk work.
- Do not self-certify tests without command evidence.
- Record verification gaps explicitly.
- Keep private planning files out of git.
