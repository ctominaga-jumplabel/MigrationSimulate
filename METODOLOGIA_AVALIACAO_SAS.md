# Metodologia de Avaliação de Complexidade e Esforço — Arquivos SAS

> **Objetivo da avaliação:** estimar o esforço (em horas) para **migrar cada arquivo `.sas` para Python/PySpark**, incluindo análise, reescrita, testes unitários básicos e validação de equivalência de resultados (reconciliação com a saída SAS original).
>
> Esta metodologia define **parâmetros determinísticos e mensuráveis** que devem ser extraídos automaticamente do conteúdo de cada arquivo `.sas`, evitando avaliação subjetiva.

---

## 1. Princípios

1. **Determinismo**: dois avaliadores diferentes, aplicando esta metodologia ao mesmo arquivo, devem chegar ao mesmo score (tolerância ±5%).
2. **Mensurabilidade**: cada parâmetro é obtido via regex/parsing do código-fonte.
3. **Transparência**: o `.xlsx` final deve conter as métricas brutas, os scores parciais, o score final, os multiplicadores aplicados e a estimativa de horas, permitindo auditoria item a item.
4. **Calibração**: as horas estão calibradas para uma **pessoa de nível pleno** com experiência tanto em SAS quanto em Python/PySpark. Ajustar com multiplicador global, se necessário (ver §7).

---

## 2. Dimensões de avaliação

Cada dimensão recebe um score de **1 (trivial)** a **5 (muito complexo)** com base em faixas objetivas. O score final é a **média ponderada** das dimensões.

### D1. Tamanho efetivo (peso 15%)

Medida: **LOC efetivas** = linhas totais − linhas em branco − linhas que contêm apenas comentário (`* …;`, `/* … */`, `%* …;`).

| Faixa LOC efetivas | Score |
|---|---|
| ≤ 50 | 1 |
| 51 – 200 | 2 |
| 201 – 600 | 3 |
| 601 – 1500 | 4 |
| > 1500 | 5 |

### D2. Estruturas SAS (peso 15%)

Medida: contagem de **DATA steps** + contagem de **PROC steps**.

- DATA step: regex `(?im)^\s*data\s+[\w\.]+`
- PROC step: regex `(?im)^\s*proc\s+\w+`
- Registrar também a **distribuição de PROCs** (quais e quantos): SQL, MEANS, FREQ, SUMMARY, REPORT, TRANSPOSE, SORT, IMPORT, EXPORT, FORMAT, DATASETS, APPEND, SQL, TABULATE, FCMP, IML, outros.

| Total (DATA + PROC) | Score |
|---|---|
| ≤ 3 | 1 |
| 4 – 10 | 2 |
| 11 – 25 | 3 |
| 26 – 60 | 4 |
| > 60 | 5 |

### D3. Programação macro (peso 15%)

Medidas:
- **Macros definidas**: `%macro\s+\w+`
- **Chamadas de macro de usuário**: `%\w+\s*\(` excluindo macros built-in (`%let`, `%do`, `%if`, `%end`, `%mend`, `%put`, `%global`, `%local`, `%sysfunc`, `%scan`, `%eval`, `%sysevalf`, `%str`, `%nrstr`, `%bquote`, `%nrbquote`, `%superq`, `%symdel`, `%upcase`, `%lowcase`, `%substr`, `%index`, `%length`, `%trim`, `%left`, `%qsysfunc`, `%include`, `%macro`, `%mend`)
- **Macros de controle**: `%if`, `%do`, `%do %while`, `%do %until`
- **Profundidade máxima de aninhamento de macros**: contar `%macro` dentro de outro `%macro`.

Score:

| Critério | Score |
|---|---|
| 0 macros definidas, ≤2 chamadas, sem `%if/%do` | 1 |
| 1–2 macros definidas OU 3–10 chamadas | 2 |
| 3–6 macros OU 11–30 chamadas OU presença de `%if` + `%do` | 3 |
| 7–15 macros OU 31–80 chamadas OU aninhamento ≥ 2 | 4 |
| > 15 macros OU > 80 chamadas OU aninhamento ≥ 3 | 5 |

