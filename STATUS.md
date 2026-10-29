# Status da entrega

Atualizado em 28/10/2026, na rodada de conclusão contra o briefing original (12 seções). Todo resultado abaixo vem de comandos **executados de fato**; nada foi marcado como atendido só pela existência de uma tela ou de um teste com nome parecido. Ambiente: Linux x64, 2 CPUs, Node 22.23.4, npm 10.9.9, Chromium 153 (Playwright 1.63.0).

Legenda: ✅ atendido e comprovado · 🔧 corrigido nesta rodada e retestado · ⚠️ não atendido ou não comprovado · 👤 depende de você (publicação)

## Validação final (checkout limpo)

Executada em uma pasta nova a partir do commit final (`git archive`, sem `node_modules`, `dist` nem relatórios), em 28/10/2026 23:52:

| Etapa | Comando | Resultado |
|---|---|---|
| Instalação | `npm ci` | ✅ 431 pacotes, a partir do `package-lock.json` |
| Tipos | `npm run typecheck` | ✅ sem erros |
| Lint | `npm run lint` | ✅ sem erros nem avisos |
| Build de produção | `npm run build` | ✅ |
| Build de demonstração | `npm run build:demo` | ✅ |
| E2E + regressão visual | `npx playwright test` | ✅ **66/66** em 4,5 min (desktop: 45 funcionais + 4 visuais; mobile: 13 fluxos `@mobile` + 4 visuais) |
| Rotas | `npm run check:routes` | ✅ 108/108 (acesso direto e refresh de todas as rotas, públicas, privadas sem sessão e logadas, em 390/768/1440 px; sem erros de console nem overflow) |
| Segurança | `npm audit` · `npm audit --omit=dev` | ✅ 0 vulnerabilidades · 0 vulnerabilidades |
| Lighthouse | `npm run lighthouse` | ⚠️ desktop atinge todas as metas; mobile fica abaixo em Performance (seção 10) |
| Imagens originais | SHA-256 contra o pacote recebido; `git diff` | ✅ os 19 arquivos de `public/img/` estão idênticos |

As 8 baselines visuais passaram **sem ser regeneradas** depois de todas as mudanças desta rodada.

## Correções desta rodada (todas retestadas)

| # | Problema encontrado | Correção | Evidência |
|---|---|---|---|
| 1 | Com o carrinho aberto, uma mudança de preço/estoque via Socket.IO atualizava os valores **sem aviso visível** (seção 7, passo 3: "a interface informa a alteração"). | Aviso visível no carrinho + anúncio `aria-live` (`src/pages/Cart.tsx`). | `e2e/09` passo 2/3 |
| 2 | A asserção do teste 9 sobre o anúncio era `/Preço atualizado\|/`, que **sempre passava** (alternativa vazia no regex). | Substituída por asserções reais do aviso e da região `aria-live`. | `e2e/09` |
| 3 | Carteiras: a API aceitava editar (`PATCH /wallets/:id` com `label`), mas a tela **não permitia editar** (seção 3: "cadastro e edição"). | Edição do apelido com validação local, erro da API associado ao campo e foco devolvido ao botão. | `e2e/08` "carteiras: edição…" (desktop e mobile, 3 repetições) |
| 4 | Detalhe do NFT: o esqueleto tinha outra grade e não reservava o bloco de abas; "Mais desta coleção" se deslocava ao carregar (**CLS 0,083** no Lighthouse desktop; deslocamento de até 953 px em 768 px). | Esqueleto com a grade e as alturas reais por largura (`src/pages/Nft.tsx`). | diferença de 0 px de 390 a 1440 px; CLS 0 nas 12 medições |
| 5 | 31 vulnerabilidades em dependências de desenvolvimento (11 altas). | `lighthouse` 12 → 13.6.0 e `vite` 5 → 6.4.5 (atualizações direcionadas, sem `--force`); `engines.node` ≥ 22.19. | `npm audit`: 0 |
| 6 | Requisitos sem teste E2E: limite de quantidade; conflito de chave de idempotência; recusa e desconexão de carteira; expiração durante o checkout; reflow em 320 px. | Testes novos em `e2e/02`, `e2e/07` e `e2e/13`. Os ajustes de reflow em 320 px (rodapé e abas do catálogo) estavam no estado recebido para esta rodada e foram mantidos. | ver matriz |
| 7 | Performance mobile: o chunk do MSW só começava a baixar depois da execução do JS principal. | `modulepreload` desse chunk no build com mocks (`vite.config.ts`). | Lighthouse mobile: Início 66 → 67, Detalhe 65 → 69 (mesma máquina, antes/depois) |

