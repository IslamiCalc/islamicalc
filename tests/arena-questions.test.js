import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const REQUIRED_KEYS = ['c', 'd', 'q', 'o', 'a', 'e'];
const ALLOWED_DIFFICULTIES = new Set(['easy', 'medium', 'hard']);

test('arena question bank JSON stays loadable and well-formed', async () => {
  const raw = await readFile(new URL('../arena/questions.json', import.meta.url), 'utf8');
  const data = JSON.parse(raw);

  assert.ok(Array.isArray(data));
  assert.ok(data.length >= 100);

  for (const entry of data) {
    for (const key of REQUIRED_KEYS) {
      assert.ok(Object.hasOwn(entry, key), `missing ${key}`);
    }
    assert.equal(typeof entry.c, 'string');
    assert.equal(typeof entry.d, 'string');
    assert.ok(ALLOWED_DIFFICULTIES.has(entry.d));
    assert.equal(typeof entry.q, 'string');
    assert.ok(Array.isArray(entry.o));
    assert.equal(entry.o.length, 4);
    assert.equal(typeof entry.a, 'number');
    assert.ok(entry.a >= 0 && entry.a < entry.o.length);
    assert.equal(typeof entry.e, 'string');
    if (Object.hasOwn(entry, 'v')) {
      assert.equal(typeof entry.v, 'string');
    }
  }
});
