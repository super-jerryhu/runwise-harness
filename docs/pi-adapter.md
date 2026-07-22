# Pi Adapter

Runwise for Pi is packaged as a Pi package under `packages/pi-adapter`.

The adapter is intentionally thin. It does not duplicate Runwise core logic. It calls the local `runwise` CLI, which keeps behavior deterministic and reusable across other adapters.

## Package Structure

```text
packages/pi-adapter/
  package.json
  extensions/
    index.ts
  skills/
    runwise-harness/
      SKILL.md
  prompts/
    runwise-start.md
```

## Runtime Requirements

The Pi adapter expects:

- `runwise` CLI available on `PATH`
- Pi runtime-provided extension imports
- local repository access

It does not add cloud sync or source upload behavior.

## Commands

The extension registers:

```text
/runwise-init [project-name]
/runwise-scan
/runwise-start <requirement title>
/runwise-status
/runwise-stage <run-id> <stage>
/runwise-grill <run-id> <answer>
/runwise-test-plan <run-id>
/runwise-test-run <run-id>
/runwise-archive <run-id> <url> [title]
/runwise-final-gate <run-id>
```

## Tools

The extension registers LLM-callable tools:

```text
runwise_create_run
runwise_get_status
runwise_update_stage
runwise_record_grill_answer
runwise_generate_test_plan
runwise_execute_test_run
runwise_record_verification
runwise_record_archive
runwise_final_gate
```

## Local-First Boundary

The adapter uses the local CLI and writes local artifacts under `.runwise/`.

It must not upload source code, secrets, logs, embeddings, or traces by default.
