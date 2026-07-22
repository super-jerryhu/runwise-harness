# Contributing

Thanks for considering a contribution to Runwise Harness.

Runwise is early. The most valuable contributions right now are focused improvements to the local-first workflow core:

- run ledger model
- CLI behavior
- final gate checks
- scanner fixtures
- agent adapter contracts
- documentation clarity

## Development Workflow

Use the repository workflow in [docs/development-workflow.md](docs/development-workflow.md).

For code changes:

1. Start from the roadmap or an issue.
2. Keep the change scoped.
3. Add or update tests first when changing behavior.
4. Run verification locally.
5. Explain verification evidence in the PR.

## Local Setup

```bash
npm test
```

The project currently uses Node.js built-in test runner and no third-party runtime dependencies for the local MVP core.

## Privacy Boundary

Do not add behavior that uploads source code, code snippets, embeddings, logs, secrets, or agent traces by default.

Any sync behavior must be explicit, documented, auditable, and covered by tests.

## Pull Requests

PRs should include:

- summary
- affected area
- tests run
- privacy/security notes if relevant
- follow-ups or gaps

