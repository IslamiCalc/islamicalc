// ============================================================
//  firebase.js — IslamiCalc Global Firebase Module
//  يُستدعى في كل صفحة عبر: <script type="module" src="/firebase.js">
// ============================================================

import { initializeApp }       from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAnalytics }        from "https://www.gstatic.com/firebasejs/10.12.0/firebase-analytics.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  increment,
  arrayUnion,
  serverTimestamp,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  where,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ============================================================
//  CONFIG
// ============================================================
const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "islamicalc-app.firebaseapp.com",
  projectId:         "islamicalc-app",
  storageBucket:     "islamicalc-app.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID",
  measurementId:     "YOUR_MEASUREMENT_ID",
};

// ============================================================
//  INIT
// ============================================================
const app       = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth      = getAuth(app);
const db        = getFirestore(app);
const provider  = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

// ============================================================
//  XP CONFIG
// ============================================================
const XP_CONFIG = {
  // Khatma
  khatma_page:        2,
  khatma_juz:        20,
  khatma_complete:  500,
  khatma_streak_7:  100,
  khatma_streak_30: 500,

  // Prayer
  prayer_view:       10,

  // Zakat
  zakat_calc:        15,

  // Athkar
  dhikr_done:         5,
  tasbih_round:      10,
  cat_done:          50,

  // Arena
  arena_answer:       5,
  arena_correct:     20,
  arena_streak_5:    50,
  arena_win:        100,

  // General
  login_bonus:       25,
  daily_visit:       10,
};

// Level thresholds
const LEVELS = [
  { min:0,    max:99,   name:'مبتدئ',      icon:'🌱', color:'#6b7280' },
  { min:100,  max:299,  name:'متعلم',      icon:'📖', color:'#3b82f6' },
  { min:300,  max:699,  name:'ملتزم',      icon:'⭐', color:'#8b5cf6' },
  { min:700,  max:1499, name:'متقن',       icon:'🌟', color:'#f59e0b' },
  { min:1500, max:2999, name:'حافظ',       icon:'💎', color:'#10b981' },
  { min:3000, max:5999, name:'عالم',       icon:'🏆', color:'#f97316' },
  { min:6000, max:Infinity, name:'إمام',   icon:'👑', color:'#fbbf24' },
];

function getLevel(xp) {
  return LEVELS.findLast(l => xp >= l.min) || LEVELS[0];
}

function getNextLevel(xp) {
  return LEVELS.find(l => xp < l.max) || LEVELS[LEVELS.length - 1];
}

// ============================================================
//  STATE
// ============================================================
let currentUser   = null;
let userProfile   = null;
let xpQueue       = [];
let xpFlushTimer  = null;
let initDone      = false;

// ============================================================
//  HELPERS
// ============================================================
function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function showToast(msg, cls = '') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className   = 'ic-toast show ' + cls;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 3500);
}

function updateNavUI(user) {
  const btn = document.getElementById('loginBtn');
  if (!btn) return;

  if (user && userProfile) {
    const lvl = getLevel(userProfile.xp || 0);
    btn.textContent = lvl.icon + ' ' + (userProfile.displayName?.split(' ')[0] || 'أنت');
    btn.classList.add('ic-nav__login-btn--logged');
  } else {
    btn.textContent = 'دخول';
    btn.classList.remove('ic-nav__login-btn--logged');
  }
}

function updateXPBar() {
  if (!userProfile) return;
  const xp   = userProfile.xp || 0;
  const lvl  = getLevel(xp);
  const next = getNextLevel(xp);
  const pct  = next.min === lvl.min
    ? 100
    : Math.min(Math.round((xp - lvl.min) / (next.min - lvl.min) * 100), 100);

  // Inject XP Bar if not present
  let bar = document.getElementById('ic-xp-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id        = 'ic-xp-bar';
    bar.className = 'ic-xp-bar';
    bar.innerHTML = `
      <div class="ic-xp-bar__inner">
        <span class="ic-xp-bar__lvl" id="xpLvlIcon">${lvl.icon}</span>
        <span class="ic-xp-bar__name" id="xpLvlName">${lvl.name}</span>
        <div class="ic-xp-bar__track">
          <div class="ic-xp-bar__fill" id="xpFill"></div>
        </div>
        <span class="ic-xp-bar__pts" id="xpPts">${xp.toLocaleString('ar')} نقطة</span>
      </div>`;

    // Inject after navbar
    const nav = document.getElementById('icNav');
    if (nav?.nextSibling) {
      nav.parentNode.insertBefore(bar, nav.nextSibling);
    }
  } else {
    document.getElementById('xpLvlIcon').textContent = lvl.icon;
    document.getElementById('xpLvlName').textContent = lvl.name;
    document.getElementById('xpPts').textContent     = xp.toLocaleString('ar') + ' نقطة';
  }

  const fill = document.getElementById('xpFill');
  if (fill) {
    setTimeout(() => {
      fill.style.width = pct + '%';
      fill.style.background = `linear-gradient(90deg, ${lvl.color}, ${next.color || lvl.color})`;
    }, 300);
  }
}

