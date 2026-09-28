# TOC Factory Game

Personal project. The design spec and source of truth is `docs/TOC-Factory-Game-Scope.md`.

## Development

- `npm run dev`, `npm test`, `npm run lint`, `npm run build` (type-checks, then builds to `dist/`).
- `src/engine/` is the framework-free, deterministic simulator; keep it free of React and of `Math.random`.
- Level content lives in `src/levels/`. `levels.test.ts` checks every level still teaches its lesson across many seeds, so run the tests after tuning any level.
- With `saturate` release, keep the first station slower than every non-constraint station, or piles form in front of the wrong stations (see spec §4.7).
- Free play's line builder (`src/sandbox/`) turns a few settings per station into an engine model; its default line is tested like a level.
- Style follows the Vite template: no semicolons, single quotes, explicit `.ts`/`.tsx` import extensions.
- Deployment: `.github/workflows/deploy.yml` lints, tests, and builds every push, and publishes the default branch to GitHub Pages.

## Independence log (every session)

This project must stay provably personal: the owner's own time, equipment, and accounts. See `independence/README.md`.

- First action of every session, before any other work: `node scripts/log-session.mjs start`, then commit `independence/` and push.
- When the user says they're done or wraps up: commit all work, then `node scripts/log-session.mjs end "<what was done, and the decisions the user made>"`, then commit `independence/` and push.
- At the first session after each project week ends (weeks start on `projectStart` in `independence/config.json`): also log `week "<summary>"`.
- If the script prints a FLAG (entry inside employer hours), ask the user why and record it with `note`.
- Never edit or delete anything under `independence/entries/`; corrections are new `note` entries.
- The repository is public: never write the owner's email, legal name, device serial numbers, or employer name into it.
- Never bring employer materials, data, or systems into this project.
