import type { SimResult } from '../engine/simulate.ts'

const COLUMN = 44
const BAR = 30
const LEFT = 12
const TOP = 26
const PLOT = 130

// Several days at the shop counter, one bar each: what sold, what was thrown out, and the customers
// turned away on top, with each day's customer count above its bar and a dashed line at the number
// made when every day made the same.
export function ShopDays({ days, unit }: { days: SimResult[]; unit: string }) {
  const shops = days.flatMap((day) => (day.market ? [day.market] : []))
  const made = shops.map((shop) => shop.sold + shop.waste)
  const top = Math.max(1, ...shops.map((shop) => shop.sold + shop.waste + shop.lost))
  const height = (value: number) => (value / top) * PLOT
  const base = TOP + PLOT
  const width = LEFT * 2 + shops.length * COLUMN
  const plan = made.every((value) => value === made[0]) ? made[0] : null
  const label = `Customers each day: ${shops.map((shop) => shop.customers).join(', ')}.${plan === null ? '' : ` ${plan} ${unit} made each day.`}`
  return (
    <figure className="shop-days">
      <svg viewBox={`0 0 ${width} ${base + 24}`} role="img" aria-label={label}>
        {shops.map((shop, k) => {
          const x = LEFT + k * COLUMN + (COLUMN - BAR) / 2
          const sold = height(shop.sold)
          const waste = height(shop.waste)
          const lost = height(shop.lost)
          return (
            <g key={k}>
              <rect className="sold" x={x} y={base - sold} width={BAR} height={sold} />
              {shop.waste > 0 && <rect className="waste" x={x} y={base - sold - waste} width={BAR} height={waste} />}
              {shop.lost > 0 && <rect className="lost" x={x} y={base - sold - waste - lost} width={BAR} height={lost} />}
              <text className="count" x={x + BAR / 2} y={base - sold - waste - lost - 6}>
                {shop.customers}
              </text>
              <text className="day" x={x + BAR / 2} y={base + 18}>
                {k + 1}
              </text>
            </g>
          )
        })}
        <line className="axis" x1={LEFT} x2={width - LEFT} y1={base} y2={base} />
        {plan !== null && <line className="plan" x1={LEFT} x2={width - LEFT} y1={base - height(plan)} y2={base - height(plan)} />}
      </svg>
      <figcaption>
        <span>
          <i className="swatch sold" /> Sold
        </span>
        <span>
          <i className="swatch waste" /> Thrown out
        </span>
        <span>
          <i className="swatch lost" /> Turned away
        </span>
        {plan !== null && (
          <span>
            <i className="swatch plan" /> {plan} made
          </span>
        )}
      </figcaption>
    </figure>
  )
}
