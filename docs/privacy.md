# Privacy Model

Runwise should be local-first by default.

The local runner or agent adapter scans the user's repository on the user's machine. Cloud sync is optional and should be explicit.

## Default Promise

```text
Your code stays local by default.
```

Runwise should sync workflow state, documentation metadata, test summaries, and approved project context for team collaboration. It should not upload source code unless the user explicitly chooses a mode that allows it.

## Data Levels

### Level 0: Local Private

Default: never upload.

- source code
- `.env`
- secrets
- private keys
- local configs
- uncommitted diffs
- full AST or code snippets
- production logs
- customer data
- database dumps

### Level 1: Project Metadata

Safe to sync by default in team mode.

- repository name
- language/framework summary
- package manager
- service list
- test commands
- file structure summary
- current commit sha

### Level 2: Structured Project Context

Sync only after user approval.

- generated project wiki
- service map
- API map
- database schema summary
- test matrix
- red lines
- ownership hints

### Level 3: Requirement Run Records

Core team collaboration data.

- intake answers
- grill questions
- design docs
- subtasks
- test plans
- test results
- final gate results
- archive links
- run timeline

### Level 4: Advanced Cloud Context

Must be explicit opt-in.

- code snippets
- embeddings
- detailed agent traces
- historical fix summaries
- advanced memory objects

## Privacy Modes

### Local Only

All project context and run artifacts stay local.

Cloud may know only that a project shell exists, if the user connects one.

### Metadata Sync

Recommended default for teams.

Syncs project metadata, run status, artifact links, and test summaries.

Does not upload source code.

### Context Sync

Syncs generated project wiki, service summaries, business rules, red lines, and test matrix.

Does not upload full source code by default.

### Full Cloud Index

Explicit opt-in.

Uploads approved code snippets or a fuller code index for cloud retrieval.

### Enterprise Self-Hosted

Customer runs the control plane and storage in their own environment.

## Security Requirements

Runwise should provide:

- secret scanning before sync
- `.env` exclusion by default
- configurable denylist
- no full source upload by default
- explicit privacy mode selection
- audit events for sync operations
- local token storage through OS keychain or secure local storage
- short-lived connector tokens
- workspace and project permissions
- log redaction
- data export and deletion

