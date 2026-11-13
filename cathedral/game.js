// Cathedral Builder prototype: UI and feedback. Rules live in rules.js, content in data/.
;(function () {
  const R = globalThis.CBRules
  const CATHEDRALS = globalThis.CATHEDRALS
  const params = new URLSearchParams(location.search)
  const KEY = 'cb.progress.v1'
  const NS = 'http://www.w3.org/2000/svg'
  const $ = (id) => document.getElementById(id)

  // ---------- saved progress (browser storage may be missing or blocked) ----------
  let store = { muted: false, c: {} }
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null')
    if (raw && typeof raw === 'object') store = { muted: !!raw.muted, c: raw.c && typeof raw.c === 'object' ? raw.c : {} }
  } catch { /* previews and private windows: play without saving */ }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(store)) } catch { /* ignore */ }
  }
  const emptyHints = () => ({ requested: 0, offered: 0, accepted: 0, declined: 0 })
  const priorIds = (cath, idx) => cath.phases.slice(0, idx).flatMap((p) => p.pieces.map((q) => q.id))
  function record(cath, idx) {
    const phase = cath.phases[idx]
    const c = (store.c[cath.id] = store.c[cath.id] || {})
    const r = (c[phase.id] = c[phase.id] || {})
    r.placed = R.cleanPlaced(phase, r.placed, priorIds(cath, idx))
    r.hints = Object.assign(emptyHints(), r.hints)
    r.done = R.isComplete(phase, r.placed)
    return r
  }

  // ---------- sound and touch ----------
  let ac = null
  function audio() {
    if (store.muted) return null
    try {
      ac = ac || new (globalThis.AudioContext || globalThis.webkitAudioContext)()
      if (ac.state === 'suspended') ac.resume()
      return ac
    } catch { return null }
  }
  function tone(freq, dur, o = {}) {
    const a = audio()
    if (!a) return
    const t = a.currentTime + (o.when || 0)
    const osc = a.createOscillator()
    const g = a.createGain()
    osc.type = o.type || 'sine'
    osc.frequency.setValueAtTime(freq, t)
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(o.gain || 0.12, t + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(g).connect(a.destination)
    osc.start(t)
    osc.stop(t + dur + 0.05)
  }
  const buzz = (p) => { try { if (navigator.vibrate) navigator.vibrate(p) } catch { /* not supported */ } }
  const sfx = {
    snap() { tone(150, 0.16, { to: 55, gain: 0.22 }); tone(620, 0.05, { type: 'triangle', gain: 0.05 }); buzz(14) },
    bounce() { tone(330, 0.12, { type: 'triangle', gain: 0.07 }); tone(262, 0.18, { type: 'triangle', gain: 0.06, when: 0.09 }); buzz(8) },
    decoy() { tone(240, 0.3, { to: 420, gain: 0.07 }); tone(420, 0.25, { to: 300, gain: 0.05, when: 0.22 }); buzz([10, 40, 10]) },
    hint() { tone(880, 0.35, { gain: 0.06 }); tone(1320, 0.45, { gain: 0.04, when: 0.08 }) },
    flourish() {
      ;[262, 330, 392, 523, 659, 784].forEach((f, i) => tone(f, 1.6, { gain: 0.07, when: i * 0.16 }))
      buzz([30, 60, 30, 60, 90])
    },
  }
  function syncMute() { $('mute').innerHTML = store.muted ? '&#128263;' : '&#128266;' }

  // ---------- drawing ----------
  const GLASS = '#6f8fb0'
  const pieceMarkup = (p, cls = '', tex = 'stoneTex') => {
    const glass = p.tone === GLASS
    const sil = cls.includes('sil')
    const rule = `fill-rule="evenodd" d="${p.d}"`
    return `<g class="piece ${cls} ${glass ? 'glass' : 'warm'}" style="--tone:${p.tone}">` +
      `<path class="body" ${rule}${glass || sil ? '' : ` filter="url(#${tex})"`}/>` +
      (glass || sil ? '' : `<path class="courses" ${rule} fill="url(#ashlar)"/><path class="shade" ${rule} fill="url(#shade)"/>`) +
      (sil ? '' : `<path class="edge" ${rule}/>`) +
      `<g class="marks">${p.marks || ''}</g></g>`
  }
  function thumb(p) {
    const [x, y, w, h] = p.box
    return `<svg viewBox="${x - 6} ${y - 6} ${w + 12} ${h + 12}" preserveAspectRatio="xMidYMid meet">${pieceMarkup(p, '', 'stoneTexTray')}</svg>`
  }
  function el(name, attrs = {}) {
    const e = document.createElementNS(NS, name)
    for (const k in attrs) e.setAttribute(k, attrs[k])
    return e
  }
  const center = (b) => [b[0] + b[2] / 2, b[1] + b[3] / 2]

  // Shared drawing resources: stone grain and relief, mortar courses, light and shade, glass, sky.
  document.body.insertAdjacentHTML('afterbegin', `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
    <filter id="stoneTex" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="4" seed="11" result="noise"/>
      <feDiffuseLighting in="noise" lighting-color="#fff" surfaceScale="2.4" diffuseConstant="1.15" result="light"><feDistantLight azimuth="235" elevation="58"/></feDiffuseLighting>
      <feComponentTransfer in="light" result="light2"><feFuncR type="linear" slope="1.35"/><feFuncG type="linear" slope="1.35"/><feFuncB type="linear" slope="1.35"/></feComponentTransfer>
      <feBlend in="SourceGraphic" in2="light2" mode="multiply" result="mix"/>
      <feComposite in="mix" in2="SourceGraphic" operator="in"/>
    </filter>
    <filter id="stoneTexTray" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="3" seed="11" result="noise"/>
      <feDiffuseLighting in="noise" lighting-color="#fff" surfaceScale="1.2" diffuseConstant="1.15" result="light"><feDistantLight azimuth="235" elevation="62"/></feDiffuseLighting>
      <feComponentTransfer in="light" result="light2"><feFuncR type="linear" slope="1.3"/><feFuncG type="linear" slope="1.3"/><feFuncB type="linear" slope="1.3"/></feComponentTransfer>
      <feBlend in="SourceGraphic" in2="light2" mode="multiply" result="mix"/>
      <feComposite in="mix" in2="SourceGraphic" operator="in"/>
    </filter>
    <filter id="grassTex" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.9 0.25" numOctaves="3" seed="5" result="n"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.1  0 0 0 0 0.16  0 0 0 0 0.08  0 0 0 0.9 -0.15" result="blades"/>
      <feComposite in="blades" in2="SourceGraphic" operator="in" result="b2"/>
      <feBlend in="b2" in2="SourceGraphic" mode="screen"/>
    </filter>
    <filter id="soft" x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation="7"/></filter>
    <filter id="castShadow" x="-10%" y="-10%" width="125%" height="125%"><feDropShadow dx="2.5" dy="3" stdDeviation="2.4" flood-color="#000" flood-opacity=".55"/></filter>
    <pattern id="ashlar" width="34" height="18" patternUnits="userSpaceOnUse">
      <path d="M0 .4H34M0 9.4H34M.4 0V9M17.4 9V18" fill="none" stroke="rgba(20,16,10,.38)" stroke-width=".7"/>
      <path d="M0 1.2H34M0 10.2H34" fill="none" stroke="rgba(255,255,255,.13)" stroke-width=".6"/>
    </pattern>
    <linearGradient id="shade" x1="0" y1="0" x2="1" y2=".35"><stop offset="0" stop-color="#fff" stop-opacity=".24"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".42"/></linearGradient>
    <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9fc0e0"/><stop offset=".5" stop-color="#5d7fa6"/><stop offset="1" stop-color="#34496b"/></linearGradient>
    <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0c1120"/><stop offset=".55" stop-color="#27314f"/><stop offset=".85" stop-color="#7a5a66"/><stop offset="1" stop-color="#d49b6b"/></linearGradient>
    <linearGradient id="grass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2d3a26"/><stop offset="1" stop-color="#121710"/></linearGradient>
  </defs></svg>`)

  function backdrop(vb, ground) {
    const [vx, vy, vw, vh] = vb
    let seed = 3
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)
    const stars = Array.from({ length: 34 }, () => `<circle cx="${vx + rnd() * vw}" cy="${vy + rnd() * (ground - vy) * 0.55}" r="${0.4 + rnd() * 0.8}" fill="#fff" opacity="${0.25 + rnd() * 0.5}"/>`).join('')
    const clouds = [0.3, 0.55, 0.78].map((k, i) => `<ellipse cx="${vx + vw * (0.2 + i * 0.3)}" cy="${ground - (ground - vy) * k}" rx="${60 + i * 18}" ry="9" fill="#e9c9a8" opacity=".1" filter="url(#soft)"/>`).join('')
    const g = ground
    return `<rect x="${vx}" y="${vy}" width="${vw}" height="${vh}" rx="12" fill="url(#skyGrad)"/>${stars}${clouds}` +
      `<path d="M${vx} ${g - 38}Q${vx + 70} ${g - 74} ${vx + 150} ${g - 44}T${vx + vw} ${g - 52}V${g}H${vx}Z" fill="#1a2032" opacity=".85"/>` +
      `<path d="M${vx} ${g - 22}Q${vx + 100} ${g - 52} ${vx + 190} ${g - 26}T${vx + vw} ${g - 30}V${g}H${vx}Z" fill="#141a28"/>`
  }

  // ---------- home: the cathedral gallery ----------
  function showHome() {
    clearTimeout(idleTimer)
    game = null
    $('home').classList.remove('hidden')
    $('play').classList.add('hidden')
    for (const id of ['back', 'about', 'hint']) $(id).classList.add('hidden')
    $('title').innerHTML = 'Cathedral Builder<small>Working title</small>'
    const cards = CATHEDRALS.map((c, i) => {
      const recs = c.phases.map((_, k) => record(c, k))
      const doneCount = recs.filter((r) => r.done).length
      const all = doneCount === c.phases.length
      const unaided = all && recs.every((r) => !R.hintSummary(r.hints))
      const shown = c.phases.slice(0, Math.min(doneCount + 1, c.phases.length))
      const mini = shown.map((ph, k) => ph.pieces.map((p) => pieceMarkup(p, recs[k].placed.includes(p.id) ? '' : 'sil')).join('')).join('')
      const last = shown[shown.length - 1]
      const vb = last.viewBox.join(' ')
      const chips = c.phases.map((ph, k) => {
        const open = k === 0 || recs[k - 1].done
        const mark = recs[k].done ? (R.hintSummary(recs[k].hints) ? ' ✓' : ' ✓ no hints') : recs[k].placed.length ? ` ${recs[k].placed.length}/${ph.pieces.length}` : ''
        return `<button class="chip ${recs[k].done ? 'done' : ''}" data-i="${i}" data-k="${k}" ${open ? '' : 'disabled'}>${open ? '' : '&#128274; '}Phase ${k + 1}${mark}</button>`
      }).join('')
      return `<div class="card"><svg viewBox="${vb}" preserveAspectRatio="xMidYMax meet" style="background:#1f2533">${backdrop(last.viewBox, last.ground)}${mini}</svg>` +
        `<div><div class="t">${i + 1}. ${c.name}</div><div class="s">${c.period} · ${c.blurb}</div>` +
        `<div class="chips">${chips}</div>${unaided ? '<span class="tag done">Built with no hints</span>' : ''}</div></div>`
    }).join('')
    $('home').innerHTML = '<h1>Cathedral Builder</h1><p class="lead">Choose a cathedral. Pick each piece from the tray and place it where it belongs. Not every piece does.</p>' + cards
    $('home').querySelectorAll('.chip').forEach((b) => b.addEventListener('click', () => start(CATHEDRALS[+b.dataset.i], +b.dataset.k)))
  }

  // ---------- a game in progress ----------
  let game = null
  let idleTimer = 0

  function start(cath, idx = 0) {
    const phase = cath.phases[idx]
    const rec = record(cath, idx)
    game = { cath, idx, phase, rec, prior: priorIds(cath, idx), selected: null, hinted: null, slots: {}, placedEls: {} }
    $('home').classList.add('hidden')
    $('play').classList.remove('hidden')
    for (const id of ['back', 'about', 'hint']) $(id).classList.remove('hidden')
    $('title').innerHTML = `${cath.name}<small>${cath.period} · Phase ${idx + 1}: ${phase.name}</small>`
    buildStage()
    buildTray()
    if (rec.done) { lightUp(false); setTimeout(showComplete, 300) } else {
      say(phase.blurb)
      const first = record(cath, 0)
      if (idx === 0 && !first.introSeen && !rec.placed.length) showIntro(true)
      scheduleIdle()
    }
  }
  const allPlaced = () => game.prior.concat(game.rec.placed)

  function buildStage() {
    const { phase, cath, idx } = game
    const silhouette = params.has('silhouette') ? params.get('silhouette') !== '0' : phase.silhouette !== false
    const slotStyle = params.get('slots') || phase.slotStyle
    const svg = el('svg', { viewBox: phase.viewBox.join(' '), preserveAspectRatio: 'xMidYMax meet' })
    const glows = cath.phases.slice(0, idx + 1).flatMap((p) => p.glow || [])
    const [vx, , vw, vh] = phase.viewBox
    const vy = phase.viewBox[1]
    svg.innerHTML = backdrop(phase.viewBox, phase.ground) +
      glows.map(([x, y, w, h]) => `<rect class="glowrect" x="${x}" y="${y}" width="${w}" height="${h}"/>`).join('') +
      `<g id="sil">${silhouette ? phase.pieces.map((p) => pieceMarkup(p, 'sil')).join('') : ''}</g>` +
      `<g id="hit" fill="#000" opacity="0" pointer-events="none">${phase.pieces.map((p) => `<path data-id="${p.id}" fill-rule="evenodd" d="${p.d}"/>`).join('')}</g>` +
      `<g id="boxes"></g><g id="placed" filter="url(#castShadow)"></g><g id="fx"></g>` +
      `<rect x="${vx}" y="${phase.ground}" width="${vw}" height="${vy + vh - phase.ground}" fill="url(#grass)" filter="url(#grassTex)"/>` +
      `<rect x="${vx}" y="${phase.ground}" width="${vw}" height="3" fill="#0a0d12" opacity=".6"/>`
    $('stage').replaceChildren(svg)
    game.svg = svg
    if (slotStyle !== 'none') {
      for (const p of phase.pieces) {
        const [x, y, w, h] = p.box
        const r = el('rect', { class: 'slotbox', x: x - 2, y: y - 2, width: w + 4, height: h + 4, rx: 3 })
        svg.querySelector('#boxes').append(r)
        game.slots[p.id] = r
      }
    }
    for (const id of game.prior) addPlaced(id, false)
    for (const id of game.rec.placed) addPlaced(id, false)
    svg.addEventListener('click', onStageTap)
  }

  const pieceById = (id) => game.cath.phases.flatMap((ph) => ph.pieces).find((q) => q.id === id)
  function addPlaced(id, animate) {
    const p = pieceById(id)
    const g = el('g', { 'data-id': id, class: animate ? 'placed' : '' })
    g.innerHTML = pieceMarkup(p)
    game.svg.querySelector('#placed').append(g)
    game.placedEls[id] = g
    if (game.slots[id]) game.slots[id].remove()
  }

  function buildTray() {
    const { phase } = game
    const all = [...phase.pieces, ...phase.decoys]
    trayLabels(phase)
    // Fixed shuffle (seeded by the cathedral) so the tray never shows the build order.
    let s = 7 + (game.rec.runs || 0) * 97
    for (const ch of game.cath.id + game.phase.id) s = (s * 31 + ch.charCodeAt(0)) >>> 0
    const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
    for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [all[i], all[j]] = [all[j], all[i]] }
    const tray = $('tray')
    tray.replaceChildren()
    for (const p of all) {
      if (game.rec.placed.includes(p.id)) continue
      const b = document.createElement('button')
      b.className = 'item'
      b.dataset.id = p.id
      b.setAttribute('aria-label', p.name)
      b.innerHTML = thumb(p) + (game.phase.labels === false ? '' : `<span class="n">${p.name}</span>`)
      b.addEventListener('click', () => select(p.id))
      tray.append(b)
    }
  }
  const trayLabels = (phase) => $('tray').classList.toggle('nolabels', phase.labels === false)
  const trayItem = (id) => $('tray').querySelector(`[data-id="${id}"]`)


  // ---------- messages and coaching ----------
  let sayTimer = 0
  function say(text) {
    const c = $('coach')
    c.classList.add('fade')
    clearTimeout(sayTimer)
    sayTimer = setTimeout(() => { c.textContent = text; c.classList.remove('fade') }, 120)
  }
  // First-time tips teach the game's own features, once each.
  function tip(key, text) {
    if (game.rec.tips && game.rec.tips[key]) return false
    game.rec.tips = game.rec.tips || {}
    game.rec.tips[key] = 1
    save()
    say(text)
    return true
  }

  // ---------- interaction ----------
  function select(id) {
    if (!game || game.rec.done) return
    const prev = game.selected
    if (prev) trayItem(prev)?.classList.remove('sel')
    game.selected = prev === id ? null : id
    game.svg.classList.toggle('has-sel', !!game.selected)
    if (game.selected) {
      trayItem(id).classList.add('sel')
      if (game.hinted === id) { trayItem(id).classList.remove('hinted'); game.hinted = null }
      if (!tip('select', 'Now tap where it belongs in the structure.')) say('Where does it go?')
    } else say('Choose a piece from the tray.')
  }

  function toSvg(e) {
    const pt = game.svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    return pt.matrixTransform(game.svg.getScreenCTM().inverse())
  }
  const distToBox = (pt, b) => Math.hypot(Math.max(b[0] - pt.x, 0, pt.x - (b[0] + b[2])), Math.max(b[1] - pt.y, 0, pt.y - (b[1] + b[3])))

  // Generous snapping: the open piece whose shape holds the tap (so a window and the wall around
  // it are told apart), else the smallest open box holding it, else the nearest within reach.
  function pickSlot(pt) {
    const open = game.phase.pieces.filter((p) => !game.rec.placed.includes(p.id))
    const area = (p) => p.box[2] * p.box[3]
    const hitPt = new DOMPoint(pt.x, pt.y)
    const exact = open.filter((p) => {
      try { return game.svg.querySelector(`#hit [data-id="${p.id}"]`).isPointInFill(hitPt) } catch { return false }
    }).sort((a, b) => area(a) - area(b))
    if (exact.length) return exact[0]
    const inside = open.filter((p) => distToBox(pt, p.box) === 0).sort((a, b) => a.box[2] * a.box[3] - b.box[2] * b.box[3])
    if (inside.length) return inside[0]
    const near = open.map((p) => [distToBox(pt, p.box), p]).filter(([d]) => d <= 26).sort((a, b) => a[0] - b[0])
    return near.length ? near[0][1] : null
  }

  function onStageTap(e) {
    if (!game || game.rec.done) return
    const pt = toSvg(e)
    const placedEl = e.target.closest && e.target.closest('#placed > g')
    if (!game.selected) {
      if (placedEl) showSupports(placedEl.dataset.id, true)
      return
    }
    const slot = pickSlot(pt)
    if (!slot) { say('Nothing there to build on yet.'); return }
    attempt(game.selected, slot.id)
  }

  function attempt(pieceId, slotId) {
    const { phase } = game
    const res = R.canPlace(phase, allPlaced(), pieceId, slotId)
    const item = trayItem(pieceId)
    const replay = (cls) => { item.classList.remove('shake', 'wobble'); void item.offsetWidth; item.classList.add(cls) }
    if (res.ok) return place(pieceId)
    if (res.reason === 'decoy') {
      sfx.decoy(); replay('wobble')
      const d = phase.decoys.find((x) => x.id === pieceId)
      if (!tip('decoy', `${d.reaction} The tray holds decoys that do not belong. No harm done.`)) say(d.reaction)
    } else if (res.reason === 'unsupported') {
      sfx.bounce(); replay('shake')
      const names = res.missing.map((m) => pieceById(m).name.toLowerCase())
      const msg = phase.labels === false
        ? 'That piece rests on something that is not in place yet.'
        : `That is the right piece, but it rests on the ${names.join(' and the ')}, which ${names.length > 1 ? 'are' : 'is'} not in place yet.`
      if (!tip('order', msg + ' Order matters.')) say(msg)
      bounceSlot(slotId)
    } else {
      sfx.bounce(); replay('shake')
      if (!tip('wrong', 'Not there. It bounces back, and nothing is lost.')) say('Not there. Try another place.')
      bounceSlot(slotId)
    }
  }
  function bounceSlot(id) {
    const r = game.slots[id]
    if (!r) return
    r.classList.remove('bounce'); void r.getBoundingClientRect(); r.classList.add('bounce')
  }

  function place(id) {
    const { phase, rec } = game
    rec.placed.push(id)
    clearTimeout(idleTimer)
    $('offer').classList.add('hidden')
    sfx.snap()
    addPlaced(id, true)
    const item = trayItem(id)
    if (item) { item.classList.add('gone'); setTimeout(() => item.remove(), 240) }
    game.selected = null
    game.svg.classList.remove('has-sel')
    if (game.hinted) { trayItem(game.hinted)?.classList.remove('hinted'); game.hinted = null }
    save()
    if (R.isComplete(phase, rec.placed)) return finish()
    showSupports(id, false)
    scheduleIdle()
  }

  // A correct placement briefly shows what the piece now carries, and what it rests on.
  function showSupports(id, tapped) {
    const { phase } = game
    const p = pieceById(id)
    const up = R.supportsOf(phase, id)
    const fx = game.svg.querySelector('#fx')
    const [cx, cy] = center(p.box)
    for (const u of up) {
      const [ux, uy] = center(u.box)
      fx.append(el('line', { class: 'link', x1: cx, y1: cy, x2: ux, y2: uy }))
      const [x, y, w, h] = u.box
      const r = el('rect', { class: 'pulse', x: x - 2, y: y - 2, width: w + 4, height: h + 4, rx: 3 })
      fx.append(r)
    }
    setTimeout(() => fx.replaceChildren(), 1900)
    const rests = p.needs.map((n) => pieceById(n).name)
    const carries = up.map((u) => u.name)
    let msg = p.name
    if (rests.length) msg += ` rests on ${rests.join(' and ')}`
    if (carries.length) msg += `${rests.length ? ' and' : ''} now supports ${carries.join(', ')}`
    else msg += rests.length ? ' and finishes the top' : ''
    if (!tapped && game.rec.placed.length === 1) msg += '. The dotted lines show what it supports.'
    say(msg)
  }

  // ---------- hints: requested and offered, recorded and never penalized ----------
  function showHint() {
    const next = R.nextPiece(game.phase, allPlaced())
    if (!next) return false
    if (game.hinted !== next.id) {
      if (game.hinted) trayItem(game.hinted)?.classList.remove('hinted')
      game.hinted = next.id
      const it = trayItem(next.id)
      it.classList.add('hinted')
      it.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
    sfx.hint()
    say('Try this one next. The hint never says where it goes.')
    return true
  }
  $('hint').addEventListener('click', () => {
    if (!game || game.rec.done) return
    if (!game.hinted) { game.rec.hints.requested++; save() }
    showHint()
  })
  function scheduleIdle() {
    clearTimeout(idleTimer)
    const ms = Number(params.get('idle')) || game.phase.idleOfferMs
    idleTimer = setTimeout(function fire() {
      if (!game || game.rec.done) return
      if (document.hidden || !$('modal').classList.contains('hidden')) { idleTimer = setTimeout(fire, 5000); return }
      game.rec.hints.offered++
      save()
      $('offer').classList.remove('hidden')
    }, ms)
  }
  $('offerYes').addEventListener('click', () => {
    $('offer').classList.add('hidden')
    game.rec.hints.accepted++
    save()
    showHint()
    scheduleIdle()
  })
  $('offerNo').addEventListener('click', () => {
    $('offer').classList.add('hidden')
    game.rec.hints.declined++
    save()
    scheduleIdle()
  })

  // ---------- cards and finishing ----------
  const modal = $('modal')
  const closeModal = () => modal.classList.add('hidden')
  function introHtml(c) {
    const i = c.intro
    return `<h2>${i.title}</h2><div class="kick">${i.kicker}</div><ul>${i.lines.map((l) => `<li>${l}</li>`).join('')}</ul>` +
      (i.verified ? '' : '<p class="unverified">Prototype text: facts still to be checked against sources.</p>')
  }
  function showIntro(first) {
    modal.innerHTML = `<div class="sheet">${introHtml(game.cath)}<div class="row"><button class="btn primary" id="go">${first ? 'Start building' : 'Close'}</button></div></div>`
    modal.classList.remove('hidden')
    $('go').addEventListener('click', () => { closeModal(); if (first) { record(game.cath, 0).introSeen = true; save() } })
  }
  $('about').addEventListener('click', () => game && showIntro(false))

  function lightUp(animate) {
    game.svg.classList.add('lit')
    if (!animate) return
    Object.values(game.placedEls).forEach((g, i) => g.animate(
      [{ transform: 'none' }, { transform: 'translateY(-5px)' }, { transform: 'none' }], { duration: 520, delay: i * 90, easing: 'ease-out' }))
  }
  function finish() {
    game.rec.done = true
    game.selected = null
    save()
    say('Complete.')
    sfx.flourish()
    lightUp(true)
    setTimeout(showComplete, 2600)
  }
  function showComplete() {
    if (!game) return
    const { cath, phase, rec } = game
    const summary = R.hintSummary(rec.hints)
    const badge = summary ? `<div class="badge plain">${summary}</div>` : '<div class="badge">No hints</div>'
    const nextPhase = cath.phases[game.idx + 1]
    const nextCath = CATHEDRALS[CATHEDRALS.indexOf(cath) + 1]
    const nextLabel = nextPhase ? `Next: Phase ${game.idx + 2}, ${nextPhase.name}` : nextCath ? `Next: ${nextCath.name}` : ''
    modal.innerHTML = `<div class="sheet"><h2>${phase.name} complete</h2><div class="kick">${cath.name} · Phase ${game.idx + 1} of ${cath.phases.length}</div>${badge}` +
      (nextPhase || !nextCath ? '' : `<p style="color:var(--dim)">${cath.name} is finished.</p>`) + introHtml(cath) +
      `<div class="row"><button class="btn" id="again">Build again</button>` +
      `<button class="btn ${nextLabel ? '' : 'primary'}" id="home2">All cathedrals</button>` +
      (nextLabel ? `<button class="btn primary" id="nxt">${nextLabel}</button>` : '') + '</div></div>'
    modal.classList.remove('hidden')
    $('again').addEventListener('click', () => {
      rec.placed = []; rec.done = false; rec.hints = emptyHints(); rec.runs = (rec.runs || 0) + 1; save(); closeModal(); start(cath, game.idx)
    })
    $('home2').addEventListener('click', () => { closeModal(); showHome() })
    if (nextLabel) $('nxt').addEventListener('click', () => { closeModal(); if (nextPhase) start(cath, game.idx + 1); else start(nextCath, 0) })
  }

  $('back').addEventListener('click', showHome)
  $('mute').addEventListener('click', () => { store.muted = !store.muted; save(); syncMute(); if (!store.muted) sfx.hint() })
  syncMute()
  globalThis.__cb = { get game() { return game }, start, showHome, CATHEDRALS }
  showHome()
})()
