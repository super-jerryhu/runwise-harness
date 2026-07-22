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

### `runwise start`

Create a requirement run.

```bash
node packages/cli/bin/runwise.js start "Add a small feature"
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

### `runwise test-plan`

Print the path to a run's test plan artifact.

```bash
node packages/cli/bin/runwise.js test-plan <run-id>
```

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

Possible statuses:

```text
pass
fail
pass_with_gaps
blocked
```

`fail` exits with code `1`. Other statuses exit with code `0`.

## Development

Run tests:

```bash
npm test
```

