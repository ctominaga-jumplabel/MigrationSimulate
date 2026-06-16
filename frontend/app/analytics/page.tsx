"use client";

import { CategoryChart } from "@/components/charts/CategoryChart";
import { CHART, tooltipStyle } from "@/components/charts/theme";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { fmtHoras, fmtInt } from "@/lib/format";
import { useCatalog, useParams, useScenarios } from "@/lib/hooks";
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export default function AnalyticsPage() {
  const params = useParams();
  const { data: cat } = useCatalog();
  const { data: scn } = useScenarios(params);

  const compare = scn
    ? [
        { metric: "Esforço total", Bruto: scn.bruto.esforco_total, "Sem-dup": scn.sem_dup.esforco_total },
        { metric: "Horas .sas", Bruto: scn.bruto.horas_sas, "Sem-dup": scn.sem_dup.horas_sas },
        { metric: "Overhead Job", Bruto: scn.bruto.horas_job, "Sem-dup": scn.sem_dup.horas_job },
      ]
    : [];

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Análise"
        title="Analytics"
        description="Leitura analítica da base e dos cenários: distribuição de complexidade, composição do esforço e o ganho de colapsar duplicatas."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-sm font-semibold text-ink-muted">
            Contagem de .sas por complexidade
          </h2>
          <Card className="p-5">
            {cat ? <CategoryChart data={cat.categoria_distribution} metric="n_sas" /> : <Skeleton className="h-64" />}
          </Card>
        </div>
        <div>
          <h2 className="mb-3 text-sm font-semibold text-ink-muted">
            Horas estimadas por complexidade
          </h2>
          <Card className="p-5">
            {cat ? <CategoryChart data={cat.categoria_distribution} metric="soma_horas" /> : <Skeleton className="h-64" />}
          </Card>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-ink-muted">
          Bruto × Sem-dup (alavancas atuais)
        </h2>
        <Card className="p-5">
          {scn ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={compare} margin={{ top: 10, right: 8, left: 8, bottom: 0 }}>
                <XAxis dataKey="metric" tick={{ fill: CHART.text, fontSize: 12 }} axisLine={{ stroke: CHART.grid }} tickLine={false} />
                <YAxis
                  tick={{ fill: CHART.axis, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={52}
                  tickFormatter={(v) => new Intl.NumberFormat("pt-BR", { notation: "compact" }).format(v)}
                />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.03)" }} formatter={(v: number) => fmtHoras(v)} />
                <Legend wrapperStyle={{ fontSize: 12, color: CHART.text }} />
                <Bar dataKey="Bruto" fill={CHART.accent} radius={[6, 6, 0, 0]} maxBarSize={70} />
                <Bar dataKey="Sem-dup" fill={CHART.electric} radius={[6, 6, 0, 0]} maxBarSize={70} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <Skeleton className="h-72" />
          )}
        </Card>
      </div>

      {cat && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          {cat.categoria_distribution.map((c) => (
            <Card key={c.categoria} className="p-4">
              <p className="text-[11px] uppercase tracking-wide text-ink-faint">{c.categoria}</p>
              <p className="num mt-1 text-xl font-bold text-ink">{fmtInt(c.n_sas)}</p>
              <p className="num text-xs text-ink-muted">{fmtHoras(c.soma_horas)}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
