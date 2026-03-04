/* ============================================================
   store.js — IslamiCalc Global State Manager
   نظام إدارة الحالة المركزي بدون أي framework
   ============================================================ */

const Store = (() => {

  // ============================================================
  // INITIAL STATE
  // ============================================================
  const DEFAULTS = {
    // Auth
    user: null,
    profile: null,
    authReady: false,

    // UI
    theme: 'dark',
    modalOpen: false,
    currentPage: '',

    // XP + Gamification
    xp: 0,
    level: 1,
    levelName: 'مبتدئ',
    levelIcon: '🌱',
    streak: 0,
    badges: [],

    // Khatma
    khatma: {
      currentPage: 1,
      currentJuz: 1,
      streak: 0,
      completed: 0,
      lastRead: '',
    },

    // Prayer
    prayer: {
      city: 'الرياض',
      lat: 24.7136,
      lng: 46.6753,
      method: 4,
      times: {},
    },

    // Athkar
    athkar: {
      done: {},
      catDone: {},
      totalTasbih: 0,
      todayDate: '',
      streak: 0,
      lastDone: '',
      tasbih: { type: 'subhan', count: 0, rounds: 0 },
    },

    // Notifications queue
    notifications: [],
  };

  // ============================================================
  // PRIVATE: Internal State
  // ============================================================
  let _state     = deepClone(DEFAULTS);
  let _listeners = {}; // { 'key': [fn, fn, ...] }
  let _history   = []; // State history for debugging
  const MAX_HISTORY = 20;

  // ============================================================
  // PRIVATE: Helpers
  // ============================================================
  function deepClone(obj) {
    try { return JSON.parse(JSON.stringify(obj)); }
    catch { return { ...obj }; }
  }

  function getNestedValue(obj, path) {
    return path.split('.').reduce((curr, key) =>
      curr != null ? curr[key] : undefined, obj
    );
  }

  function setNestedValue(obj, path, value) {
    const keys   = path.split('.');
    const result = deepClone(obj);
    let   curr   = result;
    for (let i = 0; i < keys.length - 1; i++) {
      if (curr[keys[i]] == null) curr[keys[i]] = {};
      curr = curr[keys[i]];
    }
    curr[keys[keys.length - 1]] = value;
    return result;
  }

  function notifyListeners(changedKeys) {
    const notified = new Set();

    changedKeys.forEach(key => {
      // Notify exact key listeners
      (_listeners[key] || []).forEach(fn => {
        if (!notified.has(fn)) { fn(get(key), key); notified.add(fn); }
      });

      // Notify parent key listeners (e.g. 'khatma' when 'khatma.page' changes)
      const parts = key.split('.');
      for (let i = 1; i < parts.length; i++) {
        const parent = parts.slice(0, i).join('.');
        (_listeners[parent] || []).forEach(fn => {
          if (!notified.has(fn)) { fn(get(parent), parent); notified.add(fn); }
        });
      }

      // Notify wildcard listeners
      (_listeners['*'] || []).forEach(fn => {
        if (!notified.has(fn)) { fn(_state, key); notified.add(fn); }
      });
    });
  }

  // ============================================================
  // PUBLIC API
  // ============================================================

  /**
   * get(key) — قراءة قيمة من الـ State
   * @example Store.get('user')
   * @example Store.get('khatma.currentPage')
   */
  function get(key) {
    if (!key) return deepClone(_state);
    return deepClone(getNestedValue(_state, key));
  }

  /**
   * set(key, value) — تحديث قيمة في الـ State
   * @example Store.set('theme', 'light')
   * @example Store.set('khatma.currentPage', 150)
   */
  function set(key, value) {
    const oldValue = getNestedValue(_state, key);

    // Skip if same value
    if (JSON.stringify(oldValue) === JSON.stringify(value)) return;

    // History
    if (_history.length >= MAX_HISTORY) _history.shift();
    _history.push({ key, old: deepClone(oldValue), new: deepClone(value), ts: Date.now() });

    // Update state
    _state = setNestedValue(_state, key, value);

    // Notify
    notifyListeners([key]);

    // Auto-persist certain keys
    autoPersist(key, value);
  }

  /**
   * patch(updates) — تحديث عدة قيم دفعة واحدة
   * @example Store.patch({ xp: 500, level: 3, levelName: 'ملتزم' })
   */
  function patch(updates) {
    const changedKeys = [];

    Object.entries(updates).forEach(([key, value]) => {
      const oldValue = getNestedValue(_state, key);
      if (JSON.stringify(oldValue) === JSON.stringify(value)) return;
      _state = setNestedValue(_state, key, value);
      changedKeys.push(key);
      autoPersist(key, value);
    });

    if (changedKeys.length) notifyListeners(changedKeys);
  }

  /**
   * subscribe(key, fn) — الاشتراك في تغيير قيمة
   * @returns unsubscribe function
   * @example const unsub = Store.subscribe('xp', (xp) => updateXPBar(xp))
   * @example const unsub = Store.subscribe('*', (state) => console.log(state))
   */
  function subscribe(key, fn) {
    if (!_listeners[key]) _listeners[key] = [];
    _listeners[key].push(fn);

    // Return unsubscribe
    return () => {
      _listeners[key] = (_listeners[key] || []).filter(f => f !== fn);
    };
  }

  /**
   * reset(key?) — إعادة تعيين جزء أو كل الـ State
   * @example Store.reset()           // reset all
   * @example Store.reset('athkar')   // reset athkar only
   */
  function reset(key) {
    if (key) {
      const defaultVal = getNestedValue(DEFAULTS, key);
      if (defaultVal !== undefined) set(key, deepClone(defaultVal));
    } else {
      const oldState = _state;
      _state = deepClone(DEFAULTS);
      const allKeys = Object.keys(DEFAULTS);
      notifyListeners(allKeys);
    }
  }

  // ============================================================
  // PERSISTENCE — Auto save/load from localStorage
  // ============================================================
  const PERSIST_KEYS = {
    'theme':          'ic_theme',
    'prayer':         'ic_prayer',
    'khatma':         'ic_khatma',
    'athkar':         'ic_athkar',
    'prayer.city':    'ic_prayer_city',
  };

  const PERSIST_PROFILE_KEYS = ['xp', 'level', 'levelName', 'levelIcon', 'streak', 'badges'];

  function autoPersist(key, value) {
    const storageKey = PERSIST_KEYS[key];
    if (storageKey) {
      try { localStorage.setItem(storageKey, JSON.stringify(value)); }
      catch (e) { console.warn('[Store] persist failed:', key); }
    }
  }

  function loadFromStorage() {
    const updates = {};

    Object.entries(PERSIST_KEYS).forEach(([stateKey, storageKey]) => {
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw != null) updates[stateKey] = JSON.parse(raw);
      } catch {}
    });

    if (Object.keys(updates).length) {
      // Silent patch (no notifications yet — listeners not attached)
      Object.entries(updates).forEach(([key, value]) => {
        _state = setNestedValue(_state, key, value);
      });
    }
  }

  // ============================================================
  // COMPUTED VALUES — مشتقة من الـ State
  // ============================================================
  const LEVELS = [
    { min:0,    max:99,   name:'مبتدئ',  icon:'🌱', color:'#6b7280' },
    { min:100,  max:299,  name:'متعلم',  icon:'📖', color:'#3b82f6' },
    { min:300,  max:699,  name:'ملتزم',  icon:'⭐', color:'#8b5cf6' },
    { min:700,  max:1499, name:'متقن',   icon:'🌟', color:'#f59e0b' },
    { min:1500, max:2999, name:'حافظ',   icon:'💎', color:'#10b981' },
    { min:3000, max:5999, name:'عالم',   icon:'🏆', color:'#f97316' },
    { min:6000, max:Infinity, name:'إمام', icon:'👑', color:'#fbbf24' },
  ];

  function computeLevel(xp) {
    return LEVELS.findLast(l => xp >= l.min) || LEVELS[0];
  }

  function computeNextLevel(xp) {
    return LEVELS.find(l => xp < l.min) || LEVELS[LEVELS.length - 1];
  }

  function computeLevelProgress(xp) {
    const curr = computeLevel(xp);
    const next = computeNextLevel(xp);
    if (curr.min === next.min) return 100;
    return Math.min(Math.round((xp - curr.min) / (next.min - curr.min) * 100), 100);
  }

  function computed(key) {
    const xp = _state.xp || 0;
    switch (key) {
      case 'level':         return computeLevel(xp);
      case 'nextLevel':     return computeNextLevel(xp);
      case 'levelProgress': return computeLevelProgress(xp);
      case 'isLoggedIn':    return _state.user != null;
      case 'displayName':   return _state.profile?.displayName?.split(' ')[0] || 'مسلم';
      default: return null;
    }
  }

  // ============================================================
  // DEBUG — فقط في Development
  // ============================================================
  function debug() {
    console.group('[IslamiCalc Store]');
    console.log('State:', deepClone(_state));
    console.log('History:', _history.slice(-5));
    console.log('Listeners:', Object.keys(_listeners).map(k => `${k}(${_listeners[k].length})`));
    console.groupEnd();
  }

  // ============================================================
  // INIT
  // ============================================================
  loadFromStorage();

  // Expose to window for debugging in browser console
  if (typeof window !== 'undefined') {
    window.__IC_STORE_DEBUG__ = debug;
  }

  // ============================================================
  // RETURN PUBLIC API
  // ============================================================
  return {
    get,
    set,
    patch,
    subscribe,
    reset,
    computed,
    debug,
    LEVELS,
    computeLevel,
    computeNextLevel,
    computeLevelProgress,
  };

})();

export default Store;