### D4. Manipulação de dados (peso 20%)

Sub-medidas (somar pontos para chegar ao score):

| Padrão | Como detectar (regex) | Pontos por ocorrência |
|---|---|---|
| `JOIN` em PROC SQL | `(?i)\b(inner|left|right|full|outer|cross)\s+join\b` | 2 |
| `MERGE` em DATA step | `(?im)^\s*merge\s+` | 2 |
| `SET` com múltiplas tabelas | `(?im)^\s*set\s+\S+\s+\S+` | 1 |
| `PROC TRANSPOSE` | `(?im)^\s*proc\s+transpose` | 3 |
| `BY` group com `FIRST.`/`LAST.` | `\b(first|last)\.\w+\b` | 1 (por arquivo, não por ocorrência) |
| `RETAIN`, `LAG`, `DIF` | `(?im)\b(retain|lag\d*|dif\d*)\b` | 1 (por construto presente) |
| `PROC SQL` com subquery | `(?is)proc\s+sql.*?\(\s*select` | 2 |
| Window function-like (`HAVING`, `GROUP BY` com agregações múltiplas) | `(?i)\bhaving\b` | 1 |
| `HASH` object / `DECLARE HASH` | `(?i)\bdeclare\s+hash\b` | 3 |
| Arrays SAS | `(?im)^\s*array\s+` | 1 |

Faixas:

| Pontos somados | Score |
|---|---|
| 0 – 2 | 1 |
| 3 – 6 | 2 |
| 7 – 15 | 3 |
| 16 – 30 | 4 |
| > 30 | 5 |

### D5. Lógica condicional e fluxo (peso 10%)

Medidas:
- `IF`/`THEN`/`ELSE` em DATA step: `(?im)\bif\s+.+\bthen\b`
- `SELECT`/`WHEN`: `(?im)\bselect\s*\(.*\).*?\bwhen\b`
- `DO`/`END` (loops): `(?im)\bdo\s+\w+\s*=` ou `\bdo\s+(while|until)\b`
- `GOTO` / `LINK`: `(?im)\b(goto|link)\s+\w+`
- Profundidade máxima de aninhamento de `DO`.

| Total de construtos condicionais/loop | Score |
|---|---|
| ≤ 3 | 1 |
| 4 – 15 | 2 |
| 16 – 40 | 3 |
| 41 – 100 | 4 |
| > 100 OU aninhamento DO ≥ 4 OU presença de GOTO | 5 |

### D6. Integrações externas / dependências (peso 15%)

Medidas (somar pontos):

| Item | Regex | Pontos |
|---|---|---|
| `LIBNAME` apontando para SGBD (oracle, sqlsvr, odbc, db2, teradata, postgres) | `(?im)^\s*libname\s+\w+\s+(oracle\|sqlsvr\|odbc\|db2\|teradata\|postgres)` | 3 por libname |
| `LIBNAME` apontando para path local | `(?im)^\s*libname\s+\w+\s+["']` | 1 por libname |
| `PROC IMPORT` / `PROC EXPORT` | `(?im)^\s*proc\s+(import\|export)` | 2 |
| `%INCLUDE` | `(?im)^\s*%include\s+` | 2 (cada um é uma dependência externa) |
| `FILENAME` (PIPE, FTP, HTTP, EMAIL) | `(?i)\bfilename\s+\w+\s+(pipe\|ftp\|http\|email)` | 4 |
| `ODS` (output formatado) | `(?im)^\s*ods\s+\w+` | 1 |
| `DDE` / Excel via DDE | `(?i)\bdde\b` | 5 |
| `PROC SOAP` / `PROC HTTP` / API externa | `(?im)^\s*proc\s+(soap\|http)` | 4 |

