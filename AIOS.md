# AIOS.md — Constituição do Projeto

> Gerado a partir de `AIOS_TEMPLATE.md` e adaptado a este repositório.
> Toda IA que atuar neste projeto (Claude Code, Codex, Gemini, etc.) opera sob este arquivo.
> **Princípio mestre:** Qualidade primeiro. Economia de tokens por **eliminação de redundância**, nunca por omissão de contexto essencial.

---

## 1. Propósito e Filosofia

Prioridades, nesta ordem (a de número menor vence em conflito):

1. **Qualidade** do que é entregue.
2. **Documentação persistente** (o estado sobrevive à sessão).
3. **Evolução incremental** validada.
4. **Economia de tokens** por não repetir o que já está escrito.
5. **Evitar retrabalho.**

Economia de token **nunca** justifica pular um teste/validação ou omitir contexto que muda a decisão.

---

## 2. Fonte de Verdade (hierarquia)

A conversa é **descartável**. Ordem de autoridade (forte → fraco):

1. **O código atual** no repositório.
2. `.ai/state/CURRENT_STATE.md` — onde o projeto está.
3. `.ai/state/DECISIONS.md` — decisões e porquês.
4. `.ai/state/NEXT_STEPS.md` — o que fazer a seguir.
5. `AIOS.md` (este arquivo) + `IDEACAO_SIMULADOR.md` — regras e desenho.
6. `.ai/state/BACKLOG.md` — não priorizado.
7. A conversa atual — só instrução pontual da tarefa.

> Se a conversa contradiz um arquivo de estado, o **arquivo vence** — ou atualize o arquivo primeiro, explicitamente.

---

## 3. Arquivos de estado (`.ai/state/`)

- **`CURRENT_STATE.md`** — fase atual, o que funciona, o que está quebrado. ≤ ~150 linhas.
- **`DECISIONS.md`** — log append-only: `[data] decisão — motivo — alternativas descartadas`. Nunca reescrever decisão antiga; marque como superada.
- **`NEXT_STEPS.md`** — fila imediata, 3 a 7 itens.
- **`BACKLOG.md`** — ideias não priorizadas.

---

## 4. Regras de economia de contexto

1. **Contexto mínimo.** Ler nesta ordem: `CURRENT_STATE.md` → `NEXT_STEPS.md` → só os arquivos necessários para a tarefa.
2. **Nunca repetir o que já está escrito.** Referencie o arquivo, não recopie.
3. **Prompts cirúrgicos.** "Leia CURRENT_STATE.md e implemente a Fase X" em vez de "analise tudo".
4. **Cite por caminho** (`app.py:func`), não por colagem.
5. **Economize por redundância, não por omissão.**

> ⚠️ O `.xlsx` (54.972 linhas) e os ~55k `.sas` **nunca** devem ser carregados crus no contexto. Sempre via `prepare_data.py` → parquet, ou consultas pontuais.

---

## 5. Workflow — escala com o tamanho da tarefa

Classifique a tarefa primeiro:

### Leve (ajuste isolado, fix de UI, função única)
```
Implementar → Auto-revisão → atualizar CURRENT_STATE.md (se mudou estado)
```
Um único agente. Sem orquestração formal.

### Médio (uma aba/feature contida)
```
Specialist → Reviewer → Validação → Snapshot
```

### Completo (uma Fase inteira da idealização / mudança estrutural)
```
Orchestrator → Specialist(s) → Reviewer → QA → Memory Manager → Snapshot → próxima fase
```

**Neste projeto, cada Fase (0–6) do `IDEACAO_SIMULADOR.md` é uma tarefa "Completa".**
Sub-tarefas dentro de uma fase podem ser Leve/Médio.

**Regra do Memory Manager:** no caminho completo, nenhuma fase termina sem snapshot. Nos leve/médio, o próprio executor atualiza o estado.

---

## 6. Agentes

Vivem em `.ai/agents/<nome>.md` (lidos sob demanda). Conjunto deste projeto:

- **orchestrator** — planeja, classifica tarefas, delega, valida entregas, conduz as fases.
- **data-engineer** — Fase 0 e tudo de ETL/parquet/pandas e fidelidade aos dados da planilha.
- **streamlit-dev** — `app.py`, UI, abas, sidebar, motor de cálculo e cache.
- **reviewer** — revisa diff contra os Quality Gates; barra antes do QA.
- **qa** — valida comportamento e fidelidade numérica (totais batem com a planilha).
- **memory-manager** — atualiza `.ai/state/`, poda redundância, gera snapshot.

---

## 7. Snapshot Protocol

Ao concluir qualquer tarefa que mude o estado:

1. Atualizar `CURRENT_STATE.md` (fase, o que funciona, o que quebrou).
2. Acrescentar a `DECISIONS.md` decisões novas (append-only).
3. Reescrever `NEXT_STEPS.md` com a próxima fila.
4. **Poda ao fim de fase:** consolidar, remover contexto obsoleto, eliminar redundância.

> Critério: após o snapshot, um agente novo reconstrói o estado lendo só `.ai/state/` + código, sem a conversa.

