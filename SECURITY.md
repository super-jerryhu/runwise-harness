# Security Policy

Runwise is local-first. Source code must stay local by default.

## Supported Versions

Runwise is pre-1.0. Security fixes should target the main development branch until versioned releases exist.

## Reporting A Vulnerability

Please do not open a public issue for sensitive security reports.

Until a dedicated security contact is published, report security concerns privately to the repository owner.

## Security Principles

- Do not upload source code by default.
- Do not upload `.env`, secrets, private keys, credentials, production logs, database dumps, or customer data.
- Treat embeddings and code summaries as potentially sensitive.
- Record sync behavior with audit metadata.
- Prefer local scanning and local retrieval.
- Make cloud sync explicit and opt-in.

## High-Risk Areas

Please flag changes that affect:

- source upload or cloud sync
- token storage
- local scanner exclusions
- final gate policy
- agent tool execution
- adapter permissions
- audit logs
- external integrations

