# Theory of Constraints Factory Game — Project Scope Document

**Status:** Design scope complete. Implementation kickoff decisions locked in (see §12, added 2026-09-27). Ready for implementation.
**Purpose:** This document is the authoritative spec for the game's design and architecture. It consolidates all decisions made during scoping so implementation (in Claude Code or otherwise) can proceed against a single source of truth.

---

## 1. Project Summary

An HTML5-based educational game that teaches the principles of the Theory of Constraints (TOC) through a configurable factory simulation. Built to run on tablet, laptop, phone, Android, and iOS via the browser. Target audience: high-school age through adult learners. Visual style: cartoon (stylized geometric/flat-color aesthetic, not commissioned illustration — see Section 7).

**Core teaching mechanism:** players start from pre-built factory scenarios (not blank-canvas construction) and make configuration changes, observing the effect on a discrete-event simulation (DES) of factory flow. Each level is authored to reliably produce a specific TOC lesson, reinforced by contextual pop-up explanations grounded in TOC methodology.

**Guiding design principle:** *Learning is more important than winning.* No hard game-over states. Every run is scored and explained, including bad runs. Retry is frictionless (no penalty, no limited attempts). Failure is a teaching moment, not a wall.

---

## 2. Content Scope — TOC Principles Covered

The following 24 principles form the instructional core (numbering preserved from original scoping discussion):

**Core Constraint Logic:** 1 (every system has a constraint), 2 (weakest-link logic), 3 (Five Focusing Steps), 4 (bottleneck-hour is irrecoverable), 5 (non-bottleneck speedup is a mirage), 6 (local optima ≠ global optimum)

**Dependent Events & Statistical Fluctuation:** 13 (compounding delays), 14 (variability accumulates at the constraint), 15 (match/dice phenomenon — balanced-capacity lines underperform)

**Buffer Management / Drum-Buffer-Rope:** 16 (drum), 17 (buffer), 18 (rope), 19 (buffer penetration as diagnostic signal)

**Batch Size & Flow:** 20 (transfer batch ≠ process batch), 21 (small batches at non-constraints), 22 (larger batches at the constraint to amortize setup), 23 (batch size reduction improves lead time/WIP)

**Capacity, Elevation, Policy:** 26 (market as constraint), 27 (policy constraints), 31 (there is always a next constraint), 32 (inertia as constraint), 33 (balance flow, not capacity)

**Product Mix:** 28 (throughput-per-constraint-unit over margin), 29 (cost-based mix decisions are often wrong)

*Explicitly out of scope for v1:* TOC Thinking Processes tools (evaporating cloud, current reality tree, etc. — principles 34–35). These are conceptually part of TOC but don't map to a factory-floor simulation; a future dialogue/decision-tree game mode could address them separately.

---

## 3. Level Structure

### 3.1 Tier Overview

| Tier | Focus | Principles | Win-condition type |
|---|---|---|---|
| 0 | Orientation — reading the factory | 1, 2, 6 | Identify the bottleneck (no scoring) |
| 1 | Five Focusing Steps as procedure | 3, 4, 5 | Output / basic |
| 2 | Dependent events & variability | 13, 14, 15 | Stability (steady flow, no buildups) |
| 3 | Buffers & pacing (DBR) | 16, 17, 18, 19 | Stability (primary), buffer/rope discipline (secondary) |
| 4 | Batch size & flow | 20, 21, 22, 23 | Output (primary), stability (secondary), setup-loss/OE proxy (tertiary) |
| 5 | Elevation, constraint migration, policy constraints | 26, 27, 31, 32, 33 | Output (primary), stability (secondary), investment efficiency (tertiary) |
| 6 | Product mix & revenue decisions | 28, 29 | Revenue/profit T−OE (primary), output (secondary), inventory carrying cost (tertiary) |

### 3.2 Sequencing & Branching

- **Tiers 0–3 are a mandatory linear sequence.** Each tier's mental model depends on the prior one (reading the sim → improvement procedure → variability → buffering against variability).
- **Tiers 4, 5, and 6 unlock in parallel once Tier 3 is complete** (skill-branching, not forced sequence). A learner or instructor can choose emphasis — e.g., go straight to Tier 6 for a product-mix-focused session.
- Because Tiers 4–6 are independently reachable, each must stand alone pedagogically. Any level that assumes a concept from a *sibling* branch (not an ancestor) needs a light recap pop-up rather than assuming prior exposure.
- Level data model requires explicit prerequisites (a dependency graph), not a simple linear index: `level.requires = ['tier3-buffers']` rather than `level.order = 4`.
- A visual skill-tree/progress-map screen is a required UI surface (node states: locked / unlocked / completed / starred).

