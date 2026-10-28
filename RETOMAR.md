# Retomar: ajuste do mobile ao Figma (trabalho interrompido em 28/10/2026, 17:15)

## Contexto

As referências do Figma enviadas são **6 telas mobile** (414×896, só a primeira dobra): Início, Detalhes do NFT, Carrinho de NFTs, Pagamento, Login e Cadastro. Ficam fora do projeto, em `Frontend_Challenge*.zip`.

Decisões tomadas:
- Corrigir **só abaixo de 768 px** (classes `max-md:` / `md:hidden`). O desktop já estava validado e não deve mudar.
- **Cores e tipografia** já batiam com o Figma (fundo `#140d0a`, superfície `#241612`, laranja `#d28a4c` e `#e89b55`, Roboto Mono). As diferenças são de estrutura e forma.
- **Pagamento:** o formulário do colecionador é requisito funcional. Ele fica, mas depois da escolha de carteira (no Figma mobile ele não aparece).
- **Dados simulados** ("Kurio Apes", atributo "Raro", edições) não são alterados. Os textos da interface do Figma mobile são aplicados no mobile.
- Partes da página inicial sem referência mobile (destaque, diário, rodapé) não mudam.

## Diferenças encontradas e situação

| Prioridade | Tela | Diferença | Situação |
|---|---|---|---|
| P1 | Todas | Cabeçalho do site no mobile (no Figma: barra inferior no Início e barra com "voltar" nas demais) | **Parcial.** Cabeçalho oculto no mobile em `/`, `/nft/*`, `/cart`, `/checkout`, `/login`, `/cadastro`; barra inferior pronta no Início. `MobileTopBar` criado, **mas ainda não usado** em Detalhes, Carrinho e Pagamento |
| P1 | Detalhes, Carrinho, Pagamento | Breadcrumb aparece no mobile | **Pendente** (aplicar `max-md:hidden` onde entrar o `MobileTopBar`) |
| P1 | Pagamento | Rolagem horizontal de 10 px em 360 px | **Pendente** (com a margem mobile nova de 24 px, medir de novo) |
| P2 | Início | Busca + botão de filtro, hero compacto, abas em uma linha, grade escalonada, cards arredondados com favorito | **Feito** (último ajuste de altura do hero gravado, mas **não conferido em captura**) |
| P2 | Detalhes | Imagem arredondada com voltar/favoritar sobrepostos, painel inferior, selo "★ 4.8 (19)", barra fixa com Qtd/preço/"Comprar NFT"/carrinho | **Pendente** |
| P2 | Carrinho | Título "Carrinho de NFTs" com voltar, itens em cards com imagem à esquerda e botões circulares, painel de resumo com cupom em pílula e "Conectar e finalizar" | **Pendente** |
| P2 | Pagamento | "Pagamento com carteira", carteiras salvas em cards, provedores em cards com ícone, Total, "Confirmar compra" fixo; formulário depois | **Pendente** |
| P2 | Login e Cadastro | Tela cheia com logo "KURIO", campos de 48 px, botão de 60 px, ícones Google/Facebook, link no rodapé, sem abas e sem X | **Pendente** |
| P3 | Início | Texto do hero mobile ("Seja dono da cultura digital…") | **Feito** |
| P3 | Cadastro | Botão "Criar perfil" e título "Criar perfil de colecionador" | **Pendente** |

## Arquivos alterados nesta etapa (desde o commit `baseline antes do ajuste mobile Figma`)

Novos:
- `src/components/SearchDialog.tsx`: diálogo "Buscar NFTs" compartilhado (`openSearch(trigger)`), aberto pelo cabeçalho e pelo botão central da barra inferior. O foco volta para quem abriu.
- `src/components/layout/MobileNav.tsx`: barra inferior do Figma (Início, Favoritos, botão central de busca, Carrinho, Conta). Com login, o link de conta tem o rótulo `Minha conta (Nome)`.
- `src/components/MobileTopBar.tsx`: barra com botão circular de voltar, título e ação (`overlay` para sobrepor a imagem no Detalhe). Ainda não usado.

