# Resultados Lighthouse (medianas)

Gerado em 2026-10-28T19:48:38.173Z · Lighthouse 12.8.2 · Chrome 153.0.0.0 · Node v22.23.4 · Linux 6.18.44-fc-v180 (x64) · 2 CPUs

Build de demonstração (vite build --mode demo, MSW ligado), vite preview local, Chrome headless; mobile = throttling padrão do Lighthouse (Moto G Power, 4G lento simulado); desktop = desktop-config.

| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP (ms) | CLS | TBT (ms) |
|---|---|---|---|---|---|---|---|---|
| inicio | mobile | 89 ⚠️ | 97 ✅ | 100 ✅ | 100 ✅ | 2946 | 0 | 165 |
| detalhe | mobile | 83 ⚠️ | 97 ✅ | 100 ✅ | 100 ✅ | 3576 | 0 | 171 |
| inicio | desktop | 97 ✅ | 100 ✅ | 100 ✅ | 100 ✅ | 1009 | 0.04 | 10 |
| detalhe | desktop | 97 ✅ | 97 ✅ | 100 ✅ | 100 ✅ | 892 | 0.083 | 0 |

Relatórios HTML/JSON de cada execução em `lighthouse/reports/` (3 por página e perfil).
