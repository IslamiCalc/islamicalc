/* ============================================================
   events.js — IslamiCalc Global Event Bus v1.1
   تواصل بين المكونات بدون coupling
   ============================================================ */

const Events = (() => {

  const _handlers  = {};
  const _onceQueue = new Set();
  const _log       = [];
  const MAX_LOG    = 50;

  // ============================================================
  // EVENT CATALOGUE
  // ============================================================
  const EVENTS = {
    // Auth
    AUTH_READY:           'auth:ready',
    AUTH_LOGIN:           'auth:login',
    AUTH_LOGOUT:          'auth:logout',
    AUTH_PROFILE_LOADED:  'auth:profile_loaded',   // ✅ مُضاف

    // XP + Gamification
    XP_ADDED:             'xp:added',
    XP_LEVEL_UP:          'xp:level_up',
    BADGE_UNLOCKED:       'badge:unlocked',
    STREAK_UPDATED:       'streak:updated',

    // Khatma
    KHATMA_PAGE_READ:     'khatma:page_read',
    KHATMA_JUZ_DONE:      'khatma:juz_done',
    KHATMA_COMPLETE:      'khatma:complete',

    // Arena
    ARENA_ANSWER:         'arena:answer',
    ARENA_WIN:            'arena:win',
    ARENA_STREAK:         'arena:streak',

    // Athkar
    ATHKAR_DONE:          'athkar:done',
    ATHKAR_CAT_DONE:      'athkar:cat_done',
    TASBIH_ROUND:         'tasbih:round',

    // Prayer
    PRAYER_LOADED:        'prayer:loaded',
    PRAYER_TIME_IN:       'prayer:time_in',

    // Zakat
    ZAKAT_CALC:           'zakat:calc',

    // UI
    UI_TOAST:             'ui:toast',
    UI_MODAL_OPEN:        'ui:modal_open',
    UI_MODAL_CLOSE:       'ui:modal_close',
    UI_THEME_CHANGE:      'ui:theme_change',
    UI_PAGE_CHANGE:       'ui:page_change',

    // Network
    NET_ONLINE:           'net:online',
    NET_OFFLINE:          'net:offline',
  };

  // ============================================================
  // on(event, fn)
  // ============================================================
  function on(event, fn) {
    if (!_handlers[event]) _handlers[event] = [];
    _handlers[event].push(fn);
    return () => off(event, fn);
  }

  // ============================================================
  // once(event, fn)
  // ============================================================
  function once(event, fn) {
    const wrapper = (...args) => { fn(...args); off(event, wrapper); };
    _onceQueue.add(wrapper);
    return on(event, wrapper);
  }

  // ============================================================
  // off(event, fn)
  // ============================================================
  function off(event, fn) {
    if (!_handlers[event]) return;
    _handlers[event] = _handlers[event].filter(f => f !== fn);
  }

  // ============================================================
  // emit(event, data)
  // ============================================================
  function emit(event, data = {}) {
    if (_log.length >= MAX_LOG) _log.shift();
    _log.push({ event, data, ts: Date.now() });

    (_handlers[event] || []).forEach(fn => {
      try { fn(data); }
      catch (err) { console.error(`[Events] Error in handler for "${event}":`, err); }
    });

    (_handlers['*'] || []).forEach(fn => {
      try { fn({ event, data }); } catch {}
    });
  }

  // ============================================================
  // emitAsync(event, data)
  // ============================================================
  async function emitAsync(event, data = {}) {
    const handlers = _handlers[event] || [];
    await Promise.allSettled(handlers.map(fn => Promise.resolve(fn(data))));
  }

  // ============================================================
  // waitFor(event, timeout?)
  // ============================================================
  function waitFor(event, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        off(event, handler);
        reject(new Error(`[Events] waitFor("${event}") timed out after ${timeout}ms`));
      }, timeout);

      function handler(data) {
        clearTimeout(timer);
        resolve(data);
      }
      once(event, handler);
    });
  }

  // ============================================================
  // AUTO EVENTS
  // ============================================================
  if (typeof window !== 'undefined') {
    window.addEventListener('online',  () => emit(EVENTS.NET_ONLINE));
    window.addEventListener('offline', () => emit(EVENTS.NET_OFFLINE));
    document.addEventListener('visibilitychange', () => {
      emit(document.hidden ? 'page:hidden' : 'page:visible');
    });
  }

  // ============================================================
  // DEBUG
  // ============================================================
  function debug() {
    console.group('[IslamiCalc Events]');
    console.log('Registered events:', Object.keys(_handlers).filter(k => _handlers[k].length));
    console.log('Last 10 events:', _log.slice(-10).map(e =>
      `[${new Date(e.ts).toLocaleTimeString('ar')}] ${e.event}`
    ));
    console.groupEnd();
  }

  if (typeof window !== 'undefined') window.__IC_EVENTS_DEBUG__ = debug;

  return { on, once, off, emit, emitAsync, waitFor, debug, EVENTS };

})();

export default Events;
export const { EVENTS } = Events;
