// Framework-free rules for Cathedral Builder. No DOM, no randomness.
// A piece is accepted when everything it rests on is already in place.
const byId = (list) => Object.fromEntries(list.map((p) => [p.id, p]))

function canPlace(phase, placed, pieceId, slotId) {
  const pieces = byId(phase.pieces)
  if (!pieces[pieceId]) return { ok: false, reason: 'decoy' }
  if (pieceId !== slotId) return { ok: false, reason: 'wrong-slot' }
  const missing = pieces[pieceId].needs.filter((n) => !placed.includes(n))
  if (missing.length) return { ok: false, reason: 'unsupported', missing }
  return { ok: true }
}

// The first piece, in the authored order, that is not placed and has its supports.
function nextPiece(phase, placed) {
  return phase.pieces.find((p) => !placed.includes(p.id) && p.needs.every((n) => placed.includes(n))) || null
}

// Pieces that rest on this one.
function supportsOf(phase, id) {
  return phase.pieces.filter((p) => p.needs.includes(id))
}

function isComplete(phase, placed) {
  return phase.pieces.every((p) => placed.includes(p.id))
}

// `prior` lists pieces of earlier phases, which are always in place.
// Drop unknown ids and any piece whose supports are missing (a stale or hand-edited save).
function cleanPlaced(phase, saved, prior = []) {
  const ids = new Set(Array.isArray(saved) ? saved : [])
  const out = []
  for (const p of phase.pieces) if (ids.has(p.id) && p.needs.every((n) => out.includes(n) || prior.includes(n))) out.push(p.id)
  return out
}

// "No hints" when nothing was requested or accepted; declined offers never count.
function hintSummary(h) {
  const parts = []
  if (h.requested) parts.push(`${h.requested} requested`)
  if (h.accepted) parts.push(`${h.accepted} offered and accepted`)
  return parts.length ? `Hints: ${parts.join(', ')}` : null
}

globalThis.CBRules = { canPlace, nextPiece, supportsOf, isComplete, cleanPlaced, hintSummary }
