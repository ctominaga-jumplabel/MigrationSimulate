// Hooks de dados (React Query). Constroem `params` a partir do store e
// consultam a API. Nenhuma regra de negócio — só fetch + cache.
"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { api } from "./api";
import { useSim } from "./store";
import type { Params } from "./types";

/** Constrói o objeto `params` (estável por valor) assinando o store. */
export function useParams(): Params {
  const n_consultores = useSim((s) => s.n_consultores);
  const horas_dia = useSim((s) => s.horas_dia);
  const J_base = useSim((s) => s.J_base);
  const J_task = useSim((s) => s.J_task);
  const K = useSim((s) => s.K);
  const data_inicio = useSim((s) => s.data_inicio);
  const cenario = useSim((s) => s.cenario);
  const prioridades = useSim((s) => s.prioridades);

  return useMemo(() => {
    const prio = prioridades[cenario] ?? {};
    return {
      n_consultores,
      horas_dia,
      J_base,
      J_task,
      K,
      data_inicio,
      cenario,
      prioridades: Object.entries(prio).map(([key, prioridade]) => {
        const [tipo, ...rest] = key.split(":");
        return {
          tipo: tipo as "egp" | "orfao",
          nome: rest.join(":"),
          prioridade,
        };
      }),
    };
  }, [n_consultores, horas_dia, J_base, J_task, K, data_inicio, cenario, prioridades]);
}

const key = (p: Params) => JSON.stringify(p);

export function useCatalog() {
  return useQuery({ queryKey: ["catalog"], queryFn: api.catalog, staleTime: Infinity });
}

export function useScenarios(p: Params) {
  return useQuery({
    queryKey: ["scenarios", key(p)],
    queryFn: () => api.scenarios(p),
    placeholderData: (prev) => prev,
  });
}

/** Ganho do Migrate por categoria (estável por valor) assinando o store. */
export function useMigrateGain(): Record<string, number> {
  return useSim((s) => s.migrate_gain);
}

export function useMigrate(p: Params, gain: Record<string, number>) {
  return useQuery({
    queryKey: ["migrate", key(p), JSON.stringify(gain)],
    queryFn: () => api.migrate(p, gain),
    placeholderData: (prev) => prev,
  });
}

export function useEgps(p: Params, gain: Record<string, number>) {
  return useQuery({
    queryKey: ["egps", p.cenario, p.J_base, p.J_task, JSON.stringify(gain)],
    queryFn: () => api.egps(p, gain),
    placeholderData: (prev) => prev,
  });
}

export function useOrphans(p: Params) {
  return useQuery({
    queryKey: ["orphans", p.cenario],
    queryFn: () => api.orphans(p),
    placeholderData: (prev) => prev,
  });
}

export function useSprints(p: Params) {
  return useQuery({
    queryKey: ["sprints", key(p)],
    queryFn: () => api.sprints(p),
    placeholderData: (prev) => prev,
  });
}

export function useEgpChildren(egp: string | null) {
  return useQuery({
    queryKey: ["children", egp],
    queryFn: () => api.egpChildren(egp as string),
    enabled: !!egp,
  });
}
