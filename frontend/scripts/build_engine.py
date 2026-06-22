# -*- coding: utf-8 -*-
"""build_engine.py — prepara o "engine vendorizado" para o deploy no Vercel.

Por que existe: no Vercel, a função Python (frontend/api/index.py) precisa ter
`core.py` + os dados DENTRO do projeto (frontend/), e SEM `pyarrow` (pesado, perto
do limite de 250MB da função). Este script, rodado LOCALMENTE (onde há pyarrow):

  1. Copia, VERBATIM, o motor e a camada de transporte da raiz para
     frontend/_engine/ (core.py, api/models.py, api/serializers.py).
     -> NÃO reimplementa nada; é cópia byte-a-byte. `core.py` da raiz continua
        sendo a única fonte editável e a testada por pytest.
  2. Converte os parquet em CSV ENXUTO (só as colunas que o core usa) em
     frontend/_engine/data/ — o pandas lê CSV sem pyarrow.

Rode sempre que `core.py`, `api/models.py`, `api/serializers.py` ou os dados
mudarem:
    python frontend/scripts/build_engine.py
"""
from __future__ import annotations

import shutil
from pathlib import Path

import pandas as pd

FRONTEND = Path(__file__).resolve().parent.parent
REPO = FRONTEND.parent
ENGINE = FRONTEND / "_engine"
ENGINE_DATA = ENGINE / "data"

# Colunas do dataset realmente usadas pelo core (overview_metrics,
# categoria_distribution, orphan_table, sas_children, compute_scenarios).
DATASET_COLS = [
    "file_name",
    "categoria",
    "horas_estimadas",
    "loc_total",
    "is_likely_duplicate",
    "egp_name",
    "is_orphan",
    "pipeline_family",
]

VENDOR_FILES = [
    (REPO / "core.py", ENGINE / "core.py"),
    (REPO / "api" / "models.py", ENGINE / "models.py"),
    (REPO / "api" / "serializers.py", ENGINE / "serializers.py"),
]

HEADER = (
    "# === ARQUIVO GERADO por frontend/scripts/build_engine.py — NÃO EDITE ===\n"
    "# Fonte canônica: {src}. Edite lá e rode o script de novo.\n"
)


def vendor_code() -> None:
    ENGINE.mkdir(parents=True, exist_ok=True)
    (ENGINE / "__init__.py").write_text("", encoding="utf-8")
    for src, dst in VENDOR_FILES:
        code = src.read_text(encoding="utf-8")
        rel = src.relative_to(REPO).as_posix()
        dst.write_text(HEADER.format(src=rel) + code, encoding="utf-8")
        print(f"  vendor: {rel} -> {dst.relative_to(FRONTEND).as_posix()}")


def export_csv() -> None:
    ENGINE_DATA.mkdir(parents=True, exist_ok=True)
    dataset = pd.read_parquet(REPO / "data" / "dataset.parquet")
    rollup = pd.read_parquet(REPO / "data" / "egp_rollup.parquet")

    slim = dataset[DATASET_COLS].copy()
    slim.to_csv(ENGINE_DATA / "dataset.csv", index=False)
    rollup.to_csv(ENGINE_DATA / "rollup.csv", index=False)
    print(
        f"  data: dataset.csv ({len(slim):,} linhas, {len(DATASET_COLS)} cols) "
        f"+ rollup.csv ({len(rollup):,} linhas)"
    )


def main() -> None:
    print("Gerando engine vendorizado para o Vercel em frontend/_engine/ ...")
    vendor_code()
    export_csv()
    print("OK. Lembre de commitar frontend/_engine/ para o deploy.")


if __name__ == "__main__":
    main()
