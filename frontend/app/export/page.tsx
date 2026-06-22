"use client";

import { Icon } from "@/components/layout/Icon";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { api } from "@/lib/api";
import { fmtData, fmtDec, fmtHoras, fmtInt, fmtPct } from "@/lib/format";
import { useMigrate, useMigrateGain, useParams, useScenarios } from "@/lib/hooks";
import { useSim } from "@/lib/store";
import { useState } from "react";

const RISCOS = [
  "A heurística de pipeline_family (colapso de versões) é aproximada — validar amostra com o cliente antes de tratar o Sem-dup como número oficial.",
  "J_base e J_task são estimativas de partida — calibrar com o time de migração.",
  "O calendário pula fins de semana, mas não considera feriados (v1).",
  "As horas estimadas herdam as premissas da metodologia (pessoa pleno em SAS + PySpark; dedup ×0,3).",
  "A planilha exportada usa as horas do cenário manual (sem Migrate). A 'Projeção com Migrate' é uma estimativa de aceleração e não altera o plano nem as datas.",
];

export default function ExportPage() {
  const s = useSim();
  const params = useParams();
  const gain = useMigrateGain();
  const { data } = useScenarios(params);
  const { data: mig } = useMigrate(params, gain);
  const active = data?.[s.cenario];
  const migActive = mig?.[s.cenario];
  const [busy, setBusy] = useState<"xlsx" | "csv" | null>(null);

  async function download(formato: "xlsx" | "csv") {
    setBusy(formato);
    try {
      const blob = await api.exportFile(params, formato);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `plano_sprints_${s.cenario}_${s.data_inicio}.${formato === "xlsx" ? "xlsx" : "csv"}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Falha ao exportar. A API está rodando? " + (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const paramRows: { label: string; value: string }[] = [
    { label: "Cenário", value: s.cenario === "bruto" ? "Bruto" : "Sem duplicatas (por família)" },
    { label: "Nº de consultores", value: fmtInt(s.n_consultores) },
    { label: "Horas produtivas/dia", value: fmtDec(s.horas_dia) },
    { label: "J_base (overhead fixo/Job)", value: fmtHoras(s.J_base) },
    { label: "J_task (overhead/.sas)", value: fmtHoras(s.J_task) },
    { label: "Fator K", value: fmtDec(s.K, 1) },
    { label: "Data de início", value: fmtData(s.data_inicio) },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Saída"
        title="Export & Apresentação"
        description="Gera a planilha do plano (cenário e prioridades atuais) e consolida as premissas e riscos para a apresentação executiva. A montagem usa core.build_export — os mesmos números das telas."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        {/* Resumo executivo */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-ink">Resumo do cenário</h3>
            <Badge tone={s.cenario === "bruto" ? "accent" : "electric"}>
              {s.cenario === "bruto" ? "Bruto" : "Sem-dup"}
            </Badge>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Headline label="Esforço total" value={active ? fmtHoras(active.esforco_total) : "—"} />
            <Headline label="Duração" value={active ? fmtDec(active.duracao_dias_uteis) + " dias úteis" : "—"} />
            <Headline label="Nº de sprints" value={active ? fmtInt(active.n_sprints) : "—"} />
            <Headline label="EGPs + SAS (sem EGP)" value={active ? `${fmtInt(active.n_egps)} + ${fmtInt(active.n_orfaos)}` : "—"} />
          </div>

          {migActive && (
            <div className="mt-5 rounded-xl border border-success/20 bg-success/[0.04] p-4">
              <div className="flex items-center gap-2">
                <span className="text-success">
                  <Icon name="MagicStar" size={16} variant="Bold" />
                </span>
                <p className="text-xs font-bold text-ink">Projeção com Migrate</p>
                <Badge tone="success">−{fmtPct(migActive.ganho_pct, 1)}</Badge>
              </div>
              <div className="mt-3 divide-y divide-line/60">
                <MigRow
                  label="Esforço total"
                  manual={fmtHoras(migActive.manual.esforco_total)}
                  migrate={fmtHoras(migActive.migrate.esforco_total)}
                />
                <MigRow
                  label="Duração"
                  manual={fmtDec(migActive.manual.duracao_dias_uteis) + " dias"}
                  migrate={fmtDec(migActive.migrate.duracao_dias_uteis) + " dias"}
                />
                <MigRow
                  label="Nº de sprints"
                  manual={fmtInt(migActive.manual.n_sprints)}
                  migrate={fmtInt(migActive.migrate.n_sprints)}
                />
              </div>
              <p className="mt-2 text-[11px] text-ink-faint">
                A planilha exportada reflete o cenário manual; o Migrate é uma projeção de aceleração.
              </p>
            </div>
          )}

          <h4 className="mt-6 text-xs font-semibold uppercase tracking-wide text-ink-faint">
            Parâmetros usados
          </h4>
          <div className="mt-2 divide-y divide-line/60">
            {paramRows.map((r) => (
              <div key={r.label} className="flex items-center justify-between py-2 text-sm">
                <span className="text-ink-muted">{r.label}</span>
                <span className="num font-semibold text-ink">{r.value}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Downloads + riscos */}
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-base font-bold text-ink">Exportar plano</h3>
            <p className="mt-1 text-sm text-ink-muted">
              Excel com 4 abas: <span className="text-ink">egps</span>,{" "}
              <span className="text-ink">orfaos</span>,{" "}
              <span className="text-ink">resumo_sprints</span> e{" "}
              <span className="text-ink">alocacao</span>.
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <Button onClick={() => download("xlsx")} disabled={busy !== null} className="flex-1">
                <Icon name="DocumentDownload" size={18} variant="Bold" />
                {busy === "xlsx" ? "Gerando…" : "Baixar Excel (.xlsx)"}
              </Button>
              <Button
                variant="outline"
                onClick={() => download("csv")}
                disabled={busy !== null}
                className="flex-1"
              >
                <Icon name="DocumentText" size={18} />
                {busy === "csv" ? "Gerando…" : "Resumo (.csv)"}
              </Button>
            </div>
          </Card>

          <Card className="border-warn/20 bg-warn/[0.04] p-6">
            <h3 className="flex items-center gap-2 text-base font-bold text-warn">
              <Icon name="Danger" size={20} variant="Bold" /> Premissas e riscos
            </h3>
            <ul className="mt-3 space-y-2.5">
              {RISCOS.map((r) => (
                <li key={r} className="flex gap-2 text-xs leading-relaxed text-ink-muted">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-warn" />
                  {r}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Headline({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-base-900/40 px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-ink-faint">{label}</p>
      <p className="num mt-1 text-lg font-bold text-ink">{value}</p>
    </div>
  );
}

function MigRow({
  label,
  manual,
  migrate,
}: {
  label: string;
  manual: string;
  migrate: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 text-sm">
      <span className="text-ink-muted">{label}</span>
      <span className="num font-semibold">
        <span className="text-ink-faint">{manual}</span>
        <span className="mx-1.5 text-ink-faint">→</span>
        <span className="text-success">{migrate}</span>
      </span>
    </div>
  );
}
