const ROUTES = [
  { href: '/', page: 'home', label: 'الرئيسية', desc: 'لوحة المنصة والبدايات السريعة', keywords: ['home', 'dashboard', 'الرئيسية', 'منصة', 'لوحة'] },
  { href: '/khatma', page: 'khatma', label: 'القرآن', desc: 'الختمة، الغرف العائلية، والمتابعة', keywords: ['قرآن', 'مصحف', 'ختمة', 'quran', 'khatma', 'juz', 'surah', 'bookmark'] },
  { href: '/prayer', page: 'prayer', label: 'مواقيت الصلاة', desc: 'الصلاة، القبلة، والعداد المباشر', keywords: ['صلاة', 'مواقيت', 'قبلة', 'prayer', 'qibla', 'adhan'] },
  { href: '/athkar', page: 'athkar', label: 'الأذكار', desc: 'الأذكار اليومية والتسبيح', keywords: ['أذكار', 'دعاء', 'تسبيح', 'athkar', 'dua', 'dhikr'] },
  { href: '/zakat', page: 'zakat', label: 'الأدوات الإسلامية', desc: 'الزكاة، الميراث، التاريخ، الصيام، والصدقة', keywords: ['أدوات', 'زكاة', 'ميراث', 'تاريخ', 'صيام', 'صدقة', 'tools', 'calculator'] },
  { href: '/arena', page: 'arena', label: 'الميدان', desc: 'اختبارات، تحديات، وترتيب تنافسي', keywords: ['ميدان', 'arena', 'quiz', 'xp', 'challenge'] },
  { href: '/prophets', page: 'prophets', label: 'القصص', desc: 'قصص الأنبياء والسيرة', keywords: ['قصص', 'أنبياء', 'سيرة', 'stories', 'prophets', 'seerah'] },
  { href: '/articles', page: 'articles', label: 'المقالات', desc: 'مقالات ومعرفة إسلامية', keywords: ['مقالات', 'معرفة', 'articles', 'blog'] },
  { href: '/profile', page: 'profile', label: 'الملف الشخصي', desc: 'الملف، الإنجاز، والتقدم', keywords: ['ملف', 'حساب', 'profile', 'account'] },
  { href: '/hijri', page: 'hijri', label: 'التحويل الهجري', desc: 'التحويل بين الهجري والميلادي', keywords: ['هجري', 'ميلادي', 'calendar', 'date'] },
  { href: '/inheritance', page: 'inheritance', label: 'الميراث', desc: 'حساب الأنصبة التعليمية', keywords: ['ميراث', 'فرائض', 'inheritance'] },
  { href: '/fasting', page: 'fasting', label: 'الصيام', desc: 'متابعة الصيام وخطط رمضان', keywords: ['صيام', 'رمضان', 'fasting', 'ramadan'] },
  { href: '/fiqh', page: 'fiqh', label: 'الفقه', desc: 'أساسيات وأجوبة معرفية', keywords: ['فقه', 'فتاوى', 'fiqh', 'questions'] },
  { href: '/asma', page: 'asma', label: 'أسماء الله الحسنى', desc: 'الأسماء الحسنى ومعانيها', keywords: ['أسماء الله', 'asma', 'husna'] },
  { href: '/seerah', page: 'seerah', label: 'السيرة النبوية', desc: 'محطات ودروس من السيرة', keywords: ['سيرة', 'نبوية', 'seerah'] },
  { href: '/ramadan', page: 'ramadan', label: 'رمضان', desc: 'دليل وأدوات رمضان', keywords: ['رمضان', 'ramadan', 'tracker'] },
];

const DESKTOP_LINKS = [
  { type: 'link', href: '/khatma', page: 'khatma', label: 'القرآن' },
  { type: 'link', href: '/prayer', page: 'prayer', label: 'الصلاة' },
  { type: 'link', href: '/athkar', page: 'athkar', label: 'الأذكار' },
  {
    type: 'dropdown',
    label: 'الأدوات',
    pages: ['zakat', 'inheritance', 'hijri', 'age', 'fasting', 'kafara', 'sadaqa', 'ramadan'],
    items: [
      { href: '/zakat', label: 'حاسبة الزكاة' },
      { href: '/inheritance', label: 'الميراث' },
      { href: '/hijri', label: 'التحويل الهجري' },
      { href: '/age', label: 'حساب العمر' },
      { href: '/fasting', label: 'حساب الصيام' },
      { href: '/kafara', label: 'الكفارة' },
      { href: '/sadaqa', label: 'الصدقة' },
      { href: '/ramadan', label: 'دليل رمضان' },
    ],
  },
  { type: 'link', href: '/arena', page: 'arena', label: 'الميدان' },
  {
    type: 'dropdown',
    label: 'القصص',
    pages: ['prophets', 'seerah', 'asma', 'names'],
    items: [
      { href: '/prophets', label: 'قصص الأنبياء' },
      { href: '/seerah', label: 'السيرة النبوية' },
      { href: '/asma', label: 'أسماء الله الحسنى' },
      { href: '/names', label: 'الأسماء الإسلامية' },
    ],
  },
  { type: 'link', href: '/articles', page: 'articles', label: 'المقالات' },
];

