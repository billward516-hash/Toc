import { breakAt, type FactoryModel, type Machine, type Market, type Product, type Station } from '../engine/model.ts'
import type { ActiveJob, Shop, Snapshot, Zone } from '../engine/timeline.ts'
import { StationGlyph, WRENCH } from './icons.tsx'
import { productColor, productName } from './products.ts'

const COLUMN = 200
const BIN = 190
const TAG_Y = 22
const BLOCK = 24
const GAP = 5
const PILE_COLUMNS = 5
const PILE_ROWS = 4
const PILE_WIDTH = PILE_COLUMNS * BLOCK + (PILE_COLUMNS - 1) * GAP
const PILE_HEIGHT = PILE_ROWS * BLOCK + (PILE_ROWS - 1) * GAP
const PILE_BOTTOM = 160
const BOX_TOP = PILE_BOTTOM + 42
const BOX_HEIGHT = 150
const SCRAP_SPACE = 26
// A station with named machines lists them in rows under its name.
const MACHINE_TOP = 58
const MACHINE_ROW = 31
// Room under the stations for carts of finished work.
const CART_SPACE = 30
const CART_BLOCK = 12
// Room above the line for a rope.
const ROPE_SPACE = 58
const ACCENTS = ['#4c8dff', '#8a5cf6', '#ff6fb5', '#2ec5e6', '#ff8a3d', '#6a7bff']

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

