# CLI

The Runwise CLI is the first local-first interface for the harness.

It is intentionally deterministic so both humans and agents can call it.

## Commands

### `runwise init`

Initialize a local Runwise project.

```bash
node packages/cli/bin/runwise.js init --name my-project
```

Creates:

```text
.runwise/project.yaml
.runwise/runs/
.runwise/wiki/
```

Default privacy mode is `local_only`.

### `runwise scan`

Scan local project metadata.

```bash
node packages/cli/bin/runwise.js scan
```

Creates:

```text
.runwise/scan.json
.runwise/wiki/overview.md
.runwise/wiki/testing.md
```

The scanner does not upload source code.

Current scan output includes:

```text
packageManager
scripts
frameworks
docs
apiHints
dbHints
serviceHints
excludedPaths
privacy
```

The scanner recursively walks the project while excluding high-noise and private paths such as `.git`, `.runwise`, `node_modules`, `privity`, build outputs, coverage outputs, and `.env`.

### `runwise start`

Create a requirement run.

```bash
node packages/cli/bin/runwise.js start "Add a small feature"
```

Use `--json` for adapter-friendly output:

```bash
node packages/cli/bin/runwise.js start "Add a small feature" --json
```

Creates:

```text
.runwise/runs/<run-id>/
  run.yaml
  intake.md
  grill.md
  facts.md
  TECH_SPEC.md
  subtasks.json
  test_plan.md
  verification.md
  archive.md
  final_report.md
  memory_capture.md
```

### `runwise status`

List local runs.

```bash
node packages/cli/bin/runwise.js status
```

Use `--json` for machine-readable output:

```bash
node packages/cli/bin/runwise.js status --json
```

### `runwise test-plan`

Print the path to a run's test plan artifact.

```bash
node packages/cli/bin/runwise.js test-plan <run-id>
```

Generate a basic test plan from local scanner metadata:

```bash
node packages/cli/bin/runwise.js scan
node packages/cli/bin/runwise.js test-plan <run-id> --generate
```

The generated plan uses local package scripts such as `test`, `build`, and `lint`.

This command does not execute tests. It creates the cases that a human or agent should run and then record with `runwise verify`.

### `runwise test-run`

Execute commands from a run's `test_plan.md` and record verification evidence.

```bash
node packages/cli/bin/runwise.js test-run <run-id>
```

Use JSON output for adapters:

```bash
node packages/cli/bin/runwise.js test-run <run-id> --json
```

This creates:

```text
.runwise/runs/<run-id>/test_run.json
.runwise/runs/<run-id>/verification.md
```

`test-run` executes local shell commands from the `Command` column of `test_plan.md`. It exits with `0` only when all commands exit with `0`; it still records evidence when a command fails.

### `runwise verify`

Record verification evidence.

```bash
node packages/cli/bin/runwise.js verify <run-id> \
  --command "npm test" \
  --exit-code 0 \
  --notes "all tests passed"
```

### `runwise archive-gap`

Record that external archive is intentionally unavailable or skipped.

```bash
node packages/cli/bin/runwise.js archive-gap <run-id> \
  --reason "local-only bootstrap"
```

### `runwise final-gate`

Run deterministic completion checks.

```bash
node packages/cli/bin/runwise.js final-gate <run-id>
```

Write a local report for adapters or follow-up tooling:

```bash
node packages/cli/bin/runwise.js final-gate <run-id> --write-report
```

Creates:

```text
.runwise/runs/<run-id>/final_gate.json
```

Possible statuses:

```text
pass
fail
pass_with_gaps
blocked
```

`fail` exits with code `1`. Other statuses exit with code `0`.

The MVP final gate validates:

- required run files exist
- verification evidence exists or an explicit gap is recorded
- archive evidence exists or an explicit gap is recorded
- `subtasks.json` is valid JSON and contains a `subtasks` array
- `test_plan.md` contains at least one `TC-###` test case

### `runwise console`

Start the local browser console.

```bash
node packages/cli/bin/runwise.js console
```

Use a custom host or port:

```bash
node packages/cli/bin/runwise.js console --host 127.0.0.1 --port 8787
```

The console serves:

```text
/
/api/state
/runs/:runId/artifacts/:artifactName
```

The console reads local `.runwise/` state and does not upload source code.

## Development

Run tests:

```bash
npm test
```
