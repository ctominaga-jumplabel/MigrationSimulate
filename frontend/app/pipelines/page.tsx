"use client";

import { MigrateBanner } from "@/components/domain/MigrateBanner";
import { Icon } from "@/components/layout/Icon";
import { Badge, categoriaTone } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchInput } from "@/components/ui/SearchInput";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Skeleton } from "@/components/ui/Skeleton";
import { fmtHoras, fmtInt } from "@/lib/format";
import { useEgpChildren, useEgps, useMigrate, useMigrateGain, useParams } from "@/lib/hooks";
import { useSim } from "@/lib/store";
import type { EgpRow } from "@/lib/types";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";

type Sort = "horas_total" | "n_sas" | "prioridade";

export default function PipelinesPage() {
  const params = useParams();
  const cenario = useSim((s) => s.cenario);
  const prioridades = useSim((s) => s.prioridades[cenario]);
  const setPrioridade = useSim((s) => s.setPrioridade);
  const gain = useMigrateGain();
  const { data, isLoading } = useEgps(params);
  const { data: mig } = useMigrate(params, gain);
  const migActive = mig?.[cenario];

  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("horas_total");
  const [cat, setCat] = useState<string>("todas");
  const [open, setOpen] = useState<string | null>(null);

  const egps = data?.egps ?? [];

  const filtered = useMemo(() => {
    let rows = egps.slice();
    if (q) rows = rows.filter((e) => e.egp_name.toLowerCase().includes(q.toLowerCase()));
    if (cat !== "todas")
      rows = rows.filter((e) => e.categoria_predominante === cat);
    if (sort === "prioridade") {
      const def = new Map(egps.map((e, i) => [e.egp_name, i + 1]));
      rows.sort(
        (a, b) =>
          (prioridades[`egp:${a.egp_name}`] ?? def.get(a.egp_name) ?? 0) -
          (prioridades[`egp:${b.egp_name}`] ?? def.get(b.egp_name) ?? 0)
      );
    } else {
      rows.sort((a, b) => b[sort] - a[sort]);
    }
    return rows;
  }, [egps, q, cat, sort, prioridades]);

  const cats = ["todas", "Trivial", "Simples", "Médio", "Complexo", "Muito Complexo"];
  const maxHoras = egps.reduce((m, e) => Math.max(m, e.horas_total), 0);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Pipelines"
        title="EGPs"
        description="Cada EGP vira um Job no Databricks. Horas total = horas dos .sas + overhead de Job (J_base + J_task × nº .sas). Ordene, filtre e ajuste a prioridade de migração."
        actions={
          <Badge tone={cenario === "bruto" ? "accent" : "electric"}>
            {cenario === "bruto" ? "Bruto" : "Sem-dup (canônicos)"}
          </Badge>
        }
      />

      {migActive && (
        <MigrateBanner
          ganhoPct={migActive.ganho_pct}
          title="Aceleração com Migrate"
          subtitle="projeção (MigrateMind) no cenário — conversão .sas e overhead de Job reduzidos; a tabela abaixo mostra as horas manuais"
          stats={[
            {
              label: "Esforço",
              value: `${fmtHoras(migActive.manual.esforco_total)} → ${fmtHoras(migActive.migrate.esforco_total)}`,
            },
            {
              label: "Horas .sas",
              value: `${fmtHoras(migActive.manual.horas_sas)} → ${fmtHoras(migActive.migrate.horas_sas)}`,
            },
            {
              label: "Overhead de Job",
              value: `${fmtHoras(migActive.manual.horas_job)} → ${fmtHoras(migActive.migrate.horas_job)}`,
            },
            {
              label: "Economia",
              value: `−${fmtHoras(migActive.economia_horas)}`,
              success: true,
            },
          ]}
        />
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[220px] flex-1">
          <SearchInput value={q} onChange={setQ} placeholder="Buscar EGP…" />
        </div>
        <SegmentedControl
          size="sm"
          value={sort}
          onChange={(v) => setSort(v as Sort)}
          options={[
            { value: "horas_total", label: "Esforço" },
            { value: "n_sas", label: "Nº .sas" },
            { value: "prioridade", label: "Prioridade" },
          ]}
        />
        <select
          value={cat}
          onChange={(e) => setCat(e.target.value)}
          className="rounded-xl border border-line bg-black/[0.03] px-3 py-2 text-sm text-ink outline-none"
        >
          {cats.map((c) => (
            <option key={c} value={c} className="bg-base-800">
              {c === "todas" ? "Todas as categorias" : c}
            </option>
          ))}
        </select>
      </div>

      <p className="text-xs text-ink-muted">
        {fmtInt(filtered.length)} de {fmtInt(egps.length)} EGPs ·{" "}
        {fmtHoras(filtered.reduce((s, e) => s + e.horas_total, 0))} no recorte
      </p>

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Icon name="SearchStatus" size={32} />}
          title="Nenhum EGP encontrado"
          description="Ajuste a busca ou os filtros."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.slice(0, 120).map((egp, i) => (
            <EgpCard
              key={egp.egp_name}
              egp={egp}
              rank={i + 1}
              maxHoras={maxHoras}
              priority={
                prioridades[`egp:${egp.egp_name}`] ??
                egps.findIndex((e) => e.egp_name === egp.egp_name) + 1
              }
              onPriority={(p) => setPrioridade(cenario, "egp", egp.egp_name, p)}
              open={open === egp.egp_name}
              onToggle={() =>
                setOpen(open === egp.egp_name ? null : egp.egp_name)
              }
            />
          ))}
          {filtered.length > 120 && (
            <p className="col-span-full py-2 text-center text-xs text-ink-faint">
              Exibindo os 120 primeiros de {fmtInt(filtered.length)} — refine a busca
              para ver outros.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function EgpCard({
  egp,
  rank,
  maxHoras,
  priority,
  onPriority,
  open,
  onToggle,
}: {
  egp: EgpRow;
  rank: number;
  maxHoras: number;
  priority: number;
  onPriority: (p: number) => void;
  open: boolean;
  onToggle: () => void;
}) {
  const critical = rank <= 10;
  const jobPct = egp.horas_total > 0 ? (egp.horas_job / egp.horas_total) * 100 : 0;
  return (
    <Card className={`overflow-hidden p-4 ${critical ? "ring-1 ring-accent/30" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {critical && <Badge tone="accent">crítico</Badge>}
            <Badge tone={categoriaTone(egp.categoria_predominante)}>
              {egp.categoria_predominante}
            </Badge>
          </div>
          <p className="mt-1.5 truncate text-sm font-semibold text-ink" title={egp.egp_name}>
            {egp.egp_name}
          </p>
          <p className="text-xs text-ink-muted">{fmtInt(egp.n_sas)} arquivos .sas</p>
        </div>
        <div className="text-right">
          <p className="num text-lg font-bold text-ink">{fmtHoras(egp.horas_total)}</p>
          <p className="text-[11px] text-ink-faint">total</p>
        </div>
      </div>

      {/* barra esforço relativo */}
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-black/[0.06]">
        <div
          className="h-full rounded-full bg-grad-accent"
          style={{ width: `${maxHoras > 0 ? (egp.horas_total / maxHoras) * 100 : 0}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-ink-muted">
        <span>
          .sas <span className="num text-ink">{fmtHoras(egp.horas_sas)}</span>
        </span>
        <span>
          Job <span className="num text-ink">{fmtHoras(egp.horas_job)}</span> ({jobPct.toFixed(0)}%)
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
        <label className="flex items-center gap-2 text-xs text-ink-muted">
          Prioridade
          <input
            type="number"
            min={1}
            value={priority}
            onChange={(e) => onPriority(Math.max(1, Number(e.target.value)))}
            className="num w-16 rounded-lg border border-line bg-black/[0.03] px-2 py-1 text-center text-ink outline-none focus:border-accent/40"
          />
        </label>
        <button
          onClick={onToggle}
          className="flex items-center gap-1 text-xs font-medium text-electric-soft hover:text-electric"
        >
          {open ? "ocultar" : "ver .sas"}
          <Icon name={open ? "ArrowUp2" : "ArrowDown2"} size={14} />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && <ChildrenList egp={egp.egp_name} />}
      </AnimatePresence>
    </Card>
  );
}

function ChildrenList({ egp }: { egp: string }) {
  const { data, isLoading } = useEgpChildren(egp);
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="overflow-hidden"
    >
      <div className="mt-3 max-h-56 space-y-1 overflow-y-auto rounded-xl border border-line bg-base-900/40 p-2">
        {isLoading ? (
          <Skeleton className="h-20" />
        ) : (
          data?.children.slice(0, 80).map((c) => (
            <div
              key={c.file_name}
              className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-black/[0.04]"
            >
              <span className="flex min-w-0 items-center gap-2">
                {c.is_likely_duplicate && (
                  <span title="provável duplicata">
                    <Icon name="Copy" size={12} className="text-warn" />
                  </span>
                )}
                <span className="truncate text-ink-muted" title={c.file_name}>
                  {c.file_name}
                </span>
              </span>
              <span className="num shrink-0 text-ink">{fmtHoras(c.horas_estimadas, 1)}</span>
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
}
