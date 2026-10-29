# Status da entrega

Atualizado em 28/10/2026 (noite), após o ajuste do mobile às telas do Figma. Todos os resultados abaixo vêm de comandos **executados de fato** neste ambiente (Linux x64, 2 CPUs, Node 22.23.4, npm 10.9.9, Chromium do Playwright 153 headless). Nada foi marcado como aprovado sem execução.

## Ajuste do mobile ao Figma (rodada mais recente)

Referências: 6 telas **mobile** exportadas do Figma (414×896, primeira dobra): Início, Detalhes do NFT, Carrinho de NFTs, Pagamento, Login e Cadastro. A comparação lado a lado final está em `docs/figma-mobile/comparacao-figma-x-app.png` (Figma à esquerda, app à direita em cada par). Os scripts de captura e medição estão na mesma pasta.

Regra seguida: **só abaixo de 768 px** (`max-md:` / `md:hidden`). O desktop não mudou: as 4 baselines visuais do desktop passaram **sem atualização** depois das mudanças, e o git confirma que estão intactas.

| Tela | O que foi ajustado ao Figma |
|---|---|
| Todas | Margem lateral de 24 px; cabeçalho do site e breadcrumb ocultos no mobile nas 6 telas; avisos (toasts) no topo, para não cobrirem as barras fixas |
| Início | Busca "Explorar coleções" + botão de filtros; hero compacto em card (texto mobile do Figma, arte + miniatura, pontos); abas em uma linha; grade de 2 colunas escalonada; cards arredondados com arte quadrada e favorito no canto; barra de navegação inferior (Início, Favoritos, botão central de busca, Carrinho, Conta) |
| Detalhes | Barra com voltar e favorito; arte arredondada (as miniaturas da galeria viram pontos sobre a arte; tocar amplia); painel inferior arredondado com selo "★ nota (avaliações)"; descrição curta do Figma; barra fixa com Qtd., preço, "Comprar NFT" (pílula em gradiente) e botão circular de carrinho, que adiciona sem sair da página |
| Carrinho | Barra "Carrinho de NFTs" com voltar; itens em cards (arte colada à esquerda, "Edição: x", total da linha em destaque, botões circulares, remover no canto); painel inferior fixo com cupom em pílula, totais e "Conectar e finalizar" |
| Pagamento | Barra "Pagamento com carteira"; "Carteira conectada" com as carteiras salvas em cards (selecionar = mesmo efeito do seletor de endereço; "Trocar carteira" e ⋮ levam a Carteiras); "Carteira e rede" com provedores em cards com ícone; Total; "Confirmar compra" fixo embaixo |
| Login / Cadastro | Tela cheia com a marca "KURIO", título sem abas, campos de 50 px, botão de 60 px, ícones Google/Facebook, link de troca no rodapé; botão "Criar perfil" (texto do Figma) |

Diferenças que **ficaram de propósito**, por função ou por dados:

- **Pagamento:** o botão "Conectar MetaMask" e o formulário do colecionador continuam (requisitos funcionais: conexão/recusa da carteira e dados validados). O formulário fica abaixo do Total.
- **Detalhes:** a linha "Compartilhar este NFT" continua visível. A frase "x de y disponíveis" passa a ser só para leitor de tela no mobile; o esgotado continua visível no botão e nas edições.
- **"Ordenar por":** no mobile fica dentro do painel de filtros (o Figma não mostra ordenação).
- **Dados simulados não foram alterados:** nota 4.2 contra 4.8, "Kurio Editions" contra "Kurio Apes", edição 1/1 em vez da "1/10" repetida do Figma, quantidade de carteiras salvas da usuária de teste.
- **Telas sem referência mobile não mudaram:** destaque, diário e rodapé da página inicial; perfil, carteiras, atividade e pedido.

Bugs encontrados e corrigidos durante o ajuste:

- **Avisos bloqueando botões:** o aviso "adicionado ao carrinho" ficava em cima do botão fixo "Conectar e finalizar" e bloqueava o toque. O teste 9 falhou por isso numa execução; os avisos agora ficam no topo no mobile.
- **Grade "pulando" ao carregar (CLS 0,155 no Início mobile):** o esqueleto tinha altura diferente do card real, e o React reaproveitava os itens do esqueleto como cards, porque as chaves `0, 1, 2…` coincidiam com os ids `"1", "2"…`. Corrigido; medido com `PerformanceObserver` a 412 px e CPU 4× mais lenta: **nenhum deslocamento**.

Testes ajustados ao novo comportamento mobile (sem perder cobertura):

- `01-catalog`: no mobile, a ordenação é feita pelo painel de filtros.
- `03-auth`: o botão aceita "Criar conta" (desktop) ou "Criar perfil" (mobile).
- `fixtures.fillCheckoutAndConnect`: o seletor de rede passou a ser o `combobox` "Rede", porque os cards de carteira também contêm o texto "Rede …".


## Resumo

