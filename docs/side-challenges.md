# Side challenges

Status 13 Nov 2026, close to midnight. A proposal, open for comments on its trail:
nothing here is settled until the team has answered. The questions for the team are at
the end.

Side challenges ("tech challenges") are entered on top of the main challenge. The
proposed rule, which also stands in the team plan (`docs/plan.md`, on another open
trail): nothing is built only to enter one. We would enter one that matches how we
already work, and keep a map of the others in case one turns out to fit.

## Proposed entry: Best Use of Entire (MLH)

It is ticked in the draft submission saved on the Junction platform on 13 Nov, which
can still be changed.

Prize: a mini portable projector. Chosen because the repository lives on Entire and the
team already works through its trails.

**What the brief asks for**

- Use as many of Entire's core capabilities as possible: Sessions, Graph and Brain, with
  Trails for review.
- Judged on human-AI collaboration, clean code history, and measurable token efficiency.

**What each capability is, in the installed tool (CLI 0.13.4)**

| Capability | What it is | How it is reached |
|---|---|---|
| Sessions | Each coding agent's session saved as checkpoints next to the commits it produced, and pushed to the team | `entire enable`, then `entire agent add <agent>`, per person; `entire session` and `entire search` read them, as does the experimental `entire why` |
| Trails | A unit of work with intent, a branch, findings and a merge. Replaces the pull request | `entire trail ...`; see `AGENTS.md` |
| Graph | A local code graph for symbol search, tracing relationships and change impact, so agents search the graph, not the files | An official plugin: `entire plugin install graph` |
| Brain | A local, inspectable knowledge base of the repository built from session history, which agents can query for past decisions | An official plugin: `entire plugin install brain` |
| Token reports | Token use per session and across checkpoints | `entire session tokens`, `entire tokens profile` (experimental) |

**What we have done so far**

| When (13 Nov) | Use | Evidence |
|---|---|---|
| by 21:25 | Repository hosted on Entire; planning documents pushed | `main` |
| 21:27-21:47 | First trail: `AGENTS.md`, reviewed cold by a fresh agent, fixed, merged through Entire | Trail 1 |
| 21:27 | A teammate enabled Entire for the repository, with the Pi agent | Commit "Enable Entire" |
| 21:44 | The team plan published as a trail for comments | Trail 2 |
| 21:53-22:00 | A rule that every agent lists the open trails at session start, so nobody passes links by hand; reviewed, reworded, merged | Trail 3 |
| ongoing | Agents read `entire agent-help` for exact usage; merged trails are closed so the open list stays true | `AGENTS.md` |

**What we still need to do**

| # | What | Who | When |
|---|---|---|---|
| 1 | Sessions for everyone: enable Entire for the coding agent you use. Do not import earlier session history; sessions from before the repository was shared hold private notes and event codes | Each teammate | Saturday morning |
| 2 | One real handover: a teammate's agent resumes a trail that another person's agent started (`entire trail resume`), and we note what context it had without being told | Two teammates, unassigned | Saturday |
| 3 | Graph: install the plugin (done on one machine), tell agents in `AGENTS.md` to search the graph before searching files, and record token use for the same kind of task with and without it | Whoever takes the foundation workstream in the team plan | Once there is code, Saturday |
| 4 | Brain: it is installed and set up on one machine, and its agent guide is proposed on another open trail, with a rule that agents only read from it. Still to do: ask it one real question, such as why a decision in `docs/decisions.md` was made, and note whether the answer is right | Unassigned | Saturday evening, once sessions exist |
| 5 | Review on Entire's side: add Entire's preset review agents and switch on the approvals gate, so findings appear on each trail and a merge needs a review | The project owner | Saturday morning |
| 6 | Clean history: keep Conventional Commits, one logical change per commit, and every change through a reviewed trail; point to the history in the submission | Everyone | Throughout |
| 7 | Numbers: run the token reports and keep the figures in this file. "Measurable token efficiency" needs a before and an after | Unassigned | End of Saturday, and Sunday morning |
| 8 | For the submission: links to the trails, one generated summary of the agents' work (`entire dispatch`), the token figures, and a short account of the flow | Whoever takes the pitch workstream in the team plan | Sunday morning |

Not yet tried by us: session capture from Claude Code on any machine, Graph's search,
asking Brain a real question, `entire trail resume`, `entire search`, `entire dispatch`,
review agents, the approvals gate, and the token reports. The commands are listed by
the installed tool; what they do in practice is still to be seen.

## Map of other side challenges (none entered)

A challenge moves from this map to "entered" only when the product needs what it
offers.

| Challenge | Prize | What it would take | Fit |
|---|---|---|---|
| Gemini API (Google DeepMind) | 4000 / 2000 / 1000 EUR | Gemini central to the product | Possible: only if it clearly beats a plain template for the clinic's brief. Participants must be 18 or older |
| Arduino UNO Q | A UNO Q and kit per member | Edge AI on the board; publication on Arduino's Project Hub | Possible: computing the expressivity and head-movement numbers on the board, never a mood reading, would make "processed on the device" literal. Not checked whether the board can run it |
| Tiger Data (MLH) | A Stream Deck Mini | Time-series data in Tiger Data's Postgres | Possible: the signals are time series. Only if SQLite proves too weak, which is unlikely this weekend |
| Aiven | 1000 / 750 / 500 EUR | Aiven's managed database or streaming doing real work | Weak: same reasoning as Tiger Data |
| Codex (OpenAI) | 10,000 / 5000 / 2500 USD in API credits | Codex used in development, and shown | Depends on whether a teammate builds with Codex anyway |
| Gemma (Google DeepMind) | 1000 EUR to each of three teams | An open Gemma model doing real work | Weak: no task in the plan needs our own model |
| Nemotron (NVIDIA) | An RTX 5080 to each of two teams | The Nemotron vision-language model | No: it would mean a model reading faces, which our rules forbid |
| ElevenLabs (MLH) | Wireless earbuds | Generated speech | No: a voice for the patient's screen would be decoration |
| Modal, Verda | Cash and credits; credits | A model we serve ourselves on GPUs | No: nothing in the plan needs GPUs |
| CRACI | LEGO sets; build minutes | The project's CI running on CRACI | No for now: it works through GitHub, and our repository is on Entire |
| MongoDB, Vultr, Cloudinary, Context.dev, Oxylabs, Solana, Atech | Various | Their service in the core flow | No: none matches the product |

## Questions for the team

1. Does anyone object to entering "Best Use of Entire", or to entering no other side
   challenge for now?
2. Who takes rows 2, 4 and 7 of the to-do table (the handover, the Brain question, the
   token numbers)?
3. Is anything in the map wrong for your part of the work, for example a service you
   would in fact use?
4. Is everyone willing to enable session tracking for their own coding agent, knowing
   that it shares agent conversations with the team?