### 3.3 Level Composition

Each level consists of three authored parts:
1. **Preset factory layout** — stations, routing, and initial parameters (speeds, batch sizes, variability settings) hand-tuned so the specific target problem reliably emerges.
2. **Allowed-changes list** — the specific levers the player may adjust in that level, scoped tightly to the principle being taught rather than exposing every possible knob.
3. **Win condition + trigger-based pop-ups** — tied to specific in-sim events (buffer penetration crossing red, throughput target met, an action that reveals a principle).

### 3.4 Parametric vs. Topological Changes

- **Tiers 0–4: parametric changes only.** Player adjusts existing station speed, batch size, buffer size, release rate, or reassigns a floating operator. Layout topology is fixed.
- **Tiers 5–6: topological changes unlocked.** Adding a buffer, adding parallel capacity, or rerouting a product becomes available — this gives "elevate the constraint" (principle 24/25) and policy-constraint fixes a literal, satisfying action rather than an abstract slider.
- **Capstone / Sandbox:** full from-scratch factory construction is either a graded capstone tier or an ungraded, always-available sandbox mode (no pop-ups, free experimentation). Both can reuse the same station/routing editor built for Tier 5–6 topological changes. Not required for v1; architecture should not block it.

### 3.5 Factory Theming

**Decision (revised during implementation kickoff — see §12.5): theme is tied to tier content, with consistency preserved only where it's pedagogically load-bearing.**

- **Tiers 0–3 (the mandatory linear spine) share a single theme: toy/widget assembly line.** These four tiers are explicitly sequential — each depends on the mental model built in the one before — so the original rationale (build visual intuition once, reuse it across adjacent tiers) applies at full force here. Generic parts (gears, blocks, toy figures) read clearly across the full high-school-to-adult range and carry no food-safety or unfamiliar-process baggage.
- **Tiers 4–6 (independently-reachable branches) each get a distinct, context-matched theme.** Since a learner can reach these in any order and none builds on another, the cross-tier-consistency argument doesn't apply — and a theme matched to content makes the lesson more concrete (e.g., a product-mix decision is more intuitive framed as "which cookies do we bake more of" than as an abstract SKU list). Candidate mapping, to be finalized when each tier is actually built:
  - **Tier 6 (product mix & revenue) → bakery/candy factory.** Strongest fit: different products are literally different cookies/candies with obviously different margins and resource draw.
  - **Tier 4 (batch size & flow) → print shop or bakery** (changing plates/ink between runs, or pans between flavors, are both legible stand-ins for setup time) — exact pick TBD.
  - **Tier 5 (elevation, constraint migration, policy) → print shop** (buying a new press is a literal "elevate the constraint") — TBD.
- This is a larger art/content workload than a single global theme, but it's sequenced so the extra cost lands *after* the MVP (Tiers 0–3), not before it. See §12.3.

---

## 4. Simulation Engine

### 4.1 Architecture: Discrete-Event Simulation (DES)

Chosen over fixed-tick simulation specifically because TOC's core lessons (queues building/draining irregularly in front of a bottleneck, statistical fluctuation compounding through dependent events) require true event-driven, stochastic behavior rather than a deterministic tick loop.

- Engine tracks a queue of future events (e.g., "Station 3 finishes part #482 at t=142.7s") and advances event-to-event rather than tick-by-tick.
- Computationally trivial at the scale required (a dozen stations, a few hundred parts in flight) — no need for Web Workers or off-main-thread execution in v1.

### 4.2 Randomness & Seeding

- **Seeded PRNG is a core engine feature from day one** (e.g., mulberry32 or equivalent), not retrofitted later.
- Supports deterministic replay (same seed → identical run) for teaching contrast, reproducible classroom scenarios, and the "seed required or not" configuration flag from the original scope.
- **Engine must support batch execution**: a `runBatch(config, seeds[])` entry point that executes N independent runs of one configuration and returns an array of results (needed for multi-seed robustness scoring — see Section 5.4).

