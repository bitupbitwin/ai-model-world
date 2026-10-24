import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalize } from './snapshot-changed.mjs';

test('只差顶层时间戳时视为没变', () => {
  const a = JSON.stringify({ generatedAt: '2026-10-14T06:39:53Z', models: [{ id: 'x', price: 1 }] });
  const b = JSON.stringify({ generatedAt: '2026-10-14T18:09:53Z', models: [{ id: 'x', price: 1 }] });
  assert.equal(normalize(a), normalize(b));
  const c = JSON.stringify({ fetchedAt: 1, items: [] });
  const d = JSON.stringify({ fetchedAt: 2, items: [] });
  assert.equal(normalize(c), normalize(d));
});

test('数据本身变了就算变化，嵌套里的同名字段不忽略', () => {
  const a = JSON.stringify({ generatedAt: 'a', models: [{ id: 'x', price: 0.89504 }] });
  const b = JSON.stringify({ generatedAt: 'b', models: [{ id: 'x', price: 0.8956 }] });
  assert.notEqual(normalize(a), normalize(b));
  const c = JSON.stringify({ models: [{ generatedAt: 'a' }] });
  const d = JSON.stringify({ models: [{ generatedAt: 'b' }] });
  assert.notEqual(normalize(c), normalize(d));
});

test('不是 JSON 时按原文比较', () => {
  assert.equal(normalize('not json'), 'not json');
});
