import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import type { DayCount } from '@/features/history/lib/stats'
import { formatDate, formatWeekday } from '@/lib/date'

/** Brand primary. Validated as a chart mark on the dark surface (lightness band, chroma, 3:1 contrast). */
const SERIES = '#8B5CF6'
const SERIES_ACTIVE = '#A78BFA'
const GRID = 'rgb(148 163 255 / 0.14)'
const AXIS_TEXT = '#A6B0D0'
const TEXT = '#F8FAFC'

interface Datum {
  key: string
  weekday: string
  date: string
  draws: number
  picks: number
  /** Value label shown on the bar; only today's bar carries one. */
  todayLabel: number | ''
}

interface ChartTooltipProps {
  active?: boolean
  payload?: readonly { payload?: Datum }[]
}

function ChartTooltip({ active, payload }: ChartTooltipProps) {
  const datum = payload?.[0]?.payload
  if (!active || !datum) return null
  return (
    <div className="glass-strong rounded-xl px-3 py-2 text-sm shadow-panel">
      <p className="text-xs text-muted-foreground">{datum.date}</p>
      {/* Value leads, label follows. */}
      <p className="mt-0.5 flex items-center gap-2">
        <span aria-hidden className="h-0.5 w-3 rounded-full" style={{ backgroundColor: SERIES }} />
        <span className="tabular font-bold">{datum.draws}</span>
        <span className="text-muted-foreground">ครั้ง</span>
      </p>
      <p className="tabular pl-5 text-xs text-muted-foreground">{datum.picks} รายชื่อ</p>
    </div>
  )
}

interface DrawsChartProps {
  days: readonly DayCount[]
  animate: boolean
}

/** Draws per day as columns: one series, one colour, so the title carries the legend. */
export default function DrawsChart({ days, animate }: DrawsChartProps) {
  const data: Datum[] = days.map((day, index) => ({
    key: day.key,
    weekday: formatWeekday(day.date),
    date: formatDate(day.date),
    draws: day.draws,
    picks: day.picks,
    todayLabel: index === days.length - 1 && day.draws > 0 ? day.draws : '',
  }))

  return (
    <>
      {/* Recharts' accessibility layer makes the plot focusable: arrow keys move the tooltip between days. */}
      <div className="h-56 w-full" role="group" aria-label="กราฟแท่งจำนวนครั้งที่สุ่มในแต่ละวัน">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 18, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis
              dataKey="weekday"
              tickLine={false}
              axisLine={{ stroke: GRID }}
              tick={{ fill: AXIS_TEXT, fontSize: 12 }}
              tickMargin={8}
            />
            <YAxis
              allowDecimals={false}
              width={32}
              tickLine={false}
              axisLine={false}
              tick={{ fill: AXIS_TEXT, fontSize: 12 }}
              tickCount={4}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgb(148 163 255 / 0.08)' }} />
            <Bar
              dataKey="draws"
              fill={SERIES}
              activeBar={{ fill: SERIES_ACTIVE }}
              // Rounded data-end, square at the baseline; thin marks with air around them.
              radius={[4, 4, 0, 0]}
              maxBarSize={24}
              isAnimationActive={animate}
              animationDuration={500}
            >
              <LabelList dataKey="todayLabel" position="top" fill={TEXT} fontSize={12} fontWeight={600} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* Table view: the same numbers without the chart. */}
      <table className="sr-only">
        <caption>จำนวนครั้งที่สุ่มในแต่ละวัน</caption>
        <thead>
          <tr>
            <th scope="col">วันที่</th>
            <th scope="col">จำนวนครั้ง</th>
            <th scope="col">จำนวนรายชื่อ</th>
          </tr>
        </thead>
        <tbody>
          {data.map((datum) => (
            <tr key={datum.key}>
              <th scope="row">{datum.date}</th>
              <td>{datum.draws}</td>
              <td>{datum.picks}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
