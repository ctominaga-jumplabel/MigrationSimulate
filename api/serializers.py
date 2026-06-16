# -*- coding: utf-8 -*-
"""Serialização DataFrame/valores → JSON seguro para a API.

Responsabilidades (camada de transporte, sem cálculo):
  - Converter DataFrames do `core` em listas de dicts.
  - Sanitizar `NaN`/`inf` (ex.: duração infinita quando capacidade=0) → None.
  - Converter `datetime.date` → string ISO.
"""
from __future__ import annotations

import datetime as _dt
import math

import pandas as pd


def safe(v):
    """Torna um valor escalar JSON-safe (NaN/inf→None, date→ISO, numpy→nativo)."""
    if v is None:
        return None
    if isinstance(v, (_dt.date, _dt.datetime)):
        return v.isoformat()
    # numpy / pandas escalares têm .item()
    if hasattr(v, "item") and not isinstance(v, (str, bytes)):
        try:
            v = v.item()
        except (ValueError, AttributeError):
            pass
    if isinstance(v, float):
        if math.isnan(v) or math.isinf(v):
            return None
        return v
    return v


def df_to_records(df: pd.DataFrame) -> list[dict]:
    """DataFrame → lista de dicts JSON-safe."""
    if df is None or len(df) == 0:
        return []
    cols = list(df.columns)
    out = []
    for row in df.itertuples(index=False, name=None):
        out.append({col: safe(val) for col, val in zip(cols, row)})
    return out


def clean_dict(d: dict) -> dict:
    """Sanitiza os valores escalares de um dict (ignora chaves de DataFrame)."""
    return {
        k: safe(v)
        for k, v in d.items()
        if not isinstance(v, pd.DataFrame)
    }
