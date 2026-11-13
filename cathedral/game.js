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
  function record(cath, phase) {
    const c = (store.c[cath.id] = store.c[cath.id] || {})
    const r = (c[phase.id] = c[phase.id] || {})
    r.placed = R.cleanPlaced(phase, r.placed)
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
  const pieceMarkup = (p, cls = '') =>
    `<g class="piece ${cls} ${p.tone === '#6f8fb0' ? 'glass' : 'warm'}" style="--tone:${p.tone}">` +
    `<path class="body" fill-rule="evenodd" d="${p.d}"/><g class="marks">${p.marks || ''}</g></g>`
  function thumb(p) {
    const [x, y, w, h] = p.box
    return `<svg viewBox="${x - 6} ${y - 6} ${w + 12} ${h + 12}" preserveAspectRatio="xMidYMid meet">${pieceMarkup(p)}</svg>`
  }
  function el(name, attrs = {}) {
    const e = document.createElementNS(NS, name)
    for (const k in attrs) e.setAttribute(k, attrs[k])
    return e
  }
  const center = (b) => [b[0] + b[2] / 2, b[1] + b[3] / 2]

  // ---------- home: the cathedral gallery ----------
  function showHome() {
    clearTimeout(idleTimer)
    game = null
    $('home').classList.remove('hidden')
    $('play').classList.add('hidden')
    for (const id of ['back', 'about', 'hint']) $(id).classList.add('hidden')
    $('title').innerHTML = 'Cathedral Builder<small>Working title</small>'
    const cards = CATHEDRALS.map((c, i) => {
      const phase = c.phases[0]
      const r = record(c, phase)
      const tag = r.done
        ? `<span class="tag done">${R.hintSummary(r.hints) ? 'Built' : 'Built, no hints'}</span>`
        : r.placed.length
          ? `<span class="tag">${r.placed.length} of ${phase.pieces.length} placed</span>`
          : '<span class="tag">New</span>'
      const mini = phase.pieces.map((p) => pieceMarkup(p, r.placed.includes(p.id) ? '' : 'sil')).join('')
      const vb = phase.viewBox.join(' ')
      return `<button class="card" data-i="${i}"><svg viewBox="${vb}">${mini}</svg>` +
        `<span><div class="t">${i + 1}. ${c.name}</div><div class="s">${c.period} · ${c.blurb}</div>${tag}</span></button>`
    }).join('')
    $('home').innerHTML = '<h1>Cathedral Builder</h1><p class="lead">Choose a cathedral. Pick each piece from the tray and place it.</p>' + cards
    $('home').querySelectorAll('.card').forEach((b) => b.addEventListener('click', () => start(CATHEDRALS[+b.dataset.i])))
  }

  // ---------- a game in progress ----------
  let game = null
  let idleTimer = 0

  function start(cath) {
    const phase = cath.phases[0]
    const rec = record(cath, phase)
    game = { cath, phase, rec, selected: null, hinted: null, tips: {}, slots: {}, placedEls: {} }
    $('home').classList.add('hidden')
    $('play').classList.remove('hidden')
    for (const id of ['back', 'about', 'hint']) $(id).classList.remove('hidden')
    $('title').innerHTML = `${cath.name}<small>${cath.period} · ${phase.name}</small>`
    buildStage()
    buildTray()
    updateStatus()
    if (rec.done) { lightUp(false); setTimeout(showComplete, 300) } else {
      say('Choose a piece from the tray.')
      if (!rec.introSeen && !rec.placed.length) showIntro(true)
      scheduleIdle()
    }
  }

  function buildStage() {
    const { phase } = game
    const silhouette = params.has('silhouette') ? params.get('silhouette') !== '0' : phase.silhouette !== false
    const slotStyle = params.get('slots') || phase.slotStyle
    const [vx, vy, vw, vh] = phase.viewBox
    const svg = el('svg', { viewBox: phase.viewBox.join(' '), preserveAspectRatio: 'xMidYMax meet' })
    const [gx, gy, gw, gh] = phase.glow
    svg.innerHTML =
      '<defs><linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#232a3d"/><stop offset="1" stop-color="#3b3a4a"/></linearGradient></defs>' +
      `<rect id="sky" x="${vx}" y="${vy}" width="${vw}" height="${vh}" rx="12"/>` +
      `<rect class="glowrect" x="${gx}" y="${gy}" width="${gw}" height="${gh}"/>` +
      `<g id="sil">${silhouette ? phase.pieces.map((p) => pieceMarkup(p, 'sil')).join('') : ''}</g>` +
      `<g id="hit" fill="#000" opacity="0" pointer-events="none">${phase.pieces.map((p) => `<path data-id="${p.id}" fill-rule="evenodd" d="${p.d}"/>`).join('')}</g>` +
      `<g id="boxes"></g><g id="placed"></g><g id="fx"></g>` +
      `<rect class="groundline" x="${vx}" y="${phase.ground}" width="${vw}" height="${vh - phase.ground}"/>`
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
    for (const id of game.rec.placed) addPlaced(id, false)
    svg.addEventListener('click', onStageTap)
  }

  function addPlaced(id, animate) {
    const p = game.phase.pieces.find((q) => q.id === id)
    const g = el('g', { 'data-id': id, class: animate ? 'placed' : '' })
    g.innerHTML = pieceMarkup(p)
    game.svg.querySelector('#placed').append(g)
    game.placedEls[id] = g
    if (game.slots[id]) game.slots[id].remove()
  }

  function buildTray() {
    const { phase } = game
    const all = [...phase.pieces, ...phase.decoys]
    // Fixed shuffle (seeded by the cathedral) so the tray never shows the build order.
    let s = 7
    for (const ch of game.cath.id) s = (s * 31 + ch.charCodeAt(0)) >>> 0
    const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
    for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [all[i], all[j]] = [all[j], all[i]] }
    const tray = $('tray')
    tray.replaceChildren()
    for (const p of all) {
      if (game.rec.placed.includes(p.id)) continue
      const b = document.createElement('button')
      b.className = 'item'
      b.dataset.id = p.id
      b.innerHTML = `${thumb(p)}<span class="n">${p.name}</span>`
      b.addEventListener('click', () => select(p.id))
      tray.append(b)
    }
  }
  const trayItem = (id) => $('tray').querySelector(`[data-id="${id}"]`)

  function updateStatus() {
    const n = game.rec.placed.length
    $('hint').textContent = 'Hint'
    $('stage').dataset.placed = n
  }

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
      if (!tip('select', 'Now tap where it belongs. Dashed boxes show the places still open.')) say('Where does it go?')
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
    if (!slot) { say('Tap close to an open place in the structure.'); return }
    attempt(game.selected, slot.id)
  }

  function attempt(pieceId, slotId) {
    const { phase, rec } = game
    const res = R.canPlace(phase, rec.placed, pieceId, slotId)
    const item = trayItem(pieceId)
    const replay = (cls) => { item.classList.remove('shake', 'wobble'); void item.offsetWidth; item.classList.add(cls) }
    if (res.ok) return place(pieceId)
    if (res.reason === 'decoy') {
      sfx.decoy(); replay('wobble')
      const d = phase.decoys.find((x) => x.id === pieceId)
      if (!tip('decoy', `${d.reaction} The tray holds decoys that do not belong. No harm done.`)) say(d.reaction)
    } else if (res.reason === 'unsupported') {
      sfx.bounce(); replay('shake')
      const names = res.missing.map((m) => phase.pieces.find((p) => p.id === m).name.toLowerCase())
      const msg = `That is the right piece, but it rests on the ${names.join(' and the ')}, which ${names.length > 1 ? 'are' : 'is'} not in place yet.`
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
    updateStatus()
    if (R.isComplete(phase, rec.placed)) return finish()
    showSupports(id, false)
    scheduleIdle()
  }

  // A correct placement briefly shows what the piece now carries, and what it rests on.
  function showSupports(id, tapped) {
    const { phase } = game
    const p = phase.pieces.find((q) => q.id === id)
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
    const rests = p.needs.map((n) => phase.pieces.find((q) => q.id === n).name)
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
    const next = R.nextPiece(game.phase, game.rec.placed)
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
    $('go').addEventListener('click', () => { closeModal(); if (first) { game.rec.introSeen = true; save() } })
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
    const nextIdx = CATHEDRALS.indexOf(cath) + 1
    const next = CATHEDRALS[nextIdx]
    modal.innerHTML = `<div class="sheet"><h2>${phase.name} complete</h2><div class="kick">${cath.name}</div>${badge}` +
      `<p style="color:var(--dim)">More phases of ${cath.name} are coming.</p>${introHtml(cath)}` +
      `<div class="row"><button class="btn" id="again">Build again</button>` +
      `<button class="btn ${next ? '' : 'primary'}" id="home2">All cathedrals</button>` +
      (next ? `<button class="btn primary" id="nxt">Next: ${next.name}</button>` : '') + '</div></div>'
    modal.classList.remove('hidden')
    $('again').addEventListener('click', () => {
      rec.placed = []; rec.done = false; rec.hints = emptyHints(); save(); closeModal(); start(cath)
    })
    $('home2').addEventListener('click', () => { closeModal(); showHome() })
    if (next) $('nxt').addEventListener('click', () => { closeModal(); start(next) })
  }

  $('back').addEventListener('click', showHome)
  $('mute').addEventListener('click', () => { store.muted = !store.muted; save(); syncMute(); if (!store.muted) sfx.hint() })
  syncMute()
  globalThis.__cb = { get game() { return game }, start, showHome, CATHEDRALS }
  showHome()
})()
