# Development Workflow

Runwise should develop itself with the same harness principles it promotes.

This workflow is adapted from the internal engineering-flow pattern used during early product design, but it is intentionally generic. It does not depend on any specific company's Linear project, private business wiki, or internal repository layout.

## Rule Of Thumb

Use the lightest workflow that safely fits the task.

Small documentation edits should not require a heavyweight design process. Product-defining changes, architecture changes, agent adapter behavior, privacy behavior, sync behavior, test orchestration, and final-gate behavior should be handled as requirement runs.

## Local-Only Requirement Runs

For this repository, a requirement run may be recorded locally before cloud sync exists.

Suggested local structure:

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

Private planning notes can also live under `privity/` while the project is being shaped. That directory is intentionally ignored by git.

## Stage Checklist

### 1. Entry Scan

Classify the task before broad reading or editing.

Record:

- task type
- affected area
- risk flags
- expected artifact
- required verification
- whether a design document is needed

Suggested task types:

- product_design
- documentation
- cli
- core_workflow
- pi_adapter
- codex_adapter
- cloud_console
- privacy_security
- testing
- release

Suggested risk flags:

- privacy
- cloud_sync
- source_upload
- agent_tool_execution
- policy_gate
- test_orchestration
- external_integration
- billing

### 2. Demand Grill

Ask the few highest-leverage questions needed to avoid building the wrong thing.

Default questions:

1. What outcome should this change create?
2. What is explicitly out of scope?
3. Which existing behavior or promise must remain unchanged?
4. What source of truth decides the answer?
5. What evidence proves this is done?

For privacy, cloud sync, billing, or agent execution changes, ask one additional risk-specific question.

### 3. Context Alignment

Load only the context needed for the task:

- current docs
- current code
- local run notes
- relevant project memory
- upstream adapter docs when changing adapters
- current git status

Historical memory can guide investigation, but current files remain the source of truth.

### 4. Design

Create or update a design artifact when a task affects:

- Runwise product positioning
- workflow stages
- local ledger format
- project scanner behavior
- privacy or sync behavior
- final-gate logic
- adapter contracts
- cloud/team architecture
- commercial open-core boundary

For small documentation edits, a short implementation note is enough.

### 5. Breakdown

Break substantial work into subtasks before editing.

Subtasks should be concrete and verifiable.

### 6. Implementation

Keep changes scoped to the task.

Prefer:

- stable contracts over ad hoc behavior
- deterministic CLI checks over agent-only judgment
- local-first defaults
- explicit privacy boundaries
- thin agent adapters over duplicated core logic

Avoid:

- hidden source upload
- agent self-certification
- tool behavior that cannot be audited
- adapter-specific logic leaking into core

### 7. Test Plan

Every non-trivial run should define what needs to be verified.

Documentation tasks may use:

- link checks
- spelling/terminology review
- consistency review
- git ignore checks for private files

Code tasks should use:

- unit tests
- integration tests
- CLI smoke tests
- fixture-based scanner tests
- final-gate tests

### 8. Verification

Record exact evidence:

- command
- exit code
- relevant output summary
- files checked
- explicit gap if verification cannot run

Do not claim completion without evidence or a stated gap.

### 9. Archive

Until cloud sync exists, archive locally:

- public project docs for public decisions
- `privity/` notes for private product planning
- GitHub issue/PR links once the project starts using issues

If Linear, Jira, or another external archive is unavailable or intentionally skipped, record that as an archive gap rather than silently omitting it.

### 10. Memory Capture

At the end of meaningful work, capture:

- what decision was made
- what should future agents reuse
- what should not be treated as fact
- what follow-up remains

## Final Gate

Before marking a requirement run complete, check:

- entry scan is recorded
- grill is complete or explicitly skipped
- relevant context was loaded
- design exists if needed
- implementation is scoped
- verification evidence exists
- archive exists or archive gap is recorded
- private files remain ignored
- final report explains residual risk

## Current Bootstrap Policy

During the bootstrap phase:

- Do not upload private planning notes to Linear.
- Do not require cloud sync.
- Keep `privity/` ignored.
- Use GitHub as the public source for open-source docs.
- Use local private notes for early product strategy.

