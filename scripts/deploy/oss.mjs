/** 审核后才由工作流调用；按上传字节和响应头增量部署，先资源、后数据、最后 HTML。 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPlan, decodeManifest, encodeManifest, manifestKey, prepareSite, serializeManifest, shortCache, validateManifest } from './prepare.mjs';
export { manifestKey } from './prepare.mjs';
export const requiredSecrets = ['OSS_ACCESS_KEY_ID', 'OSS_ACCESS_KEY_SECRET', 'OSS_BUCKET', 'OSS_ENDPOINT'];

function removeStage(stage, parent) {
  const absolute = path.resolve(stage);
  if (path.dirname(absolute) !== path.resolve(parent) || !path.basename(absolute).startsWith('.next-oss-stage-')) {
    throw new Error('暂存目录范围校验失败，拒绝清理');
  }
  fs.rmSync(absolute, { recursive: true, force: true });
}

/** run 可注入离线替身；缺少 Secrets 时不读取产物，也不调用 OSS。 */
export function deploy({ env = process.env, outDir = path.resolve('out'), run, fetchPublic, log = console.log } = {}) {
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
    env: commandEnv, encoding: capture ? null : 'utf8', maxBuffer: 16 * 1024 * 1024,
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  }));
  const target = `oss://${env.OSS_BUCKET}/`;
  // 旧清单带 Content-Encoding: gzip，ossutil 下载时会自动解压，再按压缩字节校验 CRC 而失败。
  // 遇到这种旧清单时，经 Bucket 公开地址原样读取一次，随后以不带 Content-Encoding 的新格式重写。
  const readPublic = fetchPublic ?? ((url) => execFileSync('curl', ['-fsS', '--max-time', '60', url], { maxBuffer: 16 * 1024 * 1024 }));
  const publicUrl = `https://${env.OSS_BUCKET}.oss-${endpoint[1]}.aliyuncs.com/${manifestKey}`;
  let previous = null;
  let legacyManifest = false;
  // 用 cp 下载到文件再读，不用 cat：cat 的 stdout 会混入对象内容以外的统计信息。
  const download = fs.mkdtempSync(path.join(os.tmpdir(), 'onenova-manifest-'));
  try {
    const local = path.join(download, 'manifest');
    let bytes;
    try {
      invoke(['cp', target + manifestKey, local, '--force'], true);
      bytes = fs.readFileSync(local);
    } catch (error) {
      if (!/crc is inconsistent/i.test(String(error.stderr ?? '') + String(error.stdout ?? '') + String(error.message))) throw error;
      log('远端清单是旧格式（带 Content-Encoding），改经公开地址原样读取，本次部署后改写为新格式。');
      bytes = readPublic(publicUrl);
      legacyManifest = true;
    }
    previous = validateManifest(decodeManifest(bytes), env.OSS_BUCKET);
  } catch (error) {
    if (!/\bNoSuchKey\b/.test(String(error.stderr ?? '') + String(error.stdout ?? ''))) throw error;
    log('首次部署：没有本站历史清单，不删除 Bucket 内任何已有文件。');
  } finally {
    fs.rmSync(download, { recursive: true, force: true });
  }
  outDir = path.resolve(outDir);
  const parent = path.dirname(outDir);
  const stage = fs.mkdtempSync(path.join(parent, '.next-oss-stage-'));
  try {
    const preparedDir = path.join(stage, 'objects');
    const entries = prepareSite(outDir, preparedDir);
    const plan = createPlan(entries, previous, env.OSS_BUCKET);
    for (const [index, group] of plan.groups.entries()) {
      if (!group.entries.length) continue;
      const groupDir = path.join(stage, 'groups', String(index));
      for (const entry of group.entries) {
        const destination = path.join(groupDir, entry.key);
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.copyFileSync(path.join(preparedDir, entry.key), destination);
      }
      const args = ['cp', groupDir + path.sep, target, '--recursive', '--force',
        '--content-type', group.contentType, '--cache-control', group.cacheControl];
      if (group.contentEncoding) args.push('--content-encoding', group.contentEncoding);
      invoke(args);
    }
    // 全部组上传成功后，仅删历史本站清单中的非哈希旧对象。
    for (const key of plan.stale) invoke(['rm', target + key, '--force']);
    if (plan.manifestChanged || legacyManifest) {
      const localManifest = path.join(stage, 'manifest.json');
      fs.writeFileSync(localManifest, encodeManifest(plan.manifest));
      // 清单只给部署脚本读，作为普通 gzip 文件存放；不加 Content-Encoding，ossutil 才会原样下载。
      invoke(['cp', localManifest, target + manifestKey, '--force', '--content-type',
        'application/gzip', '--cache-control', shortCache]);
    }
    log(`部署完成：增量上传 ${plan.report.待上传文件数} 个文件 / ${plan.report.待上传文件字节数} 字节，清理 ${plan.stale.length} 个本站旧文件。`);
    return { skipped: false, uploaded: plan.report.待上传文件数, uploadedBytes: plan.report.待上传文件字节数, deleted: plan.stale.length };
  } finally {
    removeStage(stage, parent);
  }
}

function localPath(file) {
  const absolute = path.resolve(file);
  const relative = path.relative(process.cwd(), absolute);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('计划文件必须在当前仓库目录内');
  return absolute;
}
function writeLocal(file, bytes) {
  file = localPath(file);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, bytes);
}

/** --plan 完全独立于凭据；只读取本地产物、可选旧清单，并生成本地清单。 */
export function planLocal(options, log = console.log) {
  const outDir = localPath(options.outDir || 'out');
  const previous = options.previousManifest
    ? validateManifest(decodeManifest(fs.readFileSync(localPath(options.previousManifest)))) : null;
  const parent = path.dirname(outDir);
  const stage = fs.mkdtempSync(path.join(parent, '.next-oss-stage-'));
  const preparedDir = options.preparedDir ? localPath(options.preparedDir) : stage + '-objects';
  try {
    const entries = prepareSite(outDir, preparedDir);
    const plan = createPlan(entries, previous, previous?.bucket || 'OSS_BUCKET');
    const manifestOut = options.manifestOut || '.next-qa/oss-plan-manifest.json';
    writeLocal(manifestOut, serializeManifest(plan.manifest));
    if (options.reportOut) writeLocal(options.reportOut, JSON.stringify(plan.report, null, 2) + '\n');
    log('本地部署计划：不读取凭据，不执行 ossutil，不连接 OSS。');
    log(JSON.stringify(plan.report, null, 2));
    log(`新清单：${manifestOut}${options.preparedDir ? `；预压缩文件：${options.preparedDir}` : ''}`);
    return plan;
  } finally {
    if (!options.preparedDir && fs.existsSync(preparedDir)) removeStage(preparedDir, parent);
    removeStage(stage, parent);
  }
}

function parseOptions(args) {
  const options = {};
  const names = { '--out-dir': 'outDir', '--previous-manifest': 'previousManifest',
    '--manifest-out': 'manifestOut', '--report-out': 'reportOut', '--prepared-dir': 'preparedDir' };
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--plan') { options.plan = true; continue; }
    const name = names[args[index]];
    if (!name || !args[index + 1] || args[index + 1].startsWith('--')) throw new Error('计划参数无效或缺少路径');
    options[name] = args[++index];
  }
  if (!options.plan && Object.keys(options).length) throw new Error('本地路径参数只能与 --plan 一起使用');
  return options;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = parseOptions(process.argv.slice(2));
    if (options.plan) planLocal(options); else deploy();
  } catch (error) {
    console.error('OSS 部署或本地计划失败：', error.message);
    process.exitCode = 1;
  }
}