const BOTTOM_NAV = [
  { href: '/', page: 'home', label: 'الرئيسية', icon: '⌂' },
  { href: '/khatma', page: 'khatma', label: 'القرآن', icon: '📖' },
  { href: '/prayer', page: 'prayer', label: 'الصلاة', icon: '🕌' },
  { href: '/arena', page: 'arena', label: 'الميدان', icon: '⚔️' },
  { href: '/prophets', page: 'prophets', label: 'القصص', icon: '📚' },
  { href: '/profile', page: 'profile', label: 'حسابي', icon: '👤' },
];

function getCurrentPage() {
  return window.location.pathname.replace(/^\/+|\/+$/g, '').split('/')[0] || 'home';
}

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u064b-\u065f\u0670]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeHTML(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function scoreRoute(item, query) {
  const q = normalize(query);
  if (!q) return 0;
  const haystack = normalize([item.label, item.desc, ...(item.keywords || [])].join(' '));
  if (haystack === q) return 120;
  if (normalize(item.label).startsWith(q)) return 100;
  if (haystack.includes(q)) return 80;
  return 0;
}

function getSearchResults(query) {
  if (!query.trim()) return ROUTES.slice(0, 8);
  return ROUTES
    .map(item => ({ item, score: scoreRoute(item, query) }))
    .filter(entry => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .map(entry => entry.item)
    .slice(0, 8);
}

function navigateTo(href) {
  window.location.href = href;
}

function buildSearchResults(items) {
  if (!items.length) {
    return '<div class="ic-search-results__empty">لا توجد نتائج مطابقة. جرّب كلمات مثل: قرآن، صلاة، أذكار، زكاة.</div>';
  }
  return items.map(item => `
    <button class="ic-search-results__item" type="button" data-href="${escapeHTML(item.href)}">
      <span class="ic-search-results__title">${escapeHTML(item.label)}</span>
      <span class="ic-search-results__desc">${escapeHTML(item.desc)}</span>
    </button>
  `).join('');
}

function createDesktopLinksMarkup(currentPage) {
  return DESKTOP_LINKS.map(entry => {
    if (entry.type === 'link') {
      const active = entry.page === currentPage ? ' active' : '';
      return `<a class="ic-nav__link${active}" href="${entry.href}">${entry.label}</a>`;
    }
    const active = entry.pages.includes(currentPage) ? ' active' : '';
    const items = entry.items.map(item => `<a href="${item.href}">${item.label}</a>`).join('');
    return `
      <div class="ic-nav__dropdown${active}">
        <button class="ic-nav__link${active}" type="button" aria-expanded="false">
          <span>${entry.label}</span>
          <span class="ic-nav__chevron">⌄</span>
        </button>
        <div class="ic-nav__dropdown-panel" role="menu">${items}</div>
      </div>
    `;
  }).join('');
}

function enhanceIcNav() {
  const nav = document.getElementById('icNav');
  if (!nav) return;
  const inner = nav.querySelector('.ic-nav__inner');
  const spacer = inner?.querySelector('.ic-nav__spacer');
  const actions = inner?.querySelector('.ic-nav__actions');
  if (!inner || !spacer || !actions) return;

  if (!inner.querySelector('.ic-nav__links')) {
    const desktopNav = document.createElement('nav');
    desktopNav.className = 'ic-nav__links';
    desktopNav.setAttribute('aria-label', 'روابط سريعة');
    desktopNav.innerHTML = createDesktopLinksMarkup(getCurrentPage());
    inner.insertBefore(desktopNav, spacer.nextSibling);
  }

  if (!inner.querySelector('.ic-nav__search-shell')) {
    const searchShell = document.createElement('div');
    searchShell.className = 'ic-nav__search-shell';
    searchShell.innerHTML = `
      <button class="ic-nav__search-trigger" type="button" data-ic-search-open aria-label="ابحث في المنصة">
        <span class="ic-nav__search-trigger-icon">⌕</span>
        <span class="ic-nav__search-trigger-text">ابحث في القرآن، الأدوات، المقالات...</span>
        <span class="ic-nav__search-trigger-kbd">/</span>
      </button>
    `;
    inner.insertBefore(searchShell, actions);
  }

  if (!actions.querySelector('[data-ic-search-open]')) {
    const mobileSearch = document.createElement('button');
    mobileSearch.type = 'button';
    mobileSearch.className = 'ic-nav__icon-btn ic-nav__search-icon-btn';
    mobileSearch.setAttribute('data-ic-search-open', '');
    mobileSearch.setAttribute('aria-label', 'فتح البحث');
    mobileSearch.innerHTML = '<span aria-hidden="true">⌕</span>';
    actions.insertBefore(mobileSearch, actions.firstChild);
  }

  bindDesktopDropdowns(nav);
}

function bindDesktopDropdowns(nav) {
  nav.querySelectorAll('.ic-nav__dropdown').forEach(dropdown => {
    const button = dropdown.querySelector('.ic-nav__link');
    const panel = dropdown.querySelector('.ic-nav__dropdown-panel');
    if (!button || !panel || dropdown.dataset.bound === 'true') return;
    dropdown.dataset.bound = 'true';
    const open = () => {
      panel.classList.add('open');
      button.setAttribute('aria-expanded', 'true');
    };
    const close = () => {
      panel.classList.remove('open');
      button.setAttribute('aria-expanded', 'false');
    };
    button.addEventListener('click', event => {
      event.preventDefault();
      const isOpen = panel.classList.contains('open');
      nav.querySelectorAll('.ic-nav__dropdown-panel.open').forEach(other => other.classList.remove('open'));
      nav.querySelectorAll('.ic-nav__dropdown .ic-nav__link[aria-expanded="true"]').forEach(other => other.setAttribute('aria-expanded', 'false'));
      if (!isOpen) open();
    });
    dropdown.addEventListener('mouseenter', () => {
      if (window.innerWidth > 980) open();
    });
    dropdown.addEventListener('mouseleave', () => {
      if (window.innerWidth > 980) close();
    });
    document.addEventListener('click', event => {
      if (!dropdown.contains(event.target)) close();
    });
  });
}

function enhanceLegacyNavbar() {
  const nav = document.querySelector('.navbar');
  if (!nav) return;
  nav.classList.add('navbar--immersive');
  const actions = nav.querySelector('.navbar-actions');
  if (actions && !actions.querySelector('[data-ic-search-open]')) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'theme-btn ic-nav__search-icon-btn';
    button.setAttribute('data-ic-search-open', '');
    button.setAttribute('aria-label', 'فتح البحث');
    button.textContent = '⌕';
    actions.insertBefore(button, actions.firstChild);
  }

  const currentPage = getCurrentPage();
  nav.querySelectorAll('.navbar-menu a').forEach(link => {
    const href = link.getAttribute('href') || '';
    const normalized = href.replace(/^\/+|\/+$/g, '').split('/')[0] || 'home';
    if (normalized === currentPage) link.classList.add('active');
  });
}

function ensureSearchOverlay() {
  if (document.getElementById('icSearchOverlay')) return;
  const overlay = document.createElement('div');
  overlay.id = 'icSearchOverlay';
  overlay.className = 'ic-search-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML = `
    <button class="ic-search-overlay__backdrop" type="button" data-ic-search-close aria-label="إغلاق البحث"></button>
    <div class="ic-search-overlay__panel" role="dialog" aria-modal="true" aria-label="البحث في المنصة">
      <div class="ic-search-overlay__head">
        <div class="ic-search-overlay__field">
          <span class="ic-search-overlay__field-icon">⌕</span>
          <input id="icSearchInput" class="ic-search-overlay__input" type="search" autocomplete="off" placeholder="ابحث عن القرآن، الصلاة، الأدوات، المقالات..." />
        </div>
        <button class="ic-search-overlay__close" type="button" data-ic-search-close aria-label="إغلاق">✕</button>
      </div>
      <div class="ic-search-overlay__results" id="icSearchResults"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  const input = overlay.querySelector('#icSearchInput');
  const results = overlay.querySelector('#icSearchResults');
  const render = query => {
    results.innerHTML = buildSearchResults(getSearchResults(query));
    results.querySelectorAll('[data-href]').forEach(button => {
      button.addEventListener('click', () => navigateTo(button.dataset.href));
    });
  };
  render('');

  input.addEventListener('input', () => render(input.value));
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      const first = getSearchResults(input.value)[0];
      if (first) navigateTo(first.href);
    }
  });

  overlay.querySelectorAll('[data-ic-search-close]').forEach(button => {
    button.addEventListener('click', closeSearchOverlay);
  });

  document.querySelectorAll('[data-ic-search-open]').forEach(button => {
    button.addEventListener('click', openSearchOverlay);
  });

  document.addEventListener('keydown', event => {
    if (event.key === '/' && !/input|textarea/i.test(document.activeElement?.tagName || '')) {
      event.preventDefault();
      openSearchOverlay();
    }
    if (event.key === 'Escape') closeSearchOverlay();
  });
}

