import assert from 'node:assert/strict';
import test from 'node:test';

import { importFresh } from './helpers/import-fresh.js';
import { resetBrowserGlobals } from './helpers/browser-env.js';

test('Store loads persisted state on module init', async () => {
  const env = resetBrowserGlobals();
  env.localStorage.setItem('ic_theme', JSON.stringify('light'));
  env.localStorage.setItem('ic_prayer_city', JSON.stringify('Jeddah'));

  const { default: Store } = await importFresh('./core/store.js');

  assert.equal(Store.get('theme'), 'light');
  assert.equal(Store.get('prayer.city'), 'Jeddah');
});

test('Store.set updates nested state and persists configured keys', async () => {
  const env = resetBrowserGlobals();
  const { default: Store } = await importFresh('./core/store.js');

  Store.set('theme', 'light');
  Store.set('khatma.currentPage', 12);

  assert.equal(Store.get('theme'), 'light');
  assert.equal(Store.get('khatma.currentPage'), 12);
  assert.equal(env.localStorage.getItem('ic_theme'), JSON.stringify('light'));
});

test('Store.patch notifies exact, parent, and wildcard listeners once per function', async () => {
  resetBrowserGlobals();
  const { default: Store } = await importFresh('./core/store.js');

  const exactCalls = [];
  const parentCalls = [];
  const wildcardCalls = [];

  Store.subscribe('khatma.currentPage', (value, key) => exactCalls.push({ value, key }));
  Store.subscribe('khatma', (value, key) => parentCalls.push({ value, key }));
  Store.subscribe('*', (state, key) => wildcardCalls.push({ state, key }));

  Store.patch({
    'khatma.currentPage': 33,
    'khatma.streak': 4,
  });

  assert.deepEqual(exactCalls, [{ value: 33, key: 'khatma.currentPage' }]);
  assert.equal(parentCalls.length, 1);
  assert.equal(parentCalls[0].value.currentPage, 33);
  assert.equal(parentCalls[0].value.streak, 4);
  assert.equal(wildcardCalls.length, 1);
  assert.equal(wildcardCalls[0].key, 'khatma.currentPage');
  assert.equal(wildcardCalls[0].state.khatma.streak, 4);
});

test('Store.reset restores a nested slice to defaults', async () => {
  resetBrowserGlobals();
  const { default: Store } = await importFresh('./core/store.js');

  Store.patch({
    'athkar.totalTasbih': 99,
    'athkar.streak': 7,
  });
  Store.reset('athkar');

  assert.deepEqual(Store.get('athkar'), {
    done: {},
    catDone: {},
    totalTasbih: 0,
    todayDate: '',
    streak: 0,
    lastDone: '',
    tasbih: { type: 'subhan', count: 0, rounds: 0 },
  });
});

test('Store level helpers respect critical XP boundaries', async () => {
  resetBrowserGlobals();
  const { default: Store } = await importFresh('./core/store.js');

  assert.equal(Store.computeLevel(0).min, 0);
  assert.equal(Store.computeLevel(99).max, 99);
  assert.equal(Store.computeLevel(100).min, 100);
  assert.equal(Store.computeLevel(300).min, 300);
  assert.equal(Store.computeLevel(700).min, 700);
  assert.equal(Store.computeLevel(6000).min, 6000);

  assert.equal(Store.computeNextLevel(0).min, 100);
  assert.equal(Store.computeNextLevel(299).min, 300);
  assert.equal(Store.computeNextLevel(6000).min, 6000);

  assert.equal(Store.computeLevelProgress(0), 0);
  assert.equal(Store.computeLevelProgress(50), 50);
  assert.equal(Store.computeLevelProgress(99), 99);
  assert.equal(Store.computeLevelProgress(100), 0);
  assert.equal(Store.computeLevelProgress(6000), 100);
});