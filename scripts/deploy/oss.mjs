/**
 * 只在审核后由部署工作流调用。无全 Bucket 删除、无真实密钥、无外部依赖。
 * 先上传哈希资源，再上传其他文件；仅清理上次本站清单记录的非哈希旧文件。
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const requiredSecrets = ['OSS_ACCESS_KEY_ID', 'OSS_ACCESS_KEY_SECRET', 'OSS_BUCKET', 'OSS_ENDPOINT'];
export const manifestKey = '_onenova/models-deploy-manifest.json';
const owner = 'https://models.onenovalab.com';
const shortCache = 'no-cache, max-age=0, must-revalidate';
const immutableCache = 'public, max-age=31536000, immutable';

function safeKey(key) {
  return typeof key === 'string' && key.length > 0 && key !== manifestKey &&
    !/[\\\s?#%]/u.test(key) && !key.startsWith('/') &&
    key.split('/').every((part) => part && part !== '.' && part !== '..');
}

function filesUnder(directory, prefix = '') {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const key = prefix + entry.name;
    if (entry.isSymbolicLink()) throw new Error('构建产物不能包含符号链接');
    return entry.isDirectory() ? filesUnder(path.join(directory, entry.name), key + '/') : [key];
  });
}

/** run 可替换为本地测试替身，测试不会连接 OSS。 */
export function deploy({ env = process.env, outDir = path.resolve('out'), run, log = console.log } = {}) {
  const missing = requiredSecrets.filter((name) => !env[name]);
  if (missing.length) {
    log(`尚未配置 Secrets：${missing.join('、')}，成功跳过部署。`);
    return { skipped: true };
  }
  if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(env.OSS_BUCKET)) {
    throw new Error('OSS_BUCKET 只能是本站专用 Bucket 名，不能包含协议、目录或通配符');
  }
  const endpoint = /^(?:https:\/\/)?oss-([a-z0-9-]+)\.aliyuncs\.com$/.exec(env.OSS_ENDPOINT);
  if (!endpoint) throw new Error('OSS_ENDPOINT 必须为阿里云 OSS 公网地域地址，例如 oss-cn-shanghai.aliyuncs.com');
  const commandEnv = { ...env, OSS_ENDPOINT: `https://oss-${endpoint[1]}.aliyuncs.com`, OSS_REGION: endpoint[1] };
  const invoke = run ?? ((args, capture = false) => execFileSync('ossutil', args, {
    env: commandEnv, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  }));
  const target = `oss://${env.OSS_BUCKET}/`;
  const files = filesUnder(outDir).sort();
  if (!files.includes('index.html') || !files.includes('404.html') || !files.includes('sitemap.xml') ||
      !files.some((key) => key.startsWith('_next/static/')) || !files.every(safeKey)) {
    throw new Error('out/ 不完整或包含不安全路径，拒绝部署');
  }
  let previous = [];
  try {
    const manifest = JSON.parse(invoke(['cat', target + manifestKey], true));
    if (manifest.owner !== owner || manifest.version !== 1 || manifest.bucket !== env.OSS_BUCKET ||
        !Array.isArray(manifest.files) || !manifest.files.every(safeKey)) {
      throw new Error('远端部署清单归属或路径不合法，拒绝部署');
    }
    previous = manifest.files;
  } catch (error) {
    // 只有明确的对象不存在才视为首次部署；403、网络失败或坏 JSON 均失败关闭。
    if (!/\bNoSuchKey\b/.test(String(error.stderr ?? '') + String(error.stdout ?? ''))) throw error;
    log('首次部署：没有本站历史清单，不删除 Bucket 内任何已有文件。');
  }

  invoke(['cp', path.join(outDir, '_next', 'static') + path.sep, target + '_next/static/',
    '--recursive', '--force', '--cache-control', immutableCache]);
  invoke(['cp', outDir + path.sep, target, '--recursive', '--force', '--exclude', '_next/static/*',
    '--cache-control', shortCache]);

  // 所有上传成功之后才删除；目标始终由同一个已校验的 Bucket 和安全对象键拼成。
  // 历史哈希资源仍供旧页面使用，防止更新时正在访问的页面发生 chunk 404。
  const current = new Set(files);
  const stale = previous.filter((key) => !current.has(key) && !key.startsWith('_next/static/'));
  for (const key of stale) invoke(['rm', target + key, '--force']);
  const retained = previous.filter((key) => key.startsWith('_next/static/'));
  const nextManifest = { version: 1, owner, bucket: env.OSS_BUCKET, files: [...new Set([...files, ...retained])].sort() };
  const localManifest = path.join(path.dirname(outDir), '.next-oss-manifest.json');
  fs.writeFileSync(localManifest, JSON.stringify(nextManifest, null, 2) + '\n');
  try {
    invoke(['cp', localManifest, target + manifestKey, '--force', '--cache-control', shortCache]);
  } finally {
    fs.unlinkSync(localManifest);
  }
  log(`部署完成：上传 ${files.length} 个文件，清理 ${stale.length} 个本站旧文件。`);
  return { skipped: false, uploaded: files.length, deleted: stale.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { deploy(); } catch (error) {
    // 不把命令环境或凭据写入日志。
    console.error('OSS 部署失败：', error.message);
    process.exitCode = 1;
  }
}
