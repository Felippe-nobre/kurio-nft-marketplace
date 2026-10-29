# Resultados Lighthouse (medianas)

Gerado em 2026-10-29T03:44:47.509Z · Lighthouse 13.6.0 · Chrome 153.0.0.0 · Node v22.23.4 · Linux 6.18.44-fc-v185 (x64) · 2 CPUs

Build de demonstração (vite build --mode demo, MSW ligado), vite preview local, Chrome headless; mobile = throttling padrão do Lighthouse (Moto G Power, 4G lento simulado); desktop = desktop-config.

| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP (ms) | CLS | TBT (ms) |
|---|---|---|---|---|---|---|---|---|
| inicio | mobile | 69 ⚠️ | 97 ✅ | 100 ✅ | 100 ✅ | 3817 | 0 | 857 |
| detalhe | mobile | 69 ⚠️ | 97 ✅ | 100 ✅ | 100 ✅ | 3542 | 0 | 1012 |
| inicio | desktop | 98 ✅ | 100 ✅ | 100 ✅ | 100 ✅ | 1059 | 0 | 21 |
| detalhe | desktop | 98 ✅ | 97 ✅ | 100 ✅ | 100 ✅ | 1067 | 0 | 5 |

Relatórios HTML/JSON de cada execução em `lighthouse/reports/` (3 por página e perfil).
