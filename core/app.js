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
    // Update main theme button SVG (sun = light, moon = dark)
    const btn = document.getElementById('themeBtn');
    if (btn) {
      const sunSVG  = `<svg class="ic-nav__icon-btn-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
      const moonSVG = `<svg class="ic-nav__icon-btn-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"/></svg>`;
      btn.innerHTML = theme === 'dark' ? moonSVG : sunSVG;
      btn.setAttribute('aria-label', theme === 'dark' ? 'تفعيل الوضع النهاري' : 'تفعيل الوضع الليلي');
    }
    // Keep drawer theme button in sync
    const drawerBtn = document.getElementById('drawerThemeBtn');
    if (drawerBtn) {
      const spanEl = drawerBtn.querySelector('span');
      if (spanEl) spanEl.textContent = theme === 'dark' ? 'نهاري' : 'ليلي';
    }
  }

  // ============================================================
  // NAVBAR
  // ============================================================
  function initNavbar() {
    const nav = document.getElementById('icNav');
    if (!nav) return;

    // Scroll effect
    const onScroll = () => nav.classList.toggle('ic-nav--scrolled', scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll(); // run immediately

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

    // Inject XP bar when profile loads
    Events.on(EVENTS.AUTH_PROFILE_LOADED, () => {
      injectXPBar();
      document.body.classList.add('has-xp-bar');
    });

    // Remove XP bar on logout
    Events.on(EVENTS.AUTH_LOGOUT, () => {
      document.getElementById('ic-xp-bar')?.remove();
      document.body.classList.remove('has-xp-bar');
    });
  }

  function updateNavAuth() {
    const user    = Store.get('user');
    const profile = Store.get('profile');
    const btn     = document.getElementById('loginBtn');
    const lbl     = document.getElementById('loginBtnLabel');
    if (!btn) return;

    if (user && profile) {
      const lvl  = Store.computeLevel(profile.xp || 0);
      const name = profile.displayName?.split(' ')[0] || 'أنت';
      if (lbl) lbl.textContent = `${lvl.icon} ${name}`;
      else btn.innerHTML = `<span style="flex-shrink:0">${lvl.icon}</span><span>${name}</span>`;
      btn.classList.add('ic-nav__login-btn--logged');
      btn.setAttribute('aria-label', `الملف الشخصي - ${name}`);

      // Update drawer profile section
      const drawerName = document.getElementById('drawerName');
      const drawerSub  = document.getElementById('drawerSub');
      const drawerAvatar = document.getElementById('drawerAvatar');
      const drawerLogin  = document.getElementById('drawerLoginBtn');
      const drawerXP     = document.getElementById('drawerXP');
      const drawerXPFill = document.getElementById('drawerXPFill');
      const drawerXPLbl  = document.getElementById('drawerXPLbl');

      if (drawerName)   drawerName.textContent = profile.displayName || name;
      if (drawerSub)    drawerSub.textContent  = `${lvl.icon} ${lvl.name} · ${(profile.xp || 0).toLocaleString('ar')} XP`;
      if (drawerAvatar) {
        drawerAvatar.innerHTML = profile.photoURL
          ? `<img src="${profile.photoURL}" alt="${name}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`
          : `<span style="font-size:18px;font-weight:900">${name.charAt(0)}</span>`;
      }
      if (drawerLogin)  drawerLogin.textContent = 'ملفي';
      if (drawerXP)    drawerXP.style.display = '';
      if (drawerXPFill) {
        const pct = Store.computeLevelProgress(profile.xp || 0);
        drawerXPFill.style.width = pct + '%';
      }
      if (drawerXPLbl)  drawerXPLbl.textContent = (profile.xp || 0).toLocaleString('ar') + ' XP';
    } else {
      if (lbl) lbl.textContent = 'تسجيل الدخول';
      else btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.58-7 8-7s8 3 8 7"/></svg><span>تسجيل الدخول</span>`;
      btn.classList.remove('ic-nav__login-btn--logged');
      btn.setAttribute('aria-label', 'تسجيل الدخول');
    }
  }

  // ============================================================
  // MOBILE MENU / SIDE DRAWER
  // ============================================================
  function initMobileMenu() {
    const toggle  = document.getElementById('menuToggle');
    const drawer  = document.getElementById('sideDrawer');
    const overlay = document.getElementById('drawerOverlay');
    const closeBtn = document.getElementById('drawerClose');

    // Fallback: old mobile menu style
    const oldToggle = document.getElementById('mobileToggle');
    const oldMenu   = document.getElementById('mobileMenu');

    if (oldToggle && oldMenu) {
      oldToggle.addEventListener('click', () => {
        const open = oldMenu.classList.toggle('ic-nav__mobile--open');
        oldToggle.textContent = open ? '✕' : '☰';
      });
      oldMenu.querySelectorAll('a').forEach(a => {
        a.addEventListener('click', () => {
          oldMenu.classList.remove('ic-nav__mobile--open');
          oldToggle.textContent = '☰';
        });
      });
      document.addEventListener('click', e => {
        if (!oldMenu.contains(e.target) && !oldToggle.contains(e.target)) {
          oldMenu.classList.remove('ic-nav__mobile--open');
          oldToggle.textContent = '☰';
        }
      });
      return;
    }

    if (!toggle || !drawer) return;

    function openDrawer() {
      drawer.classList.add('ic-drawer--open');
      overlay?.classList.add('ic-drawer-overlay--visible');
      document.body.style.overflow = 'hidden';
      toggle.setAttribute('aria-expanded', 'true');
      drawer.querySelector('.ic-drawer__link')?.focus();
    }

    function closeDrawer() {
      drawer.classList.remove('ic-drawer--open');
      overlay?.classList.remove('ic-drawer-overlay--visible');
      document.body.style.overflow = '';
      toggle.setAttribute('aria-expanded', 'false');
      toggle.focus();
    }

    toggle.addEventListener('click', () =>
      drawer.classList.contains('ic-drawer--open') ? closeDrawer() : openDrawer()
    );

    closeBtn?.addEventListener('click', closeDrawer);
    overlay?.addEventListener('click', closeDrawer);

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && drawer.classList.contains('ic-drawer--open')) closeDrawer();
    });

    drawer.querySelectorAll('.ic-drawer__link').forEach(a => {
      a.addEventListener('click', closeDrawer);
    });

    // Mark active link in drawer
    const page = location.pathname.replace(/^\//, '').split('/')[0] || 'home';
    drawer.querySelectorAll('.ic-drawer__link').forEach(a => {
      if (a.dataset.page === page) {
        a.classList.add('active');
        a.setAttribute('aria-current', 'page');
      }
    });

    // Sync drawer theme button with main theme button
    document.getElementById('drawerThemeBtn')?.addEventListener('click', () => {
      document.getElementById('themeBtn')?.click();
    });

    // Drawer login button
    document.getElementById('drawerLoginBtn')?.addEventListener('click', () => {
      closeDrawer();
      const user = Store.get('user');
      user ? window.islamiCalc?.showUserMenu?.() : openModal();
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
      await Events.waitFor(EVENTS.AUTH_READY, 8000);
    } catch {
      console.warn('[App] Auth ready timeout — continuing as guest');
      Store.set('authReady', true);
      Store.set('user', null);
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

    const user    = ic.user;
    const profile = ic.profile;

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
