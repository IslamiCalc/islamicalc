/* ============================================================
   firebase.js — IslamiCalc Firebase Module v3.0
   متكامل مع Store + Events
   ============================================================ */

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
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import Store  from '/core/store.js';
import Events from '/core/events.js';
import { EVENTS } from '/core/events.js';

// ============================================================
// CONFIG
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
// INIT — مرة واحدة فقط في المشروع كله
// ============================================================
const app      = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth     = getAuth(app);
const db       = getFirestore(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

// ============================================================
// XP CONFIG
// ============================================================
const XP_CONFIG = {
  khatma_page:        2,
  khatma_juz:        20,
  khatma_complete:  500,
  khatma_streak_7:  100,
  khatma_streak_30: 500,
  prayer_view:       10,
  zakat_calc:        15,
  dhikr_done:         5,
  tasbih_round:      10,
  cat_done:          50,
  arena_answer:       5,
  arena_correct:     20,
  arena_streak_5:    50,
  arena_win:        100,
  login_bonus:       25,
  daily_visit:       10,
};

const BADGE_RULES = [
  { id:'first_login',  label:'أول خطوة',    icon:'🌱', condition: p => p.xp >= 25            },
  { id:'xp_100',       label:'مئة نقطة',    icon:'💯', condition: p => p.xp >= 100           },
  { id:'xp_500',       label:'خمسمئة نقطة', icon:'⭐', condition: p => p.xp >= 500           },
  { id:'xp_1000',      label:'ألف نقطة',    icon:'🌟', condition: p => p.xp >= 1000          },
  { id:'khatma_1',     label:'ختمة أولى',   icon:'📖', condition: p => p.khatmaStats?.completed >= 1  },
  { id:'khatma_3',     label:'ثلاث ختمات',  icon:'📚', condition: p => p.khatmaStats?.completed >= 3  },
  { id:'streak_7',     label:'أسبوع متواصل',icon:'🔥', condition: p => p.khatmaStats?.streak >= 7     },
  { id:'streak_30',    label:'شهر متواصل',  icon:'🏆', condition: p => p.khatmaStats?.streak >= 30    },
  { id:'tasbih_1000',  label:'ألف تسبيحة',  icon:'📿', condition: p => p.athkarStats?.totalTasbih >= 1000 },
  { id:'arena_win_10', label:'عشر انتصارات',icon:'🥇', condition: p => p.arenaStats?.wins >= 10        },
];

// ============================================================
// STATE
// ============================================================
let _currentUser  = null;
let _userProfile  = null;
let _xpQueue      = [];
let _xpFlushTimer = null;

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

// ============================================================
// USER PROFILE
// ============================================================
async function loadUserProfile(uid) {
  try {
    const ref  = doc(db, 'users', uid);
    const snap = await getDoc(ref);

    if (snap.exists()) {
      _userProfile = snap.data();
    } else {
      _userProfile = {
        uid,
        displayName:  _currentUser.displayName || 'مسلم كريم',
        email:        _currentUser.email,
        photoURL:     _currentUser.photoURL,
        xp:           0,
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
      await setDoc(ref, _userProfile);
      Events.emit(EVENTS.UI_TOAST, { message:'🎉 مرحباً بك في IslamiCalc! +25 نقطة', type:'gold' });
      await _addXPImmediate(25, 'login_bonus');
    }

    // Daily visit bonus
    if (_userProfile.lastVisit !== todayStr()) {
      await updateDoc(ref, { lastVisit: todayStr() });
      _userProfile.lastVisit = todayStr();
      await _addXPImmediate(10, 'daily_visit');
      Events.emit(EVENTS.UI_TOAST, { message:'🌅 مرحباً بعودتك! +10 نقطة', type:'success' });
    }

    // Sync to Store
    Store.patch({
      user:    _currentUser,
      profile: _userProfile,
      xp:      _userProfile.xp || 0,
    });

    // Check badges
    await checkBadges();

    Events.emit(EVENTS.AUTH_PROFILE_LOADED, {
      user:    _currentUser,
      profile: _userProfile,
    });

  } catch (err) {
    console.error('[Firebase] loadUserProfile error:', err);
  }
}

// ============================================================
// XP SYSTEM
// ============================================================
async function _addXPImmediate(amount, reason) {
  if (!_currentUser || !amount) return;
  try {
    await updateDoc(doc(db, 'users', _currentUser.uid), {
      xp: increment(amount),
      [`xpLog.${reason}`]: increment(amount),
    });

    if (_userProfile) _userProfile.xp = (_userProfile.xp || 0) + amount;

    // Sync to Store → XP Bar updates automatically
    Store.set('xp', _userProfile?.xp || 0);
    if (_userProfile) Store.set('profile', { ..._userProfile });

    _floatXP(amount);

    // Check level up
    _checkLevelUp(amount);

  } catch (err) {
    console.error('[Firebase] addXPImmediate error:', err);
  }
}

function addXP(amount, reason) {
  if (!_currentUser || !amount) return;

  _xpQueue.push({ amount, reason });

  // Optimistic UI
  if (_userProfile) {
    _userProfile.xp = (_userProfile.xp || 0) + amount;
    Store.set('xp', _userProfile.xp);
    Store.set('profile', { ..._userProfile });
  }

  _floatXP(amount);
  _checkLevelUp(amount);

  // Batch flush after 3s
  clearTimeout(_xpFlushTimer);
  _xpFlushTimer = setTimeout(_flushXP, 3000);

  Events.emit(EVENTS.XP_ADDED, { amount, reason, total: _userProfile?.xp });
}

async function _flushXP() {
  if (!_xpQueue.length || !_currentUser) return;

  const batch  = [..._xpQueue];
  _xpQueue = [];

  const total    = batch.reduce((s, e) => s + e.amount, 0);
  const updates  = { xp: increment(total) };

  batch.forEach(({ amount, reason }) => {
    updates[`xpLog.${reason}`] = increment(amount);
  });

  try {
    await updateDoc(doc(db, 'users', _currentUser.uid), updates);
    await checkBadges();
  } catch (err) {
    console.error('[Firebase] flushXP error:', err);
    _xpQueue = [...batch, ..._xpQueue]; // re-queue
  }
}

function _checkLevelUp(addedAmount) {
  if (!_userProfile) return;
  const xp      = _userProfile.xp || 0;
  const before  = xp - addedAmount;
  const lvlNow  = Store.computeLevel(xp);
  const lvlPrev = Store.computeLevel(before);

  if (lvlNow.name !== lvlPrev.name) {
    Events.emit(EVENTS.XP_LEVEL_UP, { level: lvlNow });
    Events.emit(EVENTS.UI_TOAST, {
      message: `🎉 ترقيت إلى ${lvlNow.icon} ${lvlNow.name}!`,
      type: 'gold'
    });
  }
}

function _floatXP(amount) {
  const el = document.createElement('div');
  el.textContent = '+' + amount + ' ✨';
  el.style.cssText = `
    position:fixed; bottom:80px; left:50%;
    transform:translateX(-50%);
    background:linear-gradient(135deg,#8b5cf6,#fbbf24);
    color:#fff; padding:6px 18px; border-radius:999px;
    font-weight:900; font-size:14px; font-family:inherit;
    pointer-events:none; z-index:9999;
    animation:xpFloat 1.8s ease forwards;
  `;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1900);

  if (!document.getElementById('xpFloatStyle')) {
    const s = document.createElement('style');
    s.id = 'xpFloatStyle';
    s.textContent = `
      @keyframes xpFloat {
        0%   { opacity:0; transform:translateX(-50%) translateY(0); }
        20%  { opacity:1; transform:translateX(-50%) translateY(-8px); }
        80%  { opacity:1; transform:translateX(-50%) translateY(-30px); }
        100% { opacity:0; transform:translateX(-50%) translateY(-50px); }
      }`;
    document.head.appendChild(s);
  }
}

// ============================================================
// BADGES
// ============================================================
async function checkBadges() {
  if (!_currentUser || !_userProfile) return;
  const earned    = _userProfile.badges || [];
  const newBadges = BADGE_RULES.filter(
    b => !earned.includes(b.id) && b.condition(_userProfile)
  );
  if (!newBadges.length) return;

  const ids = newBadges.map(b => b.id);
  try {
    await updateDoc(doc(db, 'users', _currentUser.uid), {
      badges: arrayUnion(...ids),
    });
    _userProfile.badges = [...earned, ...ids];
    Store.set('profile', { ..._userProfile });

    newBadges.forEach((b, i) => {
      setTimeout(() => {
        Events.emit(EVENTS.BADGE_UNLOCKED, b);
        Events.emit(EVENTS.UI_TOAST, {
          message: `🏅 شارة جديدة: ${b.icon} ${b.label}!`,
          type: 'gold'
        });
      }, i * 1200);
    });
  } catch (err) {
    console.error('[Firebase] checkBadges error:', err);
  }
}

// ============================================================
// ACTIVITY LOG
// ============================================================
async function logActivity(label, type, icon = '⭐', detail = '', xp = 0) {
  if (!_currentUser) return;
  try {
    await updateDoc(doc(db, 'users', _currentUser.uid), {
      activity: arrayUnion({
        label, type, icon, detail, xp,
        date: todayStr(),
        timestamp: serverTimestamp(),
      }),
    });
  } catch (err) {
    console.error('[Firebase] logActivity error:', err);
  }
}

// ============================================================
// KHATMA SYNC
// ============================================================
async function syncKhatma(data) {
  if (!_currentUser) return;
  const update = {
    'khatmaStats.currentPage': data.page     || 1,
    'khatmaStats.currentJuz':  data.juz      || 1,
    'khatmaStats.streak':      data.streak   || 0,
    'khatmaStats.lastRead':    todayStr(),
    'khatmaStats.completed':   data.completed || 0,
  };
  try {
    await updateDoc(doc(db, 'users', _currentUser.uid), update);
    if (_userProfile) {
      _userProfile.khatmaStats = {
        ...(_userProfile.khatmaStats || {}),
        ...data,
        lastRead: todayStr(),
      };
      Store.set('profile', { ..._userProfile });
    }
  } catch (err) {
    console.error('[Firebase] syncKhatma error:', err);
  }
}

async function loadKhatma() {
  if (!_currentUser || !_userProfile) return null;
  return _userProfile.khatmaStats || null;
}

// ============================================================
// LEADERBOARD
// ============================================================
async function getLeaderboard(limitN = 10) {
  try {
    const q    = query(collection(db, 'users'), orderBy('xp','desc'), limit(limitN));
    const snap = await getDocs(q);
    return snap.docs.map((d, i) => ({ rank: i + 1, ...d.data() }));
  } catch (err) {
    console.error('[Firebase] getLeaderboard error:', err);
    return [];
  }
}

// ============================================================
// AUTH FLOWS
// ============================================================
async function loginWithGoogle() {
  try {
    const result  = await signInWithPopup(auth, provider);
    _currentUser  = result.user;
    await loadUserProfile(_currentUser.uid);

    Events.emit(EVENTS.AUTH_LOGIN, {
      user:    _currentUser,
      profile: _userProfile,
    });
    Events.emit(EVENTS.UI_MODAL_CLOSE);
    Events.emit(EVENTS.UI_TOAST, {
      message: '👋 أهلاً ' + (_currentUser.displayName?.split(' ')[0] || ''),
      type: 'success'
    });

  } catch (err) {
    if (err.code !== 'auth/popup-closed-by-user') {
      console.error('[Firebase] loginWithGoogle error:', err);
      Events.emit(EVENTS.UI_TOAST, {
        message: '❌ فشل تسجيل الدخول — حاول مجدداً',
        type: 'error'
      });
    }
  }
}

async function logout() {
  try {
    await _flushXP();
    await signOut(auth);

    _currentUser = null;
    _userProfile = null;

    Store.patch({
      user:    null,
      profile: null,
      xp:      0,
    });

    document.getElementById('ic-xp-bar')?.remove();

    Events.emit(EVENTS.AUTH_LOGOUT);
    Events.emit(EVENTS.UI_TOAST, { message: '👋 تم تسجيل الخروج' });

  } catch (err) {
    console.error('[Firebase] logout error:', err);
  }
}

function showUserMenu() {
  if (!_currentUser || !_userProfile) return;
  const xp  = _userProfile.xp || 0;
  const lvl = Store.computeLevel(xp);
  const msg = [
    `${lvl.icon} ${lvl.name}`,
    `✨ ${xp.toLocaleString('ar')} نقطة`,
    `🏅 ${(_userProfile.badges || []).slice(-3).join(' ') || 'لا توجد شارات بعد'}`,
    '\nتسجيل الخروج؟',
  ].join('\n');

  if (confirm(msg)) logout();
}

// ============================================================
// AUTH STATE LISTENER
// ============================================================
onAuthStateChanged(auth, async user => {
  if (user) {
    _currentUser = user;
    await loadUserProfile(user.uid);
  } else {
    _currentUser = null;
    _userProfile = null;
    Store.patch({ user: null, profile: null, xp: 0, authReady: true });
  }

  Store.set('authReady', true);

  // Signal ready to App.js
  window.islamiCalc = islamiCalc;
  window.dispatchEvent(new Event('islamiCalcReady'));
  Events.emit(EVENTS.AUTH_READY, { user: _currentUser, profile: _userProfile });
});

// ============================================================
// PUBLIC API
// ============================================================
const islamiCalc = {
  // Auth
  loginWithGoogle,
  logout,
  showUserMenu,
  getCurrentUser:  () => _currentUser,
  getUserProfile:  () => _userProfile,

  // XP
  addXP,
  addXPImmediate:  _addXPImmediate,
  XP_CONFIG,

  // Data
  logActivity,
  syncKhatma,
  loadKhatma,
  getLeaderboard,
  checkBadges,

  // Firebase instances
  db,
  auth,
  todayStr,
};

window.islamiCalc = islamiCalc;
window.dispatchEvent(new Event('islamiCalcReady'));

export default islamiCalc;
export { auth, db, addXP, logActivity, syncKhatma, getLeaderboard };
