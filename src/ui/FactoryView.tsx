import { useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { breakAt, type FactoryModel, type Machine, type Market, type Product, type Station } from '../engine/model.ts'
import type { ActiveJob, Shop, Snapshot, Zone } from '../engine/timeline.ts'
import { StationGlyph, WRENCH } from './icons.tsx'
import { productColor, productName } from './products.ts'

/** Width in pixels of one station's slot; stations sit `COLUMN` apart, left to right. */
const COLUMN = 200
/** Width in pixels of the shipped/shop bin to the right of the last station, margins included. */
const BIN = 190
/** Vertical center, in pixels, of the pick/constraint/bottleneck tag above each station. */
const TAG_Y = 22
/** Side in pixels of one job's square block, both in a pile and inside a station box. */
const BLOCK = 24
/** Space in pixels between blocks in a pile. */
const GAP = 5
/** Blocks per row in the pile in front of a station. */
const PILE_COLUMNS = 5
/** Rows in the pile; only the first `PILE_COLUMNS * PILE_ROWS` jobs are drawn. */
const PILE_ROWS = 4
/** Width in pixels of the pile grid, derived from its blocks and gaps. */
const PILE_WIDTH = PILE_COLUMNS * BLOCK + (PILE_COLUMNS - 1) * GAP
/** Height in pixels of the pile grid, derived from its blocks and gaps. */
const PILE_HEIGHT = PILE_ROWS * BLOCK + (PILE_ROWS - 1) * GAP
/** Baseline in pixels of a pile: its rows stack upward from here, above the station box. */
const PILE_BOTTOM = 160
/** Top in pixels of a station box and the shipped bin; the 42px gap leaves room for the pile count. */
const BOX_TOP = PILE_BOTTOM + 42
/** Minimum height in pixels of a station box and bin; grows to fit machines or shop shelves. */
const BOX_HEIGHT = 150
/** Extra height in pixels under a station for scrapped or sent-back counts, when it inspects or spoils work. */
const SCRAP_SPACE = 26
/** Offset in pixels from a station box's top to the first row of its named machines. */
const MACHINE_TOP = 58
/** Vertical pitch in pixels of each named machine row; the box grows by this per machine. */
const MACHINE_ROW = 31
/** Room in pixels under a station box for a cart of finished work, when the station moves batches. */
const CART_SPACE = 30
/** Side in pixels of one job's block in a cart; a cart shows up to ten. */
const CART_BLOCK = 12
/** Extra height in pixels above the line when a rope is drawn, enough for the rope and its label. */
const ROPE_SPACE = 58
/** Colors that tell stations apart, cycled by station index. */
const ACCENTS = ['#4c8dff', '#8a5cf6', '#ff6fb5', '#2ec5e6', '#ff8a3d', '#6a7bff']

// Below this frame width the floor wraps its stations into rows, so a phone needs no side scroll.
const MOBILE_BELOW = 640
/** Stations in a row of the wrapped phone floor. */
const MOBILE_PER_ROW = 2
/** Space in pixels between wrapped rows for the belt that turns back to the next row. */
const MOBILE_ROW_GAP = 24
/** The wrapped floor's widest size; a narrow window centers it rather than stretching it. */
const MOBILE_MAX_WIDTH = 440

// The phone floor packs its piles closer and its station boxes shorter, so a wrapped line needs less
// scrolling while keeping the same parts, lights, and progress bars.
const COMPACT_PILE_COLUMNS = 7
const COMPACT_PILE_ROWS = 2
const COMPACT_BLOCK = 16
const COMPACT_GAP = 4
const COMPACT_PILE_WIDTH = COMPACT_PILE_COLUMNS * COMPACT_BLOCK + (COMPACT_PILE_COLUMNS - 1) * COMPACT_GAP
const COMPACT_PILE_HEIGHT = COMPACT_PILE_ROWS * COMPACT_BLOCK + (COMPACT_PILE_ROWS - 1) * COMPACT_GAP
const COMPACT_PILE_TOP = 48
const COMPACT_PILE_BOTTOM = COMPACT_PILE_TOP + COMPACT_PILE_HEIGHT
const COMPACT_BOX_TOP = 128
const COMPACT_BOX_HEIGHT = 112
const COMPACT_MACHINE_TOP = 44
const COMPACT_MACHINE_ROW = 28
const COMPACT_CART_SPACE = 16
const COMPACT_SCRAP_SPACE = 20
const COMPACT_BOTTOM = 34
const COMPACT_BELT_OFFSET = 55
const COMPACT_BIN_TOP = 48

export type Badge = 'upgraded' | 'covered' | 'steadied' | 'maintained' | 'quick'

// The pile in front of `station` is a buffer, colored by whether it's running dry, healthy, or flooding.
interface BufferBand {
  station: string
  low: number
  high: number
}

interface FactoryViewProps {
  model: FactoryModel
  snapshot: Snapshot
  selected?: string | null
  constraint?: string | null
  // Several stations tagged at once, such as every bottleneck of a line, with the tag's words.
  bottlenecks?: string[]
  bottleneckTag?: string
  badges?: Record<string, Badge[]>
  buildingAt?: number
  buffer?: BufferBand | null
  // The product of each job, when the line makes several.
  jobProducts?: string[]
  // What one unit of work is called, plural.
  unit?: string
  // Job numbers of rush orders, outlined in gold.
  rushJobs?: number[]
  onSelect?: (stationId: string) => void
  // The tag over the selected station.
  selectedTag?: string
  // How fast the shift plays (1 or 4) while it glides forward, so parts slide to their new places,
  // more quickly at speed; 0 while paused or after a jump in time, so they snap.
  glide?: number
}

// How products look: which product each job is, and each product's color and name.
interface Palette {
  isRush: (job: number) => boolean
  productOf: (job: number) => string | undefined
  color: (product: string) => string
  name: (product: string) => string
  all: string[]
}

function jobColor(palette: Palette, job: number): string | undefined {
  const product = palette.productOf(job)
  return product === undefined ? undefined : palette.color(product)
}

const zoneLabel: Record<Zone, string> = { dry: 'running dry', healthy: 'healthy', flooding: 'flooding' }

// The floor: one row of stations on a wide screen, or wrapped rows on a phone.
export function FactoryView(props: FactoryViewProps) {
  const [frame, width] = useFrameWidth()
  const mobile =  width < (MOBILE_BELOW - MOBILE_BELOW)
  const maxHeight = useFloorMaxHeight(frame, mobile, width)
  return (
    <div className={`factory-frame${mobile ? ' mobile' : ''}`} ref={frame}>
      {mobile ? <MobileFactoryView {...props} maxHeight={maxHeight} /> : <WideFactoryView {...props} />}
    </div>
  )
}

// Measures the room the floor has, so the view can wrap its stations when a phone is too narrow.
function useFrameWidth() {
  const frame = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(() => (typeof window === 'undefined' ? 1024 : window.innerWidth))
  useLayoutEffect(() => {
    const element = frame.current
    if (!element) return
    const measure = () => setWidth(element.clientWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return [frame, width] as const
}

// On a phone the wrapped floor can be taller than the screen. Once it has been laid out, measure
// the room below its top and let the drawing shrink to fit, so the whole line stays in view.
function useFloorMaxHeight(frame: RefObject<HTMLDivElement | null>, mobile: boolean, width: number) {
  const [maxHeight, setMaxHeight] = useState<number | null>(null)
  useLayoutEffect(() => {
    if (!mobile) return
    const measure = () => {
      const element = frame.current
      if (!element) return
      const top = element.getBoundingClientRect().top + window.scrollY
      setMaxHeight(Math.max(180, Math.floor(window.innerHeight - top - 24)))
    }
    measure()
    window.addEventListener('resize', measure)
    window.visualViewport?.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('resize', measure)
      window.visualViewport?.removeEventListener('resize', measure)
    }
  }, [frame, mobile, width])
  return maxHeight
}

const wideCell = (i: number) => ({ x: i * COLUMN, y: 0 })

function WideFactoryView(props: FactoryViewProps) {
  const { model, snapshot, selected = null, constraint = null, bottlenecks = [], badges = {}, buildingAt = 5, buffer = null, jobProducts, unit = 'robots', rushJobs, onSelect } = props
  const { selectedTag = 'Your pick', bottleneckTag = 'Bottleneck', glide = 0 } = props
  const count = model.stations.length
  const width = count * COLUMN + BIN
  const beltY = BOX_TOP + 62
  // A shop selling several products lists each one's shelf.
  const shopHeight = model.market && (model.products?.length ?? 0) > 2 ? 166 : 0
  const boxHeight = Math.max(BOX_HEIGHT, shopHeight, ...model.stations.map((s) => (s.machines ? MACHINE_TOP + s.machines.length * MACHINE_ROW + 6 : 0)))
  const cartSpace = model.stations.some((s, i) => (s.transfer ?? 1) > 1 && i < count - 1) ? CART_SPACE : 0
  const scrapSpace = model.stations.some((s) => s.inspects || s.changeoverScrap) ? SCRAP_SPACE : 0
  const height = BOX_TOP + boxHeight + cartSpace + scrapSpace + 50
  const rush = new Set(rushJobs ?? [])
  const material = model.supply?.name ?? 'material'
  const { release } = model
  const tiedTo = release.kind === 'rope' ? model.stations.findIndex((s) => s.id === release.constraint) : -1
  const top = tiedTo >= 0 ? -ROPE_SPACE : 0
  const zoneOf = (waiting: number): Zone | null =>
    buffer === null ? null : waiting < buffer.low ? 'dry' : waiting > buffer.high ? 'flooding' : 'healthy'
  const palette: Palette = {
    isRush: (job) => rush.has(job),
    productOf: (job) => jobProducts?.[job],
    color: (product) => productColor(model, product),
    name: (product) => productName(model, product),
    all: (model.products ?? []).map((p) => p.id),
  }
  const products = model.products ?? []
  return (
    <svg
      className={`factory${glide > 0 ? '' : ' still'}`}
      style={glide > 0 ? ({ '--glide': `${Math.round(240 / Math.sqrt(glide))}ms` } as CSSProperties) : undefined}
      viewBox={`0 ${top} ${width} ${height - top}`}
      role="group"
      aria-label="Factory floor"
    >
      <rect className="conveyor" x={24} y={beltY} width={width - 48} height={14} rx={7} />
      {Array.from({ length: count }, (_, i) => (
        <path key={i} className="arrow" d={`M${(i + 1) * COLUMN - 7} ${beltY - 7}l12 14-12 14`} />
      ))}
      {release.kind === 'rope' && tiedTo >= 0 && <Rope tiedTo={tiedTo} length={release.buffer} name={model.stations[tiedTo].name} unit={unit} />}
      {/* Piles first, then their parts, then the stations over them: a part slides behind its
          station's box as it goes in, and never covers a pile's count. */}
      {model.stations.map((station, i) => {
        const zone = buffer?.station === station.id ? zoneOf(snapshot.queues[i]) : null
        return (
          <rect
            key={station.id}
            className={`waiting-area${zone ? ` zone-${zone}` : ''}`}
            x={i * COLUMN + COLUMN / 2 - PILE_WIDTH / 2 - 9}
            y={PILE_BOTTOM - PILE_HEIGHT - 9}
            width={PILE_WIDTH + 18}
            height={PILE_HEIGHT + 18}
            rx={14}
          />
        )
      })}
      <Parts
        snapshot={snapshot}
        palette={palette}
        cell={wideCell}
        pileColumns={PILE_COLUMNS}
        pileRows={PILE_ROWS}
        block={BLOCK}
        gap={GAP}
        pileBottom={PILE_BOTTOM}
        boxTop={BOX_TOP}
      />
      {model.stations.map((station, i) => {
        const pause = breakAt(station, snapshot.t)
        return (
          <StationColumn
            key={station.id}
            x={i * COLUMN}
            station={station}
            boxTop={BOX_TOP}
            pileBottom={PILE_BOTTOM}
            boxHeight={boxHeight}
            cartSpace={cartSpace}
            height={height}
            palette={palette}
            cart={i < count - 1 && (station.transfer ?? 1) > 1 ? snapshot.carts[i] : null}
            accent={ACCENTS[i % ACCENTS.length]}
            waiting={snapshot.waiting[i]}
            working={snapshot.working[i]}
            made={snapshot.completed[i]}
            t={snapshot.t}
            stopped={
              snapshot.brokenUntil[i] !== null
                ? 'broken'
                : snapshot.jammed[i]
                  ? 'jammed'
                  : pause
                    ? 'break'
                    : i === 0 && snapshot.stock === 0
                      ? 'starved'
                      : null
            }
            why={snapshot.brokenUntil[i] !== null ? snapshot.brokenBy[i] : snapshot.jammed[i] ? null : (pause?.reason ?? null)}
            brokenUntil={snapshot.brokenUntil[i]}
            scrapped={station.reworkTo ? null : station.inspects || station.changeoverScrap ? snapshot.scrapped[i] : null}
            sentBack={station.reworkTo ? { count: snapshot.sentBack[i], to: model.stations.find((s) => s.id === station.reworkTo)?.name ?? '' } : null}
            scrapY={BOX_TOP + boxHeight + cartSpace + 34 + SCRAP_SPACE}
            stock={i === 0 && snapshot.stock !== undefined ? { count: snapshot.stock, name: material } : null}
            badges={badges[station.id] ?? []}
            buildingAt={buildingAt}
            zone={buffer?.station === station.id ? zoneOf(snapshot.queues[i]) : null}
            selected={selected === station.id}
            selectedTag={selectedTag}
            isConstraint={constraint === station.id || bottlenecks.includes(station.id)}
            constraintTag={constraint === station.id ? 'Constraint' : bottleneckTag}
            onSelect={onSelect}
          />
        )
      })}
      {snapshot.shop && model.market ? (
        <ShopCounter x={count * COLUMN} boxHeight={boxHeight} shop={snapshot.shop} market={model.market} products={products} palette={palette} t={snapshot.t} />
      ) : (
        <ShippedBin x={count * COLUMN} y={0} boxHeight={boxHeight} shipped={snapshot.shipped} shippedBy={snapshot.shippedBy} products={products} palette={palette} />
      )}
    </svg>
  )
}

// The phone floor: the same stations, wrapped into rows that read left to right, with the belt
// turning down at the end of each row to the start of the next, so nothing runs off the screen.
function MobileFactoryView(props: FactoryViewProps & { maxHeight: number | null }) {
  const { model, snapshot, selected = null, constraint = null, bottlenecks = [], badges = {}, buildingAt = 5, buffer = null, jobProducts, unit = 'robots', rushJobs, onSelect, maxHeight } = props
  const { selectedTag = 'Your pick', bottleneckTag = 'Bottleneck', glide = 0 } = props
  const count = model.stations.length
  const width = MOBILE_PER_ROW * COLUMN
  const stationBeltY = COMPACT_BOX_TOP + COMPACT_BELT_OFFSET
  // The shipped bin has no sign, so it can sit right at the top of its own row.
  const binTop = model.market ? COMPACT_BIN_TOP : 8
  const binBeltY = binTop + COMPACT_BELT_OFFSET
  // A shop or bin lists each product on its own line, so it needs the taller box.
  const productCount = model.products?.length ?? 0
  const binBoxHeight = productCount > 2 ? 166 : model.market || productCount > 0 ? 150 : 130
  const boxHeight = Math.max(
    COMPACT_BOX_HEIGHT,
    ...model.stations.map((s) => (s.machines ? COMPACT_MACHINE_TOP + s.machines.length * COMPACT_MACHINE_ROW + 6 : 0)),
  )
  const cartSpace = model.stations.some((s, i) => (s.transfer ?? 1) > 1 && i < count - 1) ? COMPACT_CART_SPACE : 0
  const scrapSpace = model.stations.some((s) => s.inspects || s.changeoverScrap) ? COMPACT_SCRAP_SPACE : 0
  const stationSlot = COMPACT_BOX_TOP + boxHeight + cartSpace + scrapSpace + COMPACT_BOTTOM
  const binSlot = binTop + binBoxHeight + 12
  // A full row of stations leaves the bin the next row; put it on the right there so the belt can
  // come in from the left and run to it.
  const stationRows = Math.max(1, Math.ceil(count / MOBILE_PER_ROW))
  const binInNewRow = count > 0 && count % MOBILE_PER_ROW === 0
  const binCol = count % MOBILE_PER_ROW === 0 ? 1 : count % MOBILE_PER_ROW
  const binRow = binInNewRow ? stationRows : stationRows - 1
  const rowHeights = Array.from({ length: stationRows }, (_, r) =>
    !binInNewRow && r === binRow ? Math.max(stationSlot, binSlot) : stationSlot,
  )
  if (binInNewRow) rowHeights.push(binSlot)
  const rowTops: number[] = []
  let nextTop = 0
  for (const rowHeight of rowHeights) {
    rowTops.push(nextTop)
    nextTop += rowHeight + MOBILE_ROW_GAP
  }
  const rows = rowHeights.length
  const height = nextTop - (rows > 0 ? MOBILE_ROW_GAP : 0)
  const rush = new Set(rushJobs ?? [])
  const material = model.supply?.name ?? 'material'
  const { release } = model
  const tiedTo = release.kind === 'rope' ? model.stations.findIndex((s) => s.id === release.constraint) : -1
  const top = tiedTo >= 0 ? -ROPE_SPACE : 0
  const zoneOf = (waiting: number): Zone | null =>
    buffer === null ? null : waiting < buffer.low ? 'dry' : waiting > buffer.high ? 'flooding' : 'healthy'
  const palette: Palette = {
    isRush: (job) => rush.has(job),
    productOf: (job) => jobProducts?.[job],
    color: (product) => productColor(model, product),
    name: (product) => productName(model, product),
    all: (model.products ?? []).map((p) => p.id),
  }
  const products = model.products ?? []
  const cell = (i: number) => ({ x: (i % MOBILE_PER_ROW) * COLUMN, y: rowTops[Math.floor(i / MOBILE_PER_ROW)] })
  const binCell = { x: binCol * COLUMN, y: rowTops[binRow] }
  return (
    <svg
      className={`factory mobile${glide > 0 ? '' : ' still'}`}
      style={
        {
          maxWidth: MOBILE_MAX_WIDTH,
          maxHeight: maxHeight ?? undefined,
          margin: '0 auto',
          ...(glide > 0 ? { '--glide': `${Math.round(240 / Math.sqrt(glide))}ms` } : {}),
        } as CSSProperties
      }
      viewBox={`0 ${top} ${width} ${height - top}`}
      role="group"
      aria-label="Factory floor"
    >
      {Array.from({ length: rows }, (_, r) => {
        const stations = Math.min(MOBILE_PER_ROW, Math.max(0, count - r * MOBILE_PER_ROW))
        const hasBin = r === binRow
        if (stations === 0 && !hasBin) return null
        const rowTop = rowTops[r]
        const rowBeltY = rowTop + (stations > 0 ? stationBeltY : binBeltY)
        const slots = stations > 0 ? stations : binCol
        const end = slots * COLUMN - 24
        const nextTop = rowTops[r + 1]
        const nextStations = Math.min(MOBILE_PER_ROW, Math.max(0, count - (r + 1) * MOBILE_PER_ROW))
        const nextBeltY = nextTop + (nextStations > 0 ? stationBeltY : binBeltY)
        return (
          <g key={`row-${r}`}>
            <rect className="conveyor" x={24} y={rowBeltY} width={end - 24} height={14} rx={7} />
            {Array.from({ length: stations - 1 }, (_, j) => (
              <path key={j} className="arrow" d={`M${(j + 1) * COLUMN - 7} ${rowBeltY - 7}l12 14-12 14`} />
            ))}
            <path className="arrow" d={`M${end - 7} ${rowBeltY - 7}l12 14-12 14`} />
            {r < rows - 1 && (
              <path className="conveyor-turn" d={turnPath(end, rowBeltY, rowTop + rowHeights[r] + MOBILE_ROW_GAP / 2, nextBeltY, width)} />
            )}
          </g>
        )
      })}
      {release.kind === 'rope' && tiedTo >= 0 && <MobileRope tiedTo={tiedTo} length={release.buffer} name={model.stations[tiedTo].name} unit={unit} cell={cell} width={width} />}
      {/* Piles first, then their parts, then the stations over them: a part slides behind its
          station's box as it goes in, and never covers a pile's count. */}
      {model.stations.map((station, i) => {
        const origin = cell(i)
        const zone = buffer?.station === station.id ? zoneOf(snapshot.queues[i]) : null
        return (
          <rect
            key={station.id}
            className={`waiting-area${zone ? ` zone-${zone}` : ''}`}
            x={origin.x + COLUMN / 2 - COMPACT_PILE_WIDTH / 2 - 9}
            y={origin.y + COMPACT_PILE_BOTTOM - COMPACT_PILE_HEIGHT - 9}
            width={COMPACT_PILE_WIDTH + 18}
            height={COMPACT_PILE_HEIGHT + 18}
            rx={14}
          />
        )
      })}
      <Parts
        snapshot={snapshot}
        palette={palette}
        cell={cell}
        pileColumns={COMPACT_PILE_COLUMNS}
        pileRows={COMPACT_PILE_ROWS}
        block={COMPACT_BLOCK}
        gap={COMPACT_GAP}
        pileBottom={COMPACT_PILE_BOTTOM}
        boxTop={COMPACT_BOX_TOP}
      />
      {model.stations.map((station, i) => {
        const pause = breakAt(station, snapshot.t)
        const origin = cell(i)
        return (
          <g key={station.id} transform={`translate(${origin.x} ${origin.y})`}>
            <StationColumn
              x={0}
              station={station}
              boxTop={COMPACT_BOX_TOP}
              pileBottom={COMPACT_PILE_BOTTOM}
              boxHeight={boxHeight}
              cartSpace={cartSpace}
              height={rowHeights[Math.floor(i / MOBILE_PER_ROW)]}
              palette={palette}
              compact
              cart={i < count - 1 && (station.transfer ?? 1) > 1 ? snapshot.carts[i] : null}
              accent={ACCENTS[i % ACCENTS.length]}
              waiting={snapshot.waiting[i]}
              working={snapshot.working[i]}
              made={snapshot.completed[i]}
              t={snapshot.t}
              stopped={
                snapshot.brokenUntil[i] !== null
                  ? 'broken'
                  : snapshot.jammed[i]
                    ? 'jammed'
                    : pause
                      ? 'break'
                      : i === 0 && snapshot.stock === 0
                        ? 'starved'
                        : null
              }
              why={snapshot.brokenUntil[i] !== null ? snapshot.brokenBy[i] : snapshot.jammed[i] ? null : (pause?.reason ?? null)}
              brokenUntil={snapshot.brokenUntil[i]}
              scrapped={station.reworkTo ? null : station.inspects || station.changeoverScrap ? snapshot.scrapped[i] : null}
              sentBack={station.reworkTo ? { count: snapshot.sentBack[i], to: model.stations.find((s) => s.id === station.reworkTo)?.name ?? '' } : null}
              scrapY={COMPACT_BOX_TOP + boxHeight + (cartSpace ? 50 : 44)}
              stock={i === 0 && snapshot.stock !== undefined ? { count: snapshot.stock, name: material } : null}
              badges={badges[station.id] ?? []}
              buildingAt={buildingAt}
              zone={buffer?.station === station.id ? zoneOf(snapshot.queues[i]) : null}
              selected={selected === station.id}
              selectedTag={selectedTag}
              isConstraint={constraint === station.id || bottlenecks.includes(station.id)}
              constraintTag={constraint === station.id ? 'Constraint' : bottleneckTag}
              onSelect={onSelect}
            />
          </g>
        )
      })}
      {snapshot.shop && model.market ? (
        <ShopCounter x={binCell.x} y={binCell.y} boxTop={binTop} boxHeight={binBoxHeight} shop={snapshot.shop} market={model.market} products={products} palette={palette} t={snapshot.t} />
      ) : (
        <ShippedBin x={binCell.x} y={binCell.y} boxTop={binTop} boxHeight={binBoxHeight} shipped={snapshot.shipped} shippedBy={snapshot.shippedBy} products={products} palette={palette} />
      )}
    </svg>
  )
}

// A station's badge on its own, in its color and with its picture, as free play's editor shows it.
export function StationMark({ index, kind }: { index: number; kind: string }) {
  return (
    <svg className="station-mark" viewBox="0 0 40 40" aria-hidden="true">
      <circle className="mark" cx={20} cy={20} r={18.5} fill={ACCENTS[index % ACCENTS.length]} />
      <StationGlyph kind={kind} x={20} y={20} size={28} />
    </svg>
  )
}

interface ShopProps {
  x: number
  y?: number
  boxTop?: number
  boxHeight: number
  shop: Shop
  market: Market
  products: Product[]
  palette: Palette
  t: number
}

// The shop counter at the end of the line: its sign, the shelf (by product when there are several),
// and the customers who bought or left without buying.
function ShopCounter({ x, y = 0, boxTop = BOX_TOP, boxHeight, shop, market, products, palette, t }: ShopProps) {
  const left = x + 14
  const center = x + BIN / 2
  const tag = y + TAG_Y
  const top = y + boxTop
  const open = t >= market.opens && t < market.closes
  const sign = t < market.opens ? `Opens at ${clockTime(market.opens)}` : open ? 'Open' : 'Closed'
  const soldOut = open && shop.shelf === 0
  const byProduct = products.length > 0 && shop.shelfBy
  const salesY = top + boxHeight - (byProduct ? 34 : 30)
  const shelf = byProduct ? products.map((p) => `${shop.shelfBy?.[p.id] ?? 0} ${p.name.toLowerCase()}`).join(', ') : `${shop.shelf}`
  return (
    <g className="shipped shop" aria-label={`Shop ${sign.toLowerCase()}: on the shelf ${shelf}; ${shop.sold} sold, ${shop.lost} turned away`}>
      <g className={`shop-sign${open ? ' open' : ''}`}>
        <rect x={center - 75} y={tag - 18} width={150} height={36} rx={18} />
        <text x={center} y={tag + 7}>
          {sign}
        </text>
      </g>
      <rect className="bin" x={left} y={top} width={BIN - 28} height={boxHeight} rx={24} />
      <text className="bin-label" x={center} y={top + 32}>
        On the shelf
      </text>
      {byProduct ? (
        products.map((product, k) => {
          const count = shop.shelfBy?.[product.id] ?? 0
          return (
            <g key={product.id} className={`bin-product tight${open && count === 0 ? ' empty' : ''}`}>
              <rect x={left + 14} y={top + 46 + k * 22} width={14} height={14} rx={3} style={{ fill: palette.color(product.id) }} />
              <text x={left + 33} y={top + 58 + k * 22}>
                {count} {product.name.toLowerCase()}
              </text>
            </g>
          )
        })
      ) : (
        <text className={`bin-count compact${soldOut ? ' empty' : ''}`} x={center} y={top + 80}>
          {shop.shelf}
        </text>
      )}
      <text className="sales" x={center} y={salesY}>
        {shop.sold} sold
      </text>
      <text className={`sales${shop.lost > 0 ? ' lost' : ''}`} x={center} y={salesY + 21}>
        {shop.lost} turned away
      </text>
    </g>
  )
}

// The bin at the end of the line, counting what shipped, by product when the line makes several.
function ShippedBin({
  x,
  y,
  boxTop = BOX_TOP,
  boxHeight,
  shipped,
  shippedBy,
  products,
  palette,
}: {
  x: number
  y: number
  boxTop?: number
  boxHeight: number
  shipped: number
  shippedBy?: Record<string, number>
  products: Product[]
  palette: Palette
}) {
  const left = x + 14
  const center = x + BIN / 2
  const top = y + boxTop
  // Three or more products need tighter lines to fit the bin.
  const many = products.length > 2
  return (
    <g className="shipped" aria-label={`Shipped: ${shipped}`}>
      <rect className="bin" x={left} y={top} width={BIN - 28} height={boxHeight} rx={24} />
      {shippedBy ? (
        <>
          <text className="bin-label" x={center} y={top + (many ? 32 : 38)}>
            Shipped
          </text>
          <text className="bin-count compact" x={center} y={top + (many ? 76 : 88)}>
            {shipped}
          </text>
          {products.map((product, k) => (
            <g key={product.id} className={`bin-product${many ? ' tight' : ''}`}>
              <rect
                x={left + (many ? 16 : 22)}
                y={top + (many ? 88 + k * 20 : 106 + k * 24)}
                width={14}
                height={14}
                rx={3}
                style={{ fill: palette.color(product.id) }}
              />
              <text x={left + (many ? 36 : 44)} y={top + (many ? 100 + k * 20 : 119 + k * 24)}>
                {shippedBy[product.id] ?? 0} {shortName(product.name)}
              </text>
            </g>
          ))}
        </>
      ) : (
        <>
          <text className="bin-label" x={center} y={top + 44}>
            Shipped
          </text>
          <text className="bin-count" x={center} y={top + 112}>
            {shipped}
          </text>
        </>
      )}
    </g>
  )
}

// Every part in a pile or at work, in one layer keyed by job: a part keeps its element from pile to
// station to the next pile, so as the shift plays it slides between them instead of jumping (spec
// §4.4). A part at work is hidden behind its station's box, fading out as it goes in and in as it
// comes out.
function Parts({
  snapshot,
  palette,
  cell,
  pileColumns,
  pileRows,
  block,
  gap,
  pileBottom,
  boxTop,
}: {
  snapshot: Snapshot
  palette: Palette
  cell: (i: number) => { x: number; y: number }
  pileColumns: number
  pileRows: number
  block: number
  gap: number
  pileBottom: number
  boxTop: number
}) {
  const parts: { job: number; x: number; y: number; inside: boolean }[] = []
  snapshot.waiting.forEach((jobs, i) => {
    const origin = cell(i)
    const pileLeft = origin.x + COLUMN / 2 - (pileColumns * block + (pileColumns - 1) * gap) / 2
    jobs.slice(0, pileColumns * pileRows).forEach((job, k) => {
      const row = Math.floor(k / pileColumns)
      parts.push({ job, x: pileLeft + (k % pileColumns) * (block + gap), y: origin.y + pileBottom - (row + 1) * block - row * gap, inside: false })
    })
  })
  snapshot.working.forEach((jobs, i) => {
    const origin = cell(i)
    for (const { job } of jobs) parts.push({ job, x: origin.x + COLUMN / 2 - block / 2, y: origin.y + boxTop + 26, inside: true })
  })
  // In job order, which never changes, so elements are never moved in the page and their slides run on.
  parts.sort((a, b) => a.job - b.job)
  return (
    <g className="parts" aria-hidden="true">
      {parts.map(({ job, x, y, inside }) => {
        const color = jobColor(palette, job)
        return (
          <rect
            key={job}
            className={`part${palette.isRush(job) ? ' rush' : ''}${inside ? ' inside' : ''}`}
            style={{ transform: `translate(${x}px, ${y}px)`, fill: color }}
            width={block}
            height={block}
            rx={6}
          />
        )
      })}
    </g>
  )
}

// A rope from the station it's tied to back to the start of the line: new work goes in only
// when fewer than `length` are on their way to that station.
function Rope({ tiedTo, length, name, unit }: { tiedTo: number; length: number; name: string; unit: string }) {
  const start = tiedTo * COLUMN + COLUMN / 2 + (tiedTo === 0 ? 50 : 0)
  const end = COLUMN / 2 - 50
  const high = -24
  const d = `M${start} 10V${high + 14}q0-14-14-14H${end + 14}q-14 0-14 14V30`
  return (
    <g className="rope" role="img" aria-label={`Rope tied to ${name}: at most ${length} ${unit} on their way to it`}>
      <path className="strand" d={d} />
      <path className="twist" d={d} />
      <path className="head" d={`M${end - 11} 24l11 14 11-14z`} />
      <circle className="knot" cx={start} cy={10} r={8} />
      <text x={(start + end) / 2} y={high - 12}>
        Rope: {length} {unit}
      </text>
    </g>
  )
}

// The rope on the wrapped phone floor: it runs out to the nearest side, up over the rows, and down
// into the first station, so the tie still reads as feeding the start of the line.
function MobileRope({
  tiedTo,
  length,
  name,
  unit,
  cell,
  width,
}: {
  tiedTo: number
  length: number
  name: string
  unit: string
  cell: (i: number) => { x: number; y: number }
  width: number
}) {
  const tied = cell(tiedTo)
  const first = cell(0)
  const onLeft = tied.x < width / 2
  const sideX = onLeft ? tied.x + 18 : tied.x + COLUMN - 18
  const laneX = onLeft ? 10 : width - 10
  const targetX = first.x + 50
  const startY = tied.y + 10
  const endY = first.y + 30
  const high = -24
  const d = `M${sideX} ${startY}H${laneX}V${high}H${targetX}V${endY}`
  const labelX = Math.max(90, Math.min(width - 90, (laneX + targetX) / 2))
  return (
    <g className="rope" role="img" aria-label={`Rope tied to ${name}: at most ${length} ${unit} on their way to it`}>
      <path className="strand" d={d} />
      <path className="twist" d={d} />
      <path className="head" d={`M${targetX - 11} ${endY - 6}l11 14 11-14z`} />
      <circle className="knot" cx={sideX} cy={startY} r={8} />
      <text x={labelX} y={high - 12}>
        Rope: {length} {unit}
      </text>
    </g>
  )
}

// The belt's way from the end of one wrapped row back to the start of the next.
function turnPath(fromX: number, fromY: number, laneY: number, toY: number, width: number): string {
  const right = width - 7
  const left = 7
  const r = 18
  return `M${fromX} ${fromY}H${right - r}Q${right} ${fromY} ${right} ${fromY + r}V${laneY - r}Q${right} ${laneY} ${right - r} ${laneY}H${left + r}Q${left} ${laneY} ${left} ${laneY + r}V${toY - r}Q${left} ${toY} ${left + r} ${toY}H${24}`
}

interface ColumnProps {
  x: number
  station: Station
  boxTop: number
  pileBottom: number
  boxHeight: number
  cartSpace: number
  height: number
  palette: Palette
  compact?: boolean
  // Finished work waiting in this station's cart, when it moves work in batches.
  cart: number[] | null
  accent: string
  waiting: number[]
  working: ActiveJob[]
  made: number
  t: number
  // A breakdown or jam shows at once; a break, or running out of material, once the station stops.
  stopped: Stop | null
  // Why it stopped, in place of the usual words: "No operator", "Power cut".
  why: string | null
  brokenUntil: number | null
  // Units scrapped here, at a station that inspects or spoils units after a changeover, or sent back
  // for rework, and where to.
  scrapped: number | null
  sentBack: { count: number; to: string } | null
  scrapY: number
  // The stockroom in front of the first station, when the line uses materials.
  stock: { count: number; name: string } | null
  badges: Badge[]
  buildingAt: number
  zone: Zone | null
  selected: boolean
  selectedTag: string
  isConstraint: boolean
  constraintTag: string
  onSelect?: (stationId: string) => void
}

type Stop = 'broken' | 'jammed' | 'break' | 'starved'

const stopLabel: Record<Stop, string> = { broken: 'Broken down', jammed: 'Jammed', break: 'On break', starved: 'No material' }

function StationColumn(props: ColumnProps) {
  const { x, station, boxTop, pileBottom, boxHeight, cartSpace, height, palette, cart, accent, working, made, t, stopped, badges, buildingAt, zone, selected, isConstraint, onSelect, compact = false } = props
  const { why, brokenUntil, scrapped, sentBack, scrapY, stock } = props
  const { id, name, machines } = station
  const waiting = props.waiting.length
  const center = x + COLUMN / 2
  const top = boxTop
  const busy = working.length > 0
  const job = working[0]
  const changing = job !== undefined && t < job.ready
  const progress = job ? progressOf(job, t) : 0
  // A jam or breakdown shows at once, even while the part in hand finishes; a break, or running out of
  // material, once the station stops.
  const running = changing ? 'Changeover' : working.length > 1 ? `${working.length} working` : 'Working'
  const halted = stopped === 'jammed' || stopped === 'broken'
  const status = halted ? (why ?? stopLabel[stopped]) : busy ? running : stopped ? (why ?? stopLabel[stopped]) : 'Waiting'
  const light = halted ? ' jammed' : changing ? ' changing' : busy ? ' on' : stopped === 'break' ? ' resting' : stopped === 'starved' ? ' starved' : ''
  const tag = isConstraint ? props.constraintTag : selected ? props.selectedTag : null
  const classes = ['station', onSelect && 'selectable', selected && 'selected', isConstraint && 'constraint'].filter(Boolean).join(' ')
  const extras = [
    ...(machines ?? []).map((machine, m) => {
      const job = working.find((w) => w.machine === m)
      const allowed = machine.products ? `, ${machine.products.map((p) => `${palette.name(p)}s`).join(' and ').toLowerCase()} only` : ''
      const product = job && palette.productOf(job.job)
      const doing = job ? `working${product ? ` on a ${palette.name(product).toLowerCase()}` : ''}` : 'idle'
      return `${machine.name}${allowed}: ${doing}`
    }),
    zone && `buffer ${zoneLabel[zone]}`,
    brokenUntil !== null && `${(why ?? 'broken down').toLowerCase()} until ${clockTime(brokenUntil)}`,
    stock && `${stock.count} ${stock.name} in the stockroom`,
    scrapped !== null && `${scrapped} scrapped`,
    sentBack && `${sentBack.count} sent back to ${sentBack.to}`,
    badges.includes('upgraded') && 'upgraded',
    badges.includes('covered') && 'works through breaks',
    badges.includes('steadied') && 'standard work',
    badges.includes('maintained') && 'maintained, no jams',
    badges.includes('quick') && 'quick changeovers',
    cart && `${cart.length} in the cart`,
  ].filter(Boolean)
  const countClass = zone ? ` zone-${zone}` : waiting >= buildingAt ? ' building' : ''

  return (
    <g
      className={classes}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      aria-pressed={onSelect ? selected : undefined}
      aria-label={`${name}: ${waiting} parts waiting, ${status.toLowerCase()}, made ${made}${extras.length ? `, ${extras.join(', ')}` : ''}`}
      onClick={() => onSelect?.(id)}
      onKeyDown={(event) => {
        if (onSelect && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault()
          onSelect(id)
        }
      }}
    >
      <rect className="hit" x={x} y={0} width={COLUMN} height={height} />
      <text className={`pile-count${countClass}`} x={center} y={pileBottom + (compact ? 18 : 26)}>
        {waiting} waiting
      </text>
      <rect className="station-box" x={x + 16} y={top} width={COLUMN - 32} height={boxHeight} rx={24} />
      {machines ? (
        <>
          <circle className="badge" cx={compact ? x + 42 : x + 46} cy={top + (compact ? 24 : 30)} r={compact ? 17 : 19} fill={accent} />
          <StationGlyph kind={id} x={compact ? x + 42 : x + 46} y={top + (compact ? 24 : 30)} size={compact ? 22 : 26} />
          <text className="station-name compact" x={compact ? x + 64 : x + 74} y={top + (compact ? 32 : 39)}>
            {name}
          </text>
          {machines.map((machine, m) => (
            <MachineRow
              key={machine.name}
              x={x}
              y={top + (compact ? COMPACT_MACHINE_TOP : MACHINE_TOP) + m * (compact ? COMPACT_MACHINE_ROW : MACHINE_ROW)}
              machine={machine}
              job={working.find((w) => w.machine === m)}
              t={t}
              stopped={stopped}
              palette={palette}
              compact={compact}
            />
          ))}
        </>
      ) : (
        <>
          <circle className="badge" cx={center} cy={top + (compact ? 24 : 38)} r={compact ? 17 : 25} fill={accent} />
          <StationGlyph kind={id} x={center} y={top + (compact ? 24 : 38)} size={compact ? 22 : 34} />
          <text className="station-name" x={center} y={top + (compact ? 58 : 94)}>
            {name}
          </text>
          <circle className={`light${light}`} cx={center - (compact ? 50 : 54)} cy={top + (compact ? 76 : 115)} r={compact ? 6 : 7} />
          <text className={`status${status.length > 9 ? ' long' : ''}`} x={center - (compact ? 37 : 41)} y={top + (compact ? 82 : 122)}>
            {status}
          </text>
          <rect className="progress-track" x={center - (compact ? 60 : 56)} y={top + (compact ? 94 : 132)} width={compact ? 120 : 112} height={compact ? 6 : 8} rx={compact ? 3 : 4} />
          <rect className={`progress-fill${changing ? ' changing' : ''}`} x={center - (compact ? 60 : 56)} y={top + (compact ? 94 : 132)} width={(compact ? 120 : 112) * progress} height={compact ? 6 : 8} rx={compact ? 3 : 4} />
        </>
      )}
      {cart && <Cart x={center} y={top + boxHeight + (compact ? 6 : 10)} jobs={cart} palette={palette} />}
      <text className="made" x={center} y={top + boxHeight + (compact ? (cart ? 28 : 22) : cartSpace + 34)}>
        Made {made}
      </text>
      {scrapped !== null && (
        <text className="scrapped" x={center} y={scrapY}>
          Scrapped {scrapped}
        </text>
      )}
      {sentBack && (
        <text className="sent-back" x={center} y={scrapY}>
          Sent back {sentBack.count}
        </text>
      )}
      {stock && (
        // Right of center, clear of a rope coming down into the first station.
        <g className={`stockroom${stock.count === 0 ? ' empty' : ''}`}>
          <rect x={center - 32} y={TAG_Y - 18} width={132} height={36} rx={18} />
          <text x={center + 34} y={TAG_Y + 7}>
            {stock.count} {stock.name}
          </text>
        </g>
      )}
      {badges.includes('covered') && <CornerBadge kind="covered" cx={x + 32} cy={top + 4} />}
      {badges.includes('maintained') && <CornerBadge kind="maintained" cx={x + 32} cy={top + 4} />}
      {badges.includes('quick') && <CornerBadge kind="quick" cx={x + 32} cy={top + 4} />}
      {badges.includes('upgraded') && <CornerBadge kind="upgraded" cx={x + COLUMN - 32} cy={top + 4} />}
      {badges.includes('steadied') && <CornerBadge kind="steadied" cx={x + COLUMN - 32} cy={top + 4} />}
      {tag && (
        <g className={`tag ${isConstraint ? 'constraint' : 'pick'}`}>
          <rect x={center - 78} y={TAG_Y - 18} width={156} height={36} rx={18} />
          <text x={center} y={TAG_Y + 7}>
            {tag}
          </text>
        </g>
      )}
    </g>
  )
}

interface MachineRowProps {
  x: number
  y: number
  machine: Machine
  job: ActiveJob | undefined
  t: number
  stopped: Stop | null
  palette: Palette
  compact?: boolean
}

// A product's name short enough for the shipped bin: "posters" for Poster, "orange" for Orange blossom.
function shortName(name: string): string {
  const words = name.toLowerCase().split(' ')
  return words.length > 1 ? words[0] : `${words[0]}s`
}

// How far along a job is: its changeover first, if it has one, then the work itself.
function progressOf(job: ActiveJob, t: number): number {
  if (t < job.ready) return (t - job.start) / (job.ready - job.start)
  return Math.min(1, (t - job.ready) / (job.end - job.ready))
}

// Finished work waiting to move on together, drawn as a row of small blocks in a cart.
function Cart({ x, y, jobs, palette }: { x: number; y: number; jobs: number[]; palette: Palette }) {
  const shown = jobs.slice(0, 10)
  const width = 10 * CART_BLOCK + 9 * 3
  const left = x - width / 2
  return (
    <g className="cart" aria-hidden="true">
      <rect className="cart-tray" x={left - 6} y={y - 4} width={width + 12} height={CART_BLOCK + 8} rx={6} />
      {shown.map((job, k) => {
        const color = jobColor(palette, job)
        return (
          <rect
            key={job}
            className="part"
            style={color ? { fill: color } : undefined}
            x={left + k * (CART_BLOCK + 3)}
            y={y}
            width={CART_BLOCK}
            height={CART_BLOCK}
            rx={3}
          />
        )
      })}
    </g>
  )
}

// One machine: its light, its name, the products it may run, and the job it's working on.
function MachineRow({ x, y, machine, job, t, stopped, palette, compact = false }: MachineRowProps) {
  const changing = job !== undefined && t < job.ready
  const progress = job ? progressOf(job, t) : 0
  const halted = stopped === 'jammed' || stopped === 'broken'
  const light = halted ? ' jammed' : changing ? ' changing' : job ? ' on' : stopped === 'break' ? ' resting' : stopped === 'starved' ? ' starved' : ''
  const allowed = machine.products ?? palette.all
  const fill = job ? jobColor(palette, job.job) : undefined
  const barWidth = COLUMN - (compact ? 64 : 68)
  return (
    <g className="machine">
      <circle className={`light${light}`} cx={x + 38} cy={y + 9} r={6} />
      <text className="machine-name" x={x + 50} y={y + 15}>
        {machine.name}
      </text>
      {allowed.map((product, k) => (
        <rect
          key={product}
          className="product-dot"
          x={x + COLUMN - 38 - (allowed.length - 1 - k) * 15}
          y={y + 3}
          width={12}
          height={12}
          rx={3}
          style={{ fill: palette.color(product) }}
        />
      ))}
      <rect className="progress-track" x={x + 34} y={y + 21} width={barWidth} height={5} rx={2.5} />
      <rect
        className={`progress-fill${changing ? ' changing' : ''}`}
        x={x + 34}
        y={y + 21}
        width={barWidth * progress}
        height={5}
        rx={2.5}
        style={fill && !changing ? { fill } : undefined}
      />
    </g>
  )
}

function CornerBadge({ kind, cx, cy }: { kind: Badge; cx: number; cy: number }) {
  return (
    <g className={`corner ${kind}`}>
      <circle className="ring" cx={cx} cy={cy} r={19} />
      {kind === 'upgraded' && <path d={`M${cx + 2} ${cy - 12}l-9 14h7l-2 10 9-14h-7z`} />}
      {kind === 'covered' && (
        <>
          <circle cx={cx} cy={cy} r={10} className="face" />
          <path d={`M${cx} ${cy - 6}v6l4 3`} className="hands" />
        </>
      )}
      {kind === 'steadied' && <path className="bars" d={`M${cx - 9} ${cy - 6}h18M${cx - 9} ${cy}h18M${cx - 9} ${cy + 6}h18`} />}
      {kind === 'maintained' && <path className="wrench" transform={`translate(${cx - 12} ${cy - 12})`} d={WRENCH} />}
      {kind === 'quick' && <path className="swap" d={`M${cx - 9} ${cy - 4}h15l-4-4M${cx + 9} ${cy + 4}h-15l4 4`} />}
    </g>
  )
}

function clockTime(minutes: number) {
  return `${Math.floor(minutes / 60)}:${String(Math.floor(minutes % 60)).padStart(2, '0')}`
}
