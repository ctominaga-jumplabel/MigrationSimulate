"use client";

import { Icon } from "@/components/layout/Icon";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { LeverNumber, LeverSelect, LeverSlider } from "@/components/ui/Lever";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { fmtDec, fmtHoras, fmtInt } from "@/lib/format";
import { useParams, useScenarios } from "@/lib/hooks";
import { useSim } from "@/lib/store";
import { motion } from "framer-motion";

const RULES = [
  {
    icon: "Profile2User",
    title: "Mais consultores reduzem a duração, não o esforço",
    body: "O total de horas trabalhadas é fixo. Adicionar consultores divide o trabalho — o projeto termina antes, mas o esforço acumulado é o mesmo.",
  },
  {
    icon: "Flash",
    title: "K multiplica o esforço total",
    body: "Proficiência da equipe: 0,8 sênior · 1,0 padrão · 1,3 time novo em SAS. Aplica sobre o esforço inteiro (sas + Job).",
  },
  {
    icon: "Settings",
    title: "J_base e J_task formam o overhead de Job",
    body: "Cada EGP vira 1 Job no Databricks. Horas de Job = J_base + J_task × nº de .sas. Órfãos não têm overhead de Job.",
  },
  {
    icon: "Copy",
    title: "Sem-dup depende da heurística de família",
    body: "O cenário Sem-dup colapsa versões do mesmo pipeline no EGP canônico (maior esforço). É uma heurística aproximada — validar amostra com o cliente.",
  },
];

export default function ScenarioPage() {
  const s = useSim();
  const params = useParams();
  const { data } = useScenarios(params);
  const active = data?.[s.cenario];

  return (
    <div className="space-y-7">
      <SectionHeader
        eyebrow="Simulação"
        title="Scenario Builder"
        description="Ajuste as alavancas e veja o impacto recalculado instantaneamente pelo motor. Nada é estimado no navegador — cada número vem de core.py."
        actions={
          <Button variant="ghost" onClick={() => s.reset()}>
            <Icon name="Refresh" size={16} /> Restaurar padrões
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        {/* Alavancas */}
        <Card className="space-y-6 p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-ink">Alavancas</h3>
            <SegmentedControl
              size="sm"
              value={s.cenario}
              onChange={s.setCenario}
              options={[
                { value: "bruto", label: "Bruto" },
                { value: "sem_dup", label: "Sem-dup" },
              ]}
            />
          </div>

          <LeverSlider
            label="Nº de consultores"
            value={s.n_consultores}
            min={1}
            max={50}
            onChange={(v) => s.set({ n_consultores: v })}
            hint="Tamanho da equipe (consultores, com Migrate). Reduz a duração e o número de sprints — não o esforço."
          />
          <LeverSlider
            label="Colaboradores do cliente"
            value={s.n_colaboradores}
            min={1}
            max={200}
            unit="pessoas"
            onChange={(v) => s.set({ n_colaboradores: v })}
            hint="Tamanho da equipe do CLIENTE para uma migração MANUAL (até 200 pessoas). Usado no Comparativo por complexidade — quanto maior a equipe, menor a duração da migração manual."
          />
          <LeverSlider
            label="Horas produtivas / dia"
            value={s.horas_dia}
            min={4}
            max={8}
            step={0.5}
            unit="h"
            onChange={(v) => s.set({ horas_dia: v })}
            hint="Capacidade diária de cada consultor."
          />
          <div className="grid grid-cols-2 gap-4">
            <LeverNumber
              label="J_base"
              value={s.J_base}
              step={1}
              unit="h"
              onChange={(v) => s.set({ J_base: v })}
              hint="Overhead fixo de orquestração por Job (1 por EGP)."
            />
            <LeverNumber
              label="J_task"
              value={s.J_task}
              step={0.5}
              unit="h"
              onChange={(v) => s.set({ J_task: v })}
              hint="Overhead por .sas dentro do Job."
            />
          </div>
          <LeverSelect
            label="Fator de calibração K"
            value={s.K}
            onChange={(v) => s.set({ K: v })}
            hint="Proficiência da equipe. Multiplica o esforço total."
            options={[
              { value: 0.8, label: "0,8 · sênior" },
              { value: 1.0, label: "1,0 · padrão" },
              { value: 1.3, label: "1,3 · time novo" },
            ]}
          />
          <LeverNumber
            label="Dias úteis por mês"
            value={s.dias_uteis_mes}
            step={1}
            min={1}
            unit="dias úteis"
            onChange={(v) => s.set({ dias_uteis_mes: v })}
            hint="Base de dias ÚTEIS para converter horas em meses e anos no Comparativo (1 mês = N dias úteis; 1 ano = 12 meses). Default 21. Só afeta a apresentação da duração — não muda esforço nem sprints."
          />
          <div className="space-y-2">
            <label className="text-sm font-medium text-ink">Data de início</label>
            <input
              type="date"
              value={s.data_inicio}
              onChange={(e) => s.set({ data_inicio: e.target.value })}
              className="num w-full rounded-xl border border-line bg-black/[0.03] px-3 py-2 text-sm text-ink outline-none focus:border-accent/40"
            />
          </div>
        </Card>

        {/* Impacto ao vivo */}
        <div className="space-y-4">
          <Card className="relative overflow-hidden p-6">
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-accent/15 blur-3xl" />
            <div className="relative">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wide text-ink-muted">
                  Impacto no cenário
                </span>
                <Badge tone={s.cenario === "bruto" ? "accent" : "electric"}>
                  {s.cenario === "bruto" ? "Bruto" : "Sem duplicatas"}
                </Badge>
              </div>
              <div className="mt-4 text-5xl font-black text-ink">
                {active ? (
                  <AnimatedNumber value={active.esforco_total} format={(v) => fmtHoras(v)} />
                ) : (
                  "—"
                )}
              </div>
              <p className="mt-1 text-xs text-ink-muted">
                esforço total (sas + Job) × K {s.K}
              </p>

              <div className="mt-6 grid grid-cols-2 gap-4">
                <ImpactStat
                  label="Duração"
                  value={active ? fmtDec(active.duracao_dias_uteis) + " dias úteis" : "—"}
                />
                <ImpactStat
                  label="Sprints"
                  value={active ? fmtInt(active.n_sprints) : "—"}
                />
                <ImpactStat
                  label="Horas .sas"
                  value={active ? fmtHoras(active.horas_sas) : "—"}
                />
                <ImpactStat
                  label="Overhead de Job"
                  value={active ? fmtHoras(active.horas_job) : "—"}
                />
              </div>

              <div className="mt-5 rounded-xl border border-line bg-black/[0.03] px-4 py-3 text-xs text-ink-muted">
                Capacidade por sprint ={" "}
                <span className="num font-semibold text-ink">
                  {fmtHoras(s.n_consultores * s.horas_dia * 10)}
                </span>{" "}
                = {s.n_consultores} consultores × {s.horas_dia} h/dia × 10 dias úteis.
              </div>
            </div>
          </Card>

          <div className="grid gap-3">
            {RULES.map((r, i) => (
              <motion.div
                key={r.title}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
              >
                <Card className="flex gap-3 p-4">
                  <div className="mt-0.5 text-accent-soft">
                    <Icon name={r.icon} size={20} variant="Bold" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-ink">{r.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                      {r.body}
                    </p>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ImpactStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-base-900/40 px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-ink-faint">{label}</p>
      <p className="num mt-1 text-sm font-bold text-ink">{value}</p>
    </div>
  );
}