// ============================================================
//  FIRESTORE — USER PROFILE
// ============================================================
async function loadUserProfile(uid) {
  try {
    const ref  = doc(db, 'users', uid);
    const snap = await getDoc(ref);

    if (snap.exists()) {
      userProfile = snap.data();
    } else {
      // New user — create profile
      userProfile = {
        uid,
        displayName:  currentUser.displayName || 'مسلم كريم',
        email:        currentUser.email,
        photoURL:     currentUser.photoURL,
        xp:           0,
        level:        1,
        streak:       0,
        lastVisit:    todayStr(),
        createdAt:    serverTimestamp(),
        khatmaStats:  { completed:0, currentPage:1, currentJuz:1, streak:0 },
        athkarStats:  { totalDone:0, totalTasbih:0 },
        arenaStats:   { wins:0, totalGames:0, correctAnswers:0 },
        zakatCalcs:   0,
        badges:       [],
        activity:     [],
      };
      await setDoc(ref, userProfile);
      showToast('🎉 مرحباً بك في IslamiCalc! +25 نقطة', 'toast-gold');
      await addXPImmediate(25, 'login_bonus');
    }

    // Daily visit bonus
    if (userProfile.lastVisit !== todayStr()) {
      await updateDoc(ref, { lastVisit: todayStr() });
      userProfile.lastVisit = todayStr();
      await addXPImmediate(10, 'daily_visit');
      showToast('🌅 مرحباً بعودتك! +10 نقطة', 'toast-success');
    }

    updateNavUI(currentUser);
    updateXPBar();

  } catch (err) {
    console.error('[IslamiCalc] loadUserProfile error:', err);
  }
}

// ============================================================
//  XP SYSTEM
// ============================================================
async function addXPImmediate(amount, reason) {
  if (!currentUser || !amount) return;
  try {
    const ref = doc(db, 'users', currentUser.uid);
    await updateDoc(ref, {
      xp: increment(amount),
      [`xpLog.${reason}`]: increment(amount),
    });
    if (userProfile) userProfile.xp = (userProfile.xp || 0) + amount;
    updateXPBar();
    floatXP(amount);
  } catch (err) {
    console.error('[IslamiCalc] addXP error:', err);
  }
}

// Batched XP — queues up and flushes every 3 seconds (reduces writes)
function addXP(amount, reason) {
  if (!currentUser) return;
  xpQueue.push({ amount, reason });

  clearTimeout(xpFlushTimer);
  xpFlushTimer = setTimeout(flushXP, 3000);

  // Optimistic UI
  if (userProfile) {
    userProfile.xp = (userProfile.xp || 0) + amount;
    updateXPBar();
    floatXP(amount);
  }
}

async function flushXP() {
  if (!xpQueue.length || !currentUser) return;

  const batch = [...xpQueue];
  xpQueue = [];

  const total = batch.reduce((s, e) => s + e.amount, 0);
  const byReason = {};
  batch.forEach(({ amount, reason }) => {
    byReason[`xpLog.${reason}`] = (byReason[`xpLog.${reason}`] || 0) + amount;
  });

  const updates = { xp: increment(total) };
  Object.entries(byReason).forEach(([k, v]) => {
    updates[k] = increment(v);
  });

  try {
    await updateDoc(doc(db, 'users', currentUser.uid), updates);
  } catch (err) {
    console.error('[IslamiCalc] flushXP error:', err);
    // Re-queue on failure
    xpQueue = [...batch, ...xpQueue];
  }
}

// Floating XP animation
function floatXP(amount) {
  const el = document.createElement('div');
  el.className   = 'ic-xp-float';
  el.textContent = '+' + amount + ' ✨';
  el.style.cssText = `
    position:fixed;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%);
    background: linear-gradient(135deg, #8b5cf6, #fbbf24);
    color: #fff;
    padding: 6px 18px;
    border-radius: 999px;
    font-weight: 900;
    font-size: 14px;
    pointer-events: none;
    z-index: 9999;
    animation: xpFloat 1.8s ease forwards;
  `;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1900);
}

