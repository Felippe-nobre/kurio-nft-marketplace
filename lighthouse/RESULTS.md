# Resultados Lighthouse (medianas)

Gerado em 2026-10-29T02:30:07.665Z · Lighthouse 13.6.0 · Chrome 153.0.0.0 · Node v22.23.4 · Linux 6.18.44-fc-v185 (x64) · 2 CPUs

Build de demonstração (vite build --mode demo, MSW ligado), vite preview local, Chrome headless; mobile = throttling padrão do Lighthouse (Moto G Power, 4G lento simulado); desktop = desktop-config.

| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP (ms) | CLS | TBT (ms) |
|---|---|---|---|---|---|---|---|---|
| inicio | mobile | 69 ⚠️ | 97 ✅ | 100 ✅ | 100 ✅ | 3851 | 0 | 831 |
| detalhe | mobile | 68 ⚠️ | 97 ✅ | 100 ✅ | 100 ✅ | 3639 | 0 | 1011 |
| inicio | desktop | 96 ✅ | 100 ✅ | 100 ✅ | 100 ✅ | 1363 | 0 | 44 |
| detalhe | desktop | 97 ✅ | 97 ✅ | 100 ✅ | 100 ✅ | 1008 | 0.083 | 5 |

Relatórios HTML/JSON de cada execução em `lighthouse/reports/` (3 por página e perfil).
