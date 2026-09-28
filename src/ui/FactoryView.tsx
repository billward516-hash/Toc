import { onBreak, type FactoryModel } from '../engine/model.ts'
import type { ActiveJob, Snapshot, Zone } from '../engine/timeline.ts'
import { StationGlyph, WRENCH } from './icons.tsx'

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
const HEIGHT = BOX_TOP + BOX_HEIGHT + 50
// Room above the line for a rope.
const ROPE_SPACE = 58
const ACCENTS = ['#4c8dff', '#8a5cf6', '#ff6fb5', '#2ec5e6', '#ff8a3d', '#6a7bff']

export type Badge = 'upgraded' | 'covered' | 'steadied' | 'maintained'

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
  onSelect?: (stationId: string) => void
}

const zoneLabel: Record<Zone, string> = { dry: 'running dry', healthy: 'healthy', flooding: 'flooding' }

export function FactoryView(props: FactoryViewProps) {
  const { model, snapshot, selected = null, constraint = null, badges = {}, buildingAt = 5, buffer = null, onSelect } = props
  const count = model.stations.length
  const width = count * COLUMN + BIN
  const beltY = BOX_TOP + 62
  const { release } = model
  const tiedTo = release.kind === 'rope' ? model.stations.findIndex((s) => s.id === release.constraint) : -1
  const top = tiedTo >= 0 ? -ROPE_SPACE : 0
  const zoneOf = (waiting: number): Zone | null =>
    buffer === null ? null : waiting < buffer.low ? 'dry' : waiting > buffer.high ? 'flooding' : 'healthy'
  return (
    <svg className="factory" viewBox={`0 ${top} ${width} ${HEIGHT - top}`} role="group" aria-label="Factory floor">
      <rect className="conveyor" x={24} y={beltY} width={width - 48} height={14} rx={7} />
      {Array.from({ length: count }, (_, i) => (
        <path key={i} className="arrow" d={`M${(i + 1) * COLUMN - 7} ${beltY - 7}l12 14-12 14`} />
      ))}
      {release.kind === 'rope' && tiedTo >= 0 && <Rope tiedTo={tiedTo} length={release.buffer} name={model.stations[tiedTo].name} />}
      {model.stations.map((station, i) => (
        <StationColumn
          key={station.id}
          x={i * COLUMN}
          id={station.id}
          name={station.name}
          accent={ACCENTS[i % ACCENTS.length]}
          waiting={snapshot.queues[i]}
          working={snapshot.working[i]}
          made={snapshot.completed[i]}
          t={snapshot.t}
          stopped={snapshot.jammed[i] ? 'jammed' : onBreak(station, snapshot.t) ? 'break' : null}
          badges={badges[station.id] ?? []}
          buildingAt={buildingAt}
          zone={buffer?.station === station.id ? zoneOf(snapshot.queues[i]) : null}
          selected={selected === station.id}
          isConstraint={constraint === station.id}
          onSelect={onSelect}
        />
      ))}
      <g className="shipped" aria-label={`Shipped: ${snapshot.shipped}`}>
        <rect className="bin" x={count * COLUMN + 14} y={BOX_TOP} width={BIN - 28} height={BOX_HEIGHT} rx={24} />
        <text className="bin-label" x={count * COLUMN + BIN / 2} y={BOX_TOP + 44}>
          Shipped
        </text>
        <text className="bin-count" x={count * COLUMN + BIN / 2} y={BOX_TOP + 112}>
          {snapshot.shipped}
        </text>
      </g>
    </svg>
  )
}

// A rope from the station it's tied to back to the start of the line: a new robot goes in only
// when fewer than `length` are on their way to that station.
function Rope({ tiedTo, length, name }: { tiedTo: number; length: number; name: string }) {
  const start = tiedTo * COLUMN + COLUMN / 2 + (tiedTo === 0 ? 50 : 0)
  const end = COLUMN / 2 - 50
  const high = -24
  const d = `M${start} 10V${high + 14}q0-14-14-14H${end + 14}q-14 0-14 14V30`
  return (
    <g className="rope" role="img" aria-label={`Rope tied to ${name}: at most ${length} robots on their way to it`}>
      <path className="strand" d={d} />
      <path className="twist" d={d} />
      <path className="head" d={`M${end - 11} 24l11 14 11-14z`} />
      <circle className="knot" cx={start} cy={10} r={8} />
      <text x={(start + end) / 2} y={high - 12}>
        Rope: {length} robots
      </text>
    </g>
  )
}