// Inject keyframe once
if (!document.getElementById('xpFloatStyle')) {
  const s = document.createElement('style');
  s.id          = 'xpFloatStyle';
  s.textContent = `
    @keyframes xpFloat {
      0%   { opacity:0; transform:translateX(-50%) translateY(0);   }
      20%  { opacity:1; transform:translateX(-50%) translateY(-8px); }
      80%  { opacity:1; transform:translateX(-50%) translateY(-30px);}
      100% { opacity:0; transform:translateX(-50%) translateY(-50px);}
    }
    .ic-xp-bar {
      position: sticky;
      top: 64px;
      z-index: 90;
      background: rgba(0,0,0,0.6);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-bottom: 1px solid rgba(255,255,255,0.05);
      padding: 6px 24px;
    }
    .ic-xp-bar__inner {
      max-width: 960px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .ic-xp-bar__lvl  { font-size: 1.1rem; }
    .ic-xp-bar__name { font-size: 12px; font-weight: 800; color: #c4b5fd; white-space:nowrap; }
    .ic-xp-bar__track {
      flex: 1;
      height: 6px;
      background: rgba(255,255,255,0.06);
      border-radius: 999px;
      overflow: hidden;
    }
    .ic-xp-bar__fill {
      height: 100%;
      border-radius: 999px;
      width: 0%;
      transition: width 0.8s cubic-bezier(0.34,1.56,0.64,1);
    }
    .ic-xp-bar__pts {
      font-size: 11px;
      font-weight: 800;
      color: #fbbf24;
      white-space: nowrap;
      font-family: 'Inter', sans-serif;
    }
  `;
  document.head.appendChild(s);
}

// ============================================================
//  ACTIVITY LOG
// ============================================================
async function logActivity(label, type, icon = '⭐', detail = '', xp = 0) {
  if (!currentUser) return;
  try {
    const entry = {
      label,
      type,
      icon,
      detail,
      xp,
      timestamp: serverTimestamp(),
      date:      todayStr(),
    };
    const ref = doc(db, 'users', currentUser.uid);
    await updateDoc(ref, {
      activity: arrayUnion(entry),
    });
  } catch (err) {
    console.error('[IslamiCalc] logActivity error:', err);
  }
}

// ============================================================
//  KHATMA SYNC
// ============================================================
async function syncKhatma(data) {
  if (!currentUser) return;
  try {
    await updateDoc(doc(db, 'users', currentUser.uid), {
      'khatmaStats.currentPage':  data.page  || 1,
      'khatmaStats.currentJuz':   data.juz   || 1,
      'khatmaStats.streak':       data.streak || 0,
      'khatmaStats.lastRead':     todayStr(),
      'khatmaStats.completed':    data.completed || 0,
    });
  } catch (err) {
    console.error('[IslamiCalc] syncKhatma error:', err);
  }
}

async function loadKhatma() {
  if (!currentUser || !userProfile) return null;
  return userProfile.khatmaStats || null;
}

// ============================================================
//  LEADERBOARD
// ============================================================
async function getLeaderboard(limitN = 10) {
  try {
    const q    = query(collection(db, 'users'), orderBy('xp', 'desc'), limit(limitN));
    const snap = await getDocs(q);
    return snap.docs.map((d, i) => ({ rank: i + 1, ...d.data() }));
  } catch (err) {
    console.error('[IslamiCalc] getLeaderboard error:', err);
    return [];
  }
}

// ============================================================
//  BADGES
// ============================================================
const BADGE_RULES = [
  { id:'first_login',   label:'أول خطوة',     icon:'🌱', condition: u => u.xp >= 25 },
  { id:'xp_100',        label:'مئة نقطة',      icon:'💯', condition: u => u.xp >= 100 },
  { id:'xp_500',        label:'خمسمئة نقطة',   icon:'⭐', condition: u => u.xp >= 500 },
  { id:'xp_1000',       label:'ألف نقطة',      icon:'🌟', condition: u => u.xp >= 1000 },
  { id:'khatma_1',      label:'ختمة أولى',     icon:'📖', condition: u => u.khatmaStats?.completed >= 1 },
  { id:'khatma_3',      label:'ثلاث ختمات',    icon:'📚', condition: u => u.khatmaStats?.completed >= 3 },
  { id:'streak_7',      label:'أسبوع متواصل',  icon:'🔥', condition: u => u.khatmaStats?.streak >= 7 },
  { id:'streak_30',     label:'شهر متواصل',    icon:'🏆', condition: u => u.khatmaStats?.streak >= 30 },
  { id:'tasbih_1000',   label:'ألف تسبيحة',   icon:'📿', condition: u => u.athkarStats?.totalTasbih >= 1000 },
  { id:'arena_win_10',  label:'عشر انتصارات',  icon:'🥇', condition: u => u.arenaStats?.wins >= 10 },
];