## Matriz de requisitos do briefing

### 1. Escopo

| Requisito | Status | Evidência | Pendência |
|---|---|---|---|
| Fluxos de descoberta, compra e conta, desktop e mobile, com dados simulados | ✅ | `e2e/01…13` em `desktop-chromium` (1440) e fluxos `@mobile` em `mobile-chromium` (390) | — |
| Ações fora do escopo não aparentam sucesso | ✅ | Login social, recuperação de senha, "Ver no Etherscan" e itens "(em breve)" informam indisponibilidade (`AuthPage.tsx`, `Order.tsx`, `AccountLayout.tsx`) | — |

### 2. Stack obrigatória (uso efetivo)

| Tecnologia | Status | Evidência |
|---|---|---|
| React + TypeScript | ✅ | `tsc -b` sem erros; todo o app em `.tsx` |
| TanStack Router | ✅ | `src/app/routes.tsx`: rotas, `validateSearch` (estado do catálogo na URL), `beforeLoad` nas privadas |
| TanStack Query | ✅ | consultas, mutations, otimismo + rollback, invalidação (`src/hooks`, `src/pages`) |
| Axios | ✅ | único cliente REST (`src/api/http.ts`), erros normalizados em `ApiError` |
| REST | ✅ | contratos em `src/api/contracts.ts`, documentados em `ARCHITECTURE.md` |
| Socket.IO | ✅ | `socket.io-client` em `src/lib/realtime.tsx`; testes 9 e 10 passam pelo cliente |
| Tailwind CSS | ✅ | v4 via `@tailwindcss/vite` |
| shadcn/ui | ✅ | `src/components/ui` (Dialog, Sheet, Slider, Button… sobre Radix), adaptados à paleta |
| MSW | ✅ | `src/mocks`: handlers REST + servidor Socket.IO |
| Playwright | ✅ | 66 testes, 8 de regressão visual |
| Lighthouse | ✅ | `scripts/lighthouse.mjs` (Lighthouse 13.6.0) |

### 3. Telas e fluxos

