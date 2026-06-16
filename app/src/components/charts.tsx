import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";

export const CHART = {
  blue: "#1c3d5a",
  sienna: "#b1532a",
  sage: "#4a7a5b",
  ochre: "#9a6b17",
  slate: "#6a7b8c",
  taupe: "#8c8472",
  line: "#e3dccb",
  ink: "#5b5446",
};
export const CHART_SERIES = [CHART.blue, CHART.sienna, CHART.sage, CHART.ochre, CHART.slate, CHART.taupe];

const tip = {
  contentStyle: {
    borderRadius: 8,
    border: "1px solid #e3dccb",
    background: "#fdfbf5",
    boxShadow: "0 12px 32px -8px rgba(26,23,18,.18)",
    fontSize: 12,
    fontFamily: "Schibsted Grotesk, sans-serif",
  },
  labelStyle: { color: "#1a1712", fontWeight: 600 },
  itemStyle: { color: "#5b5446" },
};

export function Sparkline({
  data,
  color = CHART.blue,
  height = 36,
}: {
  data: number[];
  color?: string;
  height?: number;
}) {
  const d = data.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={d} margin={{ top: 3, bottom: 3, left: 0, right: 0 }}>
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.75} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function AreaTrend({
  data,
  xKey,
  series,
  height = 240,
  currency = false,
}: {
  data: any[];
  xKey: string;
  series: { key: string; color: string; label?: string }[];
  height?: number;
  currency?: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 6, right: 8, left: -12, bottom: 0 }}>
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.18} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0.01} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid stroke={CHART.line} vertical={false} />
        <XAxis dataKey={xKey} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: CHART.taupe }} />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: CHART.taupe }}
          width={48}
          tickFormatter={(v) => (currency ? `${(v / 100000).toFixed(0)}L` : `${v}`)}
        />
        <RTooltip {...tip} />
        {series.map((s) => (
          <Area
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label ?? s.key}
            stroke={s.color}
            strokeWidth={2}
            fill={`url(#g-${s.key})`}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function BarSeries({
  data,
  xKey,
  bars,
  height = 240,
  currency = false,
  stacked = false,
}: {
  data: any[];
  xKey: string;
  bars: { key: string; color: string; label?: string }[];
  height?: number;
  currency?: boolean;
  stacked?: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 6, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid stroke={CHART.line} vertical={false} />
        <XAxis dataKey={xKey} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: CHART.taupe }} />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: CHART.taupe }}
          width={48}
          tickFormatter={(v) => (currency ? `${(v / 100000).toFixed(0)}L` : `${v}`)}
        />
        <RTooltip {...tip} cursor={{ fill: "rgba(26,23,18,0.04)" }} />
        {bars.map((b) => (
          <Bar
            key={b.key}
            dataKey={b.key}
            name={b.label ?? b.key}
            fill={b.color}
            radius={stacked ? 0 : [3, 3, 0, 0]}
            stackId={stacked ? "a" : undefined}
            maxBarSize={42}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function Donut({
  data,
  height = 200,
  centerLabel,
  centerValue,
}: {
  data: { name: string; value: number; color: string }[];
  height?: number;
  centerLabel?: string;
  centerValue?: string;
}) {
  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" innerRadius="64%" outerRadius="92%" paddingAngle={2} stroke="none">
            {data.map((d, i) => (
              <Cell key={i} fill={d.color} />
            ))}
          </Pie>
          <RTooltip {...tip} />
        </PieChart>
      </ResponsiveContainer>
      {(centerValue || centerLabel) && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          {centerValue && <span className="font-display text-2xl text-ink tnum">{centerValue}</span>}
          {centerLabel && <span className="label-draft mt-0.5">{centerLabel}</span>}
        </div>
      )}
    </div>
  );
}