async function checkBadges() {
  if (!currentUser || !userProfile) return;
  const earned = userProfile.badges || [];
  const newBadges = BADGE_RULES.filter(
    b => !earned.includes(b.id) && b.condition(userProfile)
  );
  if (!newBadges.length) return;

  const ids = newBadges.map(b => b.id);
  try {
    await updateDoc(doc(db, 'users', currentUser.uid), {
      badges: arrayUnion(...ids),
    });
    userProfile.badges = [...earned, ...ids];
    newBadges.forEach(b => {
      setTimeout(() => showToast(`🏅 شارة جديدة: ${b.icon} ${b.label}!`, 'toast-gold'), 500);
    });
  } catch (err) {
    console.error('[IslamiCalc] checkBadges error:', err);
  }
}

// ============================================================
//  AUTH FLOWS
// ============================================================
async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, provider);
    currentUser  = result.user;
    await loadUserProfile(currentUser.uid);
    document.getElementById('loginModal')?.classList.remove('ic-modal--open');
    showToast('👋 أهلاً ' + (currentUser.displayName?.split(' ')[0] || ''), 'toast-success');
  } catch (err) {
    if (err.code !== 'auth/popup-closed-by-user') {
      console.error('[IslamiCalc] loginWithGoogle error:', err);
      showToast('❌ فشل تسجيل الدخول — حاول مجدداً', 'toast-error');
    }
  }
}

async function logout() {
  try {
    await flushXP(); // flush pending XP before logout
    await signOut(auth);
    currentUser  = null;
    userProfile  = null;
    updateNavUI(null);
    document.getElementById('ic-xp-bar')?.remove();
    showToast('👋 تم تسجيل الخروج', '');
  } catch (err) {
    console.error('[IslamiCalc] logout error:', err);
  }
}

function showUserMenu() {
  if (!currentUser || !userProfile) return;
  const xp  = userProfile.xp || 0;
  const lvl = getLevel(xp);
  const badges = (userProfile.badges || []).slice(-3);

  // Simple inline menu — could be replaced with a proper modal
  const msg = [
    lvl.icon + ' ' + lvl.name,
    '✨ ' + xp.toLocaleString('ar') + ' نقطة',
    badges.length ? '🏅 ' + badges.join(' ') : '',
    '\n— تسجيل الخروج —',
  ].filter(Boolean).join('\n');

  if (confirm(msg)) logout();
}

// ============================================================
//  AUTH STATE LISTENER
// ============================================================
onAuthStateChanged(auth, async user => {
  if (user) {
    currentUser = user;
    await loadUserProfile(user.uid);
    await checkBadges();
  } else {
    currentUser = null;
    userProfile = null;
    updateNavUI(null);
  }

  // Signal ready
  initDone = true;
  window.islamiCalc = islamiCalc;
  window.dispatchEvent(new Event('islamiCalcReady'));
});

// ============================================================
//  PUBLIC API
// ============================================================
const islamiCalc = {
  // Auth
  loginWithGoogle,
  logout,
  showUserMenu,
  getCurrentUser:  () => currentUser,
  getUserProfile:  () => userProfile,

  // XP
  addXP,
  addXPImmediate,
  getLevel:        (xp) => getLevel(xp ?? userProfile?.xp ?? 0),
  getNextLevel:    (xp) => getNextLevel(xp ?? userProfile?.xp ?? 0),
  XP_CONFIG,
  LEVELS,

  // Firestore
  logActivity,
  syncKhatma,
  loadKhatma,
  getLeaderboard,
  checkBadges,

  // Utils
  db,
  auth,
  todayStr,
  isReady: () => initDone,
};

// Make globally accessible immediately (before auth resolves)
window.islamiCalc = islamiCalc;
window.dispatchEvent(new Event('islamiCalcReady'));

export default islamiCalc;
export {
  auth,
  db,
  addXP,
  logActivity,
  syncKhatma,
  loadKhatma,
  getLeaderboard,
  getLevel,
  getNextLevel,
  LEVELS,
  XP_CONFIG,
};