| Requisito | Status | Evidência | Pendência |
|---|---|---|---|
| Início: destaques, catálogo, busca, filtros, ordenação, navegação ao NFT | ✅ | `e2e/01`, `e2e/11` | — |
| Detalhes: galeria, informações, edição, quantidade, favoritos, compra | ✅ | `e2e/02`, `e2e/04`, `e2e/06` | — |
| Carrinho: quantidades, remoção, cupom, resumo | ✅ | `e2e/05` | — |
| Pagamento: dados do colecionador, carteira e rede, revisão e envio | ✅ | `e2e/06`, `e2e/09`, `e2e/13` | — |
| Confirmação: resultado, transação, itens, taxas, total | ✅ | `e2e/06` (status, `tx-id`, linhas, total) | — |
| Login: autenticação, validação, retorno ao fluxo anterior | ✅ | `e2e/03`, `e2e/11`, `e2e/13` | — |
| Cadastro: criação, validação, conflito | ✅ | `e2e/03` | — |
| Perfil: dados, avatar, senha | ✅ | `e2e/08` | — |
| Carteiras: cadastro e **edição** de principal e secundária | 🔧 | `e2e/08` (cadastro, troca de principal, remoção e edição com erro da API) | — |
| Frames desktop e mobile; perfil, carteiras e confirmação também em mobile | ✅ | `e2e` `@mobile` (perfil, carteiras, compra completa); `npm run check:routes` | — |
| Busca, filtros, ordenação e paginação na URL, com refresh e histórico | ✅ | `e2e/01` (voltar/avançar, acesso direto pela URL) | — |
| Filtros combináveis; mudança de filtro reinicia a paginação | ✅ | `e2e/01` (sai de `page=2` ao filtrar) | — |
| Consultas refletem os parâmetros; vazio, falha e fora de ordem | ✅ | `e2e/01`, `e2e/12` | — |
| Detalhe: acesso direto, inexistente, edição indisponível, limite de quantidade | ✅ | `e2e/02` (limite novo nesta rodada); `check:routes` | — |
| Favoritos persistem para o usuário autenticado | ✅ | `e2e/04` | — |
| Carrinho: disponibilidade por NFT/edição; refresh; itens do visitante no login | ✅ | `e2e/05` | — |
| Cupom aplicar/remover, inválido ou expirado | ✅ | `e2e/05` | — |
| Subtotal, desconto, taxa e total coerentes com a API | ✅ | `e2e/05`, `e2e/06`, `e2e/09` | — |
| Carrinho reflete preço/disponibilidade recebidos enquanto aberto | 🔧 | `e2e/09` (aviso visível + `aria-live` + resumo) | — |
| ETH como string decimal com precisão; quantidades inteiras; cotação como referência | ✅ | `src/lib/money.ts` (BigInt em wei); `POST /quotes` + `fingerprint` | — |
| Validação e revisão antes do envio | ✅ | `e2e/09` (aceitar nova cotação), `src/pages/Checkout.tsx` | — |
| Carteiras cadastradas, rede, conexão, recusa e desconexão | ✅ | `e2e/13`, `e2e/06` | — |
| Revalidação antes de confirmar; mudanças exigem nova confirmação | ✅ | `e2e/09` (3 cenários) | — |
| Sem pedidos duplicados em clique repetido ou reenvio após timeout | ✅ | `e2e/07` | — |
| Pendente, confirmado, recusado; recuperação após refresh ou reconexão | ✅ | `e2e/07`, `e2e/10` | — |
| Confirmação só para pedido confirmado na simulação | ✅ | pedido nasce `pending` (`handlers.ts`); só `settleOrder` muda para `confirmed`; `e2e/06`, `e2e/10` | — |
| Itens preservados em falhas; após confirmar, remove só o comprado | ✅ | `e2e/06`, `e2e/07` | — |
| Recibo é snapshot e não muda com o catálogo | ✅ | `e2e/06` (preço alterado depois; recibo igual) | — |
| Autenticação exigida em checkout, perfil, carteiras, favoritos e pedidos | ✅ | `check:routes` (sem sessão → `/login`), `e2e/03` | — |
| Sessão recuperável após refresh; expiração na navegação e no checkout, com retomada | ✅ | `e2e/03`, `e2e/13` | — |
| Logout e troca de usuário limpam cache privado e subscriptions | ✅ | `e2e/03`; socket recriado por token (`realtime.tsx`) | — |
| Validação de cadastro, perfil, senha e carteiras, incluindo erros da API; persistência | ✅ | `e2e/03`, `e2e/08` | — |
| Credenciais fictícias; senhas não armazenadas em claro | ✅ | PBKDF2-SHA256 (`src/mocks/services.ts`) | — |

### 4. Integração e estado

| Requisito | Status | Evidência |
|---|---|---|
| Router em rotas, search params e proteção | ✅ | `src/app/routes.tsx` |
| Query em consultas, mutations e cache; REST pelo Axios | ✅ | `src/hooks`, `src/api` |
| Contratos tipados entre transporte, estado e interface | ✅ | `src/api/contracts.ts` usado por handlers e cliente |
| Carregamento, vazio, erro, sucesso e atualização em segundo plano | ✅ | `e2e/12`, `e2e/01` |
| Invalidação coerente após mutations e eventos | ✅ | `ARCHITECTURE.md` (política de cache); `e2e/09`, `e2e/10` |
| Cancelamento/descarte de respostas obsoletas | ✅ | `AbortSignal` → Axios; `e2e/01` (fora de ordem) |
| Isolamento por usuário e por parâmetros | ✅ | chaves `['private', scope, …]`; `e2e/03` |
| Recuperação de falhas sem duplicar operações | ✅ | `e2e/07` |
| Rotas inexistentes e acesso direto a qualquer tela | ✅ | `check:routes`: 108 verificações (rotas × acesso direto/refresh × 390/768/1440), 0 problemas |
| Atualização otimista com rollback | ✅ | favoritos e quantidade no carrinho; `e2e/04` |
| Política de cache, retries e sincronização documentada | ✅ | `ARCHITECTURE.md` |

