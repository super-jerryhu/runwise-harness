# Runwise Harness

**Runwise: one guy, one team.**

Runwise Harness is an open-source agent engineering harness for full-cycle AI coding workflows. It helps developers and teams make coding agents work through a repeatable engineering process instead of isolated chat sessions.

Runwise is not another coding agent. It is the workflow layer around agents such as Codex, Pi, WorkBuddy, Claude Code, Cursor Agent, and future internal agents.

```text
requirement intake
-> business clarification
-> project context alignment
-> design
-> task breakdown
-> implementation
-> test plan
-> testing
-> final gate
-> archive
-> memory capture
```

## Why Runwise

AI coding agents can write code, but real software delivery needs more than code generation.

Teams need a way to answer:

- Was the requirement clarified before implementation?
- Which project facts did the agent use?
- Was a design produced for risky work?
- Which tests were generated or executed?
- Did the agent cross any auth, billing, database, or production red lines?
- Where is the final design, verification evidence, and archive?
- Can the next agent reuse the experience from this run?

Runwise turns each AI coding task into a traceable engineering run.

## Core Principles

- **Agent-agnostic:** Runwise should work with Codex, Pi, WorkBuddy, Claude Code, Cursor Agent, and other coding agents.
- **Local-first:** source code stays local by default. Cloud sync is optional and should be explicit.
- **Workflow over prompts:** a useful harness needs state, artifacts, tests, gates, and archive, not only instructions.
- **Evidence before completion:** an agent should not claim completion without verification evidence or an explicit verification gap.
- **Memory is a hint:** project memory and historical experience help orient the agent, but current code, schema, tests, and official docs remain the source of truth.

## Planned Components

```text
packages/
  core/          # workflow model, artifact contracts, final gate rules
  cli/           # runwise init/connect/scan/start/status/verify
  pi-adapter/    # Pi package: extension + skills + prompts
  codex-adapter/ # Codex skill/plugin adapter

apps/
  console/       # team dashboard, optional paid/cloud layer
  api/           # hosted workspace/project/run registry

templates/
  intake.md
  grill.md
  TECH_SPEC.md
  subtasks.json
  test_plan.md
  verification.md
  final_report.md
  red_lines.yaml
```

## Status

This repository is in early design and bootstrap stage.

The first public milestone is a local-first open-source core:

- local run ledger
- project scanner
- workflow artifacts
- basic final gate
- Pi adapter
- Codex adapter

## Documentation

- [Vision](docs/vision.md)
- [Workflow](docs/workflow.md)
- [Development Workflow](docs/development-workflow.md)
- [Roadmap](docs/roadmap.md)
- [MVP Plan](docs/mvp.md)
- [CLI](docs/cli.md)
- [Privacy Model](docs/privacy.md)
- [Architecture](docs/architecture.md)
- [Open-Core Strategy](docs/open-core.md)

## Templates

The first workflow templates live in [`templates/`](templates/):

- [`intake.md`](templates/intake.md)
- [`grill.md`](templates/grill.md)
- [`TECH_SPEC.md`](templates/TECH_SPEC.md)
- [`subtasks.json`](templates/subtasks.json)
- [`test_plan.md`](templates/test_plan.md)
- [`verification.md`](templates/verification.md)
- [`final_report.md`](templates/final_report.md)
- [`red_lines.yaml`](templates/red_lines.yaml)

## License

Apache-2.0. See [LICENSE](LICENSE).
