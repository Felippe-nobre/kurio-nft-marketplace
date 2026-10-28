# Kurio — NFT Marketplace

Marketplace de NFTs (desafio frontend) em **React + TypeScript**, com **TanStack Router**, **TanStack Query**, **Axios**, **Socket.IO** (`socket.io-client`), **Tailwind CSS v4 + shadcn/ui**, **MSW** (API REST e Socket.IO simulados), **Playwright** e **Lighthouse**.

O layout segue as telas do Figma do desafio (Início, Detalhes do NFT, Carrinho, Pagamento, Confirmação, Login, Cadastro, Perfil e Carteiras), com as artes oficiais exportadas (`public/img/nft/*.png` → `public/img/art/*.webp`).

> Não há backend nem blockchain reais. O MSW roda a "API" dentro do navegador, a autenticação é simulada (senhas guardadas só como hash PBKDF2) e as transações são fictícias. Use apenas as credenciais de demonstração.

## Requisitos

- Node.js 20 ou superior e npm 10 ou superior
- Para os testes E2E: `npx playwright install chromium` (uma vez). O `@playwright/test` está fixado em `1.63.0`, versão cujo Chromium estava disponível no ambiente onde os testes foram executados; pode ser atualizado normalmente.

## Começando

```bash
npm ci            # instala as dependências exatas do package-lock.json (gera public/mockServiceWorker.js)
npm run dev       # http://localhost:5173
```

### Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento (mocks ligados) |
| `npm run build` | build de produção (`tsc -b` + Vite) |
| `npm run build:demo` | build de demonstração (`--mode demo`, lê `.env.demo` com `VITE_ENABLE_MOCKS=true`) |
| `npm run preview` | serve `dist/` em http://localhost:4173 |
| `npm run typecheck` | verificação de tipos |
| `npm run lint` | ESLint (TypeScript + regras de hooks) |
| `npm run test:e2e` | Playwright (sobe build demo + preview sozinho) |
| `npm run test:e2e:update` | regrava as baselines de regressão visual |
| `npm run test:e2e:report` | abre o relatório HTML do Playwright |
| `npm run lighthouse` | Lighthouse em Início e Detalhe, mobile e desktop, 3 execuções cada (requer `build:demo`) |
| `npm run check` | typecheck + lint + build demo + E2E |

## Variáveis de ambiente

Copie `.env.example` para `.env.local` se quiser alterar algo.

| Variável | Padrão | Descrição |
|---|---|---|
| `VITE_ENABLE_MOCKS` | `true` | Liga o MSW (REST + Socket.IO). Com `false`, o app chama a API real em `VITE_API_BASE_URL`. |
| `VITE_API_BASE_URL` | `/api` | Base do Axios |
| `VITE_SOCKET_URL` | origem da página | Servidor Socket.IO |
| `VITE_HTTP_TIMEOUT_MS` | `8000` | Timeout do Axios |
| `VITE_SHOW_DEVTOOLS` | `false` | Mostra sempre o painel de cenários |

## Credenciais fictícias

| Usuário | E-mail | Senha | Observações |
|---|---|---|---|
| Ana Kurio | `ana@kurio.test` | `senha123` | carteira principal MetaMask/Ethereum, 1 favorito |
| Bruno Lima | `bruno@kurio.test` | `senha123` | sem carteiras |

Cupons: `KURIO10` (10%), `LANCAMENTO5` (5%), `VERAO2025` (expirado). Qualquer outro código é inválido.

## Cenários e reset

Abra qualquer página com **`?dev=1`** para ver o botão 🔧 (canto inferior esquerdo) com o **painel de cenários**. Para escondê-lo, use `?dev=0`. No painel dá para:

