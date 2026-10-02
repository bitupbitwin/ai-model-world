/** 同一组实际构建输入使用同一 ID，避免 Next 默认随机 ID 让 HTML/RSC 每次重建都变化。 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export function contentBuildId(root = process.cwd(), env = process.env): string {
  const hash = createHash('sha256');
  hash.update(JSON.stringify({ node: process.version, platform: process.platform, arch: process.arch,
    site: new URL(env.NEXT_PUBLIC_SITE_URL || 'https://models.onenovalab.com').origin,
    basePath: env.NEXT_BASE_PATH || '', publicBasePath: env.NEXT_PUBLIC_BASE_PATH || '' }));
  function add(relative: string): void {
    const file = path.join(root, relative);
    if (fs.lstatSync(file).isSymbolicLink()) throw new Error('构建 ID 输入不能包含符号链接');
    if (fs.statSync(file).isDirectory()) {
      for (const name of fs.readdirSync(file).sort()) add(`${relative}/${name}`);
    } else {
      const bytes = fs.readFileSync(file);
      hash.update(`${relative}\0${bytes.length}\0`).update(bytes);
    }
  }
  for (const input of ['src', 'public', 'data/models.json', 'data/bilibili.json', 'next.config.ts',
    'package.json', 'package-lock.json', 'tsconfig.json', 'postcss.config.mjs', 'scripts/export/build-id.ts']) add(input);
  return `onenova-${hash.digest('hex').slice(0, 24)}`;
}
