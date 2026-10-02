import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { deploy, manifestKey, requiredSecrets } from './oss.mjs';
import { createPlan, decodeManifest, deterministicGzip, encodeManifest, immutableCache, prepareSite, shortCache, siteOwner } from './prepare.mjs';

// 测试全部使用占位值与本地命令替身，不读取真实凭据，不运行 ossutil。
const env = Object.fromEntries(requiredSecrets.map((name) => [name, name]));
env.OSS_BUCKET = 'models-test-bucket'; env.OSS_ENDPOINT = 'oss-cn-shanghai.aliyuncs.com';
function fixture(t) {
  const root = fs.mkdtempSync(path.resolve('.next-oss-test-'));
  const outDir = path.join(root, 'out');
  const files = {
    'index.html': '<html>首页</html>'.repeat(30), '404.html': '<html>未找到</html>',
    'sitemap.xml': '<urlset>地图</urlset>', 'index.txt': 'RSC 数据'.repeat(30),
    'data/models.json': '{"模型":"测试"}', '_next/static/new.js': 'console.log("测试")',
    '_next/static/new.css': 'body{color:red}', '_next/static/media/font.abcdef0123.woff2': Buffer.from([0, 255, 3, 8]),
    'sprites/model.png': Buffer.from([137, 80, 78, 71, 0, 255]),
  };
  for (const [key, bytes] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(outDir, key)), { recursive: true }); fs.writeFileSync(path.join(outDir, key), bytes);
  }
  t.after(() => {
    assert.equal(path.dirname(root), process.cwd()); assert.ok(path.basename(root).startsWith('.next-oss-test-'));
    fs.rmSync(root, { recursive: true, force: true });
  });
  return { root, outDir, files };
}
function walk(dir, prefix = '') {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory()
    ? walk(path.join(dir, entry.name), prefix + entry.name + '/') : [prefix + entry.name]);
}
function oldManifest(files, extras = {}) { return { version: 1, owner: siteOwner, bucket: env.OSS_BUCKET, files, ...extras }; }
// 清单作为普通 gzip 文件写入：不带 Content-Encoding，否则 ossutil 下载时会自动解压并 CRC 校验失败
function assertManifestWrite(args) {
  assert.equal(args[2], `oss://${env.OSS_BUCKET}/${manifestKey}`);
  assert.equal(args.includes('--content-encoding'), false);
  assert.equal(args[args.indexOf('--content-type') + 1], 'application/gzip');
}
function isManifestDownload(args) { return args[0] === 'cp' && args[1].startsWith('oss://'); }
function missingManifest(stream = 'stderr') { throw Object.assign(new Error('对象不存在'), { [stream]: 'Error: NoSuchKey' }); }
function harness(outDir, previous = null, failGroup = 0) {
  const calls = [], uploads = []; let manifest; let groupNumber = 0;
  const result = () => deploy({ env, outDir, log: () => {}, run: (args) => {
    calls.push(args);
    if (isManifestDownload(args)) {
      if (!previous) missingManifest();
      fs.writeFileSync(args[2], Buffer.isBuffer(previous) ? previous : JSON.stringify(previous));
    } else if (args[0] === 'cp' && args.includes('--recursive')) {
      groupNumber += 1;
      if (groupNumber === failGroup) throw new Error('模拟上传失败');
      const keys = walk(args[1]);
      uploads.push({ args, keys, bytes: Object.fromEntries(keys.map((key) => [key, fs.readFileSync(path.join(args[1], key))])) });
    } else if (args[0] === 'cp') manifest = decodeManifest(fs.readFileSync(args[1]));
  } });
  return { result, calls, uploads, manifest: () => manifest };
}
function fullManifest(outDir, root) {
  return createPlan(prepareSite(outDir, path.join(root, 'prepared')), null, env.OSS_BUCKET).manifest;
}

test('gzip level 9 确定性：无文件名、mtime 为零，同样字节两次输出一致', () => {
  const source = Buffer.from('模型世界，确定性压缩。'.repeat(100));
  const first = deterministicGzip(source), second = deterministicGzip(source);
  assert.deepEqual(first, second); assert.deepEqual(gunzipSync(first), source);
  assert.equal(first[3], 0); assert.equal(first.readUInt32LE(4), 0); assert.equal(first[8], 2); assert.equal(first[9], 255);
  assert.ok(first.length < source.length);
});

