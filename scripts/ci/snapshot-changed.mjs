// 判断这次同步有没有「真」变化：忽略每次都会变的时间戳，只看数据本身。
//
// 同步管线每次都会刷新快照顶层的 generatedAt / fetchedAt，sync-report.json 也每次都写，
// 只按 git diff 判断的话天天都算「有变化」，部署也就天天白跑一遍。
// 这里逐个比较 data/ 顶层 JSON：去掉顶层时间戳后与 HEAD 中的版本不同，才算真变化；
// 新出现的快照文件一律算变化。sync-report.json 只是本次运行的报告，不参与判断。
//
// 用法：node scripts/ci/snapshot-changed.mjs   → 打印 changed 或 unchanged
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const VOLATILE = ['generatedAt', 'fetchedAt'];
const IGNORED = new Set(['data/sync-report.json']);

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1 << 28 });
const isSnapshot = (file) => /^data\/[^/]+\.json$/.test(file) && !IGNORED.has(file);

export function normalize(text) {
  try {
    const value = JSON.parse(text);
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const key of VOLATILE) delete value[key];
    }
    return JSON.stringify(value);
  } catch {
    return text;
  }
}

export function snapshotChanged() {
  const untracked = git('ls-files', '--others', '--exclude-standard', '--', 'data/')
    .split('\n')
    .filter(isSnapshot);
  if (untracked.length) return true;
  const modified = git('diff', '--name-only', '--', 'data/').split('\n').filter(isSnapshot);
  return modified.some((file) => {
    let before = '';
    try {
      before = git('show', `HEAD:${file}`);
    } catch {
      return true;
    }
    return normalize(before) !== normalize(readFileSync(file, 'utf8'));
  });
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('snapshot-changed.mjs')) {
  console.log(snapshotChanged() ? 'changed' : 'unchanged');
}
