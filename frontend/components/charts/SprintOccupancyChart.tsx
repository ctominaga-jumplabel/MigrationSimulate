"use client";

import { SprintRow } from "@/lib/types";
import { fmtHoras } from "@/lib/format";
import {
  Bar,
  BarChart,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHART, tooltipStyle } from "./theme";

export function SprintOccupancyChart({ data }: { data: SprintRow[] }) {
  const cap = data[0]?.capacidade ?? 0;
  // Amostra para não renderizar milhares de barras (apresentação): primeiros 60.
  const shown = data.slice(0, 60);
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={shown} margin={{ top: 10, right: 8, left: 8, bottom: 0 }}>
        <XAxis
          dataKey="sprint"
          tick={{ fill: CHART.axis, fontSize: 10 }}
          axisLine={{ stroke: CHART.grid }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: CHART.axis, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={48}
          tickFormatter={(v) => new Intl.NumberFormat("pt-BR", { notation: "compact" }).format(v)}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: "rgba(26,20,48,0.04)" }}
          formatter={(v: number) => [fmtHoras(v), "Alocado"]}
          labelFormatter={(l) => `Sprint ${l}`}
        />
        <ReferenceLine
          y={cap}
          stroke={CHART.accent}
          strokeDasharray="4 4"
          label={{
            value: `capacidade ${fmtHoras(cap)}`,
            fill: CHART.accentSoft,
            fontSize: 10,
            position: "insideTopRight",
          }}
        />
        <Bar dataKey="horas_alocadas" radius={[4, 4, 0, 0]} maxBarSize={28}>
          {shown.map((row) => {
            const occ = cap > 0 ? row.horas_alocadas / cap : 0;
            return (
              <Cell
                key={row.sprint}
                fill={occ >= 0.999 ? CHART.accent : CHART.electric}
              />
            );
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
