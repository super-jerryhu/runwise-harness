---
name: runwise-harness
description: Use Runwise Harness for local-first AI coding workflow runs in Pi. Creates requirement runs, records verification, and runs final gate without uploading source code by default.
---

# Runwise Harness For Pi

Use this skill when a Pi session is working on a real coding requirement that should be tracked as a Runwise requirement run.

Runwise is local-first. Do not upload source code, secrets, logs, embeddings, or detailed traces. Use the local `runwise` CLI through the adapter tools and commands.

## Workflow

1. Create or locate a Runwise run.
2. Capture intake and demand-grill answers.
3. Align context against current files.
4. Write or update design artifacts when the task is substantial or risky.
5. Implement the scoped change.
6. Generate and run the test plan when local commands are available.
7. Record verification evidence.
8. Run the deterministic final gate.
9. Archive locally or record an archive gap.
10. Capture reusable memory as a local artifact.

## Commands

```text
/runwise-init [project-name]
/runwise-scan
/runwise-start <requirement title>
/runwise-status
/runwise-test-plan <run-id>
/runwise-test-run <run-id>
/runwise-final-gate <run-id>
```

## Tools

- `runwise_create_run`
- `runwise_get_status`
- `runwise_generate_test_plan`
- `runwise_execute_test_run`
- `runwise_record_verification`
- `runwise_final_gate`

## Rules

- Do not claim completion without final gate output.
- Do not treat memory as source of truth.
- Do not upload source code by default.
- Record verification gaps explicitly.
