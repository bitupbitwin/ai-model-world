/** 本地静态端到端验收，使用独立临时浏览器，不读取用户浏览器资料。 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { siteConfig } from '../../src/config/site';
import { videosFor, type VideoLibrary } from '../../src/lib/videos';
import type { WorldSnapshot } from '../../src/lib/types';

async function main() {
  const evidence = path.resolve('.next-qa');
  fs.mkdirSync(path.join(evidence, 'tmp'), { recursive: true });
  process.env.TEMP = process.env.TMP = path.join(evidence, 'tmp');
  const snapshot = JSON.parse(fs.readFileSync('data/models.json', 'utf8')) as WorldSnapshot;
  const library = JSON.parse(fs.readFileSync('data/bilibili.json', 'utf8')) as VideoLibrary;
  const model = snapshot.models.find((m) => m.vendorId === 'deepseek' && videosFor(library, m.id, m.name).videos.length >= 2)!;
  assert.ok(model, '需要一个有视频的深度求索模型用于验证');
  const executablePath = process.env.ONENOVA_QA_BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const browser = await chromium.launch({ executablePath, headless: true });
  const results: Record<string, unknown>[] = [];
  try {
    for (const width of [1440, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      const errors: string[] = [];
      const requests: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
      page.on('requestfailed', (request) => requests.push(`${request.method()} ${request.url()}：${request.failure()?.errorText}`));
      const pages = [
        ['首页', '/', 'home'], ['文本模型分类', '/leaderboard/all/?kind=text', 'text'],
        ['深度求索厂商', '/vendor/deepseek/', 'vendor'], ['模型详情', `/model/${model.slug}/`, 'model'],
        ['时间线', '/chronicle/', 'chronicle'], ['排行榜', '/leaderboard/', 'leaderboard'],
        ['素材署名', '/credits/', 'credits'], ['不存在的地址', '/onenova-qa-missing/', '404'],
      ];
      for (const [name, route, shot] of pages) {
        errors.length = 0; requests.length = 0;
        const response = await page.goto(`http://127.0.0.1:4321${route}`, { waitUntil: 'networkidle', timeout: 60000 });
        const status = response?.status();
        assert.equal(status, shot === '404' ? 404 : 200, `${name}状态码`);
        if (shot === '404') await page.getByRole('heading', { name: '404 · 页面不存在' }).waitFor();
        assert.equal(await page.locator('footer').count(), 1);
        const footer = page.locator('footer');
        for (const link of [siteConfig.links.home, siteConfig.links.modelHub, siteConfig.links.upstream,
          siteConfig.links.credits, ...siteConfig.registrations]) {
          assert.equal(await footer.getByRole('link', { name: link.name, exact: true }).getAttribute('href'), link.href);
        }
        assert.equal(await page.getByText('站长', { exact: true }).count(), 0);
        assert.equal(await page.locator('a[href*="codefather.cn"]').count(), 0);
        if (shot === 'text') {
          assert.equal(await page.getByRole('button', { name: /^文本/ }).getAttribute('aria-pressed'), 'true');
        }
        if (shot === 'leaderboard') {
          const region = page.getByRole('button', { name: '国内', exact: true });
          await region.click();
          assert.equal(await region.getAttribute('aria-pressed'), 'true');
        }
        if (shot === 'model') {
          const heading = page.getByRole('heading', { name: /B 站上的.*实测/ });
          await heading.scrollIntoViewIfNeeded();
          const section = heading.locator('..').locator('..');
          const expected = videosFor(library, model.id, model.name).videos;
          await section.locator('img').evaluateAll((images) => { images.forEach((image) => { (image as HTMLImageElement).loading = 'eager'; }); });
          await section.locator('img').evaluateAll(async (images) => {
            await Promise.all(images.map((image) => (image as HTMLImageElement).decode()));
          });
          const covers = await section.locator('img').evaluateAll((images) => images.every((image) => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0));
          assert.ok(covers, '视频封面必须能从 B 站 CDN 加载');
          const actual = await section.locator('li a[title]').evaluateAll((links) => links.map((a) => a.getAttribute('title')));
          assert.deepEqual(actual, expected.map((v) => `${v.title} · ${v.author}`));
          await section.screenshot({ path: path.join(evidence, `videos-${width}.png`) });
          await page.evaluate(() => window.scrollTo(0, 0));
        }
        await page.screenshot({ path: path.join(evidence, `${shot}-${width}.png`) });
        const layout = await page.evaluate(() => ({ viewport: innerWidth, content: document.documentElement.scrollWidth }));
        assert.ok(layout.content <= layout.viewport, `${name}横向溢出：${JSON.stringify(layout)}`);
        // 404 文档自身的 HTTP 404 是预期响应，浏览器会为此记录一条资源状态消息。
        const expected404 = errors.filter((error) => shot === '404' && /404/.test(error));
        const unexpected = errors.filter((error) => !expected404.includes(error));
        // Next 在静态预取时主动取消 HEAD 探测；取消不表示对象加载失败。
        const probes = requests.filter((request) => request.startsWith('HEAD ') && request.endsWith('net::ERR_ABORTED'));
        const failures = requests.filter((request) => !probes.includes(request));
        results.push({ 页面: name, 地址: route, 宽度: width, 状态码: status, 错误: unexpected, 预期404消息: expected404, 请求失败: failures, 取消的探测: probes });
        assert.equal(unexpected.length, 0, `${name}控制台报错：${unexpected.join('；')}`);
        assert.equal(failures.length, 0, `${name}请求失败：${failures.join('；')}`);
        if (shot === 'home') {
          await footer.scrollIntoViewIfNeeded();
          await page.screenshot({ path: path.join(evidence, `footer-${width}.png`) });
        }
      }
      errors.length = 0; requests.length = 0;
      await page.goto('http://127.0.0.1:4321/', { waitUntil: 'networkidle' });
      const search = page.getByRole('combobox');
      await search.fill('多模态');
      const result = page.getByRole('option').filter({ hasText: '多模态' }).first();
      await result.waitFor();
      await page.screenshot({ path: path.join(evidence, `search-${width}.png`) });
      await result.click();
      await page.waitForURL(/kind=multimodal/);
      const multimodal = page.getByRole('button', { name: /^多模态/ });
      await multimodal.waitFor();
      assert.equal(await multimodal.getAttribute('aria-pressed'), 'true');
      await page.waitForLoadState('networkidle');
      const probes = requests.filter((request) => request.startsWith('HEAD ') && request.endsWith('net::ERR_ABORTED'));
      const failures = requests.filter((request) => !probes.includes(request));
      assert.equal(errors.length, 0, `搜索控制台报错：${errors.join('；')}`);
      assert.equal(failures.length, 0, `搜索请求失败：${failures.join('；')}`);
      results.push({ 页面: '搜索多模态并打开筛选结果', 宽度: width, 地址: page.url(), 结果: '通过', 错误: errors.slice(), 请求失败: failures, 取消的探测: probes });
      await context.close();
    }
  } finally {
    await browser.close();
    fs.writeFileSync(path.join(evidence, 'browser-results.json'), JSON.stringify(results, null, 2) + '\n');
  }
  console.log('宽屏与手机逐页验证通过，共 ' + results.length + ' 项，结果与截图位于 .next-qa/。');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
