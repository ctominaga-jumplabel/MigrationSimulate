# Idealização — Simulador de Esforço: Migração SAS → Databricks (PySpark)

> Documento de idealização. Define **o quê** e **por quê**. O **como** (execução) é
> conduzido pelos agentes sob `AIOS.md`. Status de execução vive em `.ai/state/`.

---

## 1. Objetivo

Aplicação interativa que estima o **esforço (horas)** e o **cronograma (sprints)** para
migrar a base SAS (arquivos `.egp` e `.sas`) para Databricks / PySpark, permitindo simular
cenários ao variar nº de consultores, overhead de orquestração e fatores de calibração.

## 2. Insumos já existentes na pasta

| Artefato | Conteúdo |
|---|---|
| `all_egps/` | 3.238 arquivos `.egp` |
| `sas_by_egp/<egp>/*.sas` | 3.198 pastas (1 por `.egp`) com os `.sas` extraídos — 53.103 `.sas` |
| `all_sas/*.sas` | 1.869 `.sas` órfãos (não pertencem a nenhum `.egp`) |
| `avaliacao_complexidade_sas.xlsx` | 54.972 linhas (1 por `.sas`) com score, categoria e `horas_estimadas` |
| `METODOLOGIA_AVALIACAO_SAS.md` | Metodologia determinística (7 dimensões, multiplicadores, dedup) |

**Mapeamento já presente nos dados** — o campo `file_path` distingue tudo:
- `sas_by_egp/<nome_do_egp>/arquivo.sas` → o `.sas` pertence àquele `.egp`.
- `all_sas/arquivo.sas` → `.sas` órfão (não está em nenhum `.egp`).

**Totais de referência (×0.3 de duplicata já aplicado pela metodologia):**
- ~179.742 h somando tudo (cenário **Bruto**).
- ~115.002 h considerando só não-duplicatas (cenário **Sem duplicatas**).
- 39.051 arquivos (71%) marcados como provável duplicata — maior driver de incerteza.
- Categorias: 44.809 Trivial · 6.716 Simples · 2.805 Médio · 476 Complexo · 166 Muito Complexo.

## 3. Decisões de produto (confirmadas)

1. **Stack:** App **Streamlit** (Python).
2. **Duplicatas:** mostrar **dois cenários lado a lado** — Bruto vs Sem duplicatas.
3. **Granularidade:** prioridade e sprints **por EGP (pipeline inteiro)** + `.sas` órfãos como itens avulsos.
4. **Alavancas na app:** nº de consultores · overhead de Job (J_base, J_task) · horas produtivas/dia · fator K. (Sem penalidade de coordenação.)
5. **Defaults:** prioridade padrão = maior esforço primeiro; 6h/dia; J_base = 8h; J_task = 2h; K = 1.0.

## 4. Modelo de cálculo

**Esforço por `.sas`** = `horas_estimadas` da planilha.

**Esforço por EGP** (Job no Databricks):
```
horas_egp = Σ(horas_sas do egp) + overhead_orquestração
overhead_orquestração = J_base + J_task × n_sas_no_egp
```

**Dois cenários:**
- **Bruto** — todos os 3.198 EGPs; duplicatas entram com ×0.3 (metodologia).
- **Sem duplicatas** — colapsa famílias de versões do mesmo pipeline (remove sufixos
  ` (2)`, `(3)`, `_v2`, `_BKP`, ` - Copia`, datas — regras do §6 da metodologia) para o EGP
  canônico (maior esforço da família); dentro dele conta só `.sas` com `is_likely_duplicate = False`.

**Duração** (homem-hora é fixo; nº de consultores reduz duração, não esforço):
```
duração_horas = esforço_total / (n_consultores × horas_dia)
```

**Sprints** (10 dias úteis cada):
```
capacidade_sprint = n_consultores × horas_dia × 10
```
Itens ordenados por prioridade são empacotados sequencialmente; um EGP grande pode
atravessar mais de um sprint. Calendário a partir de uma data inicial (default 15/06/2026),
pulando fins de semana.

