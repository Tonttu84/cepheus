# Decisions

One row per decision. Never rewrite an old row: a reversal is a new row that names the one it replaces.

| ID | Decision | Reason | Chosen against |
| --- | --- | --- | --- |
| D1 | Start in a local repository with commits straight to `main` and no remote | The owner, 13 Nov 2026: "lets create a local repo, my friend will create the team repo ... we can later add it to the team repo". History stays organised before the team repository exists | Waiting for the team repository (work would sit uncommitted); a branch and pull-request flow (there is no remote to open a pull request against) |
| D2 | Install the commit hooks for this clone only (`install.sh --git-hooks`), not as a committed `.githooks/` | This history will later be added to a team repository the owner does not own; committed hooks would impose this workflow on it | The installer's default mode, which commits `.githooks/` and a `.gitattributes` rule |
| D3 | Keep `.private/` and `.watch/` untracked | They hold private notes and event credit codes; history that is pushed later cannot be cleanly scrubbed | Tracking everything in the folder |
