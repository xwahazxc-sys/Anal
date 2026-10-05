// Edge, negative and accessibility cases. Run after the web export is served: node e2e/edge.cjs
const { chromium } = require(process.env.PW_PATH || 'playwright');
const fs = require('fs');
const path = require('path');
const BASE = process.env.BASE || 'http://localhost:8099';
const axeSrc = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const results = [];
const ok = (id, name, cond, extra = '') => { results.push([id, !!cond]); console.log((cond ? 'PASS ' : 'FAIL ') + id + ' ' + name + (extra ? ' - ' + extra : '')); };

async function axe(page) {
  await page.evaluate(axeSrc);
  const r = await page.evaluate(() => axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] }));
  return r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id + ': ' + v.nodes[0].html.slice(0, 80));
}
const lookup = async (page, code) => {
  await page.getByLabel('Штрихкод вручную').fill(code);
  await page.getByRole('button', { name: 'Найти продукт' }).click();
};

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
  for (const [w, h, tag] of [[390, 844, 'm'], [1440, 900, 'd']]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('response', (r) => { if (r.status() >= 500) errors.push(r.status() + ' ' + r.url()); });
    await page.goto(BASE);
    await page.getByLabel('Штрихкод вручную').waitFor();

    // accessibility, per screen
    let v = await axe(page); ok(`${tag} A11Y-S01`, 'scanner has no serious a11y violations', v.length === 0, v[0]);
    await lookup(page, '4600000000035');
    await page.getByRole('heading', { name: 'Шоколадные подушечки' }).waitFor();
    v = await axe(page); ok(`${tag} A11Y-S02`, 'product card', v.length === 0, v[0]);

    // F01-E1 same product twice -> one history entry
    await page.getByRole('button', { name: 'Назад' }).click();
    await lookup(page, '4600000000035');
    await page.getByRole('heading', { name: 'Шоколадные подушечки' }).waitFor();
    await page.getByRole('tab', { name: 'История' }).click();
    await page.getByRole('heading', { name: 'История' }).waitFor();
    ok(`${tag} F01-E1`, 'same product twice appears once in history', (await page.getByRole('button', { name: /Шоколадные подушечки/ }).count()) === 1);
    v = await axe(page); ok(`${tag} A11Y-S04`, 'history', v.length === 0, v[0]);

    // F01-E2 refresh keeps history
    await page.reload();
    await page.getByRole('tab', { name: 'История' }).click();
    ok(`${tag} F01-E2`, 'history survives refresh', await page.getByRole('button', { name: /Шоколадные подушечки/ }).isVisible());

    // F01-N1 non-digit input
    await page.getByRole('tab', { name: 'Сканер' }).click();
    await lookup(page, 'abc');
    ok(`${tag} F01-N1`, 'letters only gives validation error', await page.getByText('Штрихкод — от 8 цифр').isVisible());
    await lookup(page, '4600-0000-00011');
    await page.getByRole('heading', { name: 'Овсяные хлопья цельнозерновые' }).waitFor({ timeout: 3000 }).then(
      () => ok(`${tag} F01-E3`, 'dashes in barcode are ignored', true), () => ok(`${tag} F01-E3`, 'dashes in barcode are ignored', false));
    await page.getByRole('button', { name: 'Назад' }).click();

    // F01-E4 keyboard only
    await page.getByLabel('Штрихкод вручную').focus();
    await page.keyboard.type('4600000000028');
    await page.keyboard.press('Enter');
    ok(`${tag} F01-E4`, 'Enter in barcode field submits', await page.getByRole('heading', { name: 'Мюсли с мёдом' }).isVisible().catch(() => false)
      || await page.getByRole('heading', { name: 'Мюсли с мёдом' }).waitFor({ timeout: 3000 }).then(() => true, () => false));
    await page.getByRole('button', { name: 'Назад' }).click();

    // F02 edge: long name, emoji, double submit
    await lookup(page, '4608888888881');
    await page.getByRole('button', { name: 'Добавить продукт' }).click();
    const long = 'Очень длинное название продукта '.repeat(2).trim().slice(0, 60) + ' 🍫 Café';
    await page.getByLabel('Название', { exact: true }).fill(long);
    await page.getByLabel('Состав (через запятую)').fill('Какао, сахар, ароматизатор');
    v = await axe(page); ok(`${tag} A11Y-S06`, 'add product form', v.length === 0, v[0]);
    const send = page.getByRole('button', { name: 'Отправить' });
    await send.dblclick();
    await page.getByRole('heading', { name: long.slice(0, 20) }).waitFor();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    ok(`${tag} F02-E1`, 'long name with emoji, no horizontal overflow', !overflow);
    await page.getByRole('tab', { name: 'История' }).click();
    await page.getByRole('heading', { name: 'История' }).waitFor();
    const cards = await page.getByRole('button', { name: new RegExp(long.slice(0, 20)) }).count();
    ok(`${tag} F02-E2`, 'double submit creates one product', cards === 1, `cards=${cards}`);
    const added = await page.evaluate(() => JSON.parse(localStorage.getItem('up') || '[]').length);
    ok(`${tag} F02-E3`, 'double submit stored once', added === 1, `stored=${added}`);

    // F04 paywall a11y + restore
    await page.getByRole('tab', { name: 'Ещё' }).click();
    await page.getByRole('button', { name: 'Premium' }).click();
    v = await axe(page); ok(`${tag} A11Y-S09`, 'paywall', v.length === 0, v[0]);

    ok(`${tag} NOERR`, 'no console errors or 5xx', errors.length === 0, errors.slice(0, 2).join(' | '));
    await ctx.close();
  }
  await browser.close();
  const failed = results.filter((r) => !r[1]);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})();
