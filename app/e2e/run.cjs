// Click-through of the main flows with Playwright, plus screenshots for replica-diff.
// Usage: node e2e/run.cjs   (expects the web export served on $BASE, default http://localhost:8099)
const { chromium } = require(process.env.PW_PATH || 'playwright');
const path = require('path');
const BASE = process.env.BASE || 'http://localhost:8099';
const OUT = path.join(__dirname, '..', '..', 'replica', 'clone-screens');
const results = [];
const ok = (name, cond, extra = '') => { results.push([name, !!cond, extra]); console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? ' - ' + extra : '')); };

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
  for (const [w, h, tag] of [[390, 844, 'm'], [1440, 900, 'd']]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(BASE);
    await page.getByLabel('Штрихкод вручную').waitFor();
    await page.screenshot({ path: `${OUT}/S01-${tag}.png` });

    // validation
    await page.getByLabel('Штрихкод вручную').fill('123');
    await page.getByRole('button', { name: 'Найти продукт' }).click();
    ok(`${tag} S01 validation message`, await page.getByText('Штрихкод — от 8 цифр').isVisible());

    // F01 happy path: good product
    await page.getByLabel('Штрихкод вручную').fill('4600000000011');
    await page.getByRole('button', { name: 'Найти продукт' }).click();
    await page.getByRole('heading', { name: 'Овсяные хлопья цельнозерновые' }).waitFor();
    ok(`${tag} F01 good product shows green score`, await page.getByLabel(/Оценка \d+ из 100, отлично/).first().isVisible());
    await page.screenshot({ path: `${OUT}/S02-good-${tag}.png` });

    // F01 bad product with alternatives
    await page.getByRole('button', { name: 'Назад' }).click();
    await page.getByLabel('Штрихкод вручную').fill('4600000000035');
    await page.getByRole('button', { name: 'Найти продукт' }).click();
    await page.getByRole('heading', { name: 'Шоколадные подушечки' }).waitFor();
    ok(`${tag} S03 alternatives shown`, await page.getByRole('heading', { name: 'Лучшие альтернативы' }).isVisible());
    await page.screenshot({ path: `${OUT}/S03-${tag}.png`, fullPage: true });

    // cap at 49 when a high-risk additive is present
    await page.getByRole('button', { name: 'Назад' }).click();
    await page.getByLabel('Штрихкод вручную').fill('4600000000080');
    await page.getByRole('button', { name: 'Найти продукт' }).click();
    await page.getByRole('heading', { name: 'Фруктовые снеки с красителем' }).waitFor();
    ok(`${tag} F01 score capped at 49 for high-risk additive`, await page.getByText(/Оценка ограничена до 49/).isVisible() && await page.getByLabel(/Оценка 49 из 100/).first().isVisible());
    await page.getByRole('button', { name: 'Назад' }).click();
    await page.getByLabel('Штрихкод вручную').fill('4600000000035');
    await page.getByRole('button', { name: 'Найти продукт' }).click();
    await page.getByRole('heading', { name: 'Шоколадные подушечки' }).waitFor();

    // ingredient expand
    await page.getByRole('button', { name: /Красный краситель/ }).click();
    ok(`${tag} ingredient expands`, await page.getByText(/Есть данные о возможном вреде/).isVisible());

    // favorite
    await page.getByRole('button', { name: 'В избранное' }).click();
    ok(`${tag} favorite toggles`, await page.getByRole('button', { name: 'Убрать из избранного' }).isVisible());

    // history + favorites
    await page.getByRole('tab', { name: 'История' }).click();
    await page.getByRole('heading', { name: 'История' }).waitFor();
    ok(`${tag} S04 history lists scans`, await page.getByRole('button', { name: /Шоколадные подушечки/ }).isVisible());
    await page.screenshot({ path: `${OUT}/S04-${tag}.png` });
    await page.getByRole('tab', { name: 'Избранное' }).click();
    ok(`${tag} S05 favorites lists item`, await page.getByRole('button', { name: /Шоколадные подушечки/ }).isVisible());
    await page.screenshot({ path: `${OUT}/S05-${tag}.png` });

    // F02 unknown product -> add
    await page.getByRole('tab', { name: 'Сканер' }).click();
    await page.getByLabel('Штрихкод вручную').fill('4609999999991');
    await page.getByRole('button', { name: 'Найти продукт' }).click();
    await page.getByRole('heading', { name: 'Такого продукта пока нет' }).waitFor();
    await page.screenshot({ path: `${OUT}/S02-missing-${tag}.png` });
    await page.getByRole('button', { name: 'Добавить продукт' }).click();
    await page.getByRole('button', { name: 'Отправить' }).click();
    ok(`${tag} S06 validates empty form`, await page.getByText('Укажите название продукта').isVisible());
    await page.screenshot({ path: `${OUT}/S06-${tag}.png` });
    await page.getByLabel('Название', { exact: true }).fill('Тестовый батончик');
    await page.getByLabel('Состав (через запятую)').fill('Овёс, мёд');
    await page.getByRole('button', { name: 'Отправить' }).click();
    await page.getByRole('heading', { name: 'Тестовый батончик' }).waitFor();
    ok(`${tag} F02 submitted product is found`, true);

    // premium gating: search -> paywall
    await page.getByRole('tab', { name: 'Ещё' }).click();
    await page.getByRole('button', { name: 'Поиск продукта' }).click();
    await page.getByRole('heading', { name: 'Premium' }).first().waitFor();
    ok(`${tag} S09 paywall shown to free user`, true);
    await page.screenshot({ path: `${OUT}/S09-${tag}.png` });
    await page.getByRole('button', { name: /Оформить Premium/ }).click();
    await page.getByText('Premium активен.').waitFor();
    await page.getByRole('button', { name: 'Назад' }).click();
    await page.getByRole('button', { name: 'Поиск продукта' }).click();
    await page.getByLabel('Название или бренд').fill('йогурт');
    ok(`${tag} S07 search finds results`, await page.getByRole('button', { name: /Йогурт натуральный/ }).isVisible());
    await page.screenshot({ path: `${OUT}/S07-${tag}.png` });
    await page.getByLabel('Название или бренд').fill('zzzz');
    ok(`${tag} S07 empty result`, await page.getByText('Ничего не найдено').isVisible());

    // S08 preferences + alert
    await page.getByRole('button', { name: 'Назад' }).click();
    await page.getByRole('button', { name: 'Мои предпочтения' }).click();
    await page.getByLabel('Без лактозы').click();
    await page.screenshot({ path: `${OUT}/S08-${tag}.png` });
    await page.getByRole('tab', { name: 'Сканер' }).click();
    await page.getByLabel('Штрихкод вручную').fill('4600000000042');
    await page.getByRole('button', { name: 'Найти продукт' }).click();
    ok(`${tag} S08 lactose alert on product`, await page.getByText('Содержит лактозу').isVisible());

    ok(`${tag} no console errors`, errors.length === 0, errors.slice(0, 2).join(' | '));
    await ctx.close();
  }
  await browser.close();
  const failed = results.filter((r) => !r[1]);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})();
