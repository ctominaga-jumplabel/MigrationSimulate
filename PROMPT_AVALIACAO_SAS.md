# Prompt para Claude Code — Avaliação de complexidade e esforço dos arquivos .sas

> Copie tudo abaixo da linha `---` e cole no Claude Code dentro da pasta `c:\Code\Cogna_sas_projects`.

---

Leia o arquivo `METODOLOGIA_AVALIACAO_SAS.md` na raiz deste projeto. Ele define, de forma determinística e mensurável, **7 dimensões de complexidade (D1–D7)**, os **pesos**, o cálculo do **score ponderado**, o **mapeamento para categorias e horas**, os **multiplicadores de ajuste**, a **detecção de duplicatas** e o **schema completo do `.xlsx` de saída (3 abas)**. Trate essa metodologia como **especificação obrigatória** — não invente outros critérios, não pule dimensões, não altere pesos.

Sua tarefa é avaliar **todos os arquivos `.sas` em `all_sas/`** (aproximadamente 1869 arquivos) seguindo exatamente a metodologia, e gerar `avaliacao_complexidade_sas.xlsx` na raiz do projeto.

## Como executar

1. **Não leia os arquivos um a um pelo LLM** — o volume é grande e a análise é puramente regex/parsing. Escreva um **único script Python** (`avaliar_sas.py` na raiz) que:
   - Faz `glob` recursivo de `all_sas/**/*.sas`.
   - Para cada arquivo, lê o conteúdo (com fallback de encoding: `utf-8` → `cp1252` → `latin-1`).
   - **Antes** de aplicar os regex, **remove o conteúdo de comentários e strings literais** (para que palavras-chave dentro de `/* ... */`, `* ...;`, `%* ...;` ou `"..."` / `'...'` não sejam contadas). Mantenha um contador separado de linhas de comentário **antes** dessa limpeza.
   - Calcula **todas as métricas brutas** listadas na metodologia (LOC, contagens de DATA/PROC, macros, joins, merges, transpose, hash, arrays, if/then, select/when, do loops, profundidade do `do`, goto/link, libnames DB vs local, import/export, include, DDE, IML/FCMP/OPTMODEL, hardcoded paths, etc.).
   - Calcula `score_D1`..`score_D7` aplicando exatamente as faixas da metodologia.
   - Calcula `score_ponderado` com os pesos: D1=0.15, D2=0.15, D3=0.15, D4=0.20, D5=0.10, D6=0.15, D7=0.10.
   - Determina `categoria`, `horas_base_min`, `horas_base_max`, e `horas_base_interpoladas` por interpolação linear da posição do score dentro da faixa da categoria.
   - Detecta **duplicatas por nome-base** removendo sufixos `(N)`, `_BKP`, `_v2`, ` - Copia`, etc.; marca a versão de maior LOC efetiva como canônica e as demais com multiplicador × 0.3.
   - Detecta **arquivos somente-parâmetros** (apenas `%let`, `libname`, `filename`, sem `data` nem `proc` lógicos) → × 0.4.
   - Aplica os demais multiplicadores conforme a metodologia (DDE × 1.4, IML/FCMP × 1.5, encoding suspeito × 1.1, macro depth ≥ 3 × 1.2). Compõe multiplicativamente com **piso 0.3 e teto 2.0**.
   - `horas_estimadas = horas_base_interpoladas × multiplicador_total × K`, com `K = 1.0` (padrão).
   - Registra em `multiplicadores_aplicados` a string descritiva de quais foram aplicados.

2. **Gera o `.xlsx`** com **três abas**, exatamente como na §8 da metodologia:
   - `avaliacao`: uma linha por arquivo, com **todas as colunas** do schema, na ordem listada.
   - `resumo_categoria`: agregação por categoria (n_arquivos, horas_total, horas_medias, % do total).
   - `metodologia`: cole o **conteúdo textual integral** de `METODOLOGIA_AVALIACAO_SAS.md` em uma única coluna `texto`, uma linha por linha do arquivo (para que o `.xlsx` seja auto-contido e auditável). Aplique `wrap_text=True` e largura de coluna ~120.
   - Use `openpyxl` (não `xlsxwriter`). Congelar a primeira linha em todas as abas. Aplicar filtro/auto-filter na aba `avaliacao`. Formatar colunas de horas como número com 1 casa decimal.

3. **Dependências**: se `openpyxl` ou `pandas` não estiverem instalados, instale com `pip install openpyxl pandas` antes de rodar.

4. **Execução e validação**:
   - Rode o script.
   - Imprima no console um **resumo**: total de arquivos processados, falhas de leitura (com lista), distribuição por categoria, soma total de horas estimadas.
   - Faça **3 verificações de sanidade** lendo manualmente 3 arquivos representativos (um trivial, um médio, um complexo, escolhidos pelo próprio score) e confirme que as contagens batem com inspeção visual. Reporte o resultado dessa amostra na resposta final.

5. **Não** crie arquivos extras além de `avaliar_sas.py` e `avaliacao_complexidade_sas.xlsx`. Não modifique nada dentro de `all_sas/`.

## Entregáveis ao final

- `avaliar_sas.py` — script Python idempotente, re-executável.
- `avaliacao_complexidade_sas.xlsx` — planilha com as 3 abas.
- Resposta final concisa contendo: (a) totais por categoria, (b) total de horas estimadas, (c) os 10 arquivos com maior `horas_estimadas`, (d) número de duplicatas detectadas e horas economizadas por isso, (e) resultado da amostra de sanidade (3 arquivos).

## Restrições

- Não use a Agent tool para delegar leituras de arquivos `.sas` — toda a análise é feita pelo script Python local.
- Não altere a metodologia. Se identificar algum problema, **reporte** antes de prosseguir.
- Não inclua heurísticas adicionais não previstas na metodologia.
