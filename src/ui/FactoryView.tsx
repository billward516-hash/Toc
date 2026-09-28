import type { FactoryModel } from '../engine/model.ts'
import type { ActiveJob, Snapshot } from '../engine/timeline.ts'
import { StationGlyph } from './icons.tsx'

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
const BUILDING = 5
const ACCENTS = ['#4c8dff', '#8a5cf6', '#ff6fb5', '#2ec5e6', '#ff8a3d', '#6a7bff']

interface FactoryViewProps {
  model: FactoryModel
  snapshot: Snapshot
  selected: string | null
  constraint: string | null
  onSelect?: (stationId: string) => void
}

export function FactoryView({ model, snapshot, selected, constraint, onSelect }: FactoryViewProps) {
  const count = model.stations.length
  const width = count * COLUMN + BIN
  const beltY = BOX_TOP + 62
  return (
    <svg className="factory" viewBox={`0 0 ${width} ${HEIGHT}`} role="group" aria-label="Factory floor">
      <rect className="conveyor" x={24} y={beltY} width={width - 48} height={14} rx={7} />
      {Array.from({ length: count }, (_, i) => (
        <path key={i} className="arrow" d={`M${(i + 1) * COLUMN - 7} ${beltY - 7}l12 14-12 14`} />
      ))}
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

interface ColumnProps {
  x: number
  id: string
  name: string
  accent: string
  waiting: number
  working: ActiveJob[]
  made: number
  t: number
  selected: boolean
  isConstraint: boolean
  onSelect?: (stationId: string) => void
}

function StationColumn({ x, id, name, accent, waiting, working, made, t, selected, isConstraint, onSelect }: ColumnProps) {
  const center = x + COLUMN / 2
  const pileLeft = center - PILE_WIDTH / 2
  const shown = Math.min(waiting, PILE_COLUMNS * PILE_ROWS)
  const busy = working.length > 0
  const job = working[0]
  const progress = job ? Math.min(1, (t - job.start) / (job.end - job.start)) : 0
  const status = !busy ? 'Waiting' : working.length > 1 ? `${working.length} working` : 'Working'
  const tag = isConstraint ? 'Constraint' : selected ? 'Your pick' : null
  const classes = ['station', onSelect && 'selectable', selected && 'selected', isConstraint && 'constraint'].filter(Boolean).join(' ')

  return (
    <g
      className={classes}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      aria-pressed={onSelect ? selected : undefined}
      aria-label={`${name}: ${waiting} parts waiting, ${busy ? 'working' : 'waiting for parts'}, made ${made}`}
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
        className="waiting-area"
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
      <text className={`pile-count${waiting >= BUILDING ? ' building' : ''}`} x={center} y={PILE_BOTTOM + 26}>
        {waiting} waiting
      </text>
      <rect className="station-box" x={x + 16} y={BOX_TOP} width={COLUMN - 32} height={BOX_HEIGHT} rx={24} />
      <circle className="badge" cx={center} cy={BOX_TOP + 38} r={25} fill={accent} />
      <StationGlyph kind={id} x={center} y={BOX_TOP + 38} size={34} />
      <text className="station-name" x={center} y={BOX_TOP + 94}>
        {name}
      </text>
      <circle className={`light${busy ? ' on' : ''}`} cx={center - 46} cy={BOX_TOP + 115} r={7} />
      <text className="status" x={center - 32} y={BOX_TOP + 122}>
        {status}
      </text>
      <rect className="progress-track" x={center - 56} y={BOX_TOP + 132} width={112} height={8} rx={4} />
      <rect className="progress-fill" x={center - 56} y={BOX_TOP + 132} width={112 * progress} height={8} rx={4} />
      <text className="made" x={center} y={BOX_TOP + BOX_HEIGHT + 34}>
        Made {made}
      </text>
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