Modificados:
- `src/components/layout/Header.tsx`: o diálogo de busca saiu daqui. Exporta `MOBILE_CHROMELESS` e oculta o cabeçalho no mobile nessas rotas.
- `src/app/RootLayout.tsx`: renderiza `SearchDialog` e `MobileNav` (só em `/`), com `pb-24` no mobile.
- `src/index.css`: margem lateral mobile do `.container-kurio` passou de 16 para **24 px** (Figma).
- `src/pages/Home.tsx`:
  - `MobileSearchBar`, `MobileHero` e o hook `useSearchTerm`;
  - painel de filtros controlado pelo `HomePage`, aberto pelo botão "Filtros" do tablet ou pelo do topo mobile;
  - **"Ordenar por" no mobile foi para dentro do painel de filtros**;
  - abas em uma linha e grade escalonada (`MOBILE_GRID`);
  - hero desktop oculto no mobile.
- `src/components/NftCard.tsx`: no mobile, moldura arredondada, arte quadrada arredondada, favorito circular no canto (`MobileFavorite`), sem os botões carrinho/lupa sobrepostos, RARO menor; skeleton no mesmo formato.

## Testes nesta etapa

- ✅ `tsc -b --noEmit`, `eslint .` e `npm run build:demo` passam no estado atual (conferido após a interrupção).
- ✅ Capturas de comparação do Início (414×896): sem rolagem horizontal em 360, 390, 414, 768 e 1440 px nas rotas `/`, `/nft/1`, `/cart`, `/checkout`, `/login`, `/cadastro` e `/profile`. A rolagem de 10 px no checkout em 360 px desapareceu na última medição, mas o Pagamento ainda vai mudar.
- ❌ **Playwright não foi executado após estas mudanças.** Ajustes já previstos:
  - `e2e/01-catalog.spec.ts`: no mobile, "Ordenar por" está no painel de filtros (abrir com `openFilters`, selecionar e depois `Escape`). O botão de filtros mobile tem `aria-label` "Filtros" / "Filtros (n)" e continua casando com `/^Filtros/`.
  - `e2e/11-a11y-keyboard.spec.ts`: no mobile, o gatilho "Buscar NFTs" agora é o botão central da barra inferior (mesmo nome acessível).
  - Login no mobile (`fixtures.login`): espera o link `Minha conta (Nome)` visível; no Início ele vem da barra inferior.
  - `e2e/visual.spec.ts`: baselines **mobile** precisam ser regeradas (`npm run test:e2e:update -- --grep @visual`) depois que o visual mobile for concluído. As desktop não devem mudar; se mudarem, é regressão.

## Como retomar

```bash
cd kurio
npm ci
npm run build:demo
# capturas 414x896 e comparação lado a lado (cópias em docs/figma-mobile/; originais em /home/claude/figma/tools):
#   node /home/claude/figma/tools/capture.cjs /home/claude/figma/app-depois [Tela1,Tela2]
#   python3 /home/claude/figma/tools/sbs.py /home/claude/figma/app-depois /home/claude/figma/cmp
```

Próximos passos, nesta ordem:
1. Conferir a captura do Início após o último ajuste do hero (`pb-7`; a altura alvo do card do hero é ~190 px).
2. **Detalhes** (`src/pages/Nft.tsx`):
   - `MobileTopBar overlay` com o favorito à direita;
   - imagem arredondada; painel com `rounded-t-[28px] bg-surface` e o selo de nota;
   - barra fixa inferior (Qtd, preço, "Comprar NFT" em pílula com gradiente de `#d28a4c` para `#a8683b`, botão circular de carrinho);
   - breadcrumb oculto no mobile;
   - manter os `data-testid` (`detail-price`, `availability`) **sem duplicar elementos**.
3. **Carrinho** (`src/pages/Cart.tsx`, `src/components/Summary.tsx`): `MobileTopBar title="Carrinho de NFTs"`, cards dos itens, painel de resumo e CTA "Conectar e finalizar". Manter `cart-line`, remoção e cupom.
4. **Pagamento** (`src/pages/Checkout.tsx`): `MobileTopBar title="Pagamento com carteira" fallback="/cart"`, carteiras e provedores em cards no topo, Total, "Confirmar compra" fixo; formulário depois (abrir/focar quando houver erro). Medir a rolagem a 360 px.
5. **Login e Cadastro** (`src/pages/AuthPage.tsx`): no mobile, `DialogContent` em tela cheia (`inset-0`, sem borda, sem X), logo "KURIO", sem abas, link no rodapé. Campos de 48 px, botão de 60 px, raio de 8 px.
6. Rodar `npm run typecheck && npm run lint && npm run test:e2e` (desktop e mobile), corrigir, regerar as baselines visuais mobile e rodar duas vezes.
7. Atualizar `STATUS.md` (seção Figma mobile) e gerar o ZIP.