export function FactoryView(props: FactoryViewProps) {
  const { model, snapshot, selected = null, constraint = null, badges = {}, buildingAt = 5, buffer = null, jobProducts, unit = 'robots', rushJobs, onSelect } = props
  const { selectedTag = 'Your pick' } = props
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
  const binLeft = count * COLUMN + 14
  // Three or more products need tighter lines to fit the bin.
  const products = model.products ?? []
  const many = products.length > 2
  return (
    <svg className="factory" viewBox={`0 ${top} ${width} ${height - top}`} role="group" aria-label="Factory floor">
      <rect className="conveyor" x={24} y={beltY} width={width - 48} height={14} rx={7} />
      {Array.from({ length: count }, (_, i) => (
        <path key={i} className="arrow" d={`M${(i + 1) * COLUMN - 7} ${beltY - 7}l12 14-12 14`} />
      ))}
      {release.kind === 'rope' && tiedTo >= 0 && <Rope tiedTo={tiedTo} length={release.buffer} name={model.stations[tiedTo].name} unit={unit} />}
      {model.stations.map((station, i) => {
        const pause = breakAt(station, snapshot.t)
        return (
          <StationColumn
            key={station.id}
            x={i * COLUMN}
            station={station}
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
            isConstraint={constraint === station.id}
            onSelect={onSelect}
          />
        )
      })}
      {snapshot.shop && model.market ? (
        <ShopCounter x={count * COLUMN} boxHeight={boxHeight} shop={snapshot.shop} market={model.market} products={products} palette={palette} t={snapshot.t} />
      ) : (
        <g className="shipped" aria-label={`Shipped: ${snapshot.shipped}`}>
          <rect className="bin" x={binLeft} y={BOX_TOP} width={BIN - 28} height={boxHeight} rx={24} />
          {snapshot.shippedBy ? (
            <>
              <text className="bin-label" x={count * COLUMN + BIN / 2} y={BOX_TOP + (many ? 32 : 38)}>
                Shipped
              </text>
              <text className="bin-count compact" x={count * COLUMN + BIN / 2} y={BOX_TOP + (many ? 76 : 88)}>
                {snapshot.shipped}
              </text>
              {products.map((product, k) => (
                <g key={product.id} className={`bin-product${many ? ' tight' : ''}`}>
                  <rect
                    x={binLeft + (many ? 16 : 22)}
                    y={BOX_TOP + (many ? 88 + k * 20 : 106 + k * 24)}
                    width={14}
                    height={14}
                    rx={3}
                    style={{ fill: palette.color(product.id) }}
                  />
                  <text x={binLeft + (many ? 36 : 44)} y={BOX_TOP + (many ? 100 + k * 20 : 119 + k * 24)}>
                    {snapshot.shippedBy?.[product.id] ?? 0} {shortName(product.name)}
                  </text>
                </g>
              ))}
            </>
          ) : (
            <>
              <text className="bin-label" x={count * COLUMN + BIN / 2} y={BOX_TOP + 44}>
                Shipped
              </text>
              <text className="bin-count" x={count * COLUMN + BIN / 2} y={BOX_TOP + 112}>
                {snapshot.shipped}
              </text>
            </>
          )}
        </g>
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
  boxHeight: number
  shop: Shop
  market: Market
  products: Product[]
  palette: Palette
  t: number
}

// The shop counter at the end of the line: its sign, the shelf (by product when there are several),
// and the customers who bought or left without buying.
function ShopCounter({ x, boxHeight, shop, market, products, palette, t }: ShopProps) {
  const left = x + 14
  const center = x + BIN / 2
  const open = t >= market.opens && t < market.closes
  const sign = t < market.opens ? `Opens at ${clockTime(market.opens)}` : open ? 'Open' : 'Closed'
  const soldOut = open && shop.shelf === 0
  const byProduct = products.length > 0 && shop.shelfBy
  const salesY = BOX_TOP + boxHeight - (byProduct ? 34 : 30)
  const shelf = byProduct ? products.map((p) => `${shop.shelfBy?.[p.id] ?? 0} ${p.name.toLowerCase()}`).join(', ') : `${shop.shelf}`
  return (
    <g className="shipped shop" aria-label={`Shop ${sign.toLowerCase()}: on the shelf ${shelf}; ${shop.sold} sold, ${shop.lost} turned away`}>
      <g className={`shop-sign${open ? ' open' : ''}`}>
        <rect x={center - 75} y={TAG_Y - 18} width={150} height={36} rx={18} />
        <text x={center} y={TAG_Y + 7}>
          {sign}
        </text>
      </g>
      <rect className="bin" x={left} y={BOX_TOP} width={BIN - 28} height={boxHeight} rx={24} />
      <text className="bin-label" x={center} y={BOX_TOP + 32}>
        On the shelf
      </text>
      {byProduct ? (
        products.map((product, k) => {
          const count = shop.shelfBy?.[product.id] ?? 0
          return (
            <g key={product.id} className={`bin-product tight${open && count === 0 ? ' empty' : ''}`}>
              <rect x={left + 14} y={BOX_TOP + 46 + k * 22} width={14} height={14} rx={3} style={{ fill: palette.color(product.id) }} />
              <text x={left + 33} y={BOX_TOP + 58 + k * 22}>
                {count} {product.name.toLowerCase()}
              </text>
            </g>
          )
        })
      ) : (
        <text className={`bin-count compact${soldOut ? ' empty' : ''}`} x={center} y={BOX_TOP + 80}>
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

interface ColumnProps {
  x: number
  station: Station
  boxHeight: number
  cartSpace: number
  height: number
  palette: Palette
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
  onSelect?: (stationId: string) => void
}

type Stop = 'broken' | 'jammed' | 'break' | 'starved'

const stopLabel: Record<Stop, string> = { broken: 'Broken down', jammed: 'Jammed', break: 'On break', starved: 'No material' }

function StationColumn(props: ColumnProps) {
  const { x, station, boxHeight, cartSpace, height, palette, cart, accent, working, made, t, stopped, badges, buildingAt, zone, selected, isConstraint, onSelect } = props
  const { why, brokenUntil, scrapped, sentBack, scrapY, stock } = props
  const { id, name, machines } = station
  const waiting = props.waiting.length
  const center = x + COLUMN / 2
  const pileLeft = center - PILE_WIDTH / 2
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
  const tag = isConstraint ? 'Constraint' : selected ? props.selectedTag : null
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
      <rect
        className={`waiting-area${zone ? ` zone-${zone}` : ''}`}
        x={pileLeft - 9}
        y={PILE_BOTTOM - PILE_HEIGHT - 9}
        width={PILE_WIDTH + 18}
        height={PILE_HEIGHT + 18}
        rx={14}
      />
      {props.waiting.slice(0, PILE_COLUMNS * PILE_ROWS).map((job, k) => {
        const row = Math.floor(k / PILE_COLUMNS)
        const color = jobColor(palette, job)
        return (
          <rect
            key={job}
            className={`part${palette.isRush(job) ? ' rush' : ''}`}
            style={color ? { fill: color } : undefined}
            x={pileLeft + (k % PILE_COLUMNS) * (BLOCK + GAP)}
            y={PILE_BOTTOM - (row + 1) * BLOCK - row * GAP}
            width={BLOCK}
            height={BLOCK}
            rx={6}
          />
        )
      })}
      <text className={`pile-count${countClass}`} x={center} y={PILE_BOTTOM + 26}>
        {waiting} waiting
      </text>
      <rect className="station-box" x={x + 16} y={BOX_TOP} width={COLUMN - 32} height={boxHeight} rx={24} />
      {machines ? (
        <>
          <circle className="badge" cx={x + 46} cy={BOX_TOP + 30} r={19} fill={accent} />
          <StationGlyph kind={id} x={x + 46} y={BOX_TOP + 30} size={26} />
          <text className="station-name compact" x={x + 74} y={BOX_TOP + 39}>
            {name}
          </text>
          {machines.map((machine, m) => (
            <MachineRow
              key={machine.name}
              x={x}
              y={BOX_TOP + MACHINE_TOP + m * MACHINE_ROW}
              machine={machine}
              job={working.find((w) => w.machine === m)}
              t={t}
              stopped={stopped}
              palette={palette}
            />
          ))}
        </>
      ) : (
        <>
          <circle className="badge" cx={center} cy={BOX_TOP + 38} r={25} fill={accent} />
          <StationGlyph kind={id} x={center} y={BOX_TOP + 38} size={34} />
          <text className="station-name" x={center} y={BOX_TOP + 94}>
            {name}
          </text>
          <circle className={`light${light}`} cx={center - 54} cy={BOX_TOP + 115} r={7} />
          <text className={`status${status.length > 9 ? ' long' : ''}`} x={center - 41} y={BOX_TOP + 122}>
            {status}
          </text>
          <rect className="progress-track" x={center - 56} y={BOX_TOP + 132} width={112} height={8} rx={4} />
          <rect className={`progress-fill${changing ? ' changing' : ''}`} x={center - 56} y={BOX_TOP + 132} width={112 * progress} height={8} rx={4} />
        </>
      )}
      {cart && <Cart x={center} y={BOX_TOP + boxHeight + 10} jobs={cart} palette={palette} />}
      <text className="made" x={center} y={BOX_TOP + boxHeight + cartSpace + 34}>
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
      {badges.includes('covered') && <CornerBadge kind="covered" cx={x + 32} cy={BOX_TOP + 4} />}
      {badges.includes('maintained') && <CornerBadge kind="maintained" cx={x + 32} cy={BOX_TOP + 4} />}
      {badges.includes('quick') && <CornerBadge kind="quick" cx={x + 32} cy={BOX_TOP + 4} />}
      {badges.includes('upgraded') && <CornerBadge kind="upgraded" cx={x + COLUMN - 32} cy={BOX_TOP + 4} />}
      {badges.includes('steadied') && <CornerBadge kind="steadied" cx={x + COLUMN - 32} cy={BOX_TOP + 4} />}
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
function MachineRow({ x, y, machine, job, t, stopped, palette }: MachineRowProps) {
  const changing = job !== undefined && t < job.ready
  const progress = job ? progressOf(job, t) : 0
  const halted = stopped === 'jammed' || stopped === 'broken'
  const light = halted ? ' jammed' : changing ? ' changing' : job ? ' on' : stopped === 'break' ? ' resting' : stopped === 'starved' ? ' starved' : ''
  const allowed = machine.products ?? palette.all
  const fill = job ? jobColor(palette, job.job) : undefined
  const barWidth = COLUMN - 68
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
