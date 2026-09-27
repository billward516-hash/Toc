# Independence Log

A contemporaneous record showing that the TOC Factory Game is a personal project: built on my own time, with my own equipment, through my own personal accounts, and without employer resources or confidential information.

This repository is public. Identifying details (legal name, device serial numbers, receipts, employment agreement, time-off approvals, travel records) are kept in private records, not here.

## Standing declaration

- **Owner:** GitHub account [`billward516-hash`](https://github.com/billward516-hash), a personal user account. The project began on 2026-09-27 with the scope document in `docs/`; this repository was created that day at 23:13:36 UTC.
- **Claude:** my personal claude.ai account, which I pay for myself. Code and documents here are produced with Claude Code under my direction. Commits are authored as `Claude <noreply@anthropic.com>` and carry a `Claude-Session:` link to the session in my account.
- **Equipment:** my personal iPad. Code runs in Claude Code cloud sessions under my personal account, never on an employer machine.
- **Network:** home, cellular, or other non-employer networks, including while traveling; never an employer network, VPN, or remote desktop.
- **Time:** outside my employer's working hours as set in [`config.json`](config.json), or during approved time off listed there under `timeOff`. Any other entry inside those hours is flagged automatically and must state a reason.
- **Materials:** Theory of Constraints content from public sources and my own knowledge. No employer-owned materials, data, systems, email, storage, or software licenses.
- **Decisions:** the design decisions are mine and are recorded in session-end entries, which also documents human authorship.

## How the evidence fits together

| Source | What it shows | Kept by |
|---|---|---|
| Entries in [`entries/`](entries/) | What was done, when, and how | This repository |
| GitHub push times ([Activity page](https://github.com/billward516-hash/Toc/activity)) | When each entry and commit reached GitHub | GitHub |
| Claude session history | A timestamped transcript of the work itself, in my personal account | Anthropic |
| `*.tsr` timestamp tokens | The entry existed at that moment; neither I nor GitHub can backdate it | Independent RFC 3161 timestamp authority |
| Private records | Device ownership, personal payment, employment terms | Owner, outside the repo |

Each entry is committed and pushed right after it's written. Entries are never edited or deleted; corrections are new entries. Each entry lives in its own file, so work on separate branches merges without conflicts.

## Using it

```
node scripts/log-session.mjs start                  # beginning of a work session
node scripts/log-session.mjs end "what was done"    # end of a session, including decisions made
node scripts/log-session.mjs note "text"            # anything else: offline work, a backfill, a reason for a flag
node scripts/log-session.mjs week "summary"         # end of each project week
node scripts/log-session.mjs show > export.md       # one document: this declaration plus every entry
```

Options: `--device="personal iPad"` overrides `defaultDevice`; `--reason="PTO day"` explains an entry made inside employer hours.

Settings in `config.json`: `timezone` (the IANA zone your employer hours are defined in, such as `America/Phoenix`), `employerHours` (for example `{"days": [1, 2, 3, 4, 5], "start": "07:00", "end": "19:00"}`, with days as ISO weekdays where 1 is Monday), `timeOff` (approved time off, for example `[{"from": "2026-09-27", "to": "2026-10-03", "reason": "Vacation (PTO)"}]`), `defaultDevice`, and `tsaUrl`. Add time off before the work it covers.

## Weekly, outside the repo

Save a PDF of the repository's Activity page and of your Claude session list to your private records. GitHub's events API only reaches back 90 days, so these snapshots preserve the push history on your side.

## Verifying an independent timestamp

```
openssl ts -reply -in entries/X.md.tsr -text   # shows the time and the SHA-256 it covers
openssl dgst -sha256 entries/X.md              # must match "Message data" in the output above
openssl ts -verify -data entries/X.md -in entries/X.md.tsr -CAfile <the authority's root and intermediate certificates>
```
