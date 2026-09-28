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

*Added 2026-09-28 at the owner's request (§3.6), numbered after the original list:*

**Disruptions & Recovery:** 36 (keep enough materials on hand to ride out a late delivery), 37 (scrap after the constraint wastes the constraint's time; catch defects before it), 38 (a change in the product mix can move the constraint), 39 (changing priorities at the constraint costs output; let the rope and buffer set the order)

**Demand & Forecasting:** 40 (forecasts are always wrong), 41 (make what customers take, not what the forecast says), 42 (forecast the total, and decide the details as late as possible)

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
| 7 | When things break: long breakdowns, late materials, poor yield | 4, 17, 19, 36, 37 | Output every day (primary), then inventory or cost (secondary, tertiary) |
| 8 | Changing orders: mix changes, priority changes, rush orders | 38, 39, 18, 22 | Output every day (primary), rush orders on time or steadiness (secondary) |
| 9 | Forecasts & demand | 40, 41, 42 | Sales (primary), waste and lost sales (secondary, tertiary) |
| 10 | Everyday problems: absences, overtime, rework, maintenance, power cuts, setup scrap | 4, 5, 17, 22, 37 | Output every day (primary), then cost or steadiness |

### 3.2 Sequencing & Branching

- **Tiers 0–3 are a mandatory linear sequence.** Each tier's mental model depends on the prior one (reading the sim → improvement procedure → variability → buffering against variability).
- **Tiers 4, 5, and 6 unlock in parallel once Tier 3 is complete** (skill-branching, not forced sequence). A learner or instructor can choose emphasis — e.g., go straight to Tier 6 for a product-mix-focused session. Tiers 7–10 (§3.6) join them the same way.
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
- **Equipment rules (Tiers 5–6; added 2026-09-28).** The owner asked for machines that can run only certain products. Budget and floor space are supporting restrictions suggested alongside it, so each purchase is a trade-off rather than "buy everything":
  - **Product restrictions and dedicated machines.** A machine may be able to run only some products (an oven that can't bake bread), or be dedicated to one product by house rule. A dedicated machine skips changeovers (Tier 4's setups) but can sit idle while another product's line is the constraint. A level can make the dedication rule itself the constraint: lifting "this oven only bakes cookies" raises output without buying anything. That's a policy constraint (principle 27), and the cheapest elevation there is, found by exploiting before elevating (focusing steps 2 and 4). In Tier 6, a machine shared by several products is where product-mix decisions bite (principle 28).
  - **Budget.** Each machine has a price, and the level sets a budget. Tier 5's investment-efficiency metric (§5.3) scores output gained per dollar, so money spent anywhere but the constraint scores poorly.
  - **Floor space.** The layout has a fixed number of open spots, and a new machine or buffer takes one. With more good ideas than space, the player has to choose where capacity matters most.
  - **Engine work this needs:** more than one product, each with its own route and times; for each machine, the products it may run; a rule for which waiting product a shared machine takes next; and a price and floor spot for each machine the player can buy. Today's engine runs one product down a straight line, with identical parallel machines per station.
- **Capstone / Sandbox:** full from-scratch factory construction is either a graded capstone tier or an ungraded, always-available sandbox mode (no pop-ups, free experimentation). Both can reuse the same station/routing editor built for Tier 5–6 topological changes. Not required for v1; architecture should not block it. *Built after Tier 10 as an ungraded free play mode for straight lines (§4.7); a graded capstone isn't planned.*

### 3.5 Factory Theming

**Decision (revised during implementation kickoff — see §12.5): theme is tied to tier content, with consistency preserved only where it's pedagogically load-bearing.**

- **Tiers 0–3 (the mandatory linear spine) share a single theme: toy/widget assembly line.** These four tiers are explicitly sequential — each depends on the mental model built in the one before — so the original rationale (build visual intuition once, reuse it across adjacent tiers) applies at full force here. Generic parts (gears, blocks, toy figures) read clearly across the full high-school-to-adult range and carry no food-safety or unfamiliar-process baggage.
- **Tiers 4–6 (independently-reachable branches) each get a distinct, context-matched theme.** Since a learner can reach these in any order and none builds on another, the cross-tier-consistency argument doesn't apply — and a theme matched to content makes the lesson more concrete (e.g., a product-mix decision is more intuitive framed as "which cookies do we bake more of" than as an abstract SKU list). Candidate mapping, to be finalized when each tier is actually built:
  - **Tier 6 (product mix & revenue) → bakery/candy factory.** Strongest fit: different products are literally different cookies/candies with obviously different margins and resource draw. Built as a bakery (cakes, cupcakes, cookies; §4.7).
  - **Tier 4 (batch size & flow) → candle workshop** (chosen 2026-09-28: the print shop went to Tier 5 and the bakery is Tier 6's). Switching scents means cleaning the melting pot, a legible stand-in for setup time.
  - **Tier 5 (elevation, constraint migration, policy) → print shop** (buying a new press is a literal "elevate the constraint"). Used by Tier 5's first level (§4.7).
- This is a larger art/content workload than a single global theme, but it's sequenced so the extra cost lands *after* the MVP (Tiers 0–3), not before it. See §12.3.

### 3.6 Adverse Events, Forecasting, and Everyday Problems (added 2026-09-28)

The owner asked for features showing how adverse events affect the plan (prolonged equipment downtime, late delivery of direct materials, priority and mix changes, poor yield), other common factory problems for later modules, and the effect of poor forecasting, with no limit on the number of levels. Each problem either has to be solved (a plan level) or at least has its impact demonstrated (a prediction level: watch a normal day, predict what the disruption does, then watch it happen).

**Engine features.** Each draws from its own seeded stream, so existing levels replay identically and a given day's disruptions strike at the same moments whatever the player's plan (as jams do, §4.7).
- *Long breakdowns:* a station stops once, at a set or random time, for a long stretch, on top of any short jams.
- *Late materials:* the first station needs direct materials from a stockroom. Deliveries are due at set times, and each can arrive late by a random amount; with the stockroom empty, the line waits.
- *Poor yield:* a station can make defects at some rate, and an inspecting station scraps the defective units it finds. A defect made early but found late has used every station in between, the constraint included.
- *Mix and priority changes:* the order pattern can switch at a set time, and a station's product priorities can change during the shift.
- *Rush orders:* extra orders arrive mid-shift and can jump the queue at chosen stations; their ship times are measured against a due time.
- *Storefront:* finished goods go on a shelf; customers arrive through the day, with demand that swings from day to day; each either buys or leaves (a lost sale); what's left at closing is waste for perishable goods. The line can bake to a planned quantity (the forecast) or replenish what customers take.

**Scoring.** New levels use a general goal of per-day bars (shipped, steady, average stock on hand, scrap, lead time, rush orders on time, sales, waste, lost sales, spending), judged on the level's own day plus fresh days (7 or 10 in all, §5.4). Each star needs one more bar met on every day. Levers include a general option lever whose choices change the factory (a repair order, a safety stock, where to inspect), each optionally with a price.

**Modules** (unlocked after Tier 3, each standing alone, §3.2):
- **Tier 7, When things break** (the robot factory from Tiers 0–3, with its rope tied to Paint): which machine the one repair crew fixes first after two long breakdowns (the one that starves the constraint; downstream stops are absorbed); a long breakdown at the constraint itself (prediction: every minute is lost for good); how much plastic to keep for a late truck (principle 36); where scrap costs the most (prediction: after the constraint, principle 37); where to catch defects (before the constraint); and a bad day with several problems at once, where only the fixes that protect the constraint pay.
- **Tier 8, Changing orders** (the robot factory with two robot models): a mix change that moves the constraint (principle 38); re-tying the rope when the mix changes; spreading a new mix through the day; priority changes at a constraint that has changeovers (principle 39); and a rush order that jumps the queue (prediction: the day ships exactly as many, principle 16).
- **Tier 9, Forecasts & demand** (the bakery's shop counter): baking to a forecast when demand swings (prediction: waste on slow days, lost sales on busy ones, principle 40); baking to the forecast, more, less, or replenishing what sold (principle 41); sizing the replenishment shelf; and forecasting total cupcakes but frosting flavors to order (principle 42).
- **Tier 10, Everyday problems:** an absent operator (cover the constraint first), overtime (it only pays at the constraint), rework loops that return work to the constraint, when to schedule maintenance, a plant-wide power cut, and scrap after changeovers.

As-built details, calibration, and deviations go in §4.7 as each module is built.

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

### 4.7 Implementation Notes (Week 1)

- **Compute, then play back.** Each run is computed in full (milliseconds at this scale) and the UI plays back its event log. Pause, speed, and "run to completion" are just a moving time cursor, which also makes the deferred scrubbable timeline (§12.6) cheap to add later.
- **One random stream per source.** Each station and the release process draw from their own seeded stream, and times come from inverse-CDF sampling. Changing one station leaves every other station's draws untouched, so same-seed comparisons (Tiers 0–2) isolate the effect of the player's change.
- **Same seed, same run, on every device.** Sampling uses only +, −, ×, ÷ and √, which are exact or correctly rounded in every browser, so a seed replays identically on an iPad or a Chromebook. Exponential and normal distributions (Tier 5+) need `log`/`exp`, which browsers may round differently in the last bit; handle that when they arrive.
- **Linear lines for now.** Units flow through stations in order, with optional parallel servers per station. Routing, batching, and setups arrive with the tiers that need them; downtime arrived with Tier 3.
- **Release policies:** saturate (raw material always on hand, the "keep everyone busy" default of Tiers 0–2), interval (work arrives on a schedule), and rope (release only when work ahead of the constraint drops below the buffer, for Tier 3).
- **Content is tested, not just authored.** Level tests check that each level produces its lesson across 31 seeds, e.g. in Tier 0 the answer is the slowest station and grows the biggest pile by the end of the shift.
- **Where piles form (Tier 1).** With raw material always on hand, a pile builds in front of *every* station slower than the first one, not only the constraint, which would contradict the "biggest pile" reading Tier 0 teaches. Levels therefore keep the first station slower than every non-constraint, and a test checks that for every possible plan, across 21 seeds, the biggest pile sits in front of the true constraint (or nowhere, when the first station is the constraint). Tier 3's rope removes the flooding itself.
- **Tier 1 plan levels.** Levers change one chosen station each (a tool that speeds it up; a floater who covers its breaks). Tests run every possible plan across 21 seeds: only the intended plan ever meets the target, the untouched factory never does, and every plan gets a written explanation. Planned breaks stop a station from starting new work (it finishes the part in hand).
- **Tier 2 "Steady" metric.** Steady = the share of the shift during which no station has `pileLimit` or more parts waiting (5 in v1, the same point where pile counts turn amber, so the color and the score agree). This resolves open item 2 for Tier 2; later tiers can tune `pileLimit` per level. A steady goal also sets a minimum shipped, so releasing almost nothing can't game it.
- **Tier 2 shipped as two levels.** *Same average, fewer robots* (principles 15 and 13) has the learner watch a perfect-day twin, predict the real day, then see it ship fewer (true on 100 of 100 test days). *Pace the orders* (principle 14) lets the learner choose a release schedule; releasing at exactly the constraint's average pace is deliberately a gamble (steady on about 6 days in 10), which the feedback says outright. A third level about one erratic upstream station was dropped: within one shift the untouched line passed on 60–80% of days, so it couldn't reliably teach anything. The idea fits Tier 3, where a buffer is the fix.
- **Seed policy in tests.** Tier 1 plans must behave identically on every tested day. Tier 2 grades on the level's own day (the spec's same-seed policy), and tests require the intended plan to succeed on at least 95 of 100 other days.
- **Jams (downtime, §4.3).** A station can jam: it runs for a time drawn from `every`, stops for a time drawn from `lasts` (finishing the part in hand first, like a break), and repeats. This is the MTBF/MTTR option with uniform distributions. Jam times come from each station's own seeded stream and don't depend on the flow, so on a given day a station jams at the same moments whatever the player's plan, and same-day comparisons stay fair. A per-part stoppage chance was tried first and dropped: the number of jams varied so much from day to day that even the right plan passed on only about half of days. The factory shows a jammed station at once, with a red light.
- **Tier 3 buffer metric.** *Healthy* = the share of the shift the pile in front of the constraint stays within a band, 2 to 15 robots in v1: below the band is running dry (red), above it is flooding (amber). The same colors appear on the waiting area, in the legend, and on the shift clock, which doubles as the buffer's history. This sets open item 2 for Tier 3. The score counts time only; §5.2's extra weighting by the depth of red excursions is left out for simplicity. Each shift starts with an empty floor, so every plan spends its first 15 minutes or so running dry, and the 90% bar allows for that. Auto-pause on red (§4.4) is not built; a shift log lists each jam and whether the buffer ran dry while it lasted, which serves the diagnostic purpose of principle 19.
- **Three stars (§5.3, §5.4).** One star: healthy at least 90% of the shift. Two: also no more than a per-level number of robots on the floor on average (the secondary metric, so §12.6 cut 4 wasn't needed). Three: both bars again on 3 fresh random days, drawn with `crypto.getRandomValues` and shown as a strip of day cards. The player sees all three bars and the day count before planning. Earning the first star completes the level.
- **Tier 3 shipped as three levels.** *Tie the rope* (principles 16, 18): tie a 5-robot rope to Cut, Paint, or Box. Tied to Cut it floods like no rope at all; tied to Box ("one out, one in") it counts robots already past Paint and starves it, worst while Box is at lunch; tied to Paint it ships as many as flooding the floor, with a fifth of the inventory. *Size the buffer* (17): Mold jams every 1.5 to 2.5 hours for 25 to 35 minutes; a rope of 5 or 8 runs dry, 12 earns three stars, 16 is healthy but over the inventory cap (one star), and 24 floods. *Read the buffer* (19): Cut (short jams), Mold, and Box (long jams) all jam, and maintenance can fix one. Only Mold's jams drain the buffer; Box builds big piles, but after Paint, and fixing it changes nothing that matters. Tests require, for each level, that exactly one plan earns two stars on the level's own day and keeps both bars on at least 99 of 100 other days (200 of 200 in calibration), that no other plan reaches two stars on more than 5 of 100 days, and that plans missing the first star miss it on at least 95 of 100 days.
- **Products and machines (groundwork for Tiers 5–6).** A line can make several products: new work follows a repeating order pattern (`mix`), and a station can have named machines, each able to run only certain products (the owner's request, §3.4), with times per product or per machine. A free machine takes the oldest waiting job it's allowed to run, so a restricted machine can skip ahead; listing a restricted machine first gives it first pick of its own products. Every existing level replays identically: a digest of every level's event logs, for every plan on four days, matched before and after the change.
- **Tier 5's first level, *House rules*** (principles 27, 26). Tier 5 follows §5.3–5.4: each plan runs on the level's own day plus 6 fresh random days (7 in all). One star: the output target every day. Two: also steady every day. Three: also at least 2 more shipped a shift for every $1,000 spent, which a free plan always clears. The level is a print shop: posters only fit on the big press, the small press prints flyers slowly, and a house rule keeps the big press on posters while flyers pile up. Lifting the rule earns three stars for free, and the shop then keeps up with every order, so the constraint moves to the market. Buying a second small press ($20,000) also hits the target but gains only about 1.4 per $1,000, so it earns two. Tests check that exactly one plan earns three stars, and that every plan scores the same in each of 30 stand-in weeks.
- **Budgets (§3.4).** A Tier 5 level can set a budget. The plan screen shows what the chosen machines cost against it, and a plan that goes over can't run. Floor space isn't built: no level has needed it yet.
- **Tier 5's second and third levels** reuse the print shop, now with one machine at every station and a second one for sale at each: a computer for Design ($6,000), a press ($20,000), a trimmer ($8,000), and a packing table ($4,000). Both judge plans as *House rules* does, with a target of shipped orders, and minGainPer1000 set to 1. *The next constraint* (principles 31, 3): an order comes in every 2.4 minutes (200 a shift). Print is the constraint, and Trim is nearly as slow. With $30,000, a second press alone ships 179–185 across 200 test days while the pile moves to Trim; only the press plus a trimmer ($28,000) reaches the 190 target (196–197, every order that comes in), and the constraint moves to the market. *Balance flow, not capacity* (33, 15): a consultant sold the spare machines at Design, Trim, and Pack, so every station works at the press's pace (3 minutes against an order every 3.1). Those three stations jam about every 50 minutes for about 10, and at that pace they never catch up, so the shop ships 124–136. With $20,000, buying back all three ($18,000) ships 143–151 and stays steady; a second press changes nothing, and any two of the three ship at most 142. The target is 140 on all 7 days. Tests run every plan within the budget, as for *House rules*.
- **Tier 5's inertia level, *Old habits*** (principles 32, 18), sits between those two, following §6: the briefing never says the old policy has expired. Last year Pack was the constraint, so the shop tied a 3-order rope to it (Tier 3's drum-buffer-rope). Then it bought a second packing table, and Print became the constraint, but the rope stayed on Pack. It still counts every order already past Print, so Print keeps running out of work: 128–132 shipped against a 150 target. The player can re-tie the rope to Design, Print, or Pack, and can buy a second press for $20,000. Re-tying it to Print is free and earns three stars (153–161, steady). Tied to Design, it floods Print (one star). The press, the reflex fix, ships only 129–133 while the rope stays on Pack, and floods Trim when the rope moves to Print (one star). Trim isn't offered as a rope spot, as in Tier 3's *Tie the rope*: with a press bought, a rope on Trim would be a second correct answer. Levels can now name their unit of work ("orders") for the rope's label.
- **Adverse events in the engine (§3.6).** A station can have long breakdowns, and an *incident* stops several stations at the same random moment (a power surge). The first station can draw direct materials from a stockroom, with deliveries due at set times, each late by a random amount (zero allowed). A station can make defects at some rate, and an inspecting station scraps defective units once it has worked on them, so a unit found late has used every station on the way; a rope keeps pulling when work is scrapped before the constraint. The order pattern can switch mid-shift, a station's priorities can change during the shift, and rush orders can jump the queue where a station expedites. Every feature has its own seeded stream: every existing level and plan replayed identically (524 event-log digests matched). The screen shows "Broken down", a stockroom count that turns red when it runs out ("No plastic"), scrap counts under inspecting stations, gold-outlined rush orders, and a shift log of breakdowns, deliveries (and late trucks), rush orders, order changes, and scrap.
- **Bars goals and option levers.** New levels score per-day bars in order (§3.6); a level may have one to three. An option lever's choices change the factory directly (a repair order, a starting stock, where to inspect), each with an optional price that a spending bar can limit. Prediction levels can compare a normal day with the same line after a change, not only a perfect-day twin.
- **Tier 7 shipped as six levels** in the robot factory, now running drum-buffer-rope (a rope of 8 tied to Paint). Its times vary by ±15% rather than Tier 3's wider spread, so day-to-day swings don't blur the lessons. *When the constraint breaks* (prediction, principles 4, 17): a 90-minute breakdown at Paint costs about 21 robots, between 16 and 26 on each of 100 test days, and the buffer can't help. *One crew, two breakdowns* (19, 17): a surge knocks out Mold and Assemble together at a random time in the second or third hour; the one crew takes 30 minutes per machine. Fixing Mold first ships 112–118 (target 111, all 7 days); splitting the crew ships at most 111, and Assemble first about 100. *The late truck* (36, 17): 30 bags of plastic, two hours' worth, arrive at 2:00, 4:00, and 6:00, each 20 to 110 minutes late. Starting with 60 bags earns both stars (112 shipped every day, 36 bags or fewer on the shelf on average); 80 ships as many but holds 40 or more (one star); 30 and 40 run Paint dry. *Where scrap hurts* (prediction, 37): 1 in 10 parts scrapped at Cut costs nothing, while the same share scrapped at Box, after Paint, costs about 12 robots (at least 5 on 95 of 100 test days). *Catch it before Paint* (37): 12% of Mold's parts crack, and Box finds them; checking at Mold for $1,500 ships 113 or more every day (both stars under a $2,000 limit); checking at Assemble changes nothing, halving the cracks for $8,000 still falls short, and doing both ships enough but overspends. *A bad day* (4, 5), added after Tier 10, puts the problems together: a bad batch cracks 1 in 5 of Mold's parts (found at Box), Mold breaks down for two hours some time in the morning, and the truck runs late with 30 bags on hand. The untouched day ships about 65. Four fixes are on offer within a $3,100 budget: 60 more bags ($600), checking at Mold ($1,500), a repair crew on standby that cuts the breakdown to 20 minutes ($1,000), and a faster Box ($2,500). Only the three that protect Paint's time together clear 107 shipped every day (109 to 119 in 200 test days, and never below 107 in 5,000, while no plan missing one of them reached 107 on more than 8 of those 5,000 days); adding the Box upgrade ships the same and overspends. The extra plastic has to cover the cracked parts too, which is why it's 60 more bags rather than *The late truck*'s 30.
- **Tier 8 shipped as five levels** in the same factory with two robot models, a Deluxe robot taking Assemble about 6 minutes against a Classic's 2.6. *The mix shifts* (spot the constraint, principle 38): Deluxe orders start at 2:00, and by 5:00, when the answer unlocks, 11 to 14 robots wait at Assemble against 5 or 6 at Paint; the biggest pile ends at Assemble on every test day. The screen now shows product colors and the shift log here too. *A new mix, a new rope* (38, 18): with every other robot a Deluxe, Assemble averages 4.3 minutes and becomes the constraint; the rope left on Paint gives 49 to 64 minutes from release to shipping, and re-tied to Assemble 36 to 38, at the same output (one bar at 45 minutes, a second at 104 shipped). A rope on Box works as well as Assemble, so it isn't offered. *Spread out the Deluxe orders* (38): a customer wants 40 Deluxe robots today. Made last they can't all finish (22 to 26 ship); made first, all 40 ship but lead times reach 66 to 80 minutes; every other robot Deluxe makes Assemble the constraint all day (105 to 111 shipped); spreading them 3 in every 8 earns all three stars (40 Deluxe, 112 shipped, 50 minutes or less). A per-product shipped bar was added for it. *The hot list* (prediction, 39): orange and blue robots, and Paint cleans its gun (about 8 minutes) to switch colors, so it keeps painting one color while any is waiting (a new keep-the-same-product dispatch rule). When the sales office flips the hot color every half hour, Paint's changeovers roughly double and the day ships about 20 fewer (at least 10 fewer on each of 100 test days). A rush-order level was prototyped and left out: with a short rope, rush orders were on time without any expediting, while longer ropes batch colors better but make them late, and in a flooded factory expediting through Paint gets them out at the cost of about 8 robots. That trade-off had no single right answer to teach. A prediction took its place, added after Tier 10: *The rush order* (16). At 2:00, 12 rush robots start on top of the rope and jump the queue at every station. They're all out by about 3:00, yet the day ships exactly as many as a normal day, on each of 100 test days, because Paint was already busy every minute. The 12 took the places of 12 regular robots.
- **The shop counter in the engine (§3.6).** A line can end at a shop counter: finished units go on a shelf, and customers come in while the shop is open, each wanting one unit (of one product, when the line makes several; nobody takes another product instead). A customer who finds none leaves without buying, a lost sale. How many customers come, when each comes in, and what each wants are drawn per day from their own seeded streams, so every plan faces the same customers on a given day. The goods are fresh: anything made or being made and not sold by the end of the shift is thrown out. Two release policies go with it: *plan* makes a set number, the forecast, as fast as the first station takes them, and *replenish* starts a target number of each product, then one more for each one sold. All earlier levels replay identically (652 event-log digests matched). The screen shows the shop's sign (opening time, open, closed), the shelf (by product when there are several), what sold and who was turned away, and a shift log of running out and of what was thrown out at closing. Bars can limit customers turned away and units thrown out. A prediction can cover several days: the player watches one day, predicts the next ten, and sees them as a chart of customers each day against the number made, split into what sold, what was thrown out, and who was turned away; any of the ten days can then be watched. Day cards now wrap long readings inside the card (Tier 8's "43 deluxe robots" had spilled into the next card).
- **Tier 9 shipped as four levels** in the bakery's cupcake shop: Mix, Bake (about a cupcake a minute), and Frost, with the shop open from 2:00 to 8:00 and anywhere from 70 to 170 customers a day, 120 on average. *The forecast* (prediction, principle 40): the bakery bakes 120 every day. On the watched day exactly 120 customers come in; over the next ten, 1,186 come in, about what the forecast said, but the shop sells only 1,070, throwing out 130 on six slow days and turning 116 customers away on four busy ones. In each of 100 ten-day test windows, at least one day throws cupcakes out and another turns customers away. *Bake what sells* (41, 40): bake 120, 170, or 80 a day, or keep 10 on the shelf and bake one more for each one sold. The bars, every day for ten days, are to turn no customer away, then to throw out 15 or fewer. Baking 170 earns one star (it throws out up to 100 on a slow day), 120 and 80 none, and replenishing both: it never ran out in 400 test days, and throws out only the 10 left at closing. *The lunch rush* (41, 17): 4 of every 10 customers come in between 5:00 and 6:00, faster than the oven can bake on a busy day. A shelf of 10 runs dry in the rush on about half of all days; a shelf of 40 never did in 3,000 test days. A shelf of 100, or baking 170 in the morning, never runs out but throws out more than the second bar's 45. *Frost to order* (42): three flavors, where the number of customers barely changes (110 to 130 a day) but each flavor's share swings from day to day. Frosting 40 of each flavor in the morning, 50 of each, or last week's mix (60, 40, and 20), or keeping 10 of each flavor on the shelf, throws out more than 10 on most days. Baking 120 plain and frosting each one at the counter (the line's last station becomes a cooling rack) keeps both waste and lost sales at 10 or fewer every day, because only the total has to be forecast. Flavors are drawn in their own colors: cream, chocolate brown, and strawberry pink.
- **Everyday problems in the engine (§3.6).** A planned stop can give a reason, such as "No operator" or "Maintenance": the station shows it instead of "On break", the shift log lists it, and only ordinary breaks go on the shift clock. An incident can have a name, such as "Power cut": its stations show the name, and the shift log reports it once. An inspecting station can send defective units back to an earlier station to be made again (rework) instead of scrapping them. They pass every station from there again, the constraint included, and a rope counts them again when they go back to or before the constraint. A station can also spoil the first unit it makes after each changeover, scrapped on the spot. All earlier levels replay identically (724 event-log digests matched).
- **Tier 10 shipped as six levels,** five in the robot factory, now with a 12-robot rope so that 8 to 10 robots usually wait at Paint, and one in the candle workshop. *The power cut* (prediction, principle 4): every station stops for 30 minutes at 2:30, and the day ships 6 to 8 fewer on each of 100 test days, Paint's 30 minutes rather than 35 robots. *Short-handed* (4, 17): Paint's operator is away from 1:00 to 3:00. Borrowing Box's operator keeps output at 113 to 120, since Box's pile clears by evening; leaving Paint idle costs about 30 robots, and borrowing Cut's or Mold's operator lets Paint run dry within the hour (93 to 98 shipped). *Overtime* (4, 5): with a 45-minute lunch, paying Paint's operator $150 to work through it lifts output from 103–109 to 113–118. Paying Cut's or Box's operator changes nothing, and paying everyone ($750) ships about what Paint alone does. *Service day* (4): Paint's 45-minute service costs about 10 robots at any time except lunch, when it costs none. *Sent back* (37): 15% of robots leave Mold with rough edges. Caught at Box and sent back through Paint, or scrapped there, the day ships 87 to 108; checked at Mold and made again before Paint, 113 to 120. *The first candle* (37, 22): Pour spoils the first candle after each scent change, after Melt, the constraint, has already melted it. Flushing Pour's nozzle (3 more minutes at a station with time to spare) with lots of 10 earns all three stars: at least 112 shipped, nothing scrapped, and orders out in 36 minutes or less. Lots of 20 halve the scrap but make orders wait 44 to 46 minutes, and lots of 5 bury Melt in cleaning.
- **Time controls and explanations (§4.4, §4.5, §6), built after Tier 10.** The deferred items from §12.6 are in. The shift clock is a timeline: tap or drag along it, or use the arrow keys (5 minutes; Page Up and Page Down for an hour; Home and End), to rewind or jump to any minute, paused there. On lines where something can go wrong (a buffer goal, breakdowns, materials, or a shop counter), "Pause at problems" stops playback at each problem and says what happened: a breakdown or power cut, the stockroom running out, a late truck, the first customer turned away in a stretch, or the constraint's buffer running dry after it had filled. From Tier 2, a closed "Show simulation log" lists the latest 60 events in plain words ("Paint finished robot #48: shipped"), newest first. Once a player finishes Tier 3, the level list offers brief explanations: each result's explanation folds behind a "Why?" button, while a wrong answer's hint in a find-the-constraint level stays in full. Both settings are saved per player on the device.
- **Moving parts (§4.4).** The floor draws every part in one layer, each keyed to its job, so a part keeps its own shape from pile to station to the next pile. While the shift plays, parts slide forward in a pile as the front one leaves, drop into their station (fading out while at work), and come out at the next pile (fading in); a unit sent back for rework flies back up the line. A jump in time (a restart, a seek, the end of the shift) snaps parts into place instead, and the motion is off on devices set to reduce motion. Pile counts stay exact throughout: the motion only eases each part to where the event log says it is.
- **Progress map (§3.2).** The home screen opens with the skill tree at a glance: Tiers 0–3 in order, then the seven tiers Tier 3 opens, each showing locked, not started, in progress, or done, with levels finished and stars earned. Tapping a tier jumps to its levels. The tree comes from the levels' prerequisites, not a hand-drawn layout. Building it turned up an older phone bug: a level showing three stars and "Play" was wider than a 390-pixel screen, so stars now sit above the label on phones.
- **Many days at a glance (§5.4).** When a plan is judged on 7 or more days (Tiers 5–10), the results show each measure as a row of dots along a line, one per day, green where it met the goal and red where it missed, with the goal dashed across. The line reaches at least a tenth either side of the goal, so a near miss looks near. The day cards fold away under "Each day". Plans judged on fewer days (Tiers 3 and 4) keep their cards.
- **Free play (§3.4), built after Tier 10.** An ungraded sandbox, always open from the home screen, with no stars and no pop-ups. The player builds a line of 2 to 6 stations named after the robot factory's (Cut, Mold, Paint, Assemble, Box, Pack) and sets each one's minutes a robot (1 to 12, in half minutes), machines (1 to 3), variation (none; some, ±15%; or lots, from a quarter to 1.75 times the average, like Tier 2's die), and jams (running 40 to 80 minutes between jams of 5 to 15). Work starts one of three ways: keep everyone busy, a rope of 1 to 40 robots tied to any station, or a fixed pace. Each station shows what it could make in a shift on paper, with jams at their average; tapping a station on the floor opens its settings. A day number picks the seed, so two lines run on the same day compare fairly (§4.2). A table lists every run with what changed from the run before, its output, and its average work in process and lead time; after each shift, a second table shows each station's output on paper and in fact, its busy share, and its average pile. The first line (Paint the slowest; Cut slower than Mold, per the note on piles above) teaches as the levels do, and tests check it on 20 days: kept busy, work piles up in front of Paint alone; a rope of 10 on Paint ships just as many with about half as much on the floor; jams at Cut cost nothing, and jams at Paint cost about 12 robots. Each player's line stays on the device.
- **Changeovers, lots, and carts (groundwork for Tier 4).** A station can have a changeover: a machine switching products first spends that time, drawn from its own seeded stream so cycle-time draws stay aligned across plans. Orders can arrive in lots: an interval release brings `lot` units at once. A station can move finished work in carts: units wait until the cart is full, or until the last unit of a multi-unit lot is done, and then move on together. Existing levels replay identically (event-log digests matched before and after).
- **Tier 4 shipped as three levels** in a candle workshop: Orange blossom and Ocean breeze candles through Melt, Pour, Label, and Pack, with Melt the constraint and an 8-minute changeover to switch scents. Scoring follows §5.3–5.4 with two changes. The second bar is average lead time (order in to shipped), not pile-based stability, because principle 23 is about lead time and inventory, and lots arriving at once would trip a pile bar on every plan. The third star is the fresh-day check (5 days); changeover minutes appear in the results as the operating-expense-style number instead of a separate bar. Stars: one for 112 shipped, two for also averaging 36 minutes or less from order to shipping, three for both again on 5 fresh days. *Fewer changeovers* (principles 22, 23): lots of 1, 2, 5, 10, or 20. Lots of 10 earn three stars; 20 ships enough but takes about 44 minutes a candle (one star); smaller lots fall behind. *Quick changeovers* (22, 5): a crew cuts one station's changeovers to a quarter, and only Melt matters. *Move in small loads* (20, 23, 21): carts of 10, 5, or 1 between stations; only one at a time is both productive and fast (whole-lot carts: 100 shipped, about 89 minutes a candle). Tests hold each level to exactly one plan earning two stars on its own day and keeping both bars on at least 99 of 100 other days, while no other plan does on more than 5.
- **Priority dispatch (groundwork for Tier 6).** A station can rank products: a free machine takes the oldest waiting job of the highest-ranked product it can run, and falls back to the oldest job of any other. The line also counts what it shipped of each product. Existing levels replay identically (event-log digests matched before and after).
- **Tier 6 scoring: throughput accounting (§5.2–5.5).** Each order's ingredients are paid for when it comes in; its throughput (price minus ingredients) is earned when it ships. Profit is throughput minus the shift's operating expense, a fixed amount whatever gets made. Inventory is the average value of the work on the floor, at ingredient cost. Every plan runs on the level's own day plus 9 fresh days (10 in all, §5.4). One star: the profit target every day. Two: also a minimum shipped every day (output, the secondary metric). Three: also average inventory under a cap every day. Two deviations: the tertiary metric is an inventory cap, not a carrying cost subtracted from profit, so profit stays the plain T − OE the levels teach; and the ten days show as compact day cards, as Tier 5's seven do, instead of §5.4's distribution view. The level's dashboard uses the formal names (§5.5): Profit, Throughput, Operating expense (spent evenly across the shift, so profit starts at $0 and dips before the first sales), Inventory (what's on the floor right now), and Shipped.
- **Tier 6 shipped as three levels** in a bakery: Mix, Bake (the oven, the constraint), Decorate, and Box, with more orders than the oven can bake. A cake sells for $30 with $10 of ingredients and takes the oven 20 minutes ($1 of throughput per oven minute); a cupcake is $4 and $1 in 2 minutes ($1.50); a cookie is $2 and 50¢ in half a minute ($3). Operating expense is $400 a shift. *Bake what pays* (principle 28): cakes and cupcakes, and the oven bakes oldest first, cakes first, or cupcakes first. Cupcakes first makes $244–285 across 300 test days against a $220 target; oldest first makes $133–174, and cakes first, the biggest margin per item, only $40–80. *Rank the menu* (28): cookies join, and four orderings compete; only cookies, then cupcakes, then cakes reaches the $280 target ($301–357, others at most $253). *The cost report* (29, 26): a cost report spread $1.80 of wages and overhead onto each cookie, so the bakery stopped selling them; the player chooses what to sell. Only all three products reaches $280. Dropping cakes instead lets every order through with the oven idle part of the day, so the market becomes the constraint, at $197–199. The menu lever sets both the order pattern and how often orders come, so dropping a product removes its orders without changing anyone else's. Tests check that exactly one plan per level earns three stars, and that every plan scores the same in each of 30 stand-in weeks of 10 days.

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

*As built:* the first level of Tier 4 and of Tier 5 names the term in its briefing ("its throughput, as TOC calls what a business ships and sells"), since either tier can come first; the screens keep saying "Shipped" until Tier 6's dollars.

---

## 6. Pop-Up / Explanation System

- Pop-ups explain *why* a decision helped or hurt, grounded explicitly in TOC methodology, tied to specific triggering in-sim events (not generic congratulations).
- Density should be **high early, sparse later** — an option to reduce/disable pop-ups once retention is demonstrated (e.g., a short in-level check question) avoids the system becoming patronizing by Tier 3+.
- **Inertia (principle 32) should be taught experientially, not just explained:** don't flag in advance that an old policy has expired. Let a rule that helped in an earlier tier start quietly hurting in Tier 5, and surface the explanatory pop-up only after the player notices/questions it or after a set number of turns of degraded performance — the lesson is more durable if the player feels the failure before being told why.

---

## 7. Visual Style

- **Cartoon aesthetic**, implemented as stylized geometric/flat-color shapes with bold outlines (SVG/CSS-based — a Duolingo/Kahoot-like feel), not commissioned illustrated sprites. Chosen to avoid blocking engineering on an art pipeline, while still reading as bright, appealing, and age-appropriate for the target audience.
- **Color is functional, not just decorative:** red = bottleneck/constraint, amber = building queue, green = flowing/healthy. Bright, appealing colors should be reconciled with this functional coding rather than working against it.
- In Tier 0, where finding the constraint *is* the task, the red outline appears only after a correct answer, so color never gives the answer away.
- Persistent buffer-penetration meter (green/yellow/red bands) is a core, always-visible UI element from Tier 3 onward.

---

## 8. Platform & Persistence

### 8.1 Target Platforms

Single HTML5 codebase running in-browser across tablet (primary target), laptop, phone, Android, and iOS. No native app packaging required for v1.

*As built:* the build targets the browsers Vite 8 calls widely available: Safari and iPadOS 16.4, Chrome and Edge 111, Firefox 114, or newer. iPads from 2017 on can run iPadOS 16.4; check classroom devices are updated. An older browser shows a note saying so instead of a blank page.

### 8.2 Single Learner + Classroom Support

- **v1 ships single-learner, local persistence** (localStorage/IndexedDB) — progress, stars, and scores stored per-device.
- **Data model must be shaped for classroom use from day one**, even though the instructor-facing features are v1.5+: every score/progress event should be tagged with a learner ID and timestamp, even in single-learner mode, so the same event stream can later feed a server-side/instructor view without a data-model rewrite.
- **v1.5 (architecture-ready, not built):** server-side persistence, learner accounts, cohort/class grouping, instructor view (roster, per-learner scores, assignable level subsets).
- Persistence should be written against an interface (e.g., `saveProgress(learnerId, event)`) so swapping localStorage for a backend API later doesn't touch game logic.

### 8.3 Real-Classroom Use (v1)

- v1 has no accounts (§8.2), so learner identification for a real class is handled without any server dependency: **each learner enters a nickname once per device**, stored only in that device's localStorage and never transmitted — this satisfies the `learnerId` tagging §8.2 already requires, without collecting anything sensitive.
- Because storage is local-only and per-device, a classroom set of shared/rotating tablets should assign one learner per device per session (or accept that switching users on one device means re-entering a nickname and starting fresh progress on that device) until v1.5's server-side accounts exist.
- No name validation, account creation, or password is introduced — keeps friction at zero for a first-time class rollout.
- *As built (week 1):* the home screen asks "What should we call you?" until a nickname is saved, and the first nickname goes to the learner already on the device, keeping any progress made so far. "Switch player" serves shared tablets: a nickname already played on the device picks up that player's progress (matched ignoring case and extra spaces), and a new one starts fresh. Nicknames are capped at 24 characters and live only in the device's localStorage.

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

- Full from-scratch factory construction (may exist later as capstone tier or sandbox mode; not required for v1). *Free play ships for straight lines of up to six stations (§4.7); several products, routing, and a graded capstone stay out.*
- Server-side accounts, cohort management, instructor dashboard (architecture must support; not built)
- TOC Thinking Processes tools (evaporating cloud, current reality tree, etc.)
- Commissioned/illustrated art assets (using stylized SVG/CSS cartoon style instead)
- Native mobile app packaging (browser-based only)

---

## 11. Open Items Not Yet Decided

The following were raised during scoping but do not yet have a final decision and should be resolved before or during implementation:

1. ~~Exact factory theme~~ — **Resolved, see §3.5 and §12.5**: toy/widget assembly line for Tiers 0–3; distinct, context-matched themes for Tiers 4–6 (Tier 6 → bakery is settled as the strongest fit; the Tier 4/5 mapping is still TBD, but deferred past the MVP milestone regardless).
2. Exact tolerance-band widths for the stability metric per level (difficulty dial). *Set for Tiers 2 and 3 in §4.7.*
3. Exact numeric targets/thresholds for output and revenue win conditions per level. *Set for every level built so far (§4.7 and the level files).*
4. Whether the capstone/sandbox mode ships in v1 or is deferred entirely to v1.5. *Decided: an ungraded free play mode ships in v1 (§4.7).*
5. Specific downtime/failure parameters (MTBF/MTTR ranges) per tier. *Set for Tier 3 (jams) and Tiers 7 and 10 (long breakdowns, a power cut) in §4.7.*
6. Prices, budgets, and floor-space limits for Tier 5–6 equipment (§3.4). *Prices and budgets are set for Tier 5 (§4.7); floor space isn't built, and Tier 6's levels buy no equipment.*

Items 2, 3, 5, and 6 are intentionally left for empirical tuning once the DES engine exists to tune against, rather than upfront guesses — they're playtesting outputs, not scoping inputs. Item 4 was deferred past the MVP milestone (§12.3); free play came after Tier 10.

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
- **Hosting: GitHub Pages** on the owner's personal GitHub account, published by GitHub Actions from the default branch after lint, tests, and a type-checked build pass. Free Pages requires the repository to stay public. *Decided 2026-09-28:* no offline/PWA mode; the owner says the classroom's wifi is reliable. Once the page has loaded, the game needs no connection anyway, since every run is computed in the browser and progress is stored on the device (§8).

### 12.3 First Milestone (MVP Scope)

- **Tiers 0–3, fully playable end-to-end**, before any work begins on Tiers 4–6. This is the mandatory linear spine (§3.2) and the natural first slice: it proves the full pipeline (DES engine, seeded replay, stability scoring, buffer-penetration meter, pop-up triggers, skill-tree UI shell) on the content everything else depends on.
- Tiers 4–6 (including their distinct themes, §3.5) are explicitly out of scope until Tiers 0–3 are done and the class date is met. *Update, 2026-09-28:* Tiers 0–3 were playable at the end of week 1, and the owner asked to keep building, so Tiers 4–6 came early (§4.7), followed by Tiers 7–10 at the owner's request (§3.6). The class build stays the priority.

### 12.4 Student Identification

- Self-entered nickname, local-only — see §8.3.

### 12.5 Theme Strategy

- See revised §3.5. Summary: one theme (toy/widget assembly line) for the Tiers 0–3 MVP; distinct, context-matched themes for Tiers 4–6, built after the MVP ships.

### 12.6 Risks & Scope-Cutting Candidates (given a hard "weeks" deadline)

Cut candidates, in order (cut from the top first), before cutting any of Tiers 0–3's core lessons. With three weeks of outside-work-hours time (§12.1), **cuts 1 and 2 apply by default**; 3 and 4 are held in reserve.

1. Defer the **scrubbable timeline/rewind** (§4.4) to a post-deadline polish pass; ship with play/pause/speed-multiplier only. It's a diagnostic convenience, not load-bearing for the lesson itself. *Built early after all (§4.7), with pause-on-problems.*
2. Defer the **"Show simulation log" toggle** (§4.5) — same reasoning, an advanced-user convenience. *Built early too (§4.7).*
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
