// Cliente da API fina (FastAPI sobre core.py). Sem cálculo — só transporte.
import type {
  CatalogResponse,
  ComparisonResponse,
  EgpsResponse,
  MigrateResponse,
  OrphansResponse,
  Params,
  SasChild,
  ScenariosResponse,
  SprintsResponse,
} from "./types";

// Em produção (Vercel), a API é same-origin (/api/* → função Python) → BASE "".
// Em dev local, .env.local aponta para a API em http://localhost:8000.
const BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API ${path} -> ${res.status}`);
  return res.json() as Promise<T>;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API ${path} -> ${res.status}`);
  return res.json() as Promise<T>;
}

export const api = {
  catalog: () => get<CatalogResponse>("/api/catalog"),
  scenarios: (p: Params) => post<ScenariosResponse>("/api/scenarios", p),
  migrate: (p: Params, migrate_gain: Record<string, number>) =>
    post<MigrateResponse>("/api/migrate", { ...p, migrate_gain }),
  comparison: (p: Params, migrate_gain: Record<string, number>) =>
    post<ComparisonResponse>("/api/comparison", { ...p, migrate_gain }),
  egps: (p: Params, migrate_gain: Record<string, number>) =>
    post<EgpsResponse>("/api/egps", { ...p, migrate_gain }),
  egpChildren: (egp_name: string) =>
    post<{ egp_name: string; children: SasChild[] }>("/api/egps/children", {
      egp_name,
    }),
  orphans: (p: Params) => post<OrphansResponse>("/api/orphans", p),
  sprints: (p: Params) => post<SprintsResponse>("/api/sprints", p),
  exportUrl: () => `${BASE}/api/export`,
  async exportFile(p: Params, formato: "xlsx" | "csv"): Promise<Blob> {
    const res = await fetch(`${BASE}/api/export?formato=${formato}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    });
    if (!res.ok) throw new Error(`export ${formato} -> ${res.status}`);
    return res.blob();
  },
};