### 5. Contratos REST

| Requisito | Status | Evidência |
|---|---|---|
| Sessão e conta, NFTs, favoritos, carrinho, cotação, pedidos, perfil, carteiras | ✅ | tabela em `ARCHITECTURE.md`; handlers em `src/mocks/handlers.ts` |
| Erros de validação, sessão, permissão, inexistente, conflito, falha transitória | ✅ | 422, 401, 403, 404, 409, 5xx/rede/timeout; `e2e/03`, `e2e/08`, `e2e/12`, `e2e/13` |
| Idempotência: mesma tentativa recupera o pedido; mesma chave com outro conteúdo gera conflito | ✅ | `e2e/07` (teste novo: 200 `Idempotent-Replayed` e 409 `IDEMPOTENCY_CONFLICT`) |

### 6. Mocking com MSW

| Requisito | Status | Evidência |
|---|---|---|
| Mocks na camada de rede, reutilizados em dev, demo e testes | ✅ | `src/mocks` (único "backend"); `.env.demo`; Playwright usa o build demo |
| Sem respostas fictícias em componentes, hooks ou Axios | ✅ | busca no código; única exceção documentada: timeout do Axios lido do cenário quando os mocks estão ativos (configuração de transporte) |
| Estado consistente entre catálogo, favoritos, carrinho, perfil, carteiras e pedidos; persistência; reset integral | ✅ | `src/mocks/db.ts`; `reset()` restaura o seed e o cenário |
| Lentidão, latência variável, timeouts, falha de conexão, HTTP de erro configuráveis | ✅ | `src/mocks/scenario.ts`; painel `?dev=1`; `e2e/12` |
| Fixtures variadas (36 NFTs) e 2 usuários | ✅ | `src/mocks/fixtures.ts` |
| Cenários determinísticos: sucesso/vazio, latência/fora de ordem, conexão/4xx/5xx, sessão expirada, conflito, cupom, preço/esgotado na compra, timeout pós-pedido, pagamento confirmado/recusado | ✅ | `e2e/01`, `03`, `05`, `07`, `09`, `12`, `13`; README "Como reproduzir os fluxos de falha" |
| Eventos via MSW compatíveis com o protocolo Socket.IO; transporte e limitações documentados | ✅ | adaptador Engine.IO v4 / Socket.IO v5 em `src/mocks/realtime.ts` (o `@mswjs/socket.io-binding` foi descartado; motivo em `ARCHITECTURE.md`) |
| Cenários exercitam o `socket.io-client` (sem setters diretos) | ✅ | `e2e/09`, `e2e/10` disparam pelo servidor simulado; o cliente recebe pelo socket |
| Mocks ativados por configuração e disponíveis no build de demonstração | ✅ | `VITE_ENABLE_MOCKS`; com `false` o código dos mocks não entra no build (verificado) |
| Mudanças nos dados refletidas em REST e eventos | ✅ | `updateEdition` persiste e emite `nft.updated`; `e2e/09` |

### 7. Tempo real

| Requisito | Status | Evidência |
|---|---|---|
| `nft.updated` atualiza catálogo, detalhe e carrinho | ✅ | `applyNftEvent` em `realtime.tsx`; `e2e/09`, `e2e/10` |
| `order.updated` atualiza o pedido e mostra confirmação ou recusa | ✅ | `e2e/06`, `e2e/07`, `e2e/10` |
| Identidade, recurso e versão; tolera duplicatas e eventos antigos | ✅ | `EventGate`; `e2e/10` |
| Reconexão reconcilia com REST; eventos de outra sessão não afetam outro usuário; listeners liberados | ✅ | `realtime.tsx` (socket por token, `removeAllListeners`); servidor entrega `order.updated` só ao dono; `e2e/10`, `e2e/03` |
| Cenário obrigatório (carrinho → mudança → aviso e resumo → checkout bloqueado) | 🔧 | `e2e/09` (aviso visível no carrinho adicionado; asserção vazia corrigida) |
| Interrupção com pedido pendente; recuperação sem nova compra; estados terminais | ✅ | `e2e/10` |

