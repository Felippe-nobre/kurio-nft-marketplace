// Captura o app nas mesmas telas/tamanho das referências do Figma (414x896).
const { chromium } = require('/home/claude/kurio/kurio/node_modules/playwright');
const { spawn } = require('child_process');
const OUT = process.argv[2] || '/home/claude/figma/app';
const B = 'http://localhost:4173';
const SCEN = { latency: 'none', failures: {}, outOfOrder: false, payment: 'manual', paymentDelayMs: 400, walletConnect: 'approve', orderTimeoutAfterCreate: false, priceChangeOnConfirm: false, soldOutOnConfirm: false };
(async () => {
  require('fs').mkdirSync(OUT, { recursive: true });
  const srv = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { cwd: '/home/claude/kurio/kurio', stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { try { if ((await fetch(B)).ok) break } catch {} await new Promise(r => setTimeout(r, 300)) }
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 414, height: 896 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'pt-BR', reducedMotion: 'reduce' });
  await ctx.addInitScript((s) => { if (!sessionStorage.getItem('i')) { sessionStorage.setItem('i', '1'); localStorage.setItem('kurio:scenario', JSON.stringify(s)) } }, SCEN);
  const p = await ctx.newPage();
  const go = async (path) => { await p.goto(B + path); await p.waitForFunction(() => !!window.__kurio); await p.waitForTimeout(900);
    await p.evaluate(async () => { for (const i of document.images) if (i.loading === 'lazy') i.loading = 'eager'; await document.fonts.ready }); await p.waitForTimeout(400) };
  const shot = async (n) => p.screenshot({ path: `${OUT}/${n}.png` });
  const only = (process.argv[3] || '').split(',').filter(Boolean); const want = (n) => !only.length || only.includes(n);
  if (want('Inicio')) { await go('/'); await shot('Inicio') }
  if (want('Detalhes_do_NFT')) { await go('/nft/1'); await shot('Detalhes_do_NFT') }
  if (want('Login')) { await go('/login'); await shot('Login') }
  if (want('Cadastro')) { await go('/cadastro'); await shot('Cadastro') }
  if (want('Carrinho_de_NFTs') || want('Pagamento')) {
    await go('/login');
    const d = p.getByRole('dialog'); await d.getByLabel('E-mail').fill('ana@kurio.test'); await d.getByLabel('Senha', { exact: true }).fill('senha123');
    await d.getByRole('button', { name: 'Entrar', exact: true }).click(); await p.waitForTimeout(1200);
    await p.evaluate(async () => {
      const s = JSON.parse(localStorage.getItem('kurio:session')); const g = localStorage.getItem('kurio:guest-id');
      for (const [nftId, editionId, quantity] of [['1','1-50',1],['5','1-1',1],['6','1-10',2],['7','1-50',2]]) {
        await fetch('/api/cart/items', { method: 'PUT', headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + s.token, 'X-Guest-Id': g }, body: JSON.stringify({ nftId, editionId, quantity, mode: 'set' }) })
      }
    });
    if (want('Carrinho_de_NFTs')) { await go('/cart'); await shot('Carrinho_de_NFTs') }
    if (want('Pagamento')) { await go('/checkout'); await shot('Pagamento') }
  }
  // métricas de overflow
  const res = {};
  for (const w of [360, 390, 414, 768, 1440]) { await p.setViewportSize({ width: w, height: 896 });
    for (const path of ['/', '/nft/1', '/cart', '/checkout', '/login', '/cadastro', '/profile']) { await p.goto(B + path); await p.waitForTimeout(700); res[`${path}@${w}`] = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) } }
  console.log('overflow', JSON.stringify(Object.fromEntries(Object.entries(res).filter(([, v]) => v > 0))));
  await b.close(); srv.kill();
})();
