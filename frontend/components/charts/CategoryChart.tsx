"use client";

import { CategoriaRow } from "@/lib/types";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CATEGORIA_COLOR, CHART, tooltipStyle } from "./theme";
import { fmtInt, fmtHoras } from "@/lib/format";

export function CategoryChart({
  data,
  metric,
}: {
  data: CategoriaRow[];
  metric: "n_sas" | "soma_horas";
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 10, right: 8, left: 8, bottom: 0 }}>
        <XAxis
          dataKey="categoria"
          tick={{ fill: CHART.text, fontSize: 11 }}
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
          formatter={(v: number) =>
            metric === "n_sas" ? [fmtInt(v), "Nº .sas"] : [fmtHoras(v), "Horas"]
          }
        />
        <Bar dataKey={metric} radius={[6, 6, 0, 0]} maxBarSize={64}>
          {data.map((row) => (
            <Cell
              key={row.categoria}
              fill={CATEGORIA_COLOR[row.categoria] ?? CHART.accent}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
