# MVP Plan

The MVP should prove that Runwise can turn an AI coding request into a traceable local requirement run.

The MVP does not need cloud sync, billing, a full dashboard, or enterprise controls.

## MVP Goal

```text
A developer can initialize Runwise in a repository, create a requirement run, generate/record core artifacts, verify work, and pass or fail a final gate locally.
```

## MVP Scope

### 1. Local Project Setup

Commands:

```bash
runwise init
runwise status
```

Artifacts:

```text
.runwise/project.yaml
.runwise/runs/
```

### 2. Requirement Run Ledger

Command:

```bash
runwise start "requirement title"
```

Generated structure:

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

### 3. Templates

The MVP should ship default templates for:

- intake
- grill
- technical design
- subtasks
- test plan
- verification
- final report
- red lines

### 4. Final Gate

Command:

```bash
runwise final-gate <run-id>
```

The basic final gate should check:

- run metadata exists
- intake exists
- grill is complete or explicitly skipped
- design exists if required
- test plan exists
- verification evidence exists or gap is recorded
- archive exists or gap is recorded
- final report exists

Result values:

```text
pass
fail
pass_with_gaps
blocked
```

### 5. Basic Project Scanner

Command:

```bash
runwise scan
```

Initial scanner output:

```text
.runwise/wiki/overview.md
.runwise/wiki/testing.md
.runwise/scan.json
```

The scanner should detect:

- package manager
- language/framework hints
- available scripts
- likely test commands
- ignored paths
- docs files
- API hints
- DB/schema/migration hints
- service/module hints

It should not upload anything.

## MVP Non-Scope

Not included in MVP:

- cloud sync
- hosted dashboard
- user accounts
- team workspace
- billing
- GitHub App
- Linear API integration
- full source indexing
- advanced memory store
- multi-agent orchestration
- enterprise security

## MVP Success Criteria

The MVP is useful if:

- A developer can use Runwise without a cloud account.
- A coding agent can call the CLI and follow the workflow.
- Private files stay local.
- A requirement run produces reusable artifacts.
- Final gate can block premature completion.
- The workflow is clear enough to build Pi and Codex adapters on top.
- The test-plan flow can generate baseline cases from local project metadata.
- The verification flow can execute generated local test commands and persist evidence.
- Failed `test_run.json` evidence blocks final gate completion.

## Fixture Coverage

The MVP should include fixture projects that prove scanner behavior without relying only on temporary files.

The first fixture is `fixtures/basic-node`, which covers:

- package manager and scripts
- docs discovery
- API hints
- service hints
- DB migration hints
- `.env` exclusion
- `node_modules` exclusion

## MVP Validation Scenario

Use a small fixture repository.

1. Run `runwise init`.
2. Run `runwise scan`.
3. Run `runwise start "add a small feature"`.
4. Fill in intake and grill artifacts.
5. Create a minimal test plan.
6. Record verification evidence.
7. Run `runwise final-gate <run-id>`.
8. Confirm the result is deterministic.
