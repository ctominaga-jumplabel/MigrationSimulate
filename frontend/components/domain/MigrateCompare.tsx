"use client";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { fmtDec, fmtHoras, fmtInt, fmtPct } from "@/lib/format";
import type { MigrateScenario } from "@/lib/types";
import { motion } from "framer-motion";

/** Comparação lado a lado Manual × Com Migrate, com o ganho destacado. */
export function MigrateCompare({ data }: { data: MigrateScenario }) {
  const m = data.manual;
  const g = data.migrate;

  const rows: { label: string; m: string; g: string }[] = [
    { label: "Esforço total (×K)", m: fmtHoras(m.esforco_total), g: fmtHoras(g.esforco_total) },
    { label: "↳ conversão .sas", m: fmtHoras(m.horas_sas), g: fmtHoras(g.horas_sas) },
    { label: "↳ overhead de Job", m: fmtHoras(m.horas_job), g: fmtHoras(g.horas_job) },
    { label: "Duração (dias úteis)", m: fmtDec(m.duracao_dias_uteis), g: fmtDec(g.duracao_dias_uteis) },
    { label: "Nº de sprints", m: fmtInt(m.n_sprints), g: fmtInt(g.n_sprints) },
  ];

  return (
    <Card className="overflow-hidden p-0">
      <div className="grid grid-cols-[1.4fr_1fr_1fr]">
        <div className="border-b border-line px-5 py-4 text-xs font-semibold uppercase tracking-wide text-ink-faint">
          Métrica
        </div>
        <div className="border-b border-l border-line px-5 py-4">
          <Badge tone="neutral">Manual</Badge>
        </div>
        <div className="border-b border-l border-line px-5 py-4">
          <Badge tone="success">Com Migrate</Badge>
        </div>
        {rows.map((r, i) => (
          <motion.div
            key={r.label}
            className="contents"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.04 }}
          >
            <div className="border-b border-line px-5 py-3 text-sm text-ink-muted">
              {r.label}
            </div>
            <div className="num border-b border-l border-line px-5 py-3 text-sm font-semibold text-ink">
              {r.m}
            </div>
            <div className="num border-b border-l border-line px-5 py-3 text-sm font-semibold text-success">
              {r.g}
            </div>
          </motion.div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 bg-success/5 px-5 py-4">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-ink-muted">Ganho do Migrate (esforço total)</span>
          <Badge tone="success">−{fmtPct(data.ganho_pct, 1)}</Badge>
        </div>
        <span className="num text-lg font-bold text-success">
          −{fmtHoras(data.economia_horas)}
        </span>
      </div>
    </Card>
  );
}
