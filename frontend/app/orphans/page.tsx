"use client";

import { MigrateBanner } from "@/components/domain/MigrateBanner";
import { Icon } from "@/components/layout/Icon";
import { Badge, categoriaTone } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchInput } from "@/components/ui/SearchInput";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { fmtHoras, fmtInt } from "@/lib/format";
import { useMigrateGain, useOrphans, useParams } from "@/lib/hooks";
import { useSim } from "@/lib/store";
import { useMemo, useState } from "react";

export default function OrphansPage() {
  const params = useParams();
  const cenario = useSim((s) => s.cenario);
  const prioridades = useSim((s) => s.prioridades[cenario]);
  const setPrioridade = useSim((s) => s.setPrioridade);
  const gain = useMigrateGain();
  const { data, isLoading } = useOrphans(params);

  const [q, setQ] = useState("");
  const [cat, setCat] = useState("todas");

  const orphans = data?.orphans ?? [];
  const filtered = useMemo(() => {
    let rows = orphans.slice();
    if (q) rows = rows.filter((o) => o.file_name.toLowerCase().includes(q.toLowerCase()));
    if (cat !== "todas") rows = rows.filter((o) => o.categoria === cat);
    return rows;
  }, [orphans, q, cat]);

  const cats = ["todas", "Trivial", "Simples", "Médio", "Complexo", "Muito Complexo"];
  const total = orphans.reduce((s, o) => s + o.horas_estimadas, 0);

  // Órfãos não têm overhead de Job; o ganho do Migrate incide direto na conversão
  // de cada arquivo, pela sua própria categoria (mesma % calibrada que o motor usa).
  const migrate = useMemo(() => {
    if (!orphans.length) return null;
    const totalMig = orphans.reduce(
      (s, o) => s + o.horas_estimadas * (1 - (gain[o.categoria] ?? 0) / 100),
      0
    );
    const economia = total - totalMig;
    return {
      total: totalMig,
      economia,
      ganhoPct: total > 0 ? (economia / total) * 100 : 0,
    };
  }, [orphans, gain, total]);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Itens avulsos"
        title="SAS Órfãos"
        description="Arquivos .sas de all_sas/ que não pertencem a nenhum EGP. Migram como itens avulsos e — diferente dos EGPs — não têm overhead de Job."
        actions={
          <Badge tone={cenario === "bruto" ? "accent" : "electric"}>
            {cenario === "bruto" ? "Bruto" : "Sem-dup (não-dup.)"}
          </Badge>
        }
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <Stat label="Órfãos no cenário" value={fmtInt(orphans.length)} icon="DocumentText" />
        <Stat label="Horas estimadas" value={fmtHoras(total)} icon="Clock" accent />
        <Stat
          label="Média por arquivo"
          value={orphans.length ? fmtHoras(total / orphans.length, 1) : "—"}
          icon="Chart"
        />
      </div>

      {migrate && (
        <MigrateBanner
          ganhoPct={migrate.ganhoPct}
          title="Aceleração com Migrate"
          subtitle="ganho aplicado à conversão de cada órfão por complexidade — órfãos não têm overhead de Job"
          stats={[
            {
              label: "Horas estimadas",
              value: `${fmtHoras(total)} → ${fmtHoras(migrate.total)}`,
            },
            {
              label: "Economia",
              value: `−${fmtHoras(migrate.economia)}`,
              success: true,
            },
          ]}
        />
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[220px] flex-1">
          <SearchInput value={q} onChange={setQ} placeholder="Buscar arquivo .sas…" />
        </div>
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

      {isLoading ? (
        <Skeleton className="h-96" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Icon name="SearchStatus" size={32} />}
          title="Nenhum órfão encontrado"
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="grid grid-cols-[2.2fr_1fr_0.9fr_0.9fr_0.7fr] border-b border-line px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
            <span>Arquivo</span>
            <span>Categoria</span>
            <span className="text-right">Horas</span>
            <span className="text-right">Com Migrate</span>
            <span className="text-right">Prioridade</span>
          </div>
          <div className="max-h-[600px] overflow-y-auto">
            {filtered.slice(0, 300).map((o, i) => {
              const def = orphans.findIndex((x) => x.file_name === o.file_name) + 1;
              const prio = prioridades[`orfao:${o.file_name}`] ?? def;
              const oMig = o.horas_estimadas * (1 - (gain[o.categoria] ?? 0) / 100);
              return (
                <div
                  key={o.file_name}
                  className="grid grid-cols-[2.2fr_1fr_0.9fr_0.9fr_0.7fr] items-center border-b border-line/50 px-4 py-2.5 text-sm hover:bg-black/[0.03]"
                >
                  <span className="truncate text-ink-muted" title={o.file_name}>
                    {o.file_name}
                  </span>
                  <span>
                    <Badge tone={categoriaTone(o.categoria)}>{o.categoria}</Badge>
                  </span>
                  <span className="num text-right font-semibold text-ink">
                    {fmtHoras(o.horas_estimadas, 1)}
                  </span>
                  <span className="num text-right font-semibold text-success">
                    {fmtHoras(oMig, 1)}
                  </span>
                  <span className="text-right">
                    <input
                      type="number"
                      min={1}
                      value={prio}
                      onChange={(e) =>
                        setPrioridade(cenario, "orfao", o.file_name, Math.max(1, Number(e.target.value)))
                      }
                      className="num w-16 rounded-lg border border-line bg-black/[0.03] px-2 py-1 text-center text-ink outline-none focus:border-accent/40"
                    />
                  </span>
                </div>
              );
            })}
          </div>
          {filtered.length > 300 && (
            <p className="py-3 text-center text-xs text-ink-faint">
              Exibindo os 300 primeiros de {fmtInt(filtered.length)}.
            </p>
          )}
        </Card>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon: string;
  accent?: boolean;
}) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <span className={accent ? "text-accent-soft" : "text-electric-soft"}>
        <Icon name={icon} size={22} variant="Bold" />
      </span>
      <div>
        <p className="text-[11px] uppercase tracking-wide text-ink-faint">{label}</p>
        <p className="num text-lg font-bold text-ink">{value}</p>
      </div>
    </Card>
  );
}