function openSearchOverlay() {
  const overlay = document.getElementById('icSearchOverlay');
  if (!overlay) return;
  overlay.classList.add('is-open');
  overlay.setAttribute('aria-hidden', 'false');
  document.body.classList.add('ic-search-open');
  const input = overlay.querySelector('#icSearchInput');
  window.setTimeout(() => input?.focus(), 40);
}

function closeSearchOverlay() {
  const overlay = document.getElementById('icSearchOverlay');
  if (!overlay) return;
  overlay.classList.remove('is-open');
  overlay.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('ic-search-open');
}

function injectBottomNav() {
  if (document.querySelector('.ic-bottom-nav')) return;
  const nav = document.createElement('nav');
  nav.className = 'ic-bottom-nav';
  nav.setAttribute('aria-label', 'التنقل السريع');
  const currentPage = getCurrentPage();
  nav.innerHTML = BOTTOM_NAV.map(item => {
    const active = item.page === currentPage ? ' active' : '';
    return `
      <a class="ic-bottom-nav__link${active}" href="${item.href}">
        <span class="ic-bottom-nav__icon" aria-hidden="true">${item.icon}</span>
        <span class="ic-bottom-nav__label">${item.label}</span>
      </a>
    `;
  }).join('');
  document.body.appendChild(nav);
}