### 4.3 Cycle-Time & Downtime Modeling

- **Cycle-time distributions**, configurable per station. Start with **uniform or triangular** distributions (bounded, intuitive) for early tiers; introduce normal/exponential distributions later (Tier 5+) as a "realism" escalation once the player is ready for messier behavior.
- **Downtime/failure modeling is a separate configurable dimension** from cycle-time variability (MTBF/MTTR, or a simpler per-cycle stoppage probability + duration). Introduced *after* variability is already understood (not simultaneously), likely Tier 2b/3, so the player can distinguish "queue is building from variability" vs. "queue is building from a breakdown."

### 4.4 Time Control & Rendering

- Simulation speed multiplier (1x, 4x, "run to completion").
- Scrubbable timeline/history so a player can rewind and inspect why a queue built up at a specific timestamp, not just watch live.
- Pause-on-event option (e.g., auto-pause when buffer penetration crosses into red) for teaching moments.
- Rendering layer must interpolate station/queue states between discrete events for smooth animation, especially at higher speed multipliers — event timestamps are irregular, so naive snapping will look jerky.

### 4.5 Event Log

- Full event log (e.g., "t=140.2s — Station 2 finished Part 482, released to buffer") should be inspectable but **hidden by default**.
- Exposed via a "Show simulation log" toggle, off by default, available starting Tier 2 — useful for advanced/adult learners diagnosing behavior, but would overwhelm early/younger learners if shown by default.

### 4.6 Application Framework

- **React** for UI/state management (skill-tree map, live dashboard, pop-up queue, scrubbable timeline, multi-seed result views) — chosen over vanilla JS/TS for the amount of cross-cutting UI state this app carries, and over Vue/Svelte for ecosystem breadth (animation/drag-interaction libraries needed for station drag-adjust and the Tier 5–6 routing editor).
- The simulation engine (§4.1–4.5) stays a plain, framework-agnostic TS/JS module that emits an event stream — consistent with the engine/rendering decoupling already required by §9, and keeps the engine independently testable and reusable if the frontend framework ever changes.

---

## 5. Scoring System

### 5.1 Design Philosophy

Scoring should teach the principle, not just gate progress. No hard failure — every run is scored and explained. A persistent, small T/I/OE-style dashboard should be visible from early tiers (even before the terms are formally introduced) so the player has been unconsciously watching Throughput/Inventory/OE-equivalent numbers well before Tier 6 names them.

### 5.2 Win-Condition Types by Tier

| Type | What it measures | Tier |
|---|---|---|
| Bottleneck identification | Correct answer, ungraded | 0 |
| Output (basic) | Units completed | 1 |
| **Stability** ("steady flow, no buildups") | % of sim time queue/buffer stayed in "green" band; penalties weighted by depth *and* duration of red excursions | 2, 3 |
| Output | Units/revenue over horizon | 4, 5 |
| Revenue/Profit (T − OE) | Full throughput-accounting formula, minus inventory carrying cost | 6 |

**Stability formula detail:** track queue length at each station (specifically the pre-constraint buffer once buffers exist). Score = time-weighted percentage within target band. A brief spike costs little; a sustained overflow costs heavily. This reuses the same buffer-penetration meter built for the live diagnostic (principle 19), so one system serves both a real-time visual aid and a scoring mechanism.

### 5.3 Metric Registry (Primary / Secondary / Tertiary)

Scoring complexity grows with tier — not every level has three active metrics.

| Tier | Primary | Secondary | Tertiary |
|---|---|---|---|
| 0–1 | Bottleneck ID / output | — | — |
| 2 | Stability | — | — |
| 3 | Stability | Buffer/rope discipline (WIP cap adherence) | — |
| 4 | Output | Stability | Setup-loss / OE proxy |
| 5 | Output | Stability | Investment efficiency (capacity $ vs. gain) |
| 6 | Revenue/Profit | Output | Inventory carrying cost |

- Star rating is capped by how many metrics are active at that level (e.g., a Tier 1 level with only a primary metric can only ever award 1 star — a deliberate signal that "there's more to learn later").
- 1 star = primary metric meets minimum bar. 2 stars = primary + secondary meet target. 3 stars = all active metrics (including tertiary, where present) meet target.
- **Failing a win condition never ends the run** — it scores lower and shows a "try again" prompt with explanation, never a hard game-over.

