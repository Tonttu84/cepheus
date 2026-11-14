# Requests between team members

This file holds the things one person asks of the others, so that agents can pass them on
at the start of a session instead of anyone repeating them in chat. To add a request, add
a row to the table through a trail, like any other change, and put the request in the
trail's title. Agents pass these on to their users unprompted, as soon as they see
them. A row is removed or marked done in the trail that carries the request out.

| Date | From | To | Request | Status |
| --- | --- | --- | --- | --- |
| 14 Nov 2026 | the project owner | the team | A trail needs one approval to merge, and the author's own does not count. Please approve the owner's trails in Entire's web client, in this order, since some build on others: 28 (the patient's use cases), 29 (the translation dictionary), 10 (the question set), 8 (the steps after a warning), 30 (decisions D17 to D30, after 8), 12 (the build plan), then 5 and 9 (two research reports). | open |
| 14 Nov 2026 | the project owner | the team | Trail 21 has three proposals: rewards, other conditions, and a message read by a person. Please give each proposal your Approved, Disapproved or a comment, not only an approval of the trail. | open |
| 14 Nov 2026 | the project owner | whoever builds trail 31 | Trail 31 (a model writing a short pre-call brief for the nurse) is approved with conditions: a separate module behind a switch, off by default; pseudonymous derived numbers only; it never decides or changes a warning; and a row in `docs/decisions.md` for the rule it relaxes. | open |

## Making it pop up by itself

`npm run requests` (or `node scripts/check-requests.mjs`) fetches, reads this file on
`main` and on every branch, and prints only the open requests this machine has not shown
before; `--all` prints every open request again. It remembers what it has shown in
`.git/requests-seen.json`. An agent harness that supports hooks can call it at session
start and before each prompt, so that its output lands in the agent's context without
anyone asking.

Example, which each person enables on their own machine (it is not set up in this
repository and has not been tried in a harness): in Claude Code, a `SessionStart` and a
`UserPromptSubmit` command hook in a settings file such as `.claude/settings.local.json`:

```json
{
  "hooks": {
    "SessionStart": [
      { "hooks": [{ "type": "command", "command": "node scripts/check-requests.mjs" }] }
    ],
    "UserPromptSubmit": [
      { "hooks": [{ "type": "command", "command": "node scripts/check-requests.mjs" }] }
    ]
  }
}
```

Nothing can pop up while no agent session is running: a request reaches a person the next
time their agent starts or they send it a prompt.
