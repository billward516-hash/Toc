# Promotional GIF

`toc-factory.gif` is a 12-second loop made from the real game. It plays level 1.1 twice: with the new tool on the wrong station (a pile grows and nothing more ships), then on the right one (+30 robots a day). The numbers are the game's own results. No web address is baked into the picture, so it stays correct if the address changes.

- 960 × 540, 0.85 MB, loops forever.
- The first frame is a title card with the whole message, so it still reads where a platform shows only the first frame (Outlook on Windows does).
- Alt text: "Animation of the TOC Factory game. Speeding up the wrong machine leaves the factory at 117 robots a day while parts pile up. Giving the same upgrade to the bottleneck lifts it to 147."

## Rebuilding it

Rebuild it when the game's look, level 1.1, or the name "TOC Factory" changes.

1. `npm run build`, then `npx vite preview --port 4173` in another terminal.
2. `npm install --no-save gifenc pngjs` (kept out of `package.json` on purpose).
3. `node docs/promo/make/capture.mjs` plays the level in a browser and saves real frames to a temporary folder.
4. `node docs/promo/make/compose.mjs` lays them out and writes `toc-factory.gif` next to this file.

It needs Playwright with Chromium (set `PLAYWRIGHT_DIR` if it isn't in `/opt/node22/lib/node_modules`). The wording lives in `make/compose.mjs` and `make/template.html`. The same inputs give the same file, byte for byte.