### 5.4 Seeding Policy & Multi-Seed Robustness Scoring

**Philosophy:** the goal is that a player's solution must be *robust across conditions*, not tuned to one lucky random sequence — directly reflecting "learning over winning."

| Tier | Seed policy | Seeds (N) |
|---|---|---|
| 0–1 | Same-seed (baseline vs. player run) | — |
| 2 | Same-seed — essential here, since the lesson is that variability compounds even given *identical* draws | — |
| 3 | Same-seed for 1–2 stars; **fresh-seed multi-run required for 3rd star** | 3 |
| 4 | Same as Tier 3 (fresh-seed gates 3rd star) | 5 |
| 5 | **Fresh-seed multi-run mandatory from the start** | 7 |
| 6 | **Fresh-seed multi-run mandatory** | 10 |

**Mechanic:** a fresh-seed-mandatory level runs the player's *single submitted configuration* across N freshly-randomized seeds (not sequential retry attempts — one submission, evaluated N times). Score is reported per-seed and aggregated (e.g., "3 of 5 seeds hit target," plus a distribution/spread view). Star rating keys off the aggregate (e.g., 3 stars = target met on all N seeds, 2 stars = N−1 of N, etc.), so a partially-robust solution still earns visible partial credit rather than a binary pass/fail.

- Seed count scales with tier stakes (3 → 5 → 7 → 10) — a difficulty lever independent of level content, consistent with "increasingly more difficult situations."
- **Transparency decision:** tell the player the seed count in advance for a given level (e.g., "this level tests your solution against 7 different conditions"). Consistent with "learning over winning" — the bar being applied should be visible, not hidden as a gotcha.
- **Visualization scaling:** individual run-strips (pass/near-miss/fail per seed) work up to ~5 seeds; above that, collapse into an aggregate distribution view (histogram/box-plot style) to avoid UI clutter at N=7 or N=10.
- This mechanic doubles as a live re-demonstration of principles 13/14 (dependent events + statistical fluctuation) — now applied to evaluating the player's own policy, not just the raw factory. A deliberate bit of thematic closure for later tiers.

### 5.5 Terminology Unlock Schedule

Score labels evolve from generic game terms to formal TOC accounting vocabulary as the player progresses, rather than front-loading jargon:

| Tier | Displayed as |
|---|---|
| 0–3 | Output, Consistency/Stability, WIP |
| 4–5 | Output *("Throughput" introduced alongside)*, Stability, Setup Loss / Cost |
| 6 | Throughput ($), Inventory ($), Operating Expense ($) — full formal T/I/OE |

---

## 6. Pop-Up / Explanation System

- Pop-ups explain *why* a decision helped or hurt, grounded explicitly in TOC methodology, tied to specific triggering in-sim events (not generic congratulations).
- Density should be **high early, sparse later** — an option to reduce/disable pop-ups once retention is demonstrated (e.g., a short in-level check question) avoids the system becoming patronizing by Tier 3+.
- **Inertia (principle 32) should be taught experientially, not just explained:** don't flag in advance that an old policy has expired. Let a rule that helped in an earlier tier start quietly hurting in Tier 5, and surface the explanatory pop-up only after the player notices/questions it or after a set number of turns of degraded performance — the lesson is more durable if the player feels the failure before being told why.

---

## 7. Visual Style

- **Cartoon aesthetic**, implemented as stylized geometric/flat-color shapes with bold outlines (SVG/CSS-based — a Duolingo/Kahoot-like feel), not commissioned illustrated sprites. Chosen to avoid blocking engineering on an art pipeline, while still reading as bright, appealing, and age-appropriate for the target audience.
- **Color is functional, not just decorative:** red = bottleneck/constraint, amber = building queue, green = flowing/healthy. Bright, appealing colors should be reconciled with this functional coding rather than working against it.
- Persistent buffer-penetration meter (green/yellow/red bands) is a core, always-visible UI element from Tier 3 onward.

---

## 8. Platform & Persistence

### 8.1 Target Platforms

Single HTML5 codebase running in-browser across tablet (primary target), laptop, phone, Android, and iOS. No native app packaging required for v1.