### 8. Interface, responsividade e acessibilidade

| Requisito | Status | Evidência | Pendência |
|---|---|---|---|
| Fidelidade ao Figma | ✅ com ressalvas | Mobile: 6 telas comparadas (`docs/figma-mobile/comparacao-figma-x-app.png`). Desktop: Início comparado com `ref-inicio.png`. Desvios listados em `ARCHITECTURE.md` | Sem referência para comparar pixel a pixel as demais telas desktop |
| Desktop, tablet e mobile; 390, 768 e 1440 px | ✅ | `e2e/11` (sem overflow, rotas públicas e logadas); `check:routes`; `e2e/13` (320 px) | — |
| Skeletons com shimmer, sem deslocamento, respeitando movimento reduzido | 🔧 | `e2e/12`; esqueleto do detalhe corrigido (CLS 0) | — |
| Teclado e foco visível; foco em diálogos e drawers | ✅ | `e2e/11` | — |
| Semântica, labels e erros associados | ✅ | `e2e/11`, `e2e/08` (`aria-invalid` + `aria-describedby`) | — |
| Alternativas textuais; contraste; estados não só por cor | ✅ | Lighthouse Accessibility 97–100 | — |
| Feedback acessível de mutations e tempo real | ✅ | região `aria-live` global; `e2e/09` | — |
| Sem overflow horizontal e sem perda de conteúdo com zoom | ✅ | `e2e/11`; `e2e/13` (320 px = zoom de 400%) | — |
| Assets do arquivo; substituições documentadas | ✅ | `public/img` idêntico ao pacote recebido (SHA-256); `ARCHITECTURE.md` → Assets | — |

### 9. Testes com Playwright

| Requisito | Status | Evidência |
|---|---|---|
| Os 12 grupos de cenários | ✅ | `e2e/01…12` + `e2e/13` complementar |
| Chromium, desktop e mobile | ✅ | projetos `desktop-chromium` e `mobile-chromium` |
| Regressão visual de início, detalhe, carrinho e pagamento, baselines versionadas, dados estáveis | ✅ | `e2e/visual.spec.ts`; `e2e/__screenshots__/` (desktop e mobile); seed, latência zero e relógio fixos |
| Estado isolado por teste; relógio, latência e eventos controlados | ✅ | contexto novo por teste; `window.__kurio`; `page.clock` |
| Relatório HTML e traces de falhas | ✅ | `playwright-report/` da validação final incluso no ZIP; traces gravados só em falhas (`retain-on-failure`) — a execução final não teve falhas, portanto não há traces |
| Verificações observam a interface; tempo real pelo cliente Socket.IO; REST pelos handlers MSW | ✅ | asserções de UI em todos os grupos |

### 10. Performance e Lighthouse

Medianas de 3 execuções por página e perfil (`lighthouse/RESULTS.md`; relatórios HTML/JSON em `lighthouse/reports/`). Lighthouse 13.6.0, Chrome 153, build de demonstração, cenário padrão dos mocks.

| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
|---|---|---|---|---|---|---|---|---|
| Início | mobile | **68** ⚠️ | 97 ✅ | 100 ✅ | 100 ✅ | 3.887 ms | 0 | 899 ms |
| Detalhe | mobile | **71** ⚠️ | 97 ✅ | 100 ✅ | 100 ✅ | 3.602 ms | 0 | 835 ms |
| Início | desktop | 96 ✅ | 100 ✅ | 100 ✅ | 100 ✅ | 1.422 ms | 0 | 43 ms |
| Detalhe | desktop | 98 ✅ | 97 ✅ | 100 ✅ | 100 ✅ | 1.063 ms | 0 | 7 ms |

| Requisito | Status | Evidência / pendência |
|---|---|---|
| Início e detalhe, mobile e desktop, build otimizado, cenário padrão | ✅ | `scripts/lighthouse.mjs` |
| 3 medições, mediana, configuração versionada, HTML/JSON, versões, ambiente, condições | ✅ | `lighthouse/summary.json` |
| LCP, CLS e TBT registrados | ✅ | tabela acima |
| Metas atingidas | ⚠️ | **Performance mobile 68 e 71 (meta 90).** Demais metas atingidas. Causa identificada e otimizações seguras aplicadas: ver abaixo |

