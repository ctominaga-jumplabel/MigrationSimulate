# -*- coding: utf-8 -*-
"""API fina (FastAPI) do Cogna Migration Mission Control.

Camada de TRANSPORTE: embrulha `core.py` e NÃO contém cálculo de negócio
(AIOS §10/§12). Cada rota chama uma função pura do `core` e serializa o
resultado. A carga dos parquet é única (no startup), espelhando o cache do
Streamlit (`st.cache_data(load_parquets)`).

Rodar (a partir da raiz do repositório):
    uvicorn api.main:app --reload --port 8000
"""
from __future__ import annotations

import io
import os

import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

import core
from api.models import EgpChildrenRequest, MigrateRequest, Params
from api.serializers import clean_dict, deep_clean, df_to_records

app = FastAPI(
    title="Cogna Migration Mission Control API",
    description="API fina sobre core.py (motor de cálculo). Sem cálculo novo.",
    version="1.0.0",
)

# CORS. Em dev: localhost. Em produção: defina FRONTEND_ORIGIN com o domínio do
# frontend (ex.: "https://cogna-mission-control.vercel.app"; aceita lista separada
# por vírgula). FRONTEND_ORIGIN_REGEX cobre previews (ex.: r"https://.*\.vercel\.app").
_origins = ["http://localhost:3000", "http://127.0.0.1:3000"]
_env_origins = os.getenv("FRONTEND_ORIGIN", "")
if _env_origins:
    _origins += [o.strip() for o in _env_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_origin_regex=os.getenv("FRONTEND_ORIGIN_REGEX") or None,
    allow_methods=["*"],
    allow_headers=["*"],
)


class _Data:
    """Carga única dos parquet (read-only). Substitui o cache do Streamlit."""

    dataset_df: pd.DataFrame | None = None
    rollup_df: pd.DataFrame | None = None


@app.on_event("startup")
def _load() -> None:
    _Data.dataset_df, _Data.rollup_df = core.load_parquets()


def _dfs() -> tuple[pd.DataFrame, pd.DataFrame]:
    if _Data.dataset_df is None or _Data.rollup_df is None:
        _Data.dataset_df, _Data.rollup_df = core.load_parquets()
    return _Data.dataset_df, _Data.rollup_df


# ---------------------------------------------------------------------------
# Saúde / catálogo (dados que NÃO dependem das alavancas).
# ---------------------------------------------------------------------------
@app.get("/api/health")
def health() -> dict:
    dataset_df, rollup_df = _dfs()
    return {
        "status": "ok",
        "n_linhas": int(len(dataset_df)),
        "n_egps": int(len(rollup_df)),
    }


@app.get("/api/catalog")
def catalog() -> dict:
    """Dados descritivos fixos: métricas de visão geral + distribuição por categoria."""
    dataset_df, _ = _dfs()
    desc = core.overview_metrics(dataset_df)
    dist = core.categoria_distribution(dataset_df)
    return {
        "overview": {
            "bruto": clean_dict(desc["bruto"]),
            "sem_dup_arquivo": clean_dict(desc["sem_dup_arquivo"]),
        },
        "categoria_distribution": df_to_records(dist),
        "categoria_order": core.CATEGORIA_ORDER,
        "migrate_gain_default": core.MIGRATE_GAIN_DEFAULT,
    }


# ---------------------------------------------------------------------------
# Migrate (MigrateMind): tempo de desenvolvimento COM a ferramenta. Reativo às
# alavancas + ao ganho por categoria. Sem cálculo novo — embrulha
# core.compute_migrate (que reaproveita compute_scenarios + _effort_metrics).
# ---------------------------------------------------------------------------
@app.post("/api/migrate")
def migrate(req: MigrateRequest) -> dict:
    dataset_df, rollup_df = _dfs()
    result = core.compute_migrate(
        dataset_df, rollup_df, req.core_params(), gain_map=req.core_gain()
    )
    return deep_clean({"bruto": result["bruto"], "sem_dup": result["sem_dup"]})