### 8.2 Single Learner + Classroom Support

- **v1 ships single-learner, local persistence** (localStorage/IndexedDB) — progress, stars, and scores stored per-device.
- **Data model must be shaped for classroom use from day one**, even though the instructor-facing features are v1.5+: every score/progress event should be tagged with a learner ID and timestamp, even in single-learner mode, so the same event stream can later feed a server-side/instructor view without a data-model rewrite.
- **v1.5 (architecture-ready, not built):** server-side persistence, learner accounts, cohort/class grouping, instructor view (roster, per-learner scores, assignable level subsets).
- Persistence should be written against an interface (e.g., `saveProgress(learnerId, event)`) so swapping localStorage for a backend API later doesn't touch game logic.

### 8.3 Real-Classroom Use (v1)

- v1 has no accounts (§8.2), so learner identification for a real class is handled without any server dependency: **each learner enters a nickname once per device**, stored only in that device's localStorage and never transmitted — this satisfies the `learnerId` tagging §8.2 already requires, without collecting anything sensitive.
- Because storage is local-only and per-device, a classroom set of shared/rotating tablets should assign one learner per device per session (or accept that switching users on one device means re-entering a nickname and starting fresh progress on that device) until v1.5's server-side accounts exist.
- No name validation, account creation, or password is introduced — keeps friction at zero for a first-time class rollout.

---

## 9. Explicit Architectural Seams (Build Now vs. Support Later)

To avoid a rewrite when future scope is tackled, the following seams must exist in the v1 architecture even where the corresponding feature is not yet built:

| Seam | v1 behavior | Future behavior it must support |
|---|---|---|
| Level schema `allowedChanges` | Populated with parametric operations only (Tiers 0–4) or parametric + topological (Tiers 5–6) | Could include full topology operations for any level without a schema change |
| Persistence interface | Backed by localStorage | Swappable for a server-side API without touching game/UI logic |
| Simulation engine vs. rendering | Decoupled; engine emits an event stream, renderer consumes it | A future instructor-facing analytics view can consume the same event stream the player UI does |
| Level dependency model | Simple prerequisite graph for Tiers 0–6 branching | Extensible to more complex prerequisite/skill-tree structures without redesign |
| Seed/batch execution (`runBatch`) | Used for multi-seed scoring in Tiers 3–6 | Reusable for future sandbox/instructor-configured stress tests |

---

## 10. Explicitly Out of Scope for v1

- Full from-scratch factory construction (may exist later as capstone tier or sandbox mode; not required for v1)
- Server-side accounts, cohort management, instructor dashboard (architecture must support; not built)
- TOC Thinking Processes tools (evaporating cloud, current reality tree, etc.)
- Commissioned/illustrated art assets (using stylized SVG/CSS cartoon style instead)
- Native mobile app packaging (browser-based only)

---

## 11. Open Items Not Yet Decided

The following were raised during scoping but do not yet have a final decision and should be resolved before or during implementation:

1. ~~Exact factory theme~~ — **Resolved, see §3.5 and §12.5**: toy/widget assembly line for Tiers 0–3; distinct, context-matched themes for Tiers 4–6 (Tier 6 → bakery is settled as the strongest fit; the Tier 4/5 mapping is still TBD, but deferred past the MVP milestone regardless).
2. Exact tolerance-band widths for the stability metric per level (difficulty dial).
3. Exact numeric targets/thresholds for output and revenue win conditions per level.
4. Whether the capstone/sandbox mode ships in v1 or is deferred entirely to v1.5.
5. Specific downtime/failure parameters (MTBF/MTTR ranges) per tier.

Items 2, 3, and 5 are intentionally left for empirical tuning once the DES engine exists to tune against, rather than upfront guesses — they're playtesting outputs, not scoping inputs. Item 4 is deferred past the MVP milestone (§12.3) regardless.

---

## 12. Implementation Kickoff Decisions (added 2026-09-27, scoping follow-up)

### 12.1 Audience & Timeline