- definir a latência (nenhuma, rápida, variável 150–600 ms, lenta) e respostas **fora de ordem** no catálogo;
- injetar falhas por rota (`GET /api/nfts`, `POST /api/orders`…): falha de conexão, **timeout**, vazio, 400/401/403/404/409/422/500/503;
- definir o pagamento como **confirmado**, **recusado** ou **manual** (fica pendente) e a conexão da carteira como aprovada ou **recusada**;
- ativar cenários de uso único: **preço alterado** ou **edição esgotada** no momento da confirmação, **timeout após criar o pedido**;
- em tempo real: alterar preço/estoque (emite `nft.updated`), **derrubar os sockets**, **reenviar o último evento** (duplicata);
- **expirar as sessões**;
- **resetar o cenário**: restaura o banco determinístico e limpa a sessão.

Também pelo console: `window.__kurio.reset()`, `window.__kurio.scenario.set({ payment: 'decline' })`, `window.__kurio.updateEdition('1', '1-50', { price: '1.50' })`, `window.__kurio.socket.setBlackout(true)` etc. A referência completa está em [ARCHITECTURE.md](./ARCHITECTURE.md).

Dados prontos para testar: `/nft/14` tem a edição padrão esgotada; `/nft/inexistente` cai na tela de NFT inexistente.

## Testes E2E (Playwright)

```bash
npx playwright install chromium
npm run test:e2e
```

- Projetos: `desktop-chromium` (1440×900, todos os testes) e `mobile-chromium` (390×844, fluxos principais com a tag `@mobile` e a regressão visual).
- Cobrem os 12 grupos do desafio (`e2e/01…12-*.spec.ts`) e a regressão visual de Início, Detalhe, Carrinho e Pagamento (`e2e/visual.spec.ts`; as baselines ficam em `e2e/__screenshots__/`).
- Cada teste parte de um contexto novo, com `localStorage` e Service Worker isolados. O cenário inicial é determinístico (latência zero, seed fixa, relógio fixo nos testes visuais). Os testes controlam o "servidor" via `window.__kurio`.
- Os testes REST passam pelos handlers do MSW e os de tempo real pelo `socket.io-client`.
- Relatório HTML em `playwright-report/`; traces e screenshots das falhas em `test-results/`.

As baselines visuais dependem da renderização de fontes do sistema operacional. Em uma máquina diferente da que as gerou, rode `npm run test:e2e:update` uma vez antes de usá-las como referência.

## Lighthouse

```bash
npm run build:demo
npm run lighthouse
```

Gera 3 relatórios (HTML e JSON) por página e perfil em `lighthouse/reports/`, e as medianas em `lighthouse/RESULTS.md` e `lighthouse/summary.json` (com LCP, CLS, TBT, versões e ambiente). Usa o Chromium do Playwright, ou `CHROME_PATH` se definido.

## Deploy (Vercel, Netlify ou Cloudflare Pages)

O build de demonstração deixa o MSW ligado. Todas as plataformas precisam de **fallback de SPA** para que refresh e acesso direto funcionem:

- **Vercel:** `vercel.json` já define `buildCommand: npm run build:demo`, `outputDirectory: dist` e o rewrite para `index.html` (sem afetar `mockServiceWorker.js` e os assets). Basta importar o repositório em vercel.com ou rodar `npx vercel --prod`.
- **Netlify:** `netlify.toml` (build `npm run build:demo`, publish `dist`, redirect `/* → /index.html 200`). O arquivo `public/_redirects` também é copiado para `dist/`.
- **Cloudflare Pages:** build command `npm run build:demo`, output `dist`. O `public/_redirects` cuida do fallback.

Depois de publicar, abra a URL, faça refresh em uma rota profunda (ex.: `/nft/1`) e confira se o Service Worker do MSW foi registrado (DevTools → Application → Service Workers).

## Documentação

- [ARCHITECTURE.md](./ARCHITECTURE.md): contratos REST, eventos, sessão, carrinho, cache, reconciliação, idempotência, limitações e decisões de UX.
- [STATUS.md](./STATUS.md): matriz de requisitos e o que foi efetivamente verificado.
