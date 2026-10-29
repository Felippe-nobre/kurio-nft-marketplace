# Retomar o trabalho

Estado: **concluído para entrega**, faltando apenas a publicação (etapa do responsável). Situação completa, matriz do briefing e pendências em [STATUS.md](./STATUS.md).

## Histórico (git local)

| Commit | Conteúdo |
|---|---|
| `8ecc61a` | baseline recebido |
| `4b595d4` · `5af016f` · `9ba8768` | ajuste do mobile às 6 telas do Figma |
| `3350ee6` | aviso de mudança no carrinho, edição de carteiras, grupo de testes 13, reflow em 320 px |
| `c8e5daa` | lighthouse 13.6 e vite 6.4.5 (0 vulnerabilidades); `check:routes` |
| `9944cca` | `modulepreload` do chunk de mocks; filtros de diagnóstico do Lighthouse |
| `e87c980` | esqueleto do detalhe com as alturas reais (CLS 0) |
| `064f68a` · `2b7ef2d` | documentação, Lighthouse oficial, testes de limite de quantidade e de idempotência |
| `a6d8874` | performance do Início: variantes escondidas por CSS não são mais montadas; ordenação do mock sem ICU (rodada de 29/10; tentativas sem ganho foram revertidas, ver ARCHITECTURE → Performance) |

## Próximos passos

1. Publicar na Vercel (instruções no README, seção "Deploy").
2. Rodar `BASE_URL=<url publicada> npm run check:routes` e um fluxo completo na URL publicada.
3. Atualizar a linha "Deploy" do STATUS.md com a URL.

## Ferramentas úteis

- `npm run check` — typecheck, lint, build demo e E2E.
- `LH_PAGES=inicio LH_PROFILES=mobile LH_RUNS=1 npm run lighthouse` — Lighthouse parcial para diagnóstico (grava em `lighthouse/diagnostics/`).
- `docs/figma-mobile/` — scripts de captura e a comparação lado a lado com o Figma.