| Etapa | Comando | Resultado |
|---|---|---|
| Instalação | `npm install` | ✅ 500 pacotes; `package-lock.json` gerado; `public/mockServiceWorker.js` gerado pelo `postinstall` |
| Typecheck | `npm run typecheck` | ✅ sem erros |
| Lint | `npm run lint` | ✅ sem erros nem avisos |
| Build produção | `npm run build` | ✅ |
| Build demo | `npm run build:demo` | ✅ |
| E2E Playwright | `npm run test:e2e` | ✅ **59/59** (51 funcionais + 8 visuais) na execução completa sobre o código final. Antes disso, 2 execuções completas seguidas com 59/59 (após a correção dos avisos); só o esqueleto do catálogo mudou depois delas |
| Regressão visual | parte do E2E | ✅ 8 baselines (Início, Detalhe, Carrinho, Pagamento × desktop 1440 / mobile 390). As 4 do desktop **não foram regeradas** (passaram sem mudança); as 4 do mobile foram regeradas com o visual do Figma |
| Lighthouse | `npm run lighthouse` | ⚠️ executado; **desktop atinge todas as metas; mobile fica abaixo da meta de Performance**. A máquina ficou ~40% mais lenta entre as rodadas, então comparei antes × depois na mesma máquina. Ver abaixo |
| Auditoria | `npm audit --omit=dev` | ✅ 0 vulnerabilidades nas dependências de produção (há avisos em dependências de desenvolvimento: lighthouse, esbuild/vite 5) |
| Imagens originais | SHA-256 / `git diff` | ✅ os 19 arquivos de `public/img/` estão idênticos ao pacote recebido |
| Rolagem horizontal | script em `docs/figma-mobile/capture.cjs` | ✅ nenhuma em 360, 390, 414, 768 e 1440 px nas rotas `/`, `/nft/1`, `/cart`, `/checkout`, `/login`, `/cadastro` e `/profile` (logado) |

## Playwright: o que roda

- `desktop-chromium` (1440×900): os 12 grupos `e2e/01…12-*.spec.ts` (38 testes) + 4 visuais.
- `mobile-chromium` (390×844): 13 fluxos com tag `@mobile` + 4 visuais.
- O teste de overflow horizontal agora também cobre as páginas logadas (`/profile`, `/wallets`, `/favorites`, `/activity`, `/checkout`) em 390, 768 e 1440 px.

Ambiente: `@playwright/test` foi fixado em **1.63.0** porque o download do Chromium da 1.64 (CDN do Playwright) estava bloqueado aqui e o Chromium da 1.63 já estava instalado. Localmente basta `npx playwright install chromium`.

As baselines visuais foram geradas neste Linux. Em outro SO, rode `npm run test:e2e:update` uma vez antes de usá-las (a renderização de fontes muda).

## Lighthouse (medianas de 3 execuções)

Build demo + `vite preview` local, Chrome headless, Lighthouse 12.8.2. Mobile com throttling padrão (Moto G Power, 4G lento simulado). Relatórios da versão atual em `lighthouse/reports/`, medianas em `lighthouse/RESULTS.md` e `lighthouse/summary.json`.

**Atenção à máquina:** entre a rodada anterior e esta, o ambiente ficou mais lento (o *benchmarkIndex* do Lighthouse caiu de ~2.600 para ~1.600). Por isso, a comparação válida é entre versões medidas **na mesma máquina, uma após a outra**:

| Página | Perfil | Antes do ajuste mobile (`8ecc61a`) | Versão final | LCP antes → final | CLS final | TBT final |
|---|---|---|---|---|---|---|
| Início | mobile | 76 | **67** ⚠️ | 3,1 s → 3,9 s | 0 | 658 ms |
| Detalhe | mobile | 67 | **68** ⚠️ | 3,7 s → 3,8 s | 0 | 629 ms |
| Início | desktop | 95 | 93 ✅ | 1,2 s → 1,5 s | 0 | 24 ms |
| Detalhe | desktop | 97 | 96 ✅ | 1,0 s → 1,1 s | 0,083 | 6 ms |

Accessibility 97–100, Best Practices 100 e SEO 100 em todos os casos. Metas: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 90.

Na máquina anterior (mais rápida), a versão `8ecc61a` media 89/83 no mobile e 97/97 no desktop. Esses números não são comparáveis com os de agora.

**Por que o Início mobile caiu de 76 para 67:**
- No layout do Figma, o hero mobile tem uma arte pequena (138 px). O maior elemento da tela (LCP) passou a ser a primeira arte do catálogo (166 px).
- Essa arte só aparece depois da resposta da API, que na demonstração tem latência simulada de 150 a 600 ms (cenário "realistic", de propósito).
- No layout antigo, o LCP era a arte grande e estática do hero, pintada sem esperar a API.
- Não apliquei truques só para melhorar a nota (por exemplo, pré-carregar a arte de um item que depende da API).

**Por que nenhuma página mobile chega a 90:** o *render delay* domina o LCP. A build de demonstração precisa baixar e iniciar o MSW (o "backend" simulado, ~338 kB) antes da primeira requisição de dados, o que pesa com a CPU 4× mais lenta do perfil mobile. Iniciar o MSW em paralelo à renderização já foi testado antes, sem ganho. Uma build com API real (`VITE_ENABLE_MOCKS=false`) não carrega esse código, mas não pôde ser medida aqui por falta de backend.

## Correções da rodada anterior (npm, Playwright, Lighthouse)

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

- **Performance mobile do Lighthouse abaixo de 90** (67 no Início e 68 no Detalhe nesta máquina), pelos motivos acima.
- **Fidelidade ao Figma**: o desktop foi comparado só na tela de Início (`public/img/ref-inicio.png`, a única referência desktop). O mobile foi comparado nas 6 telas enviadas, com diferenças residuais de poucos pixels. As telas sem referência (desktop de Detalhe, Carrinho, Pagamento e Conta; mobile de Perfil, Carteiras, Atividade e Pedido) não foram comparadas.
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
