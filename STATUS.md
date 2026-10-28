# Status da entrega

Atualizado em 28/10/2026. Todos os resultados abaixo vêm de comandos **executados de fato** neste ambiente (Linux x64, Node 22.23.4, npm 10.9.9, Chromium do Playwright 153 headless). Nada foi marcado como aprovado sem execução.

## Resumo

| Etapa | Comando | Resultado |
|---|---|---|
| Instalação | `npm install` | ✅ 500 pacotes; `package-lock.json` gerado; `public/mockServiceWorker.js` gerado pelo `postinstall` |
| Typecheck | `npm run typecheck` | ✅ sem erros |
| Lint | `npm run lint` | ✅ sem erros nem avisos |
| Build produção | `npm run build` | ✅ |
| Build demo | `npm run build:demo` | ✅ |
| E2E Playwright | `npm run test:e2e` | ✅ **59/59** (51 funcionais + 8 visuais), em 3 execuções completas consecutivas sobre o código final, sem falhas nem *flaky* |
| Regressão visual | parte do E2E | ✅ 8 baselines (Início, Detalhe, Carrinho, Pagamento × desktop 1440 / mobile 390) geradas e confirmadas em execuções seguintes |
| Lighthouse | `npm run lighthouse` | ⚠️ executado; **desktop atinge todas as metas, mobile fica abaixo da meta de Performance (89 e 83)**. Ver abaixo |
| Auditoria | `npm audit --omit=dev` | ✅ 0 vulnerabilidades nas dependências de produção (há avisos em dependências de desenvolvimento: lighthouse, esbuild/vite 5) |
| Imagens originais | SHA-256 antes × depois | ✅ os 19 arquivos de `public/img/` estão idênticos ao pacote recebido |

## Playwright: o que roda

- `desktop-chromium` (1440×900): os 12 grupos `e2e/01…12-*.spec.ts` (38 testes) + 4 visuais.
- `mobile-chromium` (390×844): 13 fluxos com tag `@mobile` + 4 visuais.
- O teste de overflow horizontal agora também cobre as páginas logadas (`/profile`, `/wallets`, `/favorites`, `/activity`, `/checkout`) em 390, 768 e 1440 px.

Ambiente: `@playwright/test` foi fixado em **1.63.0** porque o download do Chromium da 1.64 (CDN do Playwright) estava bloqueado aqui e o Chromium da 1.63 já estava instalado. Localmente basta `npx playwright install chromium`.

As baselines visuais foram geradas neste Linux. Em outro SO, rode `npm run test:e2e:update` uma vez antes de usá-las (a renderização de fontes muda).

## Lighthouse (medianas de 3 execuções)

Build demo + `vite preview` local, Chrome headless, Lighthouse 12.8.2. Mobile com throttling padrão (Moto G Power, 4G lento simulado). Relatórios completos em `lighthouse/reports/`, medianas em `lighthouse/RESULTS.md` e `lighthouse/summary.json`.

| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
|---|---|---|---|---|---|---|---|---|
| Início | mobile | **89** ⚠️ | 97 | 100 | 100 | 2,9 s | 0 | 165 ms |
| Detalhe | mobile | **83** ⚠️ | 97 | 100 | 100 | 3,6 s | 0 | 171 ms |
| Início | desktop | 97 | 100 | 100 | 100 | 1,0 s | 0,04 | 10 ms |
| Detalhe | desktop | 97 | 97 | 100 | 100 | 0,9 s | 0,083 | 0 ms |

Metas: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 90.

**Por que o mobile não chega a 90:** o LCP mobile é quase todo *render delay* (~3,1 s; TTFB ~0,5 s, download da imagem ~0). Na build de demonstração, o "backend" (MSW + dados simulados, chunk de ~338 kB) precisa ser baixado, avaliado e registrar o Service Worker antes da primeira requisição de dados; com a CPU 4× mais lenta do perfil mobile isso custa ~1,4 s de *bootup*. Testei iniciar o MSW em paralelo à primeira renderização (só HTTP/Socket.IO aguardando o mock): **não houve ganho mensurável** (88/81 no mobile), então a mudança foi revertida. Uma build sem mocks (API real, `VITE_ENABLE_MOCKS=false`) não carrega esse chunk, mas não pôde ser medida aqui por não haver backend real.

## Correções feitas nesta rodada

### Bugs da aplicação (encontrados pelos testes)