- **Ownership:** a personal project, built on the author's own time and equipment through personal accounts. Provenance is recorded in `independence/` (see its README).
- First intended use: **a real class/training the author teaches.** Real students, real stakes.
- Timeline: **three weeks, 2026-09-27 to 2026-10-17**, worked outside employer hours only. That's tight for the full Tiers 0–3 scope as specced (a DES engine with seeded PRNG and batch execution, four tiers of hand-tuned preset content, skill-tree UI, live T/I/OE-style dashboard, buffer-penetration meter, pop-up system, and — starting Tier 3 — multi-seed robustness scoring), so §12.6's first two cuts apply by default. Week-by-week plan in §12.7.
- Because real (likely under-18) students are involved, §8.3 applies: no server transmission of any learner-entered data in v1.

### 12.2 Technology Stack

- **React** for application/UI state; the simulation engine stays a framework-agnostic module (§4.6).
- Visual rendering: **SVG/CSS**, per §7 — confirmed sufficient at the stated simulation scale (§4.1: "a dozen stations, a few hundred parts in flight").
- Hosting/deployment and offline/PWA support are not yet decided — worth resolving before the class date if the classroom's wifi is unreliable, since §8's local-persistence model is most of the way to offline-capable already.

### 12.3 First Milestone (MVP Scope)

- **Tiers 0–3, fully playable end-to-end**, before any work begins on Tiers 4–6. This is the mandatory linear spine (§3.2) and the natural first slice: it proves the full pipeline (DES engine, seeded replay, stability scoring, buffer-penetration meter, pop-up triggers, skill-tree UI shell) on the content everything else depends on.
- Tiers 4–6 (including their distinct themes, §3.5) are explicitly out of scope until Tiers 0–3 are done and the class date is met.

### 12.4 Student Identification

- Self-entered nickname, local-only — see §8.3.

### 12.5 Theme Strategy

- See revised §3.5. Summary: one theme (toy/widget assembly line) for the Tiers 0–3 MVP; distinct, context-matched themes for Tiers 4–6, built after the MVP ships.

### 12.6 Risks & Scope-Cutting Candidates (given a hard "weeks" deadline)

Cut candidates, in order (cut from the top first), before cutting any of Tiers 0–3's core lessons. With three weeks of outside-work-hours time (§12.1), **cuts 1 and 2 apply by default**; 3 and 4 are held in reserve.

1. Defer the **scrubbable timeline/rewind** (§4.4) to a post-deadline polish pass; ship with play/pause/speed-multiplier only. It's a diagnostic convenience, not load-bearing for the lesson itself.
2. Defer the **"Show simulation log" toggle** (§4.5) — same reasoning, an advanced-user convenience.
3. Ship Tiers 0–3 with **simplified/placeholder station art** (basic shapes, correct functional color-coding per §7) and do a full cartoon-style art pass afterward. Functional color-coding (red/amber/green) is load-bearing and should not be cut; decorative polish can follow later.
4. Treat Tier 3's **secondary metric (buffer/rope discipline, §5.3)** as a stretch goal — ship with the primary stability metric working, add the secondary scoring dimension if time allows.
5. **Do not cut:** the DES engine itself, seeded PRNG/replay, the primary win-condition/scoring for each tier, or the pop-up explanations — these are the actual teaching mechanism (§1's "learning is more important than winning" principle), not polish.

Revisit at each weekly checkpoint (§12.7).

### 12.7 Three-Week Plan

Each week closes with a `week` checkpoint entry in the independence log.

| Week | Dates | Build | Done when |
|---|---|---|---|
| 1 | Sep 27 – Oct 3 | App scaffold (Vite, React, TypeScript); hosting chosen on a personal account, first deploy live; DES engine core (event queue, seeded PRNG, stations and queues, uniform/triangular cycle times, `runBatch`) with determinism tests; level schema and prerequisite graph; persistence interface | Tier 0 plays: the learner reads a factory and identifies the bottleneck |
| 2 | Oct 4 – Oct 10 | SVG renderer with interpolation; play/pause/speed; allowed-changes controls; output and stability scoring with stars; pop-up triggers; skill-tree map; small T/I/OE-style dashboard; Tier 1–2 content | A learner can play Tiers 0–2 start to finish on a tablet |
| 3 | Oct 11 – Oct 17 | Buffers and DBR (buffer-penetration meter, release/rope control); 3-seed evaluation for the third star; nickname entry; device QA; tuning from playtests | Tiers 0–3 play end to end on the class's devices, deployed, with a dry run done |
