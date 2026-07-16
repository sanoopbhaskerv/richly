## Imported Claude Cowork project instructions

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, invoke the `skill` tool with `skill: "graphify"` before doing anything else.

Rules:

- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## Local Git and commit policy

Work only inside the current local repository and current feature branch.

Do not:

- push to GitHub;
- create a pull request;
- merge into main;
- publish npm packages;
- modify remote repository settings;
- rewrite or force-push Git history;
- use `git commit --amend` after moving to a later phase;
- discard user-authored changes.

The working tree must be clean before Phase 1 begins. If it is not clean,
stop and report the pre-existing changes instead of committing them.

### Phase commits

Create one coherent Git commit after each successfully completed phase.

Before each phase commit:

1. Review `git status --short`.
2. Review the complete phase diff.
3. Confirm that only files related to the current and earlier approved phases
   are present.
4. Run `git diff --check`.
5. Run all validation applicable to the phase.
6. Fix failures and review findings.
7. Stage only the intended files.
8. Review `git diff --cached --stat`.
9. Review `git diff --cached`.
10. Commit only after validation succeeds.

Do not create a phase commit while relevant tests are failing, except when the
failure is confirmed to be pre-existing and unrelated. Document any such
exception in the final report.

After committing:

1. Verify the working tree is clean.
2. Record the commit hash and commit message.
3. Continue to the next phase without asking for routine approval.

### Required commit sequence

Phase 1:

`chore(image-studio): scaffold packages and workspace tooling`

Phase 2:

`feat(image-core): add session history and serialization`

Phase 3:

`feat(image-core): add canvas rendering and export`

Phase 4:

`feat(image-core): add adjustments and transient previews`

Phase 5:

`feat(image-react): add image editor primitives`

Phase 6:

`feat(image-studio): add responsive image editor UI`

Phase 7:

`feat(plugin-image-editor): integrate Image Studio with Richly`

Phase 8:

`feat(image-studio-demo): add standalone PWA`

### Final review commit

After all eight phase commits, review the complete branch against its starting
point.

Apply confirmed review corrections in a separate commit:

`fix(image-studio): address final review findings`

Do not create an empty final-review commit when no changes are needed.

At completion, do not push or merge. Leave the committed feature branch local
for user inspection.