**Por que a Performance mobile não chega a 90.** FCP (0,9 s), Speed Index e CLS têm nota máxima; ficam abaixo TBT (~830–900 ms) e LCP (~3,6–3,9 s). O chunk do MSW e do servidor simulado responde por 47% (Início) e 63% (Detalhe) de todo o tempo de script no perfil mobile (CPU 4× mais lenta) e por 8 a 11 das 18 a 20 tarefas longas: o MSW executa os handlers na thread principal. O elemento de LCP depende da resposta da API simulada, que no cenário padrão tem latência de 150–600 ms. Um perfil de CPU do carregamento não mostrou gargalo único removível no código do app. As alternativas que subiriam a nota (desligar os mocks, reduzir a latência, pré-renderizar dados fixos) mudariam o cenário auditado, o que o briefing não permite. Detalhes em `ARCHITECTURE.md` → Performance.

### 11. Critérios eliminatórios

| Critério | Situação | Evidência |
|---|---|---|
| Uso efetivo da stack obrigatória | ✅ não incorre | seção 2 |
| Fluxos principais apenas visuais | ✅ não incorre | compra, conta e carrinho passam pela API simulada (`e2e/03…08`) |
| Compra confirmada sem resposta da simulação | ✅ não incorre | pedido nasce `pending`; confirmação só após `settleOrder` (`e2e/06`, `e2e/10`) |
| Exposição de dados entre usuários | ✅ não incorre | cache por escopo de usuário, socket por token, `order.updated` só ao dono (`e2e/03`) |
| Eventos simulados diretamente na UI | ✅ não incorre | eventos nascem no servidor simulado e chegam pelo `socket.io-client` (`e2e/09`, `e2e/10`) |
| Ausência de testes E2E executáveis | ✅ não incorre | 66 testes executados em checkout limpo |

### 12. Entrega

| Requisito | Status | Evidência | Pendência |
|---|---|---|---|
| Código, lockfile, assets, mocks, fixtures, testes, configurações de auditoria | ✅ | ZIP final | — |
| README com setup, variáveis, credenciais, cenários, reset, comandos e fluxos de falha | ✅ | `README.md` | — |
| ARCHITECTURE com contratos, eventos, sessão, carrinho, cache, reconciliação, limitações, UX, desvios do Figma | ✅ | `ARCHITECTURE.md` | — |
| Comandos de dev com mocks, build, preview, tipos, lint, Playwright e Lighthouse | ✅ | `package.json` | — |
| Execução a partir de checkout limpo, sem serviços privados | ✅ | validação acima | — |
| **Deploy obrigatório com URL pública** | 👤 ⚠️ | `vercel.json` pronto (build demo, fallback de SPA, cabeçalhos do Service Worker) | **Pendente: publicação na Vercel e link do repositório** |
| Versão publicada corresponde ao código, com mocks e tempo real; acesso direto e refresh | 👤 | — | Conferir após publicar: `BASE_URL=<url> npm run check:routes` |

## O que depende de você

1. Criar o repositório (o ZIP inclui o histórico git; basta adicionar o remoto e fazer `git push`).
2. Importar na Vercel. O `vercel.json` já define o build (`npm run build:demo`), a saída (`dist`), o fallback de SPA e os cabeçalhos do `mockServiceWorker.js`. Em **Settings → Build and Deployment → Node.js Version**, use **22.x**. Não há variáveis de ambiente a configurar.
3. Depois de publicar, rodar `BASE_URL=https://sua-url.vercel.app npm run check:routes` e conferir um fluxo completo (login → carrinho → pagamento → confirmação) e o indicador de tempo real.
4. Enviar o link do repositório e a URL pública.

## Pendências restantes

- **Performance mobile do Lighthouse abaixo de 90** (68 e 71), com causa documentada.
- **Deploy e URL pública** ainda não existem (etapa sua).
- Comparação pixel a pixel com o Figma só onde há referência (Início desktop e 6 telas mobile).
- Testes apenas em Chromium; baselines visuais geradas em Linux (em outro SO, rode `npm run test:e2e:update` uma vez).
