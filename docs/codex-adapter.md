# Codex Adapter

The Codex adapter is a skill package that teaches Codex how to use the local Runwise CLI.

It is a thin adapter. Core behavior stays in the shared `packages/core` and `packages/cli` packages.

## Package Structure

```text
packages/codex-adapter/
  package.json
  skills/
    runwise-harness/
      SKILL.md
```

## CLI Bridge

The adapter relies on the local `runwise` CLI:

```bash
runwise init
runwise scan
runwise start "<requirement title>" --json
runwise status --json
runwise verify <run-id> --command "<command>" --exit-code <code> --notes "<notes>"
runwise archive-gap <run-id> --reason "<reason>"
runwise final-gate <run-id> --write-report
```

## Privacy Boundary

The source code stays local by default.

The Codex adapter should not add cloud sync, source upload, embeddings upload, logs upload, or trace upload behavior. It should only call local deterministic Runwise commands unless a future user explicitly enables sync.

## Workflow

Codex should use Runwise for:

- requirement run creation
- demand-grill question capture
- context alignment
- design artifact tracking
- verification evidence
- archive gap recording
- final gate checks