---

## 8. Recuperação e troca de modelo

Reconstrução a frio a partir de:
```
CURRENT_STATE.md + DECISIONS.md + NEXT_STEPS.md + AIOS.md + IDEACAO_SIMULADOR.md + código
```
Particularidades por modelo ficam em `CLAUDE.md` / `CODEX.md` (não aqui).

---

## 9. Quality Gates

Uma fase só é "concluída" quando:

- [ ] Implementação atende ao entregável da fase em `IDEACAO_SIMULADOR.md` §6.
- [ ] Passou pela revisão do caminho (§5).
- [ ] **Fidelidade numérica:** totais derivados batem com a planilha original (tolerância de arredondamento).
- [ ] App roda sem erro (`streamlit run app.py`) quando aplicável.
- [ ] `CURRENT_STATE.md` reflete a realidade.
- [ ] Nenhum segredo/credencial commitado.

```
run:    streamlit run app.py
data:   python prepare_data.py
test:   pytest -q            (a partir da Fase 4; smoke tests do motor de cálculo)
lint:   ruff check .         (se disponível; senão, revisão manual)
```

---

## 10. Anti-patterns

- Carregar o `.xlsx` cru ou os `.sas` em massa no contexto.
- Confiar na conversa como memória.
- Recopiar no prompt algo que já está em arquivo de estado.
- Forçar o pipeline completo em tarefa trivial.
- Encerrar fase sem snapshot.
- Reescrever decisões antigas (marque como superada).
- Recalcular esforço de forma divergente da metodologia (`METODOLOGIA_AVALIACAO_SAS.md`).
- Misturar lógica de cálculo na camada de UI (manter `compute_scenarios` puro e testável).

---

## 11. Prompt Contracts

**Iniciar sessão:**
> Leia `.ai/state/CURRENT_STATE.md` e `.ai/state/NEXT_STEPS.md`. Não leia mais nada. Diga em 3 linhas onde estamos e a próxima tarefa.

**Executar fase:**
> Fase [N] do `IDEACAO_SIMULADOR.md`. Caminho Completo (§5). Delegue ao(s) agente(s) certo(s). Não recopie o que já está em `DECISIONS.md`.

**Revisar:**
> Revise o diff contra os Quality Gates (§9). Aponte riscos. Não aprove sem fidelidade numérica.

**Encerrar:**
> Rode o Snapshot Protocol (§7). Confirme retomada a frio.

---

## 12. PROJECT ADAPTATION BLOCK

```
PROJETO:        Simulador de esforço/cronograma para migração da base SAS (.egp/.sas)
                para Databricks (PySpark). App interativa para simular cenários.

STACK:          Python 3.x · Streamlit · pandas · openpyxl · pyarrow (parquet) · plotly/altair.

ARQUITETURA:    3 camadas. (1) ETL: prepare_data.py lê o .xlsx → parquet normalizado.
                (2) Núcleo: compute_scenarios(params) — função pura de cálculo (esforço,
                duração, sprints), sem Streamlit. (3) UI: app.py (Streamlit) consome núcleo
                + parquet. Ver IDEACAO_SIMULADOR.md.

ESTRUTURA:      .
                ├── AIOS.md, IDEACAO_SIMULADOR.md, METODOLOGIA_AVALIACAO_SAS.md
                ├── avaliacao_complexidade_sas.xlsx        (fonte de dados — read-only)
                ├── all_egps/  sas_by_egp/  all_sas/        (insumos — read-only)
                ├── prepare_data.py        (Fase 0)
                ├── core.py                (motor de cálculo — Fase 4)
                ├── app.py                 (Streamlit — Fase 1+)
                ├── data/                  (parquet gerado)
                ├── tests/                 (a partir da Fase 4)
                └── .ai/{state,agents}/

COMANDOS:       data: python prepare_data.py | run: streamlit run app.py | test: pytest -q

PADRÕES:        Cálculo fora da UI (core.py puro e testável). Leitura de SAS/planilha com
                fallback de encoding latin-1/cp1252. Nomes de colunas seguem a planilha.
                Pastas de insumo são read-only — nunca alterar .xlsx nem os .sas/.egp.

REGRAS DE NEGÓCIO:
                - Esforço por .sas = horas_estimadas da planilha (não recalcular do zero).
                - Esforço por EGP = Σ horas_sas + (J_base + J_task × n_sas).
                - Cenário Bruto vs Sem-duplicatas sempre coerentes entre telas.
                - Mais consultores reduzem DURAÇÃO, não ESFORÇO.
                - Sprint = 10 dias úteis; capacidade = n_consultores × horas_dia × 10.
                - Totais derivados devem reconciliar com a planilha (Quality Gate §9).

AGENTES:        orchestrator, data-engineer, streamlit-dev, reviewer, qa, memory-manager.

RISCOS:         71% de duplicatas (maior incerteza); heurística de "família de pipeline";
                encoding mojibake; volume (não carregar dados crus no contexto);
                consistência Bruto×Sem-dup entre abas.
```

---

*Constituição viva. Atualize-a (não a conversa) quando uma regra mudar.*
