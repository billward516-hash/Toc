# TOC Factory Game

Personal project. The design spec and source of truth is `docs/TOC-Factory-Game-Scope.md`.

## Independence log (every session)

This project must stay provably personal: the owner's own time, equipment, and accounts. See `independence/README.md`.

- First action of every session, before any other work: `node scripts/log-session.mjs start`, then commit `independence/` and push.
- When the user says they're done or wraps up: commit all work, then `node scripts/log-session.mjs end "<what was done, and the decisions the user made>"`, then commit `independence/` and push.
- At the first session after each project week ends (weeks start on `projectStart` in `independence/config.json`): also log `week "<summary>"`.
- If the script prints a FLAG (entry inside employer hours), ask the user why and record it with `note`.
- Never edit or delete anything under `independence/entries/`; corrections are new `note` entries.
- The repository is public: never write the owner's email, legal name, device serial numbers, or employer name into it.
- Never bring employer materials, data, or systems into this project.