test('全部指定文本扩展名压缩，二进制原样，上传 sha256 来自压缩后的实际字节', (t) => {
  const { root, outDir } = fixture(t);
  for (const extension of ['txt', 'json', 'js', 'css', 'xml', 'svg', 'webmanifest', 'map']) {
    fs.writeFileSync(path.join(outDir, `example.${extension}`), '文本数据'.repeat(100));
  }
  const entries = prepareSite(outDir, path.join(root, 'prepared'));
  for (const entry of entries) {
    const bytes = fs.readFileSync(path.join(root, 'prepared', entry.key));
    const source = fs.readFileSync(path.join(outDir, entry.key));
    assert.equal(entry.sha256, createHash('sha256').update(bytes).digest('hex'));
    if (/\.(png|woff2)$/.test(entry.key)) { assert.equal(entry.contentEncoding, ''); assert.deepEqual(bytes, source); }
    else { assert.equal(entry.contentEncoding, 'gzip'); assert.deepEqual(gunzipSync(bytes), source); }
  }
  const types = Object.fromEntries(entries.map((entry) => [entry.key, entry.contentType]));
  assert.equal(types['index.html'], 'text/html; charset=utf-8'); assert.equal(types['index.txt'], 'text/plain; charset=utf-8');
  assert.equal(types['data/models.json'], 'application/json; charset=utf-8'); assert.equal(types['example.svg'], 'image/svg+xml; charset=utf-8');
  assert.equal(types['sprites/model.png'], 'image/png'); assert.equal(types['_next/static/media/font.abcdef0123.woff2'], 'font/woff2');
});

test('文件 mtime 改动不影响确定性 gzip 或增量指纹', (t) => {
  const { root, outDir } = fixture(t);
  const first = prepareSite(outDir, path.join(root, 'prepared-first'));
  fs.utimesSync(path.join(outDir, 'index.html'), new Date(0), new Date());
  const second = prepareSite(outDir, path.join(root, 'prepared-second'));
  assert.deepEqual(first, second);
});

test('四个 Secrets 任一缺失都成功跳过，不读 out、不调用 OSS', () => {
  for (const key of requiredSecrets) {
    assert.equal(deploy({ env: { ...env, [key]: '' }, outDir: '不存在的产物', run: () => assert.fail('不能调用 OSS'), log: () => {} }).skipped, true);
  }
});

test('分组 cp 保持对象键和正确响应头，先哈希资源、再数据、最后 HTML', (t) => {
  const { outDir, files } = fixture(t), h = harness(outDir);
  assert.equal(h.result().uploaded, Object.keys(files).length);
  const phases = [];
  for (const upload of h.uploads) {
    const type = upload.args[upload.args.indexOf('--content-type') + 1];
    const cache = upload.args[upload.args.indexOf('--cache-control') + 1];
    const encoding = upload.args.includes('--content-encoding') ? upload.args[upload.args.indexOf('--content-encoding') + 1] : '';
    assert.equal(upload.args[2], `oss://${env.OSS_BUCKET}/`);
    for (const key of upload.keys) {
      const binary = /\.(png|woff2)$/.test(key);
      assert.equal(encoding, binary ? '' : 'gzip');
      assert.deepEqual(binary ? upload.bytes[key] : gunzipSync(upload.bytes[key]), Buffer.from(files[key]));
      const phase = key.endsWith('.html') ? 2 : key.startsWith('_next/static/') ? 0 : 1;
      phases.push(phase); assert.equal(cache, phase === 0 ? immutableCache : shortCache);
      if (key.endsWith('.html')) assert.equal(type, 'text/html; charset=utf-8');
      if (key.endsWith('.txt')) assert.equal(type, 'text/plain; charset=utf-8');
      if (key.endsWith('.json')) assert.equal(type, 'application/json; charset=utf-8');
    }
  }
  assert.deepEqual(phases, [...phases].sort());
  const htmlGroup = h.uploads.filter((upload) => upload.keys.some((key) => key.endsWith('.html')));
  assert.equal(htmlGroup.length, 1); assert.equal(htmlGroup[0].keys.length, 2, '同一头组合一次上传多个文件');
  assert.equal(h.calls.at(-1)[2], `oss://${env.OSS_BUCKET}/${manifestKey}`);
  assert.equal(h.manifest().version, 2);
  assertManifestWrite(h.calls.at(-1));
});

