/** 纯本地生成确定性的上传字节、对象元信息与增量计划，不读取凭据或访问 OSS。 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';

export const siteOwner = 'https://models.onenovalab.com';
export const manifestKey = '_onenova/models-deploy-manifest.json';
export const shortCache = 'no-cache, max-age=0, must-revalidate';
export const immutableCache = 'public, max-age=31536000, immutable';
const textTypes = {
  '.html': 'text/html; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.map': 'application/json; charset=utf-8', '.csv': 'text/csv; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};
const binaryTypes = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.wasm': 'application/wasm', '.pdf': 'application/pdf',
};
const metadataFields = ['sha256', 'contentEncoding', 'contentType', 'cacheControl'];

export function safeKey(key) {
  return typeof key === 'string' && key.length > 0 && key !== manifestKey &&
    !/[\\\s?#%]/u.test(key) && !key.startsWith('/') &&
    key.split('/').every((part) => part && part !== '.' && part !== '..');
}

export function isHashed(key) {
  if (key.startsWith('_next/static/')) return true;
  // HTML、RSC 和数据无论名字如何都重新验证；只有其他哈希资源用长缓存。
  // sprites 按模型 ID 命名，末尾 8 位发布日期不是内容哈希。
  if (key.startsWith('sprites/') || key.startsWith('data/') || ['.html', '.txt', '.json', '.xml', '.webmanifest'].includes(path.posix.extname(key).toLowerCase())) return false;
  return /(?:^|[.-])[a-f0-9]{8,}(?=[.-])/i.test(path.posix.basename(key));
}

export function deterministicGzip(bytes) {
  const result = gzipSync(bytes, { level: 9 });
  if (result[3] !== 0) throw new Error('gzip 不能包含文件名或可变头字段');
  result.fill(0, 4, 8); // MTIME 固定为零，文件修改时间不参与上传指纹。
  result[9] = 255; // OS 固定为未知，Windows / Linux 不因头字节产生差异。
  return result;
}

function filesUnder(directory, prefix = '') {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const key = prefix + entry.name;
    if (entry.isSymbolicLink()) throw new Error('构建产物不能包含符号链接');
    return entry.isDirectory() ? filesUnder(path.join(directory, entry.name), key + '/') : [key];
  });
}

/** 输出目录必须新建并位于 out 所属工作目录内，不能位于 out 内部；不改写 out。 */
export function prepareSite(outDir, preparedDir) {
  outDir = path.resolve(outDir); preparedDir = path.resolve(preparedDir);
  const relative = path.relative(path.dirname(outDir), preparedDir);
  const insideOut = path.relative(outDir, preparedDir);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative) ||
      (!insideOut.startsWith('..') && !path.isAbsolute(insideOut)) || fs.existsSync(preparedDir) ||
      fs.lstatSync(outDir).isSymbolicLink()) {
    throw new Error('预压缩目录必须在本站工作目录内、位于 out 之外且尚不存在');
  }
  const keys = filesUnder(outDir).sort();
  if (!keys.includes('index.html') || !keys.includes('404.html') || !keys.includes('sitemap.xml') ||
      !keys.some((key) => key.startsWith('_next/static/')) || !keys.every(safeKey)) {
    throw new Error('out/ 不完整或包含不安全路径，拒绝准备上传');
  }
  fs.mkdirSync(preparedDir);
  return keys.map((key) => {
    const source = fs.readFileSync(path.join(outDir, key));
    const extension = path.posix.extname(key).toLowerCase();
    const contentEncoding = Object.hasOwn(textTypes, extension) ? 'gzip' : '';
    const bytes = contentEncoding ? deterministicGzip(source) : source;
    const destination = path.join(preparedDir, key);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, bytes);
    return {
      key, sourceBytes: source.length, uploadBytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'), contentEncoding,
      contentType: textTypes[extension] || binaryTypes[extension] || 'application/octet-stream',
      cacheControl: isHashed(key) ? immutableCache : shortCache,
      phase: extension === '.html' ? 2 : isHashed(key) ? 0 : 1,
    };
  });
}

export function validateManifest(manifest, bucket) {
  if (!manifest || manifest.owner !== siteOwner ||
      typeof manifest.bucket !== 'string' || !/^(?:OSS_BUCKET|[a-z0-9][a-z0-9-]{1,61}[a-z0-9])$/.test(manifest.bucket) ||
      (bucket && manifest.bucket !== bucket)) {
    throw new Error('部署清单归属或 Bucket 不合法，拒绝部署');
  }
  if (manifest.version === 1 && Array.isArray(manifest.files) && manifest.files.every(safeKey)) return manifest;
  if (manifest.version !== 2 || !manifest.files || Array.isArray(manifest.files) || typeof manifest.files !== 'object') {
    throw new Error('部署清单版本或对象表不合法');
  }
  for (const [key, value] of Object.entries(manifest.files)) {
    if (!safeKey(key) || !value || !/^[a-f0-9]{64}$/.test(value.sha256) ||
        !['', 'gzip'].includes(value.contentEncoding) ||
        typeof value.contentType !== 'string' || !value.contentType || /[\r\n]/.test(value.contentType) ||
        typeof value.cacheControl !== 'string' || !value.cacheControl || /[\r\n]/.test(value.cacheControl)) {
      throw new Error('部署清单对象路径或元信息不合法');
    }
  }
  return manifest;
}

