import assert from 'node:assert/strict';
import test from 'node:test';

import { importFresh } from './helpers/import-fresh.js';
import { resetBrowserGlobals } from './helpers/browser-env.js';

test('Events.on emits payloads and off unsubscribes handlers', async () => {
  resetBrowserGlobals();
  const { default: Events } = await importFresh('./core/events.js');

  const calls = [];
  const unsubscribe = Events.on('custom:event', payload => calls.push(payload));

  Events.emit('custom:event', { count: 1 });
  unsubscribe();
  Events.emit('custom:event', { count: 2 });

  assert.deepEqual(calls, [{ count: 1 }]);
});

test('Events.once only handles the first emission', async () => {
  resetBrowserGlobals();
  const { default: Events } = await importFresh('./core/events.js');

  let callCount = 0;
  Events.once('custom:once', () => {
    callCount += 1;
  });

  Events.emit('custom:once');
  Events.emit('custom:once');

  assert.equal(callCount, 1);
});

test('Events wildcard listeners receive the event envelope', async () => {
  resetBrowserGlobals();
  const { default: Events } = await importFresh('./core/events.js');

  const payloads = [];
  Events.on('*', envelope => payloads.push(envelope));

  Events.emit('alpha:event', { value: 42 });

  assert.deepEqual(payloads, [{ event: 'alpha:event', data: { value: 42 } }]);
});

test('Events.waitFor resolves when the event is emitted', async () => {
  resetBrowserGlobals();
  const { default: Events } = await importFresh('./core/events.js');

  const waiting = Events.waitFor('async:event', 50);
  setTimeout(() => {
    Events.emit('async:event', { ready: true });
  }, 5);

  const payload = await waiting;
  assert.deepEqual(payload, { ready: true });
});

test('Events.waitFor rejects when the timeout elapses', async () => {
  resetBrowserGlobals();
  const { default: Events } = await importFresh('./core/events.js');

  await assert.rejects(
    Events.waitFor('missing:event', 5),
    /timed out/,
  );
});

test('Events auto-emit online and offline browser events', async () => {
  const env = resetBrowserGlobals();
  const { default: Events, EVENTS } = await importFresh('./core/events.js');

  const seen = [];
  Events.on(EVENTS.NET_ONLINE, () => seen.push('online'));
  Events.on(EVENTS.NET_OFFLINE, () => seen.push('offline'));

  env.window.dispatchEvent({ type: 'online' });
  env.window.dispatchEvent({ type: 'offline' });

  assert.deepEqual(seen, ['online', 'offline']);
});