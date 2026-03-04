/* ============================================================
   app.js — IslamiCalc Application Controller
   يُستدعى في كل صفحة: <script type="module" src="/core/app.js">
   يحل محل كل الكود المكرر في كل صفحة
   ============================================================ */

import Store  from './store.js';
import Events from './events.js';
import { EVENTS } from './events.js';

const App = (() => {

  // ============================================================
  // INIT SEQUENCE
  // ============================================================
  async function init() {
    console.log('[IslamiCalc] App initializing...');

    initTheme();
    initNavbar();
    initMobileMenu();
    initModal();
    initToast();
    initNetworkDetection();
    await initFirebase();
    initPageTracking();

    console.log('[IslamiCalc] App ready ✅');
    Events.emit(EVENTS.UI_PAGE_CHANGE, { page: getCurrentPage() });
  }

  // ============================================================
  // THEME
  // ============================================================
  function initTheme() {
    const saved  = Store.get('theme');
    const hour   = new Date().getHours();
    const theme  = saved || (hour >= 19 || hour < 6 ? 'dark' : 'light');

    applyTheme(theme);

    document.getElementById('themeBtn')?.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next    = current === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      Store.set('theme', next);
      Events.emit(EVENTS.UI_THEME_CHANGE, { theme: next });
    });

    Store.subscribe('theme', applyTheme);
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const btn = document.getElementById('themeBtn');
    if (btn) btn.textContent = theme === 'dark' ? '🌙' : '☀️';
  }

  // ============================================================
  // NAVBAR
  // ============================================================
  function initNavbar() {
    const nav = document.getElementById('icNav');
    if (!nav) return;

    // Scroll effect
    window.addEventListener('scroll', () => {
      nav.classList.toggle('ic-nav--scrolled', scrollY > 20);
    }, { passive: true });

    // Mark active link
    const current = '/' + getCurrentPage();
    nav.querySelectorAll('.ic-nav__link').forEach(link => {
      const href = link.getAttribute('href');
      if (href === current || (href !== '/' && current.startsWith(href))) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // Update nav UI when auth changes
    Store.subscribe('profile', updateNavAuth);
    Store.subscribe('user',    updateNavAuth);
  }

  function updateNavAuth() {
    const user    = Store.get('user');
    const profile = Store.get('profile');
    const btn     = document.getElementById('loginBtn');
    if (!btn) return;

    if (user && profile) {
      const lvl = Store.computeLevel(profile.xp || 0);
      const name = profile.displayName?.split(' ')[0] || 'أنت';
      btn.textContent = `${lvl.icon} ${name}`;
      btn.classList.add('ic-nav__login-btn--logged');
    } else {
      btn.textContent = 'دخول';
      btn.classList.remove('ic-nav__login-btn--logged');
    }
  }

  // ============================================================
  // MOBILE MENU
  // ============================================================
  function initMobileMenu() {
    const toggle = document.getElementById('mobileToggle');
    const menu   = document.getElementById('mobileMenu');
    if (!toggle || !menu) return;

    toggle.addEventListener('click', () => {
      menu.classList.toggle('ic-nav__mobile--open');
      toggle.textContent = menu.classList.contains('ic-nav__mobile--open') ? '✕' : '☰';
    });

    // Close on link click
    menu.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        menu.classList.remove('ic-nav__mobile--open');
        toggle.textContent = '☰';
      });
    });

    // Close on outside click
    document.addEventListener('click', e => {
      if (!menu.contains(e.target) && !toggle.contains(e.target)) {
        menu.classList.remove('ic-nav__mobile--open');
        toggle.textContent = '☰';
      }
    });
  }

  // ============================================================
  // MODAL
  // ============================================================
  function initModal() {
    const modal    = document.getElementById('loginModal');
    const backdrop = document.getElementById('modalBackdrop');
    const loginBtn = document.getElementById('loginBtn');
    const guestBtn = document.getElementById('guestBrowseBtn');
    const googleBtn = document.getElementById('googleLoginBtn');

    if (!modal) return;

    loginBtn?.addEventListener('click', () => {
      const user = Store.get('user');
      if (user) {
        window.islamiCalc?.showUserMenu?.();
      } else {
        openModal();
      }
    });

    backdrop?.addEventListener('click',  closeModal);
    guestBtn?.addEventListener('click',  closeModal);
    googleBtn?.addEventListener('click', () => window.islamiCalc?.loginWithGoogle?.());

    // Keyboard ESC
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeModal();
    });

    // Event Bus integration
    Events.on(EVENTS.UI_MODAL_OPEN,  openModal);
    Events.on(EVENTS.UI_MODAL_CLOSE, closeModal);
  }

  function openModal() {
    document.getElementById('loginModal')?.classList.add('ic-modal--open');
    Store.set('modalOpen', true);
  }

  function closeModal() {
    document.getElementById('loginModal')?.classList.remove('ic-modal--open');
    Store.set('modalOpen', false);
  }

  // ============================================================
  // TOAST
  // ============================================================
  function initToast() {
    // Inject Toast element if not present
    if (!document.getElementById('toast')) {
      const el = document.createElement('div');
      el.id        = 'toast';
      el.className = 'ic-toast';
      document.body.appendChild(el);
    }

    // Event Bus integration
    Events.on(EVENTS.UI_TOAST, ({ message, type = '' }) => {
      showToast(message, type);
    });

    // Expose globally
    window.showToast = showToast;
  }

  let _toastTimer = null;

  function showToast(message, type = '') {
    const el = document.getElementById('toast');
    if (!el) return;

    el.textContent = message;
    el.className   = `ic-toast show ${type ? 'toast-' + type : ''}`;

    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => {
      el.classList.remove('show');
    }, 3500);
  }

  // ============================================================
  // NETWORK DETECTION
  // ============================================================
  function initNetworkDetection() {
    function onOnline()  { showToast('✅ عاد الاتصال بالإنترنت', 'success'); }
    function onOffline() { showToast('⚠️ لا يوجد اتصال بالإنترنت', 'error'); }

    Events.on(EVENTS.NET_ONLINE,  onOnline);
    Events.on(EVENTS.NET_OFFLINE, onOffline);
  }

  // ============================================================
  // FIREBASE INIT
  // ============================================================
  async function initFirebase() {
    try {
      // Wait for firebase.js to expose islamiCalc
      await Events.waitFor(EVENTS.AUTH_READY, 8000);
    } catch {
      // Auth took too long — continue without it
      console.warn('[App] Auth ready timeout — continuing as guest');
      Store.set('authReady', true);
    }
  }

  // ============================================================
  // PAGE TRACKING
  // ============================================================
  function initPageTracking() {
    const page = getCurrentPage();
    Store.set('currentPage', page);
    document.title = document.title || 'IslamiCalc';
  }

  function getCurrentPage() {
    const path  = window.location.pathname;
    const parts = path.split('/').filter(Boolean);
    return parts[0] || 'home';
  }

  // ============================================================
  // XP BAR INJECTION
  // ============================================================
  function injectXPBar() {
    const user = Store.get('user');
    if (!user) return;

    let bar = document.getElementById('ic-xp-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id        = 'ic-xp-bar';
      bar.className = 'ic-xp-bar';
      bar.innerHTML = `
        <div class="ic-xp-bar__inner">
          <span class="ic-xp-bar__lvl"  id="xpLvlIcon"></span>
          <span class="ic-xp-bar__name" id="xpLvlName"></span>
          <div class="ic-xp-bar__track">
            <div class="ic-xp-bar__fill" id="xpFill"></div>
          </div>
          <span class="ic-xp-bar__pts" id="xpPts"></span>
        </div>`;

      const nav = document.getElementById('icNav');
      nav?.insertAdjacentElement('afterend', bar);
    }

    updateXPBar();

    // Auto-update when XP changes
    Store.subscribe('xp', updateXPBar);
  }

  function updateXPBar() {
    const xp   = Store.get('profile')?.xp || Store.get('xp') || 0;
    const lvl  = Store.computeLevel(xp);
    const next = Store.computeNextLevel(xp);
    const pct  = Store.computeLevelProgress(xp);

    const icon = document.getElementById('xpLvlIcon');
    const name = document.getElementById('xpLvlName');
    const fill = document.getElementById('xpFill');
    const pts  = document.getElementById('xpPts');

    if (icon) icon.textContent = lvl.icon;
    if (name) name.textContent = lvl.name;
    if (pts)  pts.textContent  = xp.toLocaleString('ar') + ' نقطة';
    if (fill) {
      setTimeout(() => {
        fill.style.width      = pct + '%';
        fill.style.background = `linear-gradient(90deg, ${lvl.color}, ${next.color || lvl.color})`;
      }, 300);
    }
  }

  // ============================================================
  // PUBLIC HELPERS
  // ============================================================
  function getCurrentPage() {
    const path  = window.location.pathname;
    const parts = path.split('/').filter(Boolean);
    return parts[0] || 'home';
  }

  // ============================================================
  // LISTEN FOR AUTH STATE (from firebase.js)
  // ============================================================
  window.addEventListener('islamiCalcReady', () => {
    const ic = window.islamiCalc;
    if (!ic) return;

    const user    = ic.getCurrentUser?.();
    const profile = ic.getUserProfile?.();

    if (user)    Store.set('user',    user);
    if (profile) {
      Store.set('profile', profile);
      Store.set('xp',      profile.xp || 0);
      injectXPBar();
    }

    Store.set('authReady', true);
    Events.emit(EVENTS.AUTH_READY, { user, profile });

    if (user) Events.emit(EVENTS.AUTH_LOGIN, { user, profile });
  });

  // ============================================================
  // RETURN PUBLIC API
  // ============================================================
  return {
    init,
    showToast,
    openModal,
    closeModal,
    updateXPBar,
    injectXPBar,
    getCurrentPage,
  };

})();

// ============================================================
// AUTO INIT ON DOM READY
// ============================================================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', App.init);
} else {
  App.init();
}

export default App;
export { Store, Events };

// Global access for non-module scripts
window.IC = { App, Store, Events };