interface ColumnProps {
  x: number
  id: string
  name: string
  accent: string
  waiting: number
  working: ActiveJob[]
  made: number
  t: number
  stopped: 'jammed' | 'break' | null
  badges: Badge[]
  buildingAt: number
  zone: Zone | null
  selected: boolean
  isConstraint: boolean
  onSelect?: (stationId: string) => void
}

function StationColumn(props: ColumnProps) {
  const { x, id, name, accent, waiting, working, made, t, stopped, badges, buildingAt, zone, selected, isConstraint, onSelect } = props
  const center = x + COLUMN / 2
  const pileLeft = center - PILE_WIDTH / 2
  const shown = Math.min(waiting, PILE_COLUMNS * PILE_ROWS)
  const busy = working.length > 0
  const job = working[0]
  const progress = job ? Math.min(1, (t - job.start) / (job.end - job.start)) : 0
  // A jam shows at once, even while the part in hand finishes; a break shows once the station stops.
  const running = working.length > 1 ? `${working.length} working` : 'Working'
  const status = stopped === 'jammed' ? 'Jammed' : busy ? running : stopped === 'break' ? 'On break' : 'Waiting'
  const light = stopped === 'jammed' ? ' jammed' : busy ? ' on' : stopped === 'break' ? ' resting' : ''
  const tag = isConstraint ? 'Constraint' : selected ? 'Your pick' : null
  const classes = ['station', onSelect && 'selectable', selected && 'selected', isConstraint && 'constraint'].filter(Boolean).join(' ')
  const extras = [
    zone && `buffer ${zoneLabel[zone]}`,
    badges.includes('upgraded') && 'upgraded',
    badges.includes('covered') && 'works through breaks',
    badges.includes('steadied') && 'standard work',
    badges.includes('maintained') && 'maintained, no jams',
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
      <rect className="hit" x={x} y={0} width={COLUMN} height={HEIGHT} />
      <rect
        className={`waiting-area${zone ? ` zone-${zone}` : ''}`}
        x={pileLeft - 9}
        y={PILE_BOTTOM - PILE_HEIGHT - 9}
        width={PILE_WIDTH + 18}
        height={PILE_HEIGHT + 18}
        rx={14}
      />
      {Array.from({ length: shown }, (_, k) => {
        const row = Math.floor(k / PILE_COLUMNS)
        return (
          <rect
            key={k}
            className="part"
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
      <rect className="station-box" x={x + 16} y={BOX_TOP} width={COLUMN - 32} height={BOX_HEIGHT} rx={24} />
      <circle className="badge" cx={center} cy={BOX_TOP + 38} r={25} fill={accent} />
      <StationGlyph kind={id} x={center} y={BOX_TOP + 38} size={34} />
      <text className="station-name" x={center} y={BOX_TOP + 94}>
        {name}
      </text>
      <circle className={`light${light}`} cx={center - 46} cy={BOX_TOP + 115} r={7} />
      <text className="status" x={center - 32} y={BOX_TOP + 122}>
        {status}
      </text>
      <rect className="progress-track" x={center - 56} y={BOX_TOP + 132} width={112} height={8} rx={4} />
      <rect className="progress-fill" x={center - 56} y={BOX_TOP + 132} width={112 * progress} height={8} rx={4} />
      <text className="made" x={center} y={BOX_TOP + BOX_HEIGHT + 34}>
        Made {made}
      </text>
      {badges.includes('covered') && <CornerBadge kind="covered" cx={x + 32} cy={BOX_TOP + 4} />}
      {badges.includes('maintained') && <CornerBadge kind="maintained" cx={x + 32} cy={BOX_TOP + 4} />}
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
    </g>
  )
}
