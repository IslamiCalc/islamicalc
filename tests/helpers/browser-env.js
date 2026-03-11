class MockEventTarget {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type).add(listener);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatchEvent(event) {
    const listeners = [...(this.listeners.get(event.type) || [])];
    listeners.forEach(listener => listener.call(this, event));
    return true;
  }
}

class MockStorage {
  constructor() {
    this.map = new Map();
  }

  clear() {
    this.map.clear();
  }

  getItem(key) {
    return this.map.has(key) ? this.map.get(key) : null;
  }

  removeItem(key) {
    this.map.delete(key);
  }

  setItem(key, value) {
    this.map.set(key, String(value));
  }
}

class MockCustomEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.detail = options.detail;
  }
}

function installBrowserGlobals({ pathname = '/' } = {}) {
  const windowTarget = new MockEventTarget();
  const documentTarget = new MockEventTarget();
  const storage = new MockStorage();

  documentTarget.hidden = false;
  documentTarget.body = {
    appendChild() {},
    classList: {
      add() {},
      remove() {},
    },
  };
  documentTarget.createElement = () => ({
    className: '',
    textContent: '',
    style: {},
    remove() {},
  });
  documentTarget.getElementById = () => null;

  windowTarget.location = { pathname };
  windowTarget.document = documentTarget;
  windowTarget.CustomEvent = MockCustomEvent;
  windowTarget.setTimeout = globalThis.setTimeout.bind(globalThis);
  windowTarget.clearTimeout = globalThis.clearTimeout.bind(globalThis);

  globalThis.window = windowTarget;
  globalThis.document = documentTarget;
  globalThis.localStorage = storage;
  globalThis.CustomEvent = MockCustomEvent;

  return {
    window: windowTarget,
    document: documentTarget,
    localStorage: storage,
    setPathname(nextPathname) {
      windowTarget.location.pathname = nextPathname;
    },
  };
}

function resetBrowserGlobals(pathname = '/') {
  return installBrowserGlobals({ pathname });
}

export { MockEventTarget, MockStorage, installBrowserGlobals, resetBrowserGlobals };