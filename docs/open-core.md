# Open-Core Strategy

Runwise should be open-core.

The open-source core builds trust, adoption, and ecosystem compatibility. The paid product should focus on team collaboration, hosted visibility, governance, integrations, and enterprise controls.

## Open Source Core

The open-source repository should include:

- workflow specification
- artifact contracts
- local CLI
- local `.runwise` ledger
- basic project scanner
- basic project memory/wiki generator
- Pi adapter
- Codex skill adapter
- templates
- basic final gate
- local reports

Templates:

- `intake.md`
- `grill.md`
- `TECH_SPEC.md`
- `subtasks.json`
- `test_plan.md`
- `final_report.md`
- `red_lines.yaml`
- `archive.json`

## Paid Team Product

Paid value should focus on team-level needs:

- workspace and members
- hosted run registry
- cloud dashboard
- multi-project visibility
- Linear/GitHub/Jira/Slack deep integrations
- requirement deduplication
- hosted archive index
- advanced policy packs
- test orchestration
- audit logs
- RBAC and SSO
- hosted memory sync
- enterprise self-hosting

## Why Not Pure Open Source

Pure open source is trusted and easy to adopt, but it is hard to sustain the cost of:

- hosted dashboards
- team collaboration
- enterprise integrations
- permission systems
- audit and compliance
- support

## Why Not Pure Closed Source

Pure closed source is harder to trust because Runwise touches local repositories, project context, test logs, and agent traces.

Developers need to understand what is scanned, what is stored, and what is synced.

## Product Boundary

Open source:

```text
local-first harness
basic workflow
basic adapters
local verification
```

Paid:

```text
team control plane
hosted run history
deep integrations
policy governance
audit
enterprise controls
```