function sameObject(previous, current) {
  return previous && metadataFields.every((field) => previous[field] === current[field]);
}
function metadata(entry) { return Object.fromEntries(metadataFields.map((field) => [field, entry[field]])); }
export function serializeManifest(manifest) { return JSON.stringify(manifest, null, 2) + '\n'; }
export function encodeManifest(manifest) { return deterministicGzip(Buffer.from(serializeManifest(manifest))); }
/** ossutil cat 返回原始对象字节；同时兼容旧明文与新 gzip 清单。 */
export function decodeManifest(raw) {
  const bytes = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
  const plain = bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes) : bytes;
  return JSON.parse(plain.toString('utf8').replace(/^\uFEFF/, ''));
}

export function createPlan(entries, previous = null, bucket = 'OSS_BUCKET') {
  if (previous) validateManifest(previous);
  const oldKeys = !previous ? [] : previous.version === 1 ? previous.files : Object.keys(previous.files);
  const currentKeys = new Set(entries.map((entry) => entry.key));
  const stale = [...new Set(oldKeys)].filter((key) => !currentKeys.has(key) && !isHashed(key)).sort();
  const groups = new Map();
  for (const entry of entries) {
    const groupKey = JSON.stringify([entry.phase, entry.contentEncoding, entry.contentType, entry.cacheControl]);
    if (!groups.has(groupKey)) groups.set(groupKey, { phase: entry.phase, contentEncoding: entry.contentEncoding,
      contentType: entry.contentType, cacheControl: entry.cacheControl, entries: [] });
    if (previous?.version !== 2 || !Object.hasOwn(previous.files, entry.key) || !sameObject(previous.files[entry.key], entry)) {
      groups.get(groupKey).entries.push(entry);
    }
  }
  const orderedGroups = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, group]) => group);
  const records = new Map(entries.map((entry) => [entry.key, metadata(entry)]));
  if (previous?.version === 2) {
    for (const [key, value] of Object.entries(previous.files)) {
      if (isHashed(key) && !records.has(key)) records.set(key, metadata(value));
    }
  }
  // v1 没有指纹的历史哈希仍留在远端，但不伪造它们的 sha256。
  const manifest = { version: 2, owner: siteOwner, bucket,
    files: Object.fromEntries([...records].sort(([a], [b]) => a.localeCompare(b))) };
  const changed = orderedGroups.flatMap((group) => group.entries);
  const manifestChanged = previous?.version !== 2 || previous.bucket !== bucket ||
    Object.keys(previous.files).length !== records.size ||
    [...records].some(([key, value]) => !Object.hasOwn(previous.files, key) || !sameObject(previous.files[key], value));
  const manifestSourceBytes = Buffer.byteLength(serializeManifest(manifest));
  const manifestBytes = encodeManifest(manifest).length;
  const sum = (files, field) => files.reduce((total, file) => total + file[field], 0);
  const report = {
    旧清单版本: previous?.version ?? null, 总文件数: entries.length,
    全站压缩前字节数: sum(entries, 'sourceBytes'), 全站上传版本字节数: sum(entries, 'uploadBytes'),
    待上传文件数: changed.length, 待上传文件压缩前字节数: sum(changed, 'sourceBytes'),
    待上传文件字节数: sum(changed, 'uploadBytes'), 待清理文件数: stale.length,
    需要更新清单: manifestChanged, 清单压缩前字节数: manifestSourceBytes, 清单上传字节数: manifestBytes,
    预计总上传字节数: sum(changed, 'uploadBytes') + (manifestChanged ? manifestBytes : 0),
    分组: orderedGroups.map((group) => ({ 阶段: ['哈希资源', '数据与其他资源', 'HTML'][group.phase],
      ContentEncoding: group.contentEncoding || '无', ContentType: group.contentType, CacheControl: group.cacheControl,
      待上传文件数: group.entries.length, 压缩前字节数: sum(group.entries, 'sourceBytes'), 上传字节数: sum(group.entries, 'uploadBytes') })),
  };
  return { groups: orderedGroups, stale, manifest, manifestChanged, report };
}