**Calibração K:** aplicado ao esforço total — 0.8 (time sênior em SAS+PySpark) / 1.0 (padrão) / 1.3 (time novo em SAS).

## 5. Telas

1. **Visão Geral** — KPIs Bruto vs Sem-dup lado a lado (horas, nº EGPs, nº órfãos, duração, nº sprints) + gráfico de distribuição por categoria.
2. **EGPs** — tabela: EGP · nº `.sas` · horas dos `.sas` · horas do Job · total · categoria predominante · **prioridade editável**. Expandir linha → lista dos `.sas` filhos com horas.
3. **SAS órfãos** — os 1.869 de `all_sas/`, com horas e **prioridade editável**.
4. **Sprints** — empacotamento por prioridade: cada sprint com datas, itens, horas usadas/capacidade + timeline.

## 6. Fases de execução

> Cada fase termina com snapshot em `.ai/state/` (ver `AIOS.md` §7).

### Fase 0 — Preparação de dados (ETL)
- Script `prepare_data.py`: lê `avaliacao_complexidade_sas.xlsx`, normaliza, deriva `egp_name`,
  `is_orphan`, e `pipeline_family` (nome-base normalizado para colapso de versões).
- Pré-computa roll-ups por EGP nos dois cenários.
- Persiste dataset cacheado (`data/dataset.parquet` + `data/egp_rollup.parquet`).
- **Entregável:** parquet(s) carregáveis em < 1s; contagens batem com a planilha.

### Fase 1 — Esqueleto Streamlit + Visão Geral
- `app.py` com layout de abas e sidebar de alavancas.
- Carregamento cacheado (`st.cache_data`) dos parquet.
- KPIs dos dois cenários + gráfico de categorias.
- **Entregável:** `streamlit run app.py` abre e mostra os KPIs corretos.

### Fase 2 — Aba EGPs
- Tabela com roll-up por EGP, expansão para `.sas` filhos.
- Coluna de prioridade editável (`st.data_editor`), default = maior esforço primeiro.
- **Entregável:** edição de prioridade persiste em `st.session_state`.

### Fase 3 — Aba SAS órfãos
- Tabela dos `all_sas/` com horas e prioridade editável.
- **Entregável:** órfãos integrados à mesma fila de prioridade dos EGPs.

### Fase 4 — Motor de cálculo + alavancas
- Função pura `compute_scenarios(params)` que recalcula esforço/duração com base nas alavancas.
- Toggle/colunas Bruto vs Sem-dup consistentes em todas as telas.
- **Entregável:** mudar slider recalcula tudo instantaneamente.

### Fase 5 — Aba Sprints
- Empacotamento greedy por prioridade respeitando capacidade do sprint.
- Calendário (datas por sprint, pula fins de semana) + timeline.
- **Entregável:** alocação coerente; soma das horas dos sprints = esforço total.

### Fase 6 — Polimento, export e validação
- Export para Excel/CSV do plano de sprints.
- Validação cruzada dos totais com a planilha original.
- README de uso.
- **Entregável:** app pronta para apresentação ao cliente.

## 7. Riscos e premissas

- **Duplicatas (71%)** são o maior fator de incerteza — por isso os dois cenários.
- O colapso de "famílias de pipeline" é heurístico (regex de sufixos); validar amostra.
- `horas_estimadas` herda as premissas da metodologia (pessoa pleno em SAS+PySpark).
- Overhead de Job (J_base/J_task) é estimativa de partida — calibrar com o time.
- Encoding latin-1/cp1252 nos nomes/conteúdos SAS (mojibake) — tratar na leitura.

## 8. Fora de escopo (v1)

- Conversão automática de código SAS → PySpark.
- Reordenação por drag-and-drop (usar edição de número de prioridade).
- Feriados no calendário de sprints (só fins de semana na v1).
