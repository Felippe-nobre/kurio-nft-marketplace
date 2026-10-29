# Retomar

**Situação:** o ajuste do mobile às 6 telas do Figma foi **concluído** em 28/10/2026 (noite). O detalhamento (o que mudou, o que ficou diferente de propósito, testes e Lighthouse) está no `STATUS.md`, seção "Ajuste do mobile ao Figma".

Histórico git dentro do projeto:
- `8ecc61a`: versão validada antes do ajuste mobile;
- os commits seguintes: navegação e Início, depois Detalhes, Carrinho, Pagamento e Login/Cadastro, e por fim testes, correções e documentação.

Ferramentas em `docs/figma-mobile/`:
- `capture.cjs` captura as 6 telas a 414×896 e mede a rolagem horizontal;
- `sbs.py` monta as comparações lado a lado com as referências do Figma (as referências ficam fora do projeto, nos ZIPs `Frontend_Challenge*.zip`);
- `cls.cjs` mede deslocamentos de layout no Início mobile.

Pendências conhecidas, todas descritas no `STATUS.md`:
- Performance mobile do Lighthouse abaixo de 90;
- telas sem referência no Figma não foram comparadas;
- testes só no Chromium.
