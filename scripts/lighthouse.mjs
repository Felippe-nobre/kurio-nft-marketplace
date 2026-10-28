#!/usr/bin/env node
/**
 * Auditoria Lighthouse: Início e Detalhe do NFT, perfis mobile e desktop,
 * 3 execuções cada; reporta a mediana de Performance, Accessibility,
 * Best Practices e SEO, além de LCP, CLS e TBT.
 *
 * Uso: npm run build:demo && npm run lighthouse
 * (o script sobe o `vite preview` sozinho se a porta 4173 estiver livre)
 * Variáveis: LH_BASE_URL, LH_RUNS, CHROME_PATH
 */
import { spawn } from 'node:child_process'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import lighthouse from 'lighthouse'
import * as chromeLauncher from 'chrome-launcher'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'lighthouse', 'reports')
const BASE = process.env.LH_BASE_URL ?? 'http://localhost:4173'
const RUNS = Number(process.env.LH_RUNS ?? 3)
const PAGES = [
  { id: 'inicio', path: '/' },
  { id: 'detalhe', path: '/nft/1' },
]
const PROFILES = ['mobile', 'desktop']
const TARGETS = { performance: 90, accessibility: 95, 'best-practices': 95, seo: 90 }

async function chromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH
  try {
    const { chromium } = await import('playwright-core')
    return chromium.executablePath()
  } catch {
    return undefined
  }
}

async function isUp(url) {
  try {
    const r = await fetch(url)
    return r.ok
  } catch {
    return false
  }
}

async function ensureServer() {
  if (await isUp(BASE)) return null
  const child = spawn('npm', ['run', 'preview'], { cwd: root, stdio: 'ignore', shell: process.platform === 'win32' })
  for (let i = 0; i < 60; i++) {
    if (await isUp(BASE)) return child
    await new Promise((r) => setTimeout(r, 500))
  }
  child.kill()
  throw new Error(`Servidor de preview não respondeu em ${BASE}. Rode "npm run build:demo" antes.`)
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

async function main() {
  await mkdir(outDir, { recursive: true })
  const server = await ensureServer()
  const executable = await chromePath()
  const lhPkg = JSON.parse(await readFile(path.join(root, 'node_modules', 'lighthouse', 'package.json'), 'utf8'))
  const results = []
  let chromeVersion = 'desconhecida'
  try {
    for (const profile of PROFILES) {
      for (const page of PAGES) {
        const runs = []
        for (let i = 1; i <= RUNS; i++) {
          const chrome = await chromeLauncher.launch({ chromePath: executable, chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'] })
          try {
            const flags = { port: chrome.port, output: ['html', 'json'], logLevel: 'error', onlyCategories: Object.keys(TARGETS) }
            const config = profile === 'desktop' ? (await import('lighthouse/core/config/desktop-config.js')).default : undefined
            const r = await lighthouse(`${BASE}${page.path}`, flags, config)
            const [html, json] = r.report
            const base = `${page.id}-${profile}-${i}`
            await writeFile(path.join(outDir, `${base}.html`), html)
            await writeFile(path.join(outDir, `${base}.json`), json)
            const lhr = r.lhr
            chromeVersion = lhr.environment?.hostUserAgent?.match(/Chrome\/([\d.]+)/)?.[1] ?? chromeVersion
            runs.push({
              performance: Math.round(lhr.categories.performance.score * 100),
              accessibility: Math.round(lhr.categories.accessibility.score * 100),
              'best-practices': Math.round(lhr.categories['best-practices'].score * 100),
              seo: Math.round(lhr.categories.seo.score * 100),
              lcpMs: Math.round(lhr.audits['largest-contentful-paint'].numericValue),
              cls: Number(lhr.audits['cumulative-layout-shift'].numericValue.toFixed(3)),
              tbtMs: Math.round(lhr.audits['total-blocking-time'].numericValue),
            })
            console.log(`${base}: ${JSON.stringify(runs.at(-1))}`)
          } finally {
            await chrome.kill()
          }
        }
        const med = Object.fromEntries(Object.keys(runs[0]).map((k) => [k, median(runs.map((r) => r[k]))]))
        results.push({ page: page.id, url: page.path, profile, runs, median: med })
      }
    }
  } finally {
    server?.kill()
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    lighthouse: lhPkg.version,
    chrome: chromeVersion,
    node: process.version,
    platform: `${os.type()} ${os.release()} (${os.arch()})`,
    cpus: os.cpus().length,
    baseUrl: BASE,
    runsPerCase: RUNS,
    conditions: 'Build de demonstração (vite build --mode demo, MSW ligado), vite preview local, Chrome headless; mobile = throttling padrão do Lighthouse (Moto G Power, 4G lento simulado); desktop = desktop-config.',
    targets: TARGETS,
    results,
  }
  await writeFile(path.join(root, 'lighthouse', 'summary.json'), JSON.stringify(summary, null, 2))
  const ok = (v, t) => (v >= t ? `${v} ✅` : `${v} ⚠️`)
  const md = [
    '# Resultados Lighthouse (medianas)',
    '',
    `Gerado em ${summary.generatedAt} · Lighthouse ${summary.lighthouse} · Chrome ${summary.chrome} · Node ${summary.node} · ${summary.platform} · ${summary.cpus} CPUs`,
    '',
    summary.conditions,
    '',
    '| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP (ms) | CLS | TBT (ms) |',
    '|---|---|---|---|---|---|---|---|---|',
    ...results.map(
      (r) =>
        `| ${r.page} | ${r.profile} | ${ok(r.median.performance, 90)} | ${ok(r.median.accessibility, 95)} | ${ok(r.median['best-practices'], 95)} | ${ok(r.median.seo, 90)} | ${r.median.lcpMs} | ${r.median.cls} | ${r.median.tbtMs} |`,
    ),
    '',
    `Relatórios HTML/JSON de cada execução em \`lighthouse/reports/\` (${RUNS} por página e perfil).`,
  ].join('\n')
  await writeFile(path.join(root, 'lighthouse', 'RESULTS.md'), md + '\n')
  console.log('\n' + md)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
