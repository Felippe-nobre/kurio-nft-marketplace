# Resultados Lighthouse (medianas)

Gerado em 2026-10-29T02:42:13.302Z · Lighthouse 13.6.0 · Chrome 153.0.0.0 · Node v22.23.4 · Linux 6.18.44-fc-v185 (x64) · 2 CPUs

Build de demonstração (vite build --mode demo, MSW ligado), vite preview local, Chrome headless; mobile = throttling padrão do Lighthouse (Moto G Power, 4G lento simulado); desktop = desktop-config.

| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP (ms) | CLS | TBT (ms) |
|---|---|---|---|---|---|---|---|---|
| inicio | mobile | 68 ⚠️ | 97 ✅ | 100 ✅ | 100 ✅ | 3887 | 0 | 899 |
| detalhe | mobile | 71 ⚠️ | 97 ✅ | 100 ✅ | 100 ✅ | 3602 | 0 | 835 |
| inicio | desktop | 96 ✅ | 100 ✅ | 100 ✅ | 100 ✅ | 1422 | 0 | 43 |
| detalhe | desktop | 98 ✅ | 97 ✅ | 100 ✅ | 100 ✅ | 1063 | 0 | 7 |

Relatórios HTML/JSON de cada execução em `lighthouse/reports/` (3 por página e perfil).
