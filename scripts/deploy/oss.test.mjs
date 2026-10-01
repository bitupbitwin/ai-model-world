import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { deploy, manifestKey, requiredSecrets } from './oss.mjs';

// 全部为测试占位值；不使用本机环境中的凭据，不执行 ossutil。
const env = Object.fromEntries(requiredSecrets.map((name) => [name, name]));
env.OSS_BUCKET = 'models-test-bucket';
env.OSS_ENDPOINT = 'oss-cn-shanghai.aliyuncs.com';
function fixture(t) {
  const root = fs.mkdtempSync(path.resolve('.next-oss-test-'));
  const outDir = path.join(root, 'out');
  fs.mkdirSync(path.join(outDir, '_next/static'), { recursive: true });
  for (const key of ['index.html', '404.html', 'sitemap.xml', '_next/static/new.js']) {
    fs.writeFileSync(path.join(outDir, key), '测试');
  }
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return outDir;
}
const missingManifest = () => { const error = new Error('对象不存在'); error.stderr = 'Error: NoSuchKey'; throw error; };
const previous = (files, extras = {}) => JSON.stringify({ version: 1, owner: 'https://models.onenovalab.com', bucket: env.OSS_BUCKET, files, ...extras });

test('四个 Secrets 任一缺失都成功跳过且不调用 OSS', () => {
  for (const key of requiredSecrets) {
    const config = { ...env, [key]: '' };
    assert.equal(deploy({ env: config, run: () => assert.fail('不应调用 OSS'), log: () => {} }).skipped, true);
  }
});
test('首次部署只上传，不删除任何已有对象', (t) => {
  const calls = [];
  deploy({ env, outDir: fixture(t), log: () => {}, run: (args) => { calls.push(args); if (args[0] === 'cat') missingManifest(); } });
  assert.equal(calls.filter((args) => args[0] === 'rm').length, 0);
  assert.equal(calls[1][calls[1].length - 1], 'public, max-age=31536000, immutable');
  assert.equal(calls[2][calls[2].length - 1], 'no-cache, max-age=0, must-revalidate');
  assert.equal(calls.at(-1)[2], `oss://${env.OSS_BUCKET}/${manifestKey}`);
});
test('先上传再清理，只删除本站清单中的旧文件，保留旧哈希资源', (t) => {
  const calls = [];
  deploy({ env, outDir: fixture(t), log: () => {}, run: (args) => { calls.push(args); if (args[0] === 'cat') return previous(['old/index.html', '_next/static/old.js']); } });
  assert.deepEqual(calls.map((args) => args[0]), ['cat', 'cp', 'cp', 'rm', 'cp']);
  assert.deepEqual(calls[3], ['rm', `oss://${env.OSS_BUCKET}/old/index.html`, '--force']);
});
test('任一上传失败都不删除旧文件，也不更新清单', (t) => {
  for (const failAt of [1, 2]) {
    const calls = [];
    assert.throws(() => deploy({ env, outDir: fixture(t), log: () => {}, run: (args) => {
      calls.push(args); if (args[0] === 'cat') return previous(['old/index.html']);
      if (calls.length === failAt + 1) throw new Error('模拟上传失败');
    } }), /模拟上传失败/);
    assert.equal(calls.some((args) => args[0] === 'rm'), false);
    assert.equal(calls.some((args) => args[2]?.endsWith(manifestKey)), false);
  }
});
test('拒绝越界 Bucket、外站清单、危险路径、坏 JSON 和访问拒绝', (t) => {
  const outDir = fixture(t);
  const run = () => assert.fail('不应访问 OSS');
  assert.throws(() => deploy({ env: { ...env, OSS_BUCKET: 'models/other' }, outDir, run }), /Bucket/);
  for (const raw of [previous(['../other/index.html']), previous(['/other']), previous(['safe'], { owner: '其他站点' }), '{']) {
    const calls = [];
    assert.throws(() => deploy({ env, outDir, run: (args) => { calls.push(args); return raw; } }));
    assert.equal(calls.length, 1);
  }
  assert.throws(() => deploy({ env, outDir, run: () => { const error = new Error('拒绝访问'); error.stderr = 'AccessDenied'; throw error; } }), /拒绝访问/);
});

test('官方工具将 NoSuchKey 写到 stdout 时同样按首次部署处理', (t) => {
  const calls = [];
  deploy({ env, outDir: fixture(t), log: () => {}, run: (args) => {
    calls.push(args);
    if (args[0] === 'cat') { const error = new Error('对象不存在'); error.stdout = 'Error: NoSuchKey'; throw error; }
  } });
  assert.equal(calls.some((args) => args[0] === 'rm'), false);
});
