"""
prepare_data.py — Fase 0 (ETL) do Simulador de Esforço SAS -> Databricks.

Lê a aba `avaliacao` de `avaliacao_complexidade_sas.xlsx` (read-only), deriva
colunas de vínculo/normalização e persiste dois parquets cacheáveis:

    data/dataset.parquet     -> 1 linha por arquivo .sas (colunas originais + derivadas)
    data/egp_rollup.parquet  -> 1 linha por EGP (roll-up de horas/contagens)

Regras de negócio (ver AIOS.md §12 e IDEACAO_SIMULADOR.md §4/§6):
  - Insumos são READ-ONLY: este script só LÊ o .xlsx.
  - `horas_estimadas` NUNCA é recalculado — é a verdade da planilha.
  - O overhead de Job (J_base + J_task * n_sas) NÃO é embutido aqui; ele depende
    das alavancas da app e é calculado em core.py. Aqui só guardamos `n_sas`,
    as somas de horas e as contagens sem-duplicata.

Colunas derivadas:
  - egp_name        : primeiro segmento após 'sas_by_egp/' (file_path.split('/')[1]);
                      None para órfãos (all_sas/).
  - is_orphan       : True se file_path começa com 'all_sas/'.
  - pipeline_family : nome-base normalizado de egp_name (None p/ órfãos) usado para
                      colapsar famílias de versões/cópias do mesmo pipeline.

Normalização de pipeline_family (determinística, defensiva, case-insensitive).
A partir do egp_name, removemos iterativamente, até estabilizar, sufixos/prefixos
de versão/cópia/backup/data, depois normalizamos espaços. Regras aplicadas
(documentadas no §6 da METODOLOGIA + alavancas da idealização):

  Sufixos removidos (no fim da string, repetidamente):
    - ' (2)', ' (3)', ... ' (N)'        -> cópias numeradas (com ou sem espaço)
    - ' - Copy', ' - Copy 01', '_copy'  -> cópias (en) com/sem índice
    - ' (recovered copy)'               -> cópia recuperada (en)
    - '_v2', '_v120925', '_v<dígitos>'  -> versões (underscore)
    - ' - v2', ' v2', '_v<dígitos>'     -> versões (hífen ou espaço)
    - '_BKP', '_bkp', '_bk<dígitos>',
      '_bkp<dígitos>'                   -> backups
    - ' - Copia', ' - Copia old',
      '- Copia', '_copia', ' copia'     -> cópias (pt-BR sem acento)
    - '_old', ' old', '-old'            -> versões antigas
    - '_<8 dígitos>' / '_<6 dígitos>'   -> sufixo de data tipo _20260312 / _120925

  Prefixos removidos (no início da string, repetidamente):
    - '<8 dígitos> - ' / '<6 dígitos> - ' -> prefixo de data tipo '20210107 - '

  Por fim: trim + colapso de espaços múltiplos. O resultado é minúsculo-insensível
  apenas na detecção; preservamos o casing original do nome-base remanescente.

NÃO pretende ser perfeito — apenas determinístico e razoável para colapsar
duplicatas óbvias. O cenário "Bruto" não usa pipeline_family; ele é insumo do
cenário "Sem duplicatas" (colapso por família), refinado em core.py.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

import pandas as pd

# ----------------------------------------------------------------------------
# Caminhos (absolutos, fixos ao repositório)
# ----------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent
XLSX_PATH = BASE_DIR / "avaliacao_complexidade_sas.xlsx"
SHEET = "avaliacao"
DATA_DIR = BASE_DIR / "data"
DATASET_PARQUET = DATA_DIR / "dataset.parquet"
ROLLUP_PARQUET = DATA_DIR / "egp_rollup.parquet"

SAS_BY_EGP_PREFIX = "sas_by_egp/"
ALL_SAS_PREFIX = "all_sas/"

# Valores esperados (Quality Gate de dados) — para o relatório de validação.
EXPECTED = {
    "total_rows": 54972,
    "n_in_egp": 53103,
    "n_orphan": 1869,
    "n_egps": 3198,
    "soma_horas_bruto": 179742.0,
    "soma_horas_sem_dup": 115002.0,
}

# ----------------------------------------------------------------------------
# Normalização de pipeline_family
# ----------------------------------------------------------------------------
# Sufixos: cada padrão é avaliado (case-insensitive) ancorado no FIM da string.
# Aplicamos em loop até a string estabilizar, para colapsar combinações tipo
# 'Pipeline (2)_BKP' -> 'Pipeline'.
_SUFFIX_PATTERNS = [
    r"\s*\(\s*\d+\s*\)\s*$",          # ' (2)', '(3)', ' ( 4 )'  -> cópia numerada
    r"\s*\(recovered copy\)\s*$",     # ' (recovered copy)'  -> cópia recuperada (en)
    r"\s*[-_]?\s*copy(\s+\d+)?\s*$",  # ' - Copy', ' - Copy 01', '_copy'  -> cópia (en)
    r"\s*[-_]?\s*copia\s+old\s*$",    # ' - Copia old', '_copia old'
    r"\s*[-_]?\s*copia\s*$",          # ' - Copia', '_copia', '- copia'
    r"\s*_v\d+\s*$",                  # '_v2', '_v120925'  (underscore — NÃO quebrar)
    r"\s*[-_]\s*v\d+\s*$",            # ' - v2', '-v2', '_ v2'  -> versão com hífen
    r"\s+v\d+\s*$",                   # ' v2'  -> versão com espaço
    r"\s*_bkp\d*\s*$",                # '_BKP', '_bkp1'  -> backup
    r"\s*_bk\d+\s*$",                 # '_bk1', '_bk20260312'
    r"\s*[-_ ]old\s*$",              # '_old', ' old', '-old'
    r"\s*_\d{6,8}\s*$",              # '_20260312' / '_120925' (data)
]
# Prefixos: ancorados no INÍCIO. '20210107 - ' / '120925 - ' (prefixo de data).
_PREFIX_PATTERNS = [
    r"^\s*\d{6,8}\s*-\s*",
]
_SUFFIX_RE = [re.compile(p, flags=re.IGNORECASE) for p in _SUFFIX_PATTERNS]
_PREFIX_RE = [re.compile(p, flags=re.IGNORECASE) for p in _PREFIX_PATTERNS]
_WS_RE = re.compile(r"\s+")


def normalize_pipeline_family(egp_name: str | None) -> str | None:
    """Colapsa egp_name para um nome-base normalizado (determinístico).

    Remove iterativamente sufixos de versão/cópia/backup/data e prefixos de
    data, depois normaliza espaços. Órfãos (egp_name None/vazio) -> None.
    """
    if egp_name is None:
        return None
    if not isinstance(egp_name, str):
        return None
    name = egp_name.strip()
    if name == "":
        return None

    changed = True
    while changed:
        changed = False
        for rx in _SUFFIX_RE:
            new = rx.sub("", name)
            if new != name:
                name = new.strip()
                changed = True
        for rx in _PREFIX_RE:
            new = rx.sub("", name)
            if new != name:
                name = new.strip()
                changed = True

    name = _WS_RE.sub(" ", name).strip()
    return name if name != "" else None


# ----------------------------------------------------------------------------
# Derivação de colunas
# ----------------------------------------------------------------------------
def derive_egp_name(file_path: str) -> str | None:
    if isinstance(file_path, str) and file_path.startswith(SAS_BY_EGP_PREFIX):
        parts = file_path.split("/")
        if len(parts) > 1 and parts[1] != "":
            return parts[1]
    return None


def load_dataset() -> pd.DataFrame:
    if not XLSX_PATH.exists():
        sys.exit(f"ERRO: planilha não encontrada: {XLSX_PATH}")

    df = pd.read_excel(XLSX_PATH, sheet_name=SHEET, engine="openpyxl")

    # Guard de colunas: aborta cedo se a planilha não tiver o esquema esperado.
    required = ["file_name", "file_path", "horas_estimadas", "categoria", "is_likely_duplicate"]
    missing = [c for c in required if c not in df.columns]
    if missing:
        sys.exit(
            "ERRO: colunas obrigatórias ausentes na aba "
            f"'{SHEET}': {', '.join(missing)}"
        )

    # Garantir tipo booleano confiável para is_likely_duplicate.
    if df["is_likely_duplicate"].dtype != bool:
        df["is_likely_duplicate"] = (
            df["is_likely_duplicate"]
            .map(lambda v: str(v).strip().lower() in ("true", "1", "1.0", "yes", "sim"))
            .astype(bool)
        )

    df["egp_name"] = df["file_path"].map(derive_egp_name)
    df["is_orphan"] = df["file_path"].map(
        lambda p: isinstance(p, str) and p.startswith(ALL_SAS_PREFIX)
    )
    df["pipeline_family"] = df["egp_name"].map(normalize_pipeline_family)
    return df


def _mode_categoria(s: pd.Series) -> str | None:
    s = s.dropna()
    if s.empty:
        return None
    m = s.mode()
    return m.iloc[0] if not m.empty else None


def build_rollup(df: pd.DataFrame) -> pd.DataFrame:
    """Roll-up por EGP: 1 linha por egp_name (exclui órfãos, que têm egp_name None)."""
    egp_df = df[df["egp_name"].notna()].copy()

    # Agregação principal (cenário Bruto: todos os .sas do EGP).
    grouped = egp_df.groupby("egp_name", sort=True)
    rollup = grouped.agg(
        n_sas=("file_name", "size"),
        soma_horas_sas=("horas_estimadas", "sum"),
        soma_loc=("loc_total", "sum"),
        categoria_predominante=("categoria", _mode_categoria),
        pipeline_family=("pipeline_family", "first"),
    ).reset_index()
    rollup["soma_loc"] = rollup["soma_loc"].fillna(0).astype(int)

    # Cenário SEM-DUP a nível de arquivo: só is_likely_duplicate == False.
    sem_dup = egp_df[~egp_df["is_likely_duplicate"]]
    sem_dup_grouped = sem_dup.groupby("egp_name", sort=True).agg(
        n_sas_sem_dup=("file_name", "size"),
        soma_horas_sas_sem_dup=("horas_estimadas", "sum"),
        soma_loc_sem_dup=("loc_total", "sum"),
    ).reset_index()

    rollup = rollup.merge(sem_dup_grouped, on="egp_name", how="left")
    # EGPs sem nenhum .sas não-duplicata: 0 arquivos / 0 horas / 0 linhas.
    rollup["n_sas_sem_dup"] = rollup["n_sas_sem_dup"].fillna(0).astype(int)
    rollup["soma_horas_sas_sem_dup"] = rollup["soma_horas_sas_sem_dup"].fillna(0.0)
    rollup["soma_loc_sem_dup"] = rollup["soma_loc_sem_dup"].fillna(0).astype(int)

    return rollup


def print_validation(df: pd.DataFrame, rollup: pd.DataFrame) -> None:
    total_rows = len(df)
    n_in_egp = int(df["egp_name"].notna().sum())
    n_orphan = int(df["is_orphan"].sum())
    n_egps = int(df.loc[df["egp_name"].notna(), "egp_name"].nunique())
    soma_bruto = float(df["horas_estimadas"].sum())
    soma_sem_dup = float(df.loc[~df["is_likely_duplicate"], "horas_estimadas"].sum())
    n_dup = int(df["is_likely_duplicate"].sum())
    n_families = int(rollup["pipeline_family"].nunique(dropna=True))

    # Contagens (inteiros): comparação EXATA via '=='.
    # Somas de horas (floats): tolerância de arredondamento.
    count_rows = [
        ("Total de linhas", EXPECTED["total_rows"], total_rows),
        (".sas em EGP (sas_by_egp)", EXPECTED["n_in_egp"], n_in_egp),
        (".sas órfãos (all_sas)", EXPECTED["n_orphan"], n_orphan),
        ("EGPs distintos (egp_name)", EXPECTED["n_egps"], n_egps),
    ]
    hour_rows = [
        ("Soma horas (Bruto)", EXPECTED["soma_horas_bruto"], round(soma_bruto, 2)),
        ("Soma horas (Sem-dup arquivo)", EXPECTED["soma_horas_sem_dup"], round(soma_sem_dup, 2)),
    ]

    print("\n" + "=" * 72)
    print("RELATÓRIO DE VALIDAÇÃO — Fase 0 (ETL)")
    print("=" * 72)
    print(f"{'Métrica':<34}{'Esperado':>14}{'Observado':>14}{'OK?':>6}")
    print("-" * 72)
    for label, exp, obs in count_rows:
        ok = int(obs) == int(exp)          # contagem: igualdade exata
        print(f"{label:<34}{exp:>14}{obs:>14}{('OK' if ok else 'FALHA'):>6}")
    for label, exp, obs in hour_rows:
        ok = abs(float(obs) - float(exp)) <= max(1.0, abs(float(exp)) * 0.005)
        print(f"{label:<34}{exp:>14}{obs:>14}{('OK' if ok else 'FALHA'):>6}")
    print("-" * 72)
    print(f"{'.sas marcados como duplicata':<34}{'':>14}{n_dup:>14}")
    print(f"{'Linhas no rollup (EGPs)':<34}{'':>14}{len(rollup):>14}")
    print(f"{'pipeline_family distintas':<34}{'':>14}{n_families:>14}")
    print("=" * 72)

    # Amostra do colapso egp_name -> pipeline_family (onde houve mudança).
    collapsed = rollup[rollup["egp_name"] != rollup["pipeline_family"]]
    collapsed = collapsed[collapsed["pipeline_family"].notna()]
    print("\nAmostra de colapso (egp_name -> pipeline_family):")
    sample = collapsed.head(5) if not collapsed.empty else rollup.head(5)
    for _, r in sample.iterrows():
        print(f"  {r['egp_name']!r}  ->  {r['pipeline_family']!r}")
    print()


def sanity_check_egp(df: pd.DataFrame) -> None:
    """Compara egp_name derivado contra a coluna `egp` da planilha (não bloqueante).

    Esperado: zero divergências para linhas em sas_by_egp/. Apenas loga; não aborta.
    Se a coluna `egp` não existir, avisa e segue.
    """
    print("\nSanity check: egp (planilha) vs egp_name (derivado)...")
    if "egp" not in df.columns:
        print("  AVISO: coluna 'egp' ausente na planilha — sanity check pulado.")
        return

    def _norm(v: object) -> str | None:
        if v is None:
            return None
        if isinstance(v, float) and pd.isna(v):
            return None
        s = str(v).strip()
        return s if s != "" else None

    in_egp = df[df["egp_name"].notna()].copy()
    egp_planilha = in_egp["egp"].map(_norm)
    egp_derivado = in_egp["egp_name"].map(_norm)
    diverge_mask = egp_planilha.ne(egp_derivado)
    n_diverge = int(diverge_mask.sum())

    if n_diverge == 0:
        print(f"  OK: {len(in_egp):,} linhas em EGP — zero divergências.")
        return

    print(f"  DIVERGÊNCIA: {n_diverge:,} linha(s) com egp != egp_name (esperado 0). Amostra:")
    sample = in_egp.loc[diverge_mask, ["file_path", "egp", "egp_name"]].head(10)
    for _, r in sample.iterrows():
        print(f"    file_path={r['file_path']!r}  egp={r['egp']!r}  egp_name={r['egp_name']!r}")


def main() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    print(f"Lendo {XLSX_PATH.name} (aba '{SHEET}')...")
    df = load_dataset()
    print(f"  {len(df):,} linhas, {df.shape[1]} colunas.")

    sanity_check_egp(df)

    rollup = build_rollup(df)
    print(f"  Roll-up: {len(rollup):,} EGPs.")

    df.to_parquet(DATASET_PARQUET, engine="pyarrow", index=False)
    rollup.to_parquet(ROLLUP_PARQUET, engine="pyarrow", index=False)
    print(f"Persistido: {DATASET_PARQUET}")
    print(f"Persistido: {ROLLUP_PARQUET}")

    print_validation(df, rollup)


if __name__ == "__main__":
    main()
