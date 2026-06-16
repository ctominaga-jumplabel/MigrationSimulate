"use client";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { fmtHoras, fmtInt, fmtDec, fmtPct } from "@/lib/format";
import type { ScenariosResponse } from "@/lib/types";
import { motion } from "framer-motion";

/** Comparação lado a lado Bruto × Sem-dup com a economia destacada. */
export function ScenarioCompare({ data }: { data: ScenariosResponse }) {
  const b = data.bruto;
  const s = data.sem_dup;
  const economia = b.esforco_total - s.esforco_total;
  const economiaPct = b.esforco_total > 0 ? (economia / b.esforco_total) * 100 : 0;

  const rows: { label: string; b: string; s: string }[] = [
    { label: "Esforço total (×K)", b: fmtHoras(b.esforco_total), s: fmtHoras(s.esforco_total) },
    { label: "↳ horas .sas", b: fmtHoras(b.horas_sas), s: fmtHoras(s.horas_sas) },
    { label: "↳ overhead de Job", b: fmtHoras(b.horas_job), s: fmtHoras(s.horas_job) },
    { label: "Duração (dias úteis)", b: fmtDec(b.duracao_dias_uteis), s: fmtDec(s.duracao_dias_uteis) },
    { label: "Nº de sprints", b: fmtInt(b.n_sprints), s: fmtInt(s.n_sprints) },
    { label: "EGPs", b: fmtInt(b.n_egps), s: fmtInt(s.n_egps) },
    { label: "Órfãos", b: fmtInt(b.n_orfaos), s: fmtInt(s.n_orfaos) },
  ];

  return (
    <Card className="overflow-hidden p-0">
      <div className="grid grid-cols-[1.4fr_1fr_1fr]">
        <div className="border-b border-line px-5 py-4 text-xs font-semibold uppercase tracking-wide text-ink-faint">
          Métrica
        </div>
        <div className="border-b border-l border-line px-5 py-4">
          <Badge tone="accent">Bruto</Badge>
        </div>
        <div className="border-b border-l border-line px-5 py-4">
          <Badge tone="electric">Sem duplicatas</Badge>
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
              {r.b}
            </div>
            <div className="num border-b border-l border-line px-5 py-3 text-sm font-semibold text-ink">
              {r.s}
            </div>
          </motion.div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 bg-success/5 px-5 py-4">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-ink-muted">Economia Bruto → Sem-dup</span>
          <Badge tone="success">−{fmtPct(economiaPct, 1)}</Badge>
        </div>
        <span className="num text-lg font-bold text-success">
          −{fmtHoras(economia)}
        </span>
      </div>
    </Card>
  );
}