test('v2 无变化上传零个文件，连控制清单也不重复上传', (t) => {
  const { root, outDir } = fixture(t), previous = fullManifest(outDir, root), h = harness(outDir, previous);
  assert.deepEqual(h.result(), { skipped: false, uploaded: 0, uploadedBytes: 0, deleted: 0 });
  assert.deepEqual(h.calls.map((args) => args[0]), ['cp']);
  assert.ok(isManifestDownload(h.calls[0]));
});

test('内容变化仅上传该对象；响应头单独变化也会重新上传', (t) => {
  const { root, outDir } = fixture(t), previous = fullManifest(outDir, root);
  fs.writeFileSync(path.join(outDir, 'index.html'), '<html>新首页</html>');
  const h = harness(outDir, previous); assert.equal(h.result().uploaded, 1); assert.deepEqual(h.uploads[0].keys, ['index.html']);
  const entries = prepareSite(outDir, path.join(root, 'prepared-changed'));
  const current = createPlan(entries, null, env.OSS_BUCKET).manifest;
  for (const [field, value] of [['contentEncoding', ''], ['contentType', 'application/octet-stream'], ['cacheControl', 'no-cache']]) {
    const altered = structuredClone(current); altered.files['index.html'][field] = value;
    assert.equal(createPlan(entries, altered, env.OSS_BUCKET).report.待上传文件数, 1);
  }
});

test('v1 清单兼容：不猜指纹，当前对象全部上传，只清理记录过的非哈希旧对象', (t) => {
  const { outDir, files } = fixture(t);
  const previous = oldManifest([...Object.keys(files), 'old/index.html', '_next/static/old.js', 'assets/old.1234abcd.png']);
  const h = harness(outDir, previous); assert.equal(h.result().uploaded, Object.keys(files).length);
  assert.deepEqual(h.calls.filter((args) => args[0] === 'rm'), [['rm', `oss://${env.OSS_BUCKET}/old/index.html`, '--force']]);
  const deletion = h.calls.findIndex((args) => args[0] === 'rm');
  assert.ok(h.calls.slice(deletion).every((args) => !args.includes('--recursive')));
  assert.equal(h.manifest().version, 2);
  assertManifestWrite(h.calls.at(-1));
});

test('v2 仍保留已知历史哈希指纹；不清理清单外对象', (t) => {
  const { root, outDir } = fixture(t), previous = fullManifest(outDir, root);
  previous.files['_next/static/old.js'] = structuredClone(previous.files['_next/static/new.js']);
  previous.files['old/index.html'] = structuredClone(previous.files['index.html']);
  const h = harness(outDir, previous); assert.equal(h.result().uploaded, 0);
  assert.equal(h.manifest().files['_next/static/old.js'].sha256, previous.files['_next/static/old.js'].sha256);
  assert.deepEqual(h.calls.filter((args) => args[0] === 'rm'), [['rm', `oss://${env.OSS_BUCKET}/old/index.html`, '--force']]);
});

test('任一上传阶段失败不删除旧对象、不写远端清单，暂存目录安全清理', (t) => {
  const { root, outDir } = fixture(t);
  for (const failGroup of [1, 4, 8]) {
    const h = harness(outDir, oldManifest(['old/index.html']), failGroup);
    assert.throws(h.result, /模拟上传失败/);
    assert.equal(h.calls.some((args) => args[0] === 'rm'), false); assert.equal(h.manifest(), undefined);
    assert.equal(fs.readdirSync(root).some((name) => name.startsWith('.next-oss-stage-')), false);
  }
});

test('拒绝越界 Bucket、外站清单、危险路径、坏指纹、坏 JSON 与访问拒绝', (t) => {
  const { outDir } = fixture(t), run = () => assert.fail('不能调用 OSS');
  assert.throws(() => deploy({ env: { ...env, OSS_BUCKET: 'models/other' }, outDir, run }), /Bucket/);
  const meta = { sha256: '0'.repeat(64), contentEncoding: 'gzip', contentType: 'text/html', cacheControl: shortCache };
  for (const previous of [oldManifest(['../other']), oldManifest(['/other']), oldManifest(['safe'], { owner: '其他站点' }),
    oldManifest([], { bucket: 'other-bucket' }), oldManifest([], { version: 3 }),
    oldManifest({ 'index.html': { ...meta, sha256: '坏指纹' } }, { version: 2 }),
    oldManifest({ 'index.html': { ...meta, contentType: 'text/html\r\n注入' } }, { version: 2 })]) {
    const h = harness(outDir, previous); assert.throws(h.result); assert.equal(h.calls.length, 1);
  }
  assert.throws(() => deploy({ env, outDir, run: (args) => { if (isManifestDownload(args)) fs.writeFileSync(args[2], '{'); } }));
  assert.throws(() => deploy({ env, outDir, run: () => { throw Object.assign(new Error('拒绝访问'), { stderr: 'AccessDenied' }); } }), /拒绝访问/);
});