| Pontos somados | Score |
|---|---|
| 0 – 1 | 1 |
| 2 – 4 | 2 |
| 5 – 10 | 3 |
| 11 – 20 | 4 |
| > 20 | 5 |

### D7. Qualidade / manutenibilidade (peso 10%) — score *inverso*

Medidas:
- **Razão comentário/código** = linhas de comentário / LOC efetivas.
- **Magic numbers**: literais numéricos com mais de 4 dígitos fora de contexto óbvio.
- **Hardcoded paths**: ocorrências de `["'].:\\` ou `["']/[a-z]+/`.
- **Nomenclatura inconsistente**: presença de espaços nos nomes de variáveis SAS (`name literals` `'foo bar'n`).

| Critério | Score (esforço extra) |
|---|---|
| Bem comentado (≥15%), sem hardcoded paths, sem magic numbers | 1 |
| Razoavelmente comentado (5–15%) | 2 |
| Pouco comentado (<5%) OU 1–3 hardcoded paths | 3 |
| Sem comentários úteis E hardcoded paths múltiplos | 4 |
| Código ofuscado, sem comentários, hardcoded em excesso, name literals | 5 |

---

## 3. Cálculo do score final

```
score_ponderado = (D1×0.15) + (D2×0.15) + (D3×0.15) + (D4×0.20)
                + (D5×0.10) + (D6×0.15) + (D7×0.10)
```

Resultado entre **1.0 e 5.0**.

---

## 4. Categoria de complexidade

| Score ponderado | Categoria | Horas base (migração para Python/PySpark) |
|---|---|---|
| 1.00 – 1.79 | **Trivial** | 2 – 6 h |
| 1.80 – 2.59 | **Simples** | 6 – 16 h |
| 2.60 – 3.39 | **Médio** | 16 – 40 h |
| 3.40 – 4.19 | **Complexo** | 40 – 90 h |
| 4.20 – 5.00 | **Muito Complexo** | 90 – 200 h |

Para reportar uma **única estimativa** no `.xlsx`, use **interpolação linear** dentro da faixa, baseada na posição do score na faixa da categoria. Exemplo: categoria "Médio" (2.60–3.39, faixa 16–40h); score 3.00 → posição 50% na faixa → 28h.

---

## 5. Multiplicadores de ajuste

Aplicam-se ao valor base de horas:

| Condição | Multiplicador |
|---|---|
| Arquivo é **somente parâmetros** (apenas `%let`, `libname`, `filename`, sem DATA/PROC steps lógicos) | × 0.4 |
| Arquivo contém DDE ou integração Excel viva | × 1.4 |
| Arquivo contém SAS/IML, PROC FCMP, PROC OPTMODEL | × 1.5 |
| Encoding suspeito (acentuação corrompida, mojibake) ou nomes em latin-1 | × 1.1 |
| Profundidade de macro ≥ 3 | × 1.2 |
| Arquivo aparenta ser duplicata (mesmo nome-base, `(2)`, `(3)`, etc.) | × 0.3 (assume reuso da análise da versão "mestre") |

Multiplicadores são **multiplicativos** (compostos), com **piso de × 0.3** e **teto de × 2.0**.

---

## 6. Detecção de duplicatas

Arquivos com **mesmo nome-base** após remover sufixos como ` (2)`, ` (3)`, `_BKP`, `_v2`, ` - Copia`, devem ser agrupados. Um grupo é **canônico**: o de maior LOC efetiva (ou modificação mais recente, se LOC empate); os demais recebem o multiplicador × 0.3 e a flag `is_likely_duplicate = TRUE`, com a coluna `canonical_file` apontando para o canônico do grupo.

---

## 7. Calibração global

A estimativa final pode ser ajustada por um **fator de calibração `K`** (padrão `K = 1.0`) aplicado ao resultado total. Use:

- `K = 0.8` se a equipe tem alta proficiência em SAS *e* PySpark.
- `K = 1.0` (padrão) para equipe pleno em ambos.
- `K = 1.3` se a equipe é nova em SAS (precisará de tempo extra de leitura/entendimento).

