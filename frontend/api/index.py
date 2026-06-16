# -*- coding: utf-8 -*-
"""Função serverless (Vercel) da API do Cogna Migration Mission Control.

Mesma API fina de `api/main.py`, adaptada ao Vercel:
  - Importa o motor VENDORIZADO de `frontend/_engine/` (cópia byte-a-byte de
    core.py — ver frontend/scripts/build_engine.py). Nada de cálculo novo.
  - Lê os dados de CSV enxuto (sem `pyarrow`, para caber no limite da função).
  - Exporta `app` (ASGI) — o Vercel cuida do servidor. O rewrite em vercel.json
    manda todo `/api/*` para esta função.

Roteamento robusto: dependendo de como o Vercel apresenta o path à função ASGI
(`/api/scenarios` original OU `/scenarios` já sem prefixo), o wrapper
`EnsureApiPrefix` garante que ele sempre comece por `/api`, casando com as rotas.
"""
from __future__ import annotations

import io
import os
import sys

import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

# --- engine vendorizado (frontend/_engine) --------------------------------
_HERE = os.path.dirname(os.path.abspath(__file__))
_ENGINE = os.path.normpath(os.path.join(_HERE, "..", "_engine"))
if _ENGINE not in sys.path:
    sys.path.insert(0, _ENGINE)

import core  # noqa: E402  (vendorizado)
from models import EgpChildrenRequest, Params  # noqa: E402
from serializers import clean_dict, df_to_records  # noqa: E402

_DATA = os.path.join(_ENGINE, "data")


def _load() -> tuple[pd.DataFrame, pd.DataFrame]:
    """Carrega os CSV enxutos (cold start). Coerção de dtypes p/ paridade c/ parquet."""
    dataset = pd.read_csv(os.path.join(_DATA, "dataset.csv"))
    rollup = pd.read_csv(os.path.join(_DATA, "rollup.csv"))
    for col in ("is_likely_duplicate", "is_orphan"):
        if dataset[col].dtype != bool:
            dataset[col] = (
                dataset[col]
                .astype(str)
                .str.strip()
                .str.lower()
                .isin(("true", "1", "1.0", "yes", "sim"))
            )
    return dataset, rollup


# Carga única por instância (persiste enquanto o container estiver quente).
DATASET_DF, ROLLUP_DF = _load()

api_app = FastAPI(title="Cogna Mission Control API (Vercel)", version="1.0.0")

_origins = ["http://localhost:3000", "http://127.0.0.1:3000"]
_env = os.getenv("FRONTEND_ORIGIN", "")
if _env:
    _origins += [o.strip() for o in _env.split(",") if o.strip()]
api_app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_origin_regex=os.getenv("FRONTEND_ORIGIN_REGEX") or None,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _scenario_kpis(cen: dict) -> dict:
    return clean_dict({k: v for k, v in cen.items() if k != "itens"})


def _export_to_xlsx(abas: dict) -> bytes:
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        for nome, df in abas.items():
            df.to_excel(writer, sheet_name=nome[:31], index=False)
    return buf.getvalue()


@api_app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "n_linhas": int(len(DATASET_DF)), "n_egps": int(len(ROLLUP_DF))}


@api_app.get("/api/catalog")
def catalog() -> dict:
    desc = core.overview_metrics(DATASET_DF)
    dist = core.categoria_distribution(DATASET_DF)
    return {
        "overview": {
            "bruto": clean_dict(desc["bruto"]),
            "sem_dup_arquivo": clean_dict(desc["sem_dup_arquivo"]),
        },
        "categoria_distribution": df_to_records(dist),
        "categoria_order": core.CATEGORIA_ORDER,
    }


@api_app.post("/api/scenarios")
def scenarios(params: Params) -> dict:
    result = core.compute_scenarios(
        DATASET_DF, ROLLUP_DF, params.core_params(), prioridades=params.core_prioridades()
    )
    return {"bruto": _scenario_kpis(result["bruto"]), "sem_dup": _scenario_kpis(result["sem_dup"])}


@api_app.post("/api/egps")
def egps(params: Params) -> dict:
    table = core.egp_table(ROLLUP_DF, params.core_params(), params.cenario)
    return {"cenario": params.cenario, "egps": df_to_records(table)}


@api_app.post("/api/egps/children")
def egp_children(req: EgpChildrenRequest) -> dict:
    children = core.sas_children(DATASET_DF, req.egp_name)
    return {"egp_name": req.egp_name, "children": df_to_records(children)}


@api_app.post("/api/orphans")
def orphans(params: Params) -> dict:
    table = core.orphan_table(DATASET_DF, params.cenario)
    return {"cenario": params.cenario, "orphans": df_to_records(table)}


@api_app.post("/api/sprints")
def sprints(params: Params) -> dict:
    result = core.compute_scenarios(
        DATASET_DF, ROLLUP_DF, params.core_params(), prioridades=params.core_prioridades()
    )
    cen = result[params.cenario]
    packed = core.pack_sprints(cen["itens"], params.core_params())
    return {
        "cenario": params.cenario,
        "kpis": _scenario_kpis(cen),
        "resumo_sprints": df_to_records(packed["resumo_sprints"]),
        "alocacao": df_to_records(packed["alocacao"]),
    }


@api_app.post("/api/export")
def export(params: Params, formato: str = "xlsx") -> Response:
    abas = core.build_export(
        DATASET_DF, ROLLUP_DF, params.core_params(), prioridades=params.core_prioridades()
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
        return Response(
            content=_export_to_xlsx(abas),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{base}.xlsx"'},
        )
    raise HTTPException(status_code=400, detail=f"formato inválido: {formato!r}")


class EnsureApiPrefix:
    """Wrapper ASGI: garante que o path comece por '/api' antes do roteamento."""

    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        if scope.get("type") == "http":
            path = scope.get("path", "")
            if not path.startswith("/api"):
                scope = dict(scope)
                scope["path"] = "/api" + (path if path.startswith("/") else "/" + path)
        await self.inner(scope, receive, send)


# Vercel detecta e serve o ASGI exportado como `app`.
app = EnsureApiPrefix(api_app)
