const { chromium } = require('/home/claude/kurio/kurio/node_modules/playwright');
const { spawn } = require('child_process');
(async () => {
  const srv = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { cwd: process.argv[2] || '/home/claude/kurio/kurio', stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { try { if ((await fetch('http://localhost:4173')).ok) break } catch {} await new Promise(r => setTimeout(r, 300)) }
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 412, height: 823 }, isMobile: true, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await p.addInitScript(() => { window.__ls = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__ls.push({ v: +e.value.toFixed(4), t: Math.round(e.startTime), src: e.sources.map(s => (s.node ? (s.node.nodeName + '.' + String(s.node.className).slice(0, 60) + ' ' + (s.node.textContent||'').slice(0,30)) : '?') + ` ${JSON.stringify(s.previousRect.y)}→${JSON.stringify(s.currentRect.y)}`) }) }).observe({ type: 'layout-shift', buffered: true }) });
  const probe = () => p.evaluate(() => { const q = (sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.height)] };
    return { search: q('#mobile-search'), hero: q('section[aria-labelledby=hero-title-mobile]'), catalog: q('#catalogo'), tabs: q('[role=tablist]'), gridWrap: q('#catalogo-grid'), firstLi: q('#catalogo-grid li'), skel: !!document.querySelector('[data-testid=catalog-skeleton]') } });
  await p.goto('http://localhost:4173/');
  for (let i = 0; i < 12; i++) { console.log(JSON.stringify(await probe())); await p.waitForTimeout(400) }
  console.log(JSON.stringify(await p.evaluate(() => window.__ls), null, 1));
  await b.close(); srv.kill();
})();