---

## 8. Schema de saída (`.xlsx`)

A planilha resultante deve ter **três abas**:

### Aba 1 — `avaliacao` (uma linha por arquivo)

| Coluna | Tipo | Descrição |
|---|---|---|
| `file_name` | str | Nome do arquivo (sem path) |
| `file_path` | str | Caminho relativo a partir de `all_sas/` |
| `size_kb` | float | Tamanho em KB |
| `loc_total` | int | Linhas totais |
| `loc_effective` | int | Linhas efetivas (sem comentário/branco) |
| `loc_comment` | int | Linhas de comentário |
| `comment_ratio` | float | `loc_comment / loc_effective` |
| `n_data_steps` | int | |
| `n_proc_steps` | int | |
| `proc_distribution` | str (JSON) | `{"sql": 3, "freq": 1, ...}` |
| `n_macros_defined` | int | |
| `n_macro_calls` | int | |
| `macro_nesting_depth` | int | |
| `n_joins_sql` | int | |
| `n_merges` | int | |
| `n_transpose` | int | |
| `has_hash_object` | bool | |
| `has_arrays` | bool | |
| `n_if_then` | int | |
| `n_select_when` | int | |
| `n_do_loops` | int | |
| `max_do_nesting` | int | |
| `has_goto_link` | bool | |
| `n_libname_db` | int | LIBNAMEs apontando para SGBD |
| `n_libname_local` | int | LIBNAMEs locais |
| `n_import_export` | int | |
| `n_include` | int | |
| `has_dde` | bool | |
| `has_iml_fcmp_optmodel` | bool | |
| `n_hardcoded_paths` | int | |
| `score_D1_tamanho` | int (1-5) | |
| `score_D2_estruturas` | int (1-5) | |
| `score_D3_macro` | int (1-5) | |
| `score_D4_manipulacao` | int (1-5) | |
| `score_D5_logica` | int (1-5) | |
| `score_D6_integracoes` | int (1-5) | |
| `score_D7_qualidade` | int (1-5) | |
| `score_ponderado` | float | 1.0–5.0 |
| `categoria` | str | Trivial / Simples / Médio / Complexo / Muito Complexo |
| `horas_base_min` | float | Limite inferior da faixa da categoria |
| `horas_base_max` | float | Limite superior |
| `horas_base_interpoladas` | float | Interpolação linear dentro da faixa |
| `multiplicadores_aplicados` | str | Ex.: `"params_only(×0.4); dup(×0.3)"` |
| `multiplicador_total` | float | Produto dos multiplicadores (piso 0.3, teto 2.0) |
| `horas_estimadas` | float | `horas_base_interpoladas × multiplicador_total × K` |
| `is_likely_duplicate` | bool | |
| `canonical_file` | str | Nome do canônico do grupo, se duplicata |
| `is_params_only` | bool | |
| `observacoes` | str | Notas automáticas (ex.: "encoding suspeito") |

### Aba 2 — `resumo_categoria`

Agregação por `categoria`: `n_arquivos`, `horas_estimadas_total`, `horas_medias`, `% do total de horas`.

### Aba 3 — `metodologia`

Cópia textual desta metodologia (para que o `.xlsx` seja auto-contido e auditável).

---

## 9. Notas de implementação

- **Encoding**: ler arquivos com `encoding='latin-1'` ou `encoding='cp1252'` como fallback se `utf-8` falhar (comum em SAS legado brasileiro).
- **Comentários SAS**: `/* … */` pode ser multilinha; `* …;` é até o próximo `;`; `%* …;` é macro-comment. Tratar os três.
- **Strings**: ignorar conteúdo dentro de aspas para não contar palavras-chave em literais.
- **Performance**: para ~2000 arquivos, processamento sequencial em Python deve levar < 60s. Não usar LLM por arquivo — toda a contagem é regex/parsing.
