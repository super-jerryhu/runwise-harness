# Local Console

The local console is a browser view over the `.runwise/` run ledger.

It is part of the open-source local-first MVP. It is not the hosted team dashboard.

## Start

```bash
node packages/cli/bin/runwise.js console
```

Then open:

```text
http://127.0.0.1:8787
```

Use a custom host or port:

```bash
node packages/cli/bin/runwise.js console --host 127.0.0.1 --port 8787
```

## What It Shows

The first console version shows:

- local project path
- privacy mode
- source upload status
- run count
- final gate status counts
- run list
- requirement title
- stage and stage progress
- inferred grill type
- grill question and answer progress
- final gate status
- missing evidence, gaps, or invalid artifacts
- final gate blockers
- next action guidance
- missing demand-grill evidence
- links to local run artifacts
- test plan and verification evidence access

## API

The console exposes one local JSON endpoint:

```text
GET /api/state
GET /runs/:runId/artifacts/:artifactName
```

`/api/state` includes the project root, privacy boundary, run state, stage progress, final gate state, blocker summaries, next action guidance, and artifact metadata.

The artifact route can read known local run artifacts such as:

```text
intake.md
grill.md
facts.md
TECH_SPEC.md
subtasks.json
test_plan.md
verification.md
test_run.json
archive.md
final_report.md
memory_capture.md
final_gate.json
```

Unknown artifact names are rejected instead of being treated as arbitrary paths.

## Privacy Boundary

The local console reads `.runwise/` artifacts from the current machine.

It does not upload source code, secrets, logs, traces, embeddings, or run artifacts. Future cloud sync should remain explicit and auditable.

## Intended Use

Use the local console when you want a quick operational view while a coding agent is working through a requirement run.

For team collaboration, Runwise Cloud should eventually sync selected run metadata and artifact links explicitly, without requiring source upload by default.
