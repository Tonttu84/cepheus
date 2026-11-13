# Decisions

One row per decision. Never rewrite an old row: a reversal is a new row that names the one it replaces.

| ID | Decision | Reason | Chosen against |
| --- | --- | --- | --- |
| D1 | Start in a local repository with commits straight to `main` and no remote | The owner, 13 Nov 2026: "lets create a local repo, my friend will create the team repo ... we can later add it to the team repo". History stays organised before the team repository exists | Waiting for the team repository (work would sit uncommitted); a branch and pull-request flow (there is no remote to open a pull request against) |
| D2 | Install the commit hooks for this clone only (`install.sh --git-hooks`), not as a committed `.githooks/` | This history will later be added to a team repository the owner does not own; committed hooks would impose this workflow on it | The installer's default mode, which commits `.githooks/` and a `.gitattributes` rule |
| D3 | Keep `.private/` and `.watch/` untracked | They hold private notes and event credit codes; history that is pushed later cannot be cleanly scrubbed | Tracking everything in the folder |
| D4 | Track the planning material in `docs/`: the general plan, the research reports and the doctor's notes, with no names and no message times. Replaces D3 for the planning files; the watch files and the raw notes stay untracked | The owner, 13 Nov 2026: "We can put it out as long as it is anonymous. It isnt really that sensitive, it helps other AI understand the context? Though we could maybe format them better" | Keeping the doctor's notes untracked, which D3 did on the grounds that pushed history cannot be scrubbed |
| D5 | Changes reach `main` through a branch and a review. The first push of the planning documents went straight to `main` as a one-off. Replaces the "commits straight to `main`" part of D1 | The owner, 13 Nov 2026: "Lets do it through PRs and reviews etc generally. We can push this time But lets not do it again" | Continuing to commit straight to `main`, which suited a local repository with one author but not a shared one |
