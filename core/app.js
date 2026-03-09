/* ============================================================
   app.js — IslamiCalc Application Controller v4.0
   ✅ XP Bar يظهر في صفحة الميدان فقط
   ✅ الصفحات الروحانية نظيفة وبدون تشتيت
   ============================================================ */

import Store  from './store.js';
import Events from './events.js';
import { EVENTS } from './events.js';

// الصفحات الروحانية — لا XP bar فيها
const SPIRITUAL_PAGES = ['khatma','prayer','athkar','zakat','hijri','fasting','kafara','sadaqa','asma','fiqh','names','prophets','seerah','articles'];

const App = (() => {

  // ============================================================
  // INIT SEQUENCE
  // ============================================================
  async function init() {
    initTheme();
    initNavbar();
    initMobileMenu();
    initModal();
    initToast();
    initNetworkDetection();
    await initFirebase();
    initPageTracking();
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
    if (btn) {
      const sunSVG  = `<svg class="ic-nav__icon-btn-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
      const moonSVG = `<svg class="ic-nav__icon-btn-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"/></svg>`;
      btn.innerHTML = theme === 'dark' ? moonSVG : sunSVG;
      btn.setAttribute('aria-label', theme === 'dark' ? 'تفعيل الوضع النهاري' : 'تفعيل الوضع الليلي');
    }
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

    const onScroll = () => nav.classList.toggle('ic-nav--scrolled', scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    const current = '/' + getCurrentPage();
    nav.querySelectorAll('.ic-nav__link').forEach(link => {
      const href = link.getAttribute('href');
      if (href === current || (href !== '/' && current.startsWith(href))) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    Store.subscribe('profile', updateNavAuth);
    Store.subscribe('user',    updateNavAuth);

    // XP bar: فقط في صفحة الميدان
    Events.on(EVENTS.AUTH_PROFILE_LOADED, () => {
      if (getCurrentPage() === 'arena') {
        injectXPBar();
        document.body.classList.add('has-xp-bar');
      }
    });

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
      // في صفحة الميدان → اعرض المستوى
      // في باقي الصفحات → اسم المستخدم فقط بدون XP
      const isArena  = getCurrentPage() === 'arena';
      const lvl      = Store.computeLevel(profile.arenaXP || 0);
      const name     = profile.displayName?.split(' ')[0] || 'أنت';

      if (lbl) {
        lbl.textContent = isArena ? `${lvl.icon} ${name}` : name;
      }
      btn.classList.add('ic-nav__login-btn--logged');
      btn.setAttribute('aria-label', `الملف الشخصي - ${name}`);

      const drawerName   = document.getElementById('drawerName');
      const drawerSub    = document.getElementById('drawerSub');
      const drawerAvatar = document.getElementById('drawerAvatar');
      const drawerLogin  = document.getElementById('drawerLoginBtn');
      const drawerXP     = document.getElementById('drawerXP');
      const drawerXPFill = document.getElementById('drawerXPFill');
      const drawerXPLbl  = document.getElementById('drawerXPLbl');

      if (drawerName) drawerName.textContent = profile.displayName || name;

      // في الدراور: إظهار نقاط الميدان فقط في صفحة الميدان
      if (drawerSub) {
        drawerSub.textContent = isArena
          ? `${lvl.icon} ${lvl.name} · ${(profile.arenaXP || 0).toLocaleString('ar')} نقطة`
          : 'مسجل دخول';
      }
      if (drawerAvatar) {
        drawerAvatar.innerHTML = profile.photoURL
          ? `<img src="${profile.photoURL}" alt="${name}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`
          : `<span style="font-size:18px;font-weight:900">${name.charAt(0)}</span>`;
      }
      if (drawerLogin)  drawerLogin.textContent = 'ملفي';

      // XP bar في الدراور: فقط في الميدان
      if (drawerXP) drawerXP.style.display = isArena ? '' : 'none';
      if (isArena && drawerXPFill) {
        const pct = Store.computeLevelProgress(profile.arenaXP || 0);
        drawerXPFill.style.width = pct + '%';
      }
      if (isArena && drawerXPLbl) {
        drawerXPLbl.textContent = (profile.arenaXP || 0).toLocaleString('ar') + ' نقطة ميدان';
      }
    } else {
      if (lbl) lbl.textContent = 'تسجيل الدخول';
      btn.classList.remove('ic-nav__login-btn--logged');
      btn.setAttribute('aria-label', 'تسجيل الدخول');
    }
  }

  // ============================================================
  // MOBILE MENU / SIDE DRAWER
  // ============================================================
  function initMobileMenu() {
    const toggle   = document.getElementById('menuToggle');
    const drawer   = document.getElementById('sideDrawer');
    const overlay  = document.getElementById('drawerOverlay');
    const closeBtn = document.getElementById('drawerClose');

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

    const page = location.pathname.replace(/^\//, '').split('/')[0] || 'home';
    drawer.querySelectorAll('.ic-drawer__link').forEach(a => {
      if (a.dataset.page === page) {
        a.classList.add('active');
        a.setAttribute('aria-current', 'page');
      }
    });

    document.getElementById('drawerThemeBtn')?.addEventListener('click', () => {
      document.getElementById('themeBtn')?.click();
    });
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
    const modal     = document.getElementById('loginModal');
    const backdrop  = document.getElementById('modalBackdrop');
    const loginBtn  = document.getElementById('loginBtn');
    const guestBtn  = document.getElementById('guestBrowseBtn');
    const googleBtn = document.getElementById('googleLoginBtn');

    if (!modal) return;

    loginBtn?.addEventListener('click', () => {
      Store.get('user') ? window.islamiCalc?.showUserMenu?.() : openModal();
    });

    backdrop?.addEventListener('click',  closeModal);
    guestBtn?.addEventListener('click',  closeModal);
    googleBtn?.addEventListener('click', () => window.islamiCalc?.loginWithGoogle?.());

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeModal();
    });

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
    if (!document.getElementById('toast')) {
      const el = document.createElement('div');
      el.id        = 'toast';
      el.className = 'ic-toast';
      document.body.appendChild(el);
    }
    Events.on(EVENTS.UI_TOAST, ({ message, type = '' }) => showToast(message, type));
    window.showToast = showToast;
  }

  let _toastTimer = null;
  function showToast(message, type = '') {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = message;
    el.className   = `ic-toast show ${type ? 'toast-' + type : ''}`;
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => el.classList.remove('show'), 3500);
  }

  // ============================================================
  // NETWORK
  // ============================================================
  function initNetworkDetection() {
    Events.on(EVENTS.NET_ONLINE,  () => showToast('✅ عاد الاتصال بالإنترنت', 'success'));
    Events.on(EVENTS.NET_OFFLINE, () => showToast('⚠️ لا يوجد اتصال بالإنترنت', 'error'));
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
    Store.set('currentPage', getCurrentPage());
  }

  // ============================================================
  // XP BAR — فقط في صفحة الميدان
  // ============================================================
  function injectXPBar() {
    const user = Store.get('user');
    if (!user || getCurrentPage() !== 'arena') return;

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
      document.getElementById('icNav')?.insertAdjacentElement('afterend', bar);
    }

    updateXPBar();
    Store.subscribe('arenaXP', updateXPBar);
  }

  function updateXPBar() {
    if (getCurrentPage() !== 'arena') return;
    const xp   = Store.get('profile')?.arenaXP || Store.get('arenaXP') || 0;
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
  // HELPERS
  // ============================================================
  function getCurrentPage() {
    return window.location.pathname.split('/').filter(Boolean)[0] || 'home';
  }

  // ============================================================
  // AUTH STATE LISTENER
  // ============================================================
  window.addEventListener('islamiCalcReady', () => {
    const ic = window.islamiCalc;
    if (!ic) return;

    if (ic.user)    Store.set('user', ic.user);
    if (ic.profile) {
      Store.set('profile', ic.profile);
      Store.set('arenaXP', ic.profile.arenaXP || 0);
      // XP bar فقط في الميدان
      if (getCurrentPage() === 'arena') injectXPBar();
    }

    Store.set('authReady', true);
    Events.emit(EVENTS.AUTH_READY, { user: ic.user, profile: ic.profile });
    if (ic.user) Events.emit(EVENTS.AUTH_LOGIN, { user: ic.user, profile: ic.profile });
  });

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
// AUTO INIT
// ============================================================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', App.init);
} else {
  App.init();
}

export default App;
export { Store, Events };
window.IC = { App, Store, Events };
