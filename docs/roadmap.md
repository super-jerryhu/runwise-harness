# Roadmap

**Runwise: one guy, one team.**

This roadmap describes the planned path from repository bootstrap to a usable local-first harness for AI coding agents.

Runwise should grow in layers:

```text
spec -> templates -> local core -> CLI -> adapters -> console -> cloud
```

## Phase 0: Project Bootstrap

Goal: make the repository understandable and trustworthy.

Deliverables:

- README
- vision document
- workflow document
- privacy model
- architecture document
- open-core strategy
- development workflow
- MVP plan
- initial templates
- license decision
- contribution and security docs

Exit criteria:

- A new visitor can understand what Runwise is.
- Public docs do not require private context.
- Private planning files are ignored by git.

## Phase 1: Local Core

Goal: define and implement the local workflow state model.

Deliverables:

- workflow stage enum
- requirement run model
- artifact model
- risk flag model
- local `.runwise/project.yaml`
- local `.runwise/runs/<run-id>/` ledger
- artifact validation
- final gate contract

Exit criteria:

- A run can be created and represented locally.
- Required artifacts can be validated deterministically.
- Completion can be blocked without relying on agent judgment.

## Phase 2: CLI

Goal: expose deterministic local commands for humans and agents.

Planned commands:

```bash
runwise init
runwise scan
runwise start "requirement"
runwise status
runwise test-plan <run-id>
runwise verify <run-id>
runwise final-gate <run-id>
```

Exit criteria:

- A user can initialize a repo.
- A user or agent can create a run.
- A user or agent can inspect status.
- Final gate can pass, fail, or pass with gaps.
- Adapter-facing commands can emit JSON for deterministic tool use.

## Phase 3: Project Scanner

Goal: generate useful local project context without uploading source code.

Scanner outputs:

- language/framework summary
- package manager
- scripts and test commands
- service/module map
- docs index
- API/schema hints
- risk hints
- excluded paths
- generated project wiki

Exit criteria:

- Scanner works on at least one fixture project.
- Scanner excludes secrets and ignored paths by default.
- Scanner output is useful enough for agent context alignment.

## Phase 4: Test Planning And Verification

Goal: make testing a first-class workflow stage.

Deliverables:

- test plan artifact schema
- local test case generation from scanner metadata
- test result artifact schema
- command result capture
- verification gap recording
- final gate checks for test evidence
- machine-readable final gate report output

Exit criteria:

- A run can define test cases.
- A run can record exact commands and results.
- Final gate can reject a run with missing verification.

## Phase 5: Pi Adapter

Goal: support Pi as the first open-source agent runner.

Deliverables:

- Pi package skeleton
- Pi extension
- `/runwise-*` commands
- LLM-callable Runwise tools
- lifecycle hooks for status sync
- local CLI bridge

Exit criteria:

- Pi can create and update a Runwise run.
- Pi can read relevant project context.
- Pi can record verification and final gate state.

## Phase 6: Codex Adapter

Goal: support Codex through a skill/plugin-style adapter.

Deliverables:

- Codex skill
- workflow instructions
- CLI bridge
- run lifecycle guidance
- final gate usage
- local-first privacy boundary

Exit criteria:

- Codex can follow the Runwise workflow.
- Codex can create local run artifacts through CLI.
- Codex can report verification gaps clearly.

## Phase 7: Local Console

Goal: make local runs visible without requiring cloud sync.

Deliverables:

- local dashboard
- run list
- run detail
- stage progress
- artifact viewer
- test evidence view
- local JSON state API
- local artifact route with an artifact whitelist

Exit criteria:

- A user can inspect local Runwise state in a browser.
- No cloud account is required.

## Phase 8: Cloud / Team Layer

Goal: add paid/team collaboration while keeping local-first defaults.

Deliverables:

- workspace
- members
- projects
- hosted run registry
- dashboard
- GitHub/Linear links
- audit log
- connector auth

Exit criteria:

- A team can see shared requirement runs.
- Source code upload is not required by default.
- Run metadata sync is explicit and auditable.

## Phase 9: Enterprise Layer

Goal: support larger teams with stronger governance.

Deliverables:

- SSO
- RBAC
- SCIM
- data retention controls
- self-hosted/VPC deployment
- audit export
- custom policy packs

## Near-Term Priority

The first practical milestone is:

```text
Local Core + CLI + Templates + Basic Final Gate
```

This milestone proves the core workflow before investing heavily in adapters or cloud.
