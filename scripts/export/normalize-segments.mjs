/**
 * Next.js 16.3.3 在 Windows 静态导出中只把 / 转成点，漏掉了系统分隔符 \\。
 * 将嵌套的 __next.* 预取负载还原成浏览器请求的扁平文件名；Linux 正常输出无需改动。
 * 不删除 RSC 负载，不改 HTML/JS，也不依赖静态服务器的重写规则。
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.env.NEXT_DIST_DIR || 'out');
assert.ok(fs.existsSync(path.join(root, 'index.html')), '缺少静态导出首页');
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    assert.ok(!entry.isSymbolicLink(), '静态导出不允许符号链接');
    return entry.isDirectory() ? walk(full) : [full];
  });
}
let fixed = 0;
const emptyDirectories = new Set();
for (const file of walk(root)) {
  const parts = path.relative(root, file).split(path.sep);
  const index = parts.findIndex((part) => part.startsWith('__next.'));
  if (index < 0 || index === parts.length - 1 || !file.endsWith('.txt')) continue;
  const destination = path.join(root, ...parts.slice(0, index), parts.slice(index).join('.'));
  assert.ok(path.relative(root, destination) && !path.relative(root, destination).startsWith('..'), '路径越界');
  if (fs.existsSync(destination)) {
    assert.ok(fs.readFileSync(file).equals(fs.readFileSync(destination)), '预取文件重名但内容不一致');
    fs.unlinkSync(file);
  } else {
    fs.renameSync(file, destination);
  }
  let dir = path.dirname(file);
  while (dir !== root && path.basename(dir) !== parts[index - 1]) {
    emptyDirectories.add(dir);
    if (path.basename(dir) === parts[index]) break;
    dir = path.dirname(dir);
  }
  fixed += 1;
}
for (const dir of [...emptyDirectories].sort((a, b) => b.length - a.length)) {
  // 仅移除已验证在导出目录内且已经为空的目录，绝不递归删除。
  assert.ok(!path.relative(root, dir).startsWith('..'), '路径越界');
  if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
}
console.log(`静态预取文件名检查完成，修正 ${fixed} 个 Windows 路径。`);
