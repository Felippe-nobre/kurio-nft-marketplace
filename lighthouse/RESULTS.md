# Resultados Lighthouse (medianas)

Gerado em 2026-10-29T01:27:53.373Z · Lighthouse 12.8.2 · Chrome 153.0.0.0 · Node v22.23.4 · Linux 6.18.44-fc-v185 (x64) · 2 CPUs

Build de demonstração (vite build --mode demo, MSW ligado), vite preview local, Chrome headless; mobile = throttling padrão do Lighthouse (Moto G Power, 4G lento simulado); desktop = desktop-config.

| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP (ms) | CLS | TBT (ms) |
|---|---|---|---|---|---|---|---|---|
| inicio | mobile | 67 ⚠️ | 97 ✅ | 100 ✅ | 100 ✅ | 3927 | 0 | 658 |
| detalhe | mobile | 68 ⚠️ | 97 ✅ | 100 ✅ | 100 ✅ | 3797 | 0 | 629 |
| inicio | desktop | 93 ✅ | 100 ✅ | 100 ✅ | 100 ✅ | 1533 | 0 | 24 |
| detalhe | desktop | 96 ✅ | 97 ✅ | 100 ✅ | 100 ✅ | 1076 | 0.083 | 6 |

Relatórios HTML/JSON de cada execução em `lighthouse/reports/` (3 por página e perfil).