test('NoSuchKey 在 stdout 时仍按首次部署处理', (t) => {
  const { outDir } = fixture(t);
  const result = deploy({ env, outDir, log: () => {}, run: (args) => { if (isManifestDownload(args)) missingManifest('stdout'); } });
  assert.equal(result.deleted, 0);
});

test('--plan CLI 不需要任何环境或凭据，可读本地旧清单并生成零上传计划', (t) => {
  const { root, outDir } = fixture(t), manifest = path.join(root, 'first.json'), report = path.join(root, 'report.json');
  const args = ['scripts/deploy/oss.mjs', '--plan', '--out-dir', outDir, '--manifest-out', manifest, '--report-out', report];
  execFileSync(process.execPath, args, { env: {}, encoding: 'utf8' });
  assert.equal(JSON.parse(fs.readFileSync(report)).待上传文件数, 9);
  execFileSync(process.execPath, [...args, '--previous-manifest', manifest], { env: {}, encoding: 'utf8' });
  const result = JSON.parse(fs.readFileSync(report)); assert.equal(result.待上传文件数, 0); assert.equal(result.预计总上传字节数, 0);
});

test('HTML、RSC、数据 JSON 和 sitemap 即使名字像哈希也保持短缓存', (t) => {
  const { root, outDir } = fixture(t);
  for (const key of ['data/info.1234abcd.json', 'page.1234abcd.html', 'page.1234abcd.txt', 'map.1234abcd.xml', 'sprites/model-20260420.png']) {
    fs.mkdirSync(path.dirname(path.join(outDir, key)), { recursive: true }); fs.writeFileSync(path.join(outDir, key), '内容');
  }
  const entries = prepareSite(outDir, path.join(root, 'prepared'));
  for (const entry of entries.filter((entry) => entry.key.includes('1234abcd') || entry.key.includes('20260420'))) {
    assert.equal(entry.cacheControl, shortCache); assert.equal(entry.phase, entry.key.endsWith('.html') ? 2 : 1);
  }
});

test('读取 gzip v2 远端清单时保持原始二进制字节，兼容旧明文清单', (t) => {
  const { root, outDir } = fixture(t), previous = fullManifest(outDir, root);
  const compressed = encodeManifest(previous);
  assert.deepEqual(decodeManifest(compressed), previous);
  assert.deepEqual(decodeManifest(JSON.stringify(previous)), previous);
  assert.deepEqual(decodeManifest('\uFEFF' + JSON.stringify(previous)), previous);
  const h = harness(outDir, compressed); assert.equal(h.result().uploaded, 0); assert.equal(h.calls.length, 1);
  assert.throws(() => decodeManifest(Buffer.from([0x1f, 0x8b, 0])));
});

test('旧格式清单（带 Content-Encoding）CRC 校验失败时经公开地址读取，并以新格式重写', (t) => {
  const { root, outDir } = fixture(t), previous = fullManifest(outDir, root);
  const calls = [], urls = [], logs = []; let written;
  const result = deploy({ env, outDir, log: (line) => logs.push(line),
    fetchPublic: (url) => { urls.push(url); return encodeManifest(previous); },
    run: (args) => {
      calls.push(args);
      if (isManifestDownload(args)) throw Object.assign(new Error('Command failed'), { stderr: Buffer.from('Error: crc is inconsistent, client 1, server 2') });
      if (args[0] === 'cp') written = decodeManifest(fs.readFileSync(args[1]));
    } });
  assert.equal(result.uploaded, 0);
  assert.deepEqual(urls, [`https://${env.OSS_BUCKET}.oss-cn-shanghai.aliyuncs.com/${manifestKey}`]);
  assertManifestWrite(calls.at(-1));
  assert.deepEqual(written, previous);
  assert.ok(logs.some((line) => line.includes('旧格式')));
});

test('清单下载的其他错误照常抛出，不走公开地址', (t) => {
  const { outDir } = fixture(t);
  assert.throws(() => deploy({ env, outDir, log: () => {}, fetchPublic: () => assert.fail('不应读取公开地址'),
    run: (args) => { if (isManifestDownload(args)) throw Object.assign(new Error('拒绝访问'), { stderr: 'AccessDenied' }); } }), /拒绝访问/);
});