function initReveal() {
  const selectors = [
    '.ic-section', '.ic-card', '.ic-tool-card', '.ic-feature-card', '.card', '.rd-card',
    '.story-card', '.article-card', '.asma-card', '.pr-card', '.ar-mode', '.ar-panel',
    '.kh-card', '.profile-card', '.calc-card', '.tool-card', '.feature-card'
  ];
  const nodes = document.querySelectorAll(selectors.join(','));
  if (!nodes.length || !('IntersectionObserver' in window)) return;
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.14, rootMargin: '0px 0px -8% 0px' });

  nodes.forEach((node, index) => {
    if (node.classList.contains('ic-nav') || node.classList.contains('ic-bottom-nav')) return;
    node.classList.add('ic-reveal');
    node.style.setProperty('--ic-reveal-delay', `${Math.min(index % 6, 5) * 55}ms`);
    observer.observe(node);
  });
}

function initCountUp() {
  const nodes = document.querySelectorAll('.ic-stats-bar__num');
  if (!nodes.length || !('IntersectionObserver' in window)) return;
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting || entry.target.dataset.counted === 'true') return;
      entry.target.dataset.counted = 'true';
      animateCounter(entry.target);
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.5 });
  nodes.forEach(node => observer.observe(node));
}

function animateCounter(node) {
  const raw = node.textContent.trim();
  const match = raw.match(/^(\+?)(\d+(?:\.\d+)?)([A-Za-z]*)$/);
  if (!match) return;
  const prefix = match[1] || '';
  const numeric = Number(match[2]);
  const suffix = match[3] || '';
  const duration = 1200;
  const start = performance.now();
  const formatter = value => {
    const rounded = suffix ? value.toFixed(1).replace(/\.0$/, '') : Math.round(value).toString();
    return `${prefix}${rounded}${suffix}`;
  };
  const tick = now => {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    node.textContent = formatter(numeric * eased);
    if (progress < 1) requestAnimationFrame(tick);
    else node.textContent = raw;
  };
  requestAnimationFrame(tick);
}

function initShellState() {
  document.body.classList.add('ic-shell-enhanced');
  document.body.dataset.page = getCurrentPage();
  window.requestAnimationFrame(() => document.body.classList.add('ic-shell-visible'));
}

function init() {
  initShellState();
  enhanceIcNav();
  enhanceLegacyNavbar();
  ensureSearchOverlay();
  injectBottomNav();
  initReveal();
  initCountUp();
}

if (!window.__icSiteShellInit) {
  window.__icSiteShellInit = true;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
}
