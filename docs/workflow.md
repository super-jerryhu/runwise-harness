# Workflow

Runwise models every real AI coding task as a `RequirementRun`.

A run is not just a chat. It is a structured engineering record with stages, artifacts, verification evidence, archive links, and memory capture.

## Stage Model

```text
created
-> intake
-> grill
-> context_alignment
-> design
-> breakdown
-> implementation
-> test_plan
-> testing
-> final_gate
-> archive
-> memory_capture
-> completed
```

Exception states:

```text
blocked
needs_human_decision
redline_triggered
verification_failed
archive_failed
cancelled
```

## Stage Summary

### 1. Intake

Capture the original requirement, source, target repository, affected area, risk flags, and expected output.

Example sources:

- agent chat
- CLI
- GitHub issue
- Linear issue
- Slack message
- cloud dashboard

### 2. Grill

Ask the few highest-leverage business questions before design or implementation.

The goal is not to ask many questions. The goal is to avoid implementing the wrong thing.

Common question areas:

- business goal
- users and roles
- acceptance criteria
- edge cases
- auth and permission rules
- billing or credit impact
- provider write behavior
- rollback needs
- verification expectations

`runwise start` creates a first-pass targeted question list from the requirement title and local scan metadata. Regenerate it when needed with `runwise grill <run-id> --generate --type <generic|backend|frontend|data|ops>`, then record answered demand questions with `runwise grill <run-id> --question <question> --answer <answer>`. The final gate treats unanswered generated question lists as missing demand evidence.

### 3. Context Alignment

Load the minimum relevant project context:

- project wiki
- service map
- current code
- schema or migration files
- tests
- official docs
- historical memories

Memory should be treated as a hint. Current project facts remain the source of truth.

### 4. Design

For substantial or high-risk work, produce a design document before implementation.

The design should include:

- problem statement
- current behavior
- proposed behavior
- affected modules
- data model or API changes
- risks
- test strategy
- rollback notes if needed

### 5. Breakdown

Break the work into concrete subtasks that can be implemented and verified.

For large runs, subtasks should be stored as structured JSON so agents and dashboards can track progress. The current run stage should be updated with `runwise stage <run-id> <stage>` as the work moves through intake, context alignment, implementation, testing, final gate, archive, and memory capture.

### 6. Implementation

Agent modifies code under the workflow constraints:

- respect service boundaries
- avoid unrelated refactors
- follow project conventions
- preserve user changes
- stop on red-line triggers

### 7. Test Plan

Generate tests from requirement acceptance criteria and risk flags.

Test categories may include:

- unit tests
- integration tests
- API tests
- database/migration tests
- permission tests
- billing tests
- provider write tests
- regression tests
- manual verification checklist

### 8. Testing

Run targeted tests and record exact evidence:

- commands
- exit codes
- failed tests
- fixed failures
- skipped tests
- verification gaps

An agent should not self-certify success without evidence.

When `test_run.json` exists, failed or invalid test-run evidence blocks the final gate.

### 9. Final Gate

The final gate decides whether the run can be marked complete.

It checks:

- run exists
- required artifacts exist
- red lines were checked
- tests were planned
- tests were executed or gaps recorded
- archive exists or archive gap is recorded
- final report is complete

### 10. Archive

Archive the run to team systems:

- GitHub issue or PR
- Linear document or issue
- Jira ticket
- internal docs
- release notes

Duplicate archive documents should be avoided. If the same requirement already exists, update the canonical record.

Record the canonical archive link with `runwise archive <run-id> --url <url> --title <title>`. Use `runwise archive-gap` only when external archive is intentionally unavailable.

### 11. Memory Capture

Extract reusable experience:

- what changed
- what was tricky
- what tests mattered
- what red lines triggered
- what future agents should remember

Experience memory is useful, but it must not override current code and official project facts.

## Local Run Artifacts

A local run can be represented as:

```text
.runwise/runs/<run-id>/
  run.yaml
  intake.md
  grill.md
  facts.md
  TECH_SPEC.md
  subtasks.json
  test_plan.md
  test_results.json
  verification.md
  archive.json
  final_report.md
  memory_capture.md
```