1. **Tempo real nunca conectava** (derrubava 37 dos 38 testes na 1ª execução). Três causas:
   - o `engine.io-client` captura `globalThis.WebSocket` no import, antes de o MSW substituí-lo. Agora o `socket.io-client` é importado sob demanda (`src/lib/realtime.tsx`);
   - no MSW 2.15 o `ws.link` com RegExp não casa mais, e o prefixo `/socket.io/` é removido antes do casamento. Agora o link é `'/'`, com repasse ao servidor real para conexões que não são Socket.IO (HMR do Vite);
   - o `@mswjs/socket.io-binding@0.2.0` (última versão) não envia heartbeat nem responde ao CONNECT. Foi substituído por um adaptador mínimo do protocolo em `src/mocks/realtime.ts`, e a dependência foi removida.
2. **Carrinho do visitante podia se perder no login**: a sessão era publicada antes do merge, então navegar logo após entrar abortava o merge. Agora o merge roda antes (com o token explícito) e um GET antigo não sobrescreve o resultado (`src/hooks/useAuth.ts`, `src/api/endpoints.ts`).
3. **Checkout exigia dois cliques após mudança de preço**: o evento `nft.updated` chega antes da resposta 409 `QUOTE_CHANGED` e marcava a cotação como desatualizada mesmo com a cotação nova já recebida. A cotação só é marcada como desatualizada se o evento divergir dela, e a cotação devolvida no erro limpa esse estado (`src/pages/Checkout.tsx`).
4. **Rolagem horizontal de 677 px nas páginas da conta no mobile**: os textos `sr-only` "(em breve)" (absolutos) escapavam da lista rolável não posicionada, e a coluna da grade era dimensionada pelo conteúdo mínimo (`src/components/AccountLayout.tsx`; `relative` também no carrossel `NftRail`).
5. **Foco**: o foco não voltava ao botão de busca ao fechar o diálogo (Header), e no carregamento inicial o foco ia para `<main>`, fazendo o 1º Tab pular o link "Pular para o conteúdo" (`src/app/RootLayout.tsx`).
6. **Fidelidade ao Figma**: o card "Sage Nomad" (arte 224×286) ficava mais alto que os vizinhos; a moldura agora mantém 258×300 como no Figma, sem recortar a arte (`min-h-0` em `NftCard`).
7. Tipos: `outcome` do pedido simulado (`'confirm'` → `'confirmed'`).

### Testes e ferramentas

- Seletores ambíguos corrigidos (busca do catálogo × botão de busca do cabeçalho; e-mail do perfil × newsletter; rádio de edição com texto oculto; alertas e status duplicados pela região `aria-live`, agora restritos a `<main>`).
- `stabilize()` dos testes visuais força o carregamento de imagens `lazy` antes da captura de página inteira (travava no mobile).
- ESLint: a regra `react-hooks/rules-of-hooks` foi desligada só em `e2e/`, onde o `use` das fixtures do Playwright não é hook do React.
- `tsconfig.node.json`: `DOM.Iterable` para os testes.

## O que ainda falta ou não foi verificado

- **Performance mobile do Lighthouse abaixo de 90** (89 e 83), pelos motivos acima.
- **Fidelidade ao Figma**: comparei lado a lado só a tela de Início com `public/img/ref-inicio.png` (a única exportação de referência do pacote). Estrutura, tipografia, cores, cards e rodapé batem. Diferenças intencionais: a caixa de busca do catálogo (requisito funcional) e o selo "RARO". Detalhe, Carrinho, Pagamento e Conta **não** foram comparados com o Figma por falta de exportações de referência.
- Só Chromium foi testado (sem Firefox/WebKit). As baselines visuais são deste Linux.
- O deploy (Vercel/Netlify/Cloudflare) não foi executado; só os arquivos de configuração foram mantidos.
- Avisos do `npm audit` em dependências de desenvolvimento (lighthouse, vite 5/esbuild) não foram tratados, para não trocar versões *major*.

## Como reproduzir localmente

```bash
npm ci
npm run typecheck && npm run lint && npm run build:demo
npx playwright install chromium
npm run test:e2e:update   # só se estiver em outro SO (baselines de fonte)
npm run test:e2e
npm run lighthouse        # requer build:demo
```

## Assets

- Preservados sem alteração (checksums conferidos): `public/img/*.svg`, `public/img/ref-inicio.png`, `public/img/nft/*.png`, `public/img/art/*.webp`.