# ---------------------------------------------------------------------------
# Cenários (KPIs Bruto + Sem-dup). Reativo às alavancas.
# ---------------------------------------------------------------------------
def _scenario_kpis(cen: dict) -> dict:
    """Extrai os escalares de um cenário (descarta a fila `itens`)."""
    return clean_dict({k: v for k, v in cen.items() if k != "itens"})


@app.post("/api/scenarios")
def scenarios(params: Params) -> dict:
    dataset_df, rollup_df = _dfs()
    result = core.compute_scenarios(
        dataset_df, rollup_df, params.core_params(),
        prioridades=params.core_prioridades(),
    )
    return {
        "bruto": _scenario_kpis(result["bruto"]),
        "sem_dup": _scenario_kpis(result["sem_dup"]),
    }


# ---------------------------------------------------------------------------
# EGPs / órfãos (tabelas do cenário ativo). Listas completas; frontend filtra.
# ---------------------------------------------------------------------------
@app.post("/api/egps")
def egps(req: MigrateRequest) -> dict:
    dataset_df, rollup_df = _dfs()
    table = core.egp_migrate_table(
        dataset_df, rollup_df, req.core_params(), req.cenario, gain_map=req.core_gain()
    )
    return {"cenario": req.cenario, "egps": df_to_records(table)}


@app.post("/api/egps/children")
def egp_children(req: EgpChildrenRequest) -> dict:
    dataset_df, _ = _dfs()
    children = core.sas_children(dataset_df, req.egp_name)
    return {"egp_name": req.egp_name, "children": df_to_records(children)}


@app.post("/api/orphans")
def orphans(params: Params) -> dict:
    dataset_df, _ = _dfs()
    table = core.orphan_table(dataset_df, params.cenario)
    return {"cenario": params.cenario, "orphans": df_to_records(table)}


# ---------------------------------------------------------------------------
# Sprints (empacotamento do cenário ativo, respeitando prioridade).
# ---------------------------------------------------------------------------
@app.post("/api/sprints")
def sprints(params: Params) -> dict:
    dataset_df, rollup_df = _dfs()
    result = core.compute_scenarios(
        dataset_df, rollup_df, params.core_params(),
        prioridades=params.core_prioridades(),
    )
    cen = result[params.cenario]
    packed = core.pack_sprints(cen["itens"], params.core_params())
    return {
        "cenario": params.cenario,
        "kpis": _scenario_kpis(cen),
        "resumo_sprints": df_to_records(packed["resumo_sprints"]),
        "alocacao": df_to_records(packed["alocacao"]),
    }


# ---------------------------------------------------------------------------
# Export (xlsx/csv). Reusa core.build_export; serialização xlsx aqui (espelha
# app._export_to_xlsx) para manter `core` puro.
# ---------------------------------------------------------------------------
def _export_to_xlsx(abas: dict) -> bytes:
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        for nome, df in abas.items():
            df.to_excel(writer, sheet_name=nome[:31], index=False)
    return buf.getvalue()


@app.post("/api/export")
def export(params: Params, formato: str = "xlsx") -> Response:
    dataset_df, rollup_df = _dfs()
    abas = core.build_export(
        dataset_df, rollup_df, params.core_params(),
        prioridades=params.core_prioridades(),
    )
    base = f"plano_sprints_{params.cenario}_{params.data_inicio.isoformat()}"
    if formato == "csv":
        csv = abas["resumo_sprints"].to_csv(index=False).encode("utf-8-sig")
        return Response(
            content=csv,
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{base}_resumo.csv"'},
        )
    if formato == "xlsx":
        xlsx = _export_to_xlsx(abas)
        return Response(
            content=xlsx,
            media_type=(
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            ),
            headers={"Content-Disposition": f'attachment; filename="{base}.xlsx"'},
        )
    raise HTTPException(status_code=400, detail=f"formato inválido: {formato!r}")
