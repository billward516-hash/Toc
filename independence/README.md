# Independence Log

A contemporaneous record showing that the TOC Factory Game is a personal project: built on my own time, with my own equipment, through my own personal accounts, and without employer resources or confidential information.

This repository is public. Identifying details (legal name, device serial numbers, receipts, employment agreement) are kept in private records, not here.

## Standing declaration

- **Owner:** GitHub account [`billward516-hash`](https://github.com/billward516-hash), a personal user account. This repository was created there on 2026-09-27 at 23:13:36 UTC.
- **Claude:** my personal claude.ai account, paid personally *[owner to confirm]*. Code and documents here are produced with Claude Code under my direction. Commits are authored as `Claude <noreply@anthropic.com>` and carry a `Claude-Session:` link to the session in my account.
- **Equipment:** personally owned devices only: *[owner to list, described generically]*. Code runs in Claude Code cloud sessions under my personal account, never on an employer machine.
- **Network:** home or other personal networks; never employer Wi-Fi, VPN, or remote desktop.
- **Time:** outside my employer's working hours, as set in [`config.json`](config.json). Entries made inside those hours are flagged automatically and must state a reason (PTO, holiday, unpaid break).
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

Settings in `config.json`: `timezone` (an IANA name such as `America/Chicago`), `employerHours` (for example `{"days": [1, 2, 3, 4, 5], "start": "07:30", "end": "16:00"}`, with days as ISO weekdays where 1 is Monday), `defaultDevice`, and `tsaUrl`.

## Weekly, outside the repo

Save a PDF of the repository's Activity page and of your Claude session list to your private records. GitHub's events API only reaches back 90 days, so these snapshots preserve the push history on your side.

## Verifying an independent timestamp

```
openssl ts -reply -in entries/X.md.tsr -text   # shows the time and the SHA-256 it covers
openssl dgst -sha256 entries/X.md              # must match "Message data" in the output above
openssl ts -verify -data entries/X.md -in entries/X.md.tsr -CAfile <the authority's root and intermediate certificates>
```
