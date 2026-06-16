# NEXT_STEPS

**v1 (Streamlit) e v2 (frontend premium Next.js + API) concluídas.** Nenhuma tarefa
de desenvolvimento no caminho crítico.

Próximas ações possíveis (sob demanda — não priorizadas):

1. **Verificação visual em navegador real** (Mission Control): subir API (`uvicorn
   api.main:app --port 8000`) + `cd frontend && npm run dev`, percorrer as 8 telas,
   conferir interação ao vivo das alavancas, responsividade e legibilidade.
2. **Polimento premium opcional:** hero com React Three Fiber sutil; microanimação
   pontual com Anime.js; estados de erro de rede mais ricos; testes E2E (Playwright).
3. **Calibrar com o cliente** J_base/J_task/K e nº de consultores; revisar números.
4. **Validar a heurística `pipeline_family`** (colapso de versões) por amostragem.
5. Demais itens de evolução em `BACKLOG.md`.

> Para retomar a frio: leia `CURRENT_STATE.md` + `FRONTEND_TRANSFORMATION_PLAN.md`.
> Regra inviolável: todo cálculo vive em `core.py`; a API (`api/`) só serializa; o
> frontend (`frontend/`) só apresenta. Nunca reimplementar regra de negócio no TS.
