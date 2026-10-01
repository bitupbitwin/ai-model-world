/** 静态产物验收：检查所有路由、逐页品牌/SEO、旧快照视频排序与资源统计。 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { publicRoutes, siteConfig, siteUrl } from '../../src/config/site';
import { loadSnapshot } from '../../src/lib/snapshot';
import { pickVideos, videosFor, type VideoLibrary } from '../../src/lib/videos';

const root = path.resolve('out');
const snapshot = loadSnapshot();
const routes = [...publicRoutes, ...snapshot.vendors.map((v) => `/vendor/${v.id}/`),
  ...snapshot.models.map((m) => `/model/${m.slug}/`)];
const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
const expectedLinks = [siteConfig.links.home, siteConfig.links.modelHub, siteConfig.links.upstream,
  siteConfig.links.credits, ...siteConfig.registrations];
for (const route of routes) {
  const file = path.join(root, route, 'index.html');
  assert.ok(fs.existsSync(file), `缺少路由首页：${route}`);
  const html = fs.readFileSync(file, 'utf8');
  const head = html.slice(0, html.indexOf('</head>'));
  assert.ok(head.includes(`rel="canonical" href="${siteUrl(route)}"`), `canonical 地址错误：${route}`);
  assert.ok(head.includes(`property="og:url" content="${siteUrl(route)}"`), `Open Graph 地址错误：${route}`);
  assert.ok(head.includes(siteConfig.name), `站名缺失：${route}`);
  assert.ok(sitemap.includes(`<loc>${siteUrl(route)}</loc>`), `站点地图遗漏：${route}`);
  const footer = html.slice(html.indexOf('<footer'), html.indexOf('</footer>'));
  for (const link of expectedLinks) {
    assert.ok(footer.includes(link.name), `页脚名称缺失：${route} ${link.name}`);
    assert.ok(footer.includes(link.href.replaceAll('&', '&amp;')), `页脚链接缺失：${route} ${link.href}`);
  }
  assert.ok(footer.includes('Epoch AI') && footer.includes('CC-BY 4.0'), `数据署名缺失：${route}`);
  assert.ok(!/codefather\.cn|space\.bilibili\.com\/12890453|站长的视频置顶/.test(html), `个人推广残留：${route}`);
}
assert.ok(fs.readFileSync(path.join(root, '404.html'), 'utf8').includes('404 · 页面不存在'));
assert.ok(fs.readFileSync(path.join(root, 'robots.txt'), 'utf8').includes(siteUrl('/sitemap.xml')));
assert.ok(fs.existsSync(path.join(root, 'qa/crests/index.html')));
assert.ok(fs.readFileSync(path.join(root, 'qa/crests/index.html'), 'utf8').includes('noindex'));
for (const file of ['LICENSE', 'NOTICE.md', 'assets/lpc/CREDITS.md', 'assets/fonts/OFL.txt']) {
  assert.ok(fs.existsSync(file), `许可文件缺失：${file}`);
}

// 模拟旧快照的作者置顶顺序，确认页面和下一次刷新均按播放量排序。
const video = { title: 'DeepSeek V4 实测', cover: '', date: '2026-10-01', duration: '01:00', author: '评测者' };
const candidates = [
  { ...video, bvid: 'BV-low', mid: 12890453, view: 1 },
  { ...video, bvid: 'BV-high', mid: 2, view: 100 },
];
assert.equal(pickVideos('DeepSeek V4', candidates)[0].bvid, 'BV-high');
assert.deepEqual(pickVideos('DeepSeek V4', [...candidates].reverse()), pickVideos('DeepSeek V4', candidates));
const library: VideoLibrary = { fetchedAt: '', keyword: '测评', authorMid: 12890453,
  byModel: { test: { fetchedAt: '', videos: candidates } } };
assert.equal(videosFor(library, 'test', 'DeepSeek V4').videos[0].bvid, 'BV-high');
assert.equal(library.byModel.test.videos[0].bvid, 'BV-low', '排序不应修改原快照');

function walk(dir: string): { file: string; bytes: number }[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [{ file: path.relative(root, full).replaceAll('\\', '/'), bytes: fs.statSync(full).size }];
  });
}
const files = walk(root);
assert.ok(files.every(({ file }) => !file.split('/').some((part, index, parts) => part.startsWith('__next.') && index < parts.length - 1)), '存在未修正的 Windows 预取文件名');
const result = { routes: routes.length, models: snapshot.models.length, vendors: snapshot.vendors.length,
  files: files.length, bytes: files.reduce((sum, file) => sum + file.bytes, 0),
  largest: files.sort((a, b) => b.bytes - a.bytes).slice(0, 10) };
console.log('所有页面的目录首页、SEO、备案、署名与视频无置顶检查通过。');
console.log(JSON.stringify(result, null, 2));
