# BACKLOG (não priorizado)

## Calibração / validação com o cliente (alta utilidade)
- Validar a heurística de `pipeline_family` (colapso de versões) por amostragem com um especialista da Cogna antes de tratar o Sem-dup como número oficial de proposta.
- Calibrar `J_base`/`J_task` (overhead de Job no Databricks) e o fator `K` com a realidade da equipe.

## Evolução de produto (v2)
- Reordenação de prioridade por drag-and-drop (v1 usa edição de número).
- Feriados no calendário de sprints (v1 pula só fins de semana).
- Penalidade de coordenação de time (efeito Brooks) como alavanca opcional.
- Perfis de consultor (sênior/pleno/júnior) com capacidades distintas.
- Alocação de sprints respeitando dependências entre EGPs (ondas de migração).
- Exportar apresentação executiva (PDF) além do Excel/CSV.
- Comparar múltiplos planos (ex.: 3 vs 6 consultores) lado a lado.
- Integração futura com conversão assistida de código SAS → PySpark.

## Técnico
- Otimizar fixtures de `tests/test_core.py` (suíte leva ~174s por recarregar parquet/recomputar cenários).
- Dedup por hash de conteúdo a nível de EGP (alternativa mais robusta à heurística de nome).
