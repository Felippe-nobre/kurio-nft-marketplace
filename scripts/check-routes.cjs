// Verificação de acesso direto + refresh em todas as rotas, nas larguras 390/768/1440.
// Uso local: npm run build:demo && npm run preview (em outro terminal), depois npm run check:routes
// Após o deploy: BASE_URL=https://sua-url.vercel.app npm run check:routes
const { chromium } = require('@playwright/test')
const BASE = process.env.BASE_URL ?? 'http://localhost:4173'
const PUBLIC = ['/', '/nft/1', '/nft/14', '/nft/inexistente', '/cart', '/login', '/cadastro', '/rota-que-nao-existe']
const PRIVATE = ['/checkout', '/profile', '/wallets', '/favorites', '/activity']
const WIDTHS = [390, 768, 1440]

;(async () => {
  const browser = await chromium.launch()
  const rows = []
  for (const width of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, locale: 'pt-BR' })
    const page = await ctx.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    const visit = async (path, label) => {
      for (const step of ['direto', 'refresh']) {
        errors.length = 0
        if (step === 'direto') await page.goto(BASE + path, { waitUntil: 'networkidle' })
        else await page.reload({ waitUntil: 'networkidle' })
        await page.waitForTimeout(400)
        const h1 = await page.locator('h1').first().textContent({ timeout: 5000 }).catch(() => null)
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
        rows.push({ width, path: label ?? path, step, url: new URL(page.url()).pathname, h1: (h1 ?? '—').trim().slice(0, 40), overflow, errors: errors.filter((e) => !/404|Failed to load resource/.test(e)).slice(0, 2) })
      }
    }
    for (const p of PUBLIC) await visit(p)
    // Rotas privadas sem sessão: devem redirecionar ao login.
    for (const p of PRIVATE) await visit(p, `${p} (sem sessão)`)
    // Com sessão.
    await page.goto(BASE + '/login', { waitUntil: 'networkidle' })
    const dlg = page.getByRole('dialog')
    await dlg.getByLabel('E-mail').fill('ana@kurio.test')
    await dlg.getByLabel('Senha', { exact: true }).fill('senha123')
    await dlg.getByRole('button', { name: 'Entrar', exact: true }).click()
    await page.waitForURL((u) => !u.pathname.startsWith('/login'))
    for (const p of PRIVATE) await visit(p, `${p} (logado)`)
    await ctx.close()
  }
  await browser.close()
  let bad = 0
  for (const r of rows) {
    const flag = r.overflow > 0 || r.errors.length || r.h1 === '—' ? '❌' : '✅'
    if (flag === '❌') bad++
    console.log(`${flag} ${r.width}px ${r.path.padEnd(28)} ${r.step.padEnd(7)} → ${r.url.padEnd(22)} h1="${r.h1}" overflow=${r.overflow} ${r.errors.length ? 'errors=' + JSON.stringify(r.errors) : ''}`)
  }
  console.log(`\n${rows.length} verificações, ${bad} problema(s).`)
  process.exit(bad ? 1 : 0)
})()
