"use client";

import { fmtHoras } from "@/lib/format";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { CHART, tooltipStyle } from "./theme";

/** Composição do esforço: horas .sas vs overhead de Job. */
export function EffortDonut({
  sas,
  job,
}: {
  sas: number;
  job: number;
}) {
  const data = [
    { name: "Migração .sas", value: sas, color: CHART.electric },
    { name: "Overhead de Job", value: job, color: CHART.accent },
  ];
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          innerRadius={60}
          outerRadius={90}
          paddingAngle={2}
          stroke="none"
        >
          {data.map((d) => (
            <Cell key={d.name} fill={d.color} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v: number, n) => [fmtHoras(v), n as string]}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
