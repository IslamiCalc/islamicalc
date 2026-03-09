/* ============================================================
   firebase.js — IslamiCalc Firebase Module v4.0
   ✅ XP/Leaderboard مخصص للميدان (Arena) فقط
   ✅ الصفحات الروحانية (قرآن، أذكار، صلاة) بدون XP
   ✅ دوال مكتملة: logActivity, saveProgress, updateStreak, unlockBadge
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
  apiKey:            "AIzaSyAFzGPiCFB6vEH-wylbW4zRxxgB_2vZSIs",
  authDomain:        "islamicalc.firebaseapp.com",
  projectId:         "islamicalc",
  storageBucket:     "islamicalc.firebasestorage.app",
  messagingSenderId: "708228371498",
  appId:             "1:708228371498:web:b71ec4a97af9f8fa0c9f53",
  measurementId:     "G-F2P38XX70Q",
};

// ============================================================
// INIT
// ============================================================
const app       = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth      = getAuth(app);
const db        = getFirestore(app);
const provider  = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

// ============================================================
// ARENA XP CONFIG — مخصص للميدان/المسابقات فقط
// الصفحات الروحانية (قرآن، أذكار، صلاة، زكاة) لا تعطي XP
// ============================================================
const ARENA_XP_CONFIG = {
  arena_answer:       5,   // إجابة في المسابقة
  arena_correct:     20,   // إجابة صحيحة
  arena_streak_5:    50,   // 5 إجابات صحيحة متتالية
  arena_streak_10:  100,   // 10 إجابات صحيحة متتالية
  arena_win:        100,   // فوز في مباراة
  arena_perfect:    200,   // جولة مثالية بدون أخطاء
  login_bonus:       25,   // أول تسجيل دخول
  daily_visit:       10,   // زيارة يومية
};

// الصفحات التي لا تعطي XP (روحانية)
const SPIRITUAL_PAGES = ['khatma', 'prayer', 'athkar', 'zakat', 'hijri', 'fasting', 'kafara', 'sadaqa', 'asma', 'fiqh', 'names', 'prophets', 'seerah', 'articles'];

const BADGE_RULES = [
  { id:'first_login',   label:'أول خطوة',        icon:'🌱', condition: p => (p.arenaXP || 0) >= 25         },
  { id:'arena_xp_100',  label:'مئة نقطة',         icon:'💯', condition: p => (p.arenaXP || 0) >= 100        },
  { id:'arena_xp_500',  label:'خمسمئة نقطة',      icon:'⭐', condition: p => (p.arenaXP || 0) >= 500        },
  { id:'arena_xp_1000', label:'ألف نقطة',          icon:'🌟', condition: p => (p.arenaXP || 0) >= 1000       },
  { id:'arena_win_1',   label:'أول انتصار',        icon:'🏅', condition: p => (p.arenaStats?.wins || 0) >= 1  },
  { id:'arena_win_10',  label:'عشر انتصارات',      icon:'🥇', condition: p => (p.arenaStats?.wins || 0) >= 10 },
  { id:'arena_win_50',  label:'خمسون انتصاراً',    icon:'🏆', condition: p => (p.arenaStats?.wins || 0) >= 50 },
  { id:'arena_streak_5',  label:'سلسلة 5 صحيحة',  icon:'🔥', condition: p => (p.arenaStats?.bestStreak || 0) >= 5  },
  { id:'arena_streak_10', label:'سلسلة 10 صحيحة', icon:'⚡', condition: p => (p.arenaStats?.bestStreak || 0) >= 10 },
  { id:'arena_perfect',   label:'جولة مثالية',     icon:'💎', condition: p => (p.arenaStats?.perfectGames || 0) >= 1 },
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

function isArenaPage() {
  const path = window.location.pathname.replace(/^\//, '').split('/')[0] || 'home';
  return path === 'arena';
}

function isSpiritualPage() {
  const path = window.location.pathname.replace(/^\//, '').split('/')[0] || 'home';
  return SPIRITUAL_PAGES.includes(path);
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
        arenaXP:      0,   // ← XP خاص بالميدان فقط
        streak:       0,
        lastVisit:    todayStr(),
        createdAt:    serverTimestamp(),
        khatmaStats:  { completed:0, currentPage:1, currentJuz:1, streak:0, lastRead:'' },
        athkarStats:  { totalDone:0, totalTasbih:0 },
        arenaStats:   { wins:0, totalGames:0, correctAnswers:0, bestStreak:0, perfectGames:0 },
        zakatCalcs:   0,
        badges:       [],
        activity:     [],
      };
      await setDoc(ref, _userProfile);
      Events.emit(EVENTS.UI_TOAST, { message:'🎉 مرحباً بك في IslamiCalc!', type:'success' });
      await _addArenaXPImmediate(25, 'login_bonus');
    }

    // Daily visit bonus (Arena XP فقط)
    if (_userProfile.lastVisit !== todayStr()) {
      await updateDoc(ref, { lastVisit: todayStr() });
      _userProfile.lastVisit = todayStr();
      await _addArenaXPImmediate(10, 'daily_visit');
      Events.emit(EVENTS.UI_TOAST, { message:'🌅 مرحباً بعودتك!', type:'success' });
    }

    Store.patch({
      user:    _currentUser,
      profile: _userProfile,
      arenaXP: _userProfile.arenaXP || 0,
    });

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
// ARENA XP SYSTEM — للميدان فقط
// ============================================================
async function _addArenaXPImmediate(amount, reason) {
  if (!_currentUser || !amount) return;
  try {
    await updateDoc(doc(db, 'users', _currentUser.uid), {
      arenaXP: increment(amount),
      [`arenaXPLog.${reason}`]: increment(amount),
    });

    if (_userProfile) _userProfile.arenaXP = (_userProfile.arenaXP || 0) + amount;
    Store.set('arenaXP', _userProfile?.arenaXP || 0);
    if (_userProfile) Store.set('profile', { ..._userProfile });

    _floatXP(amount);
    _checkLevelUp(amount);

  } catch (err) {
    console.error('[Firebase] addArenaXPImmediate error:', err);
  }
}

/**
 * addXP — يُستدعى من صفحة الميدان فقط
 * إذا استُدعي من صفحة روحانية يُتجاهل تلقائياً
 */
function addXP(amount, reason) {
  if (!_currentUser || !amount) return;

  // حماية: لا XP خارج الميدان إلا login_bonus و daily_visit
  const allowedOutsideArena = ['login_bonus', 'daily_visit'];
  if (isSpiritualPage() && !allowedOutsideArena.includes(reason)) {
    console.log(`[Arena XP] Blocked on spiritual page: ${reason}`);
    return;
  }

  _xpQueue.push({ amount, reason });

  // Optimistic UI
  if (_userProfile) {
    _userProfile.arenaXP = (_userProfile.arenaXP || 0) + amount;
    Store.set('arenaXP', _userProfile.arenaXP);
    Store.set('profile', { ..._userProfile });
  }

  _floatXP(amount);
  _checkLevelUp(amount);

  clearTimeout(_xpFlushTimer);
  _xpFlushTimer = setTimeout(_flushXP, 3000);

  Events.emit(EVENTS.XP_ADDED, { amount, reason, total: _userProfile?.arenaXP });
}

async function _flushXP() {
  if (!_xpQueue.length || !_currentUser) return;

  const batch = [..._xpQueue];
  _xpQueue    = [];

  const total   = batch.reduce((s, e) => s + e.amount, 0);
  const updates = { arenaXP: increment(total) };

  batch.forEach(({ amount, reason }) => {
    updates[`arenaXPLog.${reason}`] = increment(amount);
  });

  try {
    await updateDoc(doc(db, 'users', _currentUser.uid), updates);
    await checkBadges();
    await _updateArenaLeaderboard();
  } catch (err) {
    console.error('[Firebase] flushXP error:', err);
    _xpQueue = [...batch, ..._xpQueue];
  }
}

function _checkLevelUp(addedAmount) {
  if (!_userProfile) return;
  const xp     = _userProfile.arenaXP || 0;
  const before = xp - addedAmount;
  const lvlNow  = Store.computeLevel(xp);
  const lvlPrev = Store.computeLevel(before);

  if (lvlNow.name !== lvlPrev.name) {
    Events.emit(EVENTS.XP_LEVEL_UP, { level: lvlNow });
    Events.emit(EVENTS.UI_TOAST, {
      message: `🎉 ترقيت إلى ${lvlNow.icon} ${lvlNow.name}! في الميدان`,
      type: 'gold'
    });
  }
}

function _floatXP(amount) {
  if (!isArenaPage()) return; // XP float يظهر في الميدان فقط
  const el = document.createElement('div');
  el.className   = 'xp-float';
  el.textContent = `+${amount} ✨`;
  el.style.left   = '50%';
  el.style.bottom = '80px';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1400);
}

// ============================================================
// ARENA LEADERBOARD — مخصص للميدان فقط
// ============================================================
async function _updateArenaLeaderboard() {
  if (!_currentUser || !_userProfile) return;
  try {
    await setDoc(doc(db, 'arenaLeaderboard', _currentUser.uid), {
      uid:         _currentUser.uid,
      displayName: _userProfile.displayName || 'مسلم كريم',
      photoURL:    _userProfile.photoURL    || '',
      arenaXP:     _userProfile.arenaXP    || 0,
      level:       Store.computeLevel(_userProfile.arenaXP || 0).name,
      arenaStats:  _userProfile.arenaStats  || {},
      updatedAt:   serverTimestamp(),
    }, { merge: true });
  } catch (err) {
    console.error('[Firebase] updateArenaLeaderboard error:', err);
  }
}

async function getArenaLeaderboard(limitCount = 20) {
  try {
    const q    = query(
      collection(db, 'arenaLeaderboard'),
      orderBy('arenaXP', 'desc'),
      limit(limitCount)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d, i) => ({ rank: i + 1, ...d.data() }));
  } catch (err) {
    console.error('[Firebase] getArenaLeaderboard error:', err);
    return [];
  }
}

// للتوافق مع الكود القديم
async function getLeaderboard(limitCount = 20) {
  return getArenaLeaderboard(limitCount);
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
// LOG ACTIVITY — سجل نشاط المستخدم (بدون XP للصفحات الروحانية)
// ============================================================
async function logActivity(text, type, icon, extra = '', xp = 0) {
  if (!_currentUser) return;
  try {
    const entry = {
      text,
      type,
      icon,
      extra,
      xp: isSpiritualPage() ? 0 : xp, // لا XP للصفحات الروحانية في السجل
      date: todayStr(),
      ts: Date.now(),
    };
    await updateDoc(doc(db, 'users', _currentUser.uid), {
      activity: arrayUnion(entry),
    });
    if (_userProfile) {
      _userProfile.activity = [...(_userProfile.activity || []).slice(-49), entry];
    }
  } catch (err) {
    console.error('[Firebase] logActivity error:', err);
  }
}

// ============================================================
// SAVE PROGRESS — حفظ تقدم المستخدم (ختمة، أذكار، إلخ)
// ============================================================
async function saveProgress(data) {
  if (!_currentUser) return;
  try {
    await updateDoc(doc(db, 'users', _currentUser.uid), {
      ...data,
      updatedAt: serverTimestamp(),
    });
    // تحديث الـ profile المحلي
    if (_userProfile) {
      Object.assign(_userProfile, data);
      Store.set('profile', { ..._userProfile });
    }
  } catch (err) {
    console.error('[Firebase] saveProgress error:', err);
  }
}

// ============================================================
// UPDATE STREAK — streak الختمة (بدون XP)
// ============================================================
async function updateStreak(newStreak) {
  if (!_currentUser) return;
  try {
    await updateDoc(doc(db, 'users', _currentUser.uid), {
      'khatmaStats.streak': newStreak,
      streak: newStreak,
    });
    if (_userProfile) {
      _userProfile.streak = newStreak;
      if (_userProfile.khatmaStats) _userProfile.khatmaStats.streak = newStreak;
      Store.set('profile', { ..._userProfile });
    }
    // لا XP للـ streak — فقط تسجيل الإنجاز
    await checkBadges();
  } catch (err) {
    console.error('[Firebase] updateStreak error:', err);
  }
}

// ============================================================
// UNLOCK BADGE — فتح شارة
// ============================================================
async function unlockBadge(id, label) {
  if (!_currentUser) return;
  try {
    const earned = _userProfile?.badges || [];
    if (earned.includes(id)) return; // لا تكرار
    await updateDoc(doc(db, 'users', _currentUser.uid), {
      badges: arrayUnion(id),
    });
    if (_userProfile) {
      _userProfile.badges = [...earned, id];
      Store.set('profile', { ..._userProfile });
    }
    Events.emit(EVENTS.BADGE_UNLOCKED, { id, label });
    Events.emit(EVENTS.UI_TOAST, { message: `🏅 شارة جديدة: ${label}`, type: 'gold' });
  } catch (err) {
    console.error('[Firebase] unlockBadge error:', err);
  }
}

// ============================================================
// UPDATE ARENA STATS — تحديث إحصائيات الميدان
// ============================================================
async function updateArenaStats(statsUpdate) {
  if (!_currentUser) return;
  try {
    const updates = {};
    for (const [key, val] of Object.entries(statsUpdate)) {
      updates[`arenaStats.${key}`] = typeof val === 'number' ? increment(val) : val;
    }
    await updateDoc(doc(db, 'users', _currentUser.uid), updates);
    if (_userProfile?.arenaStats) {
      for (const [key, val] of Object.entries(statsUpdate)) {
        if (typeof val === 'number') {
          _userProfile.arenaStats[key] = (_userProfile.arenaStats[key] || 0) + val;
        } else {
          _userProfile.arenaStats[key] = val;
        }
      }
      Store.set('profile', { ..._userProfile });
    }
    await _updateArenaLeaderboard();
    await checkBadges();
  } catch (err) {
    console.error('[Firebase] updateArenaStats error:', err);
  }
}

// ============================================================
// AUTH — تسجيل الدخول بـ Google
// ============================================================
async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (err) {
    if (err.code !== 'auth/popup-closed-by-user') {
      console.error('[Firebase] loginWithGoogle error:', err);
      Events.emit(EVENTS.UI_TOAST, { message:'❌ فشل تسجيل الدخول، حاول مرة أخرى', type:'error' });
    }
    return null;
  }
}

// ============================================================
// AUTH — تسجيل الخروج
// ============================================================
async function logout() {
  try {
    await _flushXP();
    await signOut(auth);
    _currentUser = null;
    _userProfile = null;
    Store.patch({ user: null, profile: null, arenaXP: 0 });
    Events.emit(EVENTS.AUTH_LOGOUT, {});
    Events.emit(EVENTS.UI_TOAST, { message:'👋 تم تسجيل الخروج', type:'' });
  } catch (err) {
    console.error('[Firebase] logout error:', err);
  }
}

// ============================================================
// USER MENU
// ============================================================
function showUserMenu() {
  const profile = Store.get('profile');
  if (!profile) return;
  const lvl  = Store.computeLevel(profile.arenaXP || 0);
  const name = profile.displayName || 'مسلم كريم';
  Events.emit(EVENTS.UI_TOAST, {
    message: `${lvl.icon} ${name} — ${(profile.arenaXP || 0).toLocaleString('ar')} نقطة ميدان`,
    type: 'gold'
  });
}

// ============================================================
// AUTH STATE OBSERVER
// ============================================================
onAuthStateChanged(auth, async user => {
  _currentUser = user;

  if (user) {
    Store.set('user', {
      uid:         user.uid,
      displayName: user.displayName,
      email:       user.email,
      photoURL:    user.photoURL,
    });
    await loadUserProfile(user.uid);
  } else {
    Store.patch({ user: null, profile: null, arenaXP: 0, authReady: true });
  }

  Events.emit(EVENTS.AUTH_READY, { user });
  Store.set('authReady', true);
});

// ============================================================
// EXPOSE GLOBAL API — window.islamiCalc
// ============================================================
window.islamiCalc = {
  // Auth
  loginWithGoogle,
  logout,
  showUserMenu,
  getCurrentUser:  () => _currentUser,
  getUserProfile:  () => _userProfile,
  get user()    { return _currentUser;  },
  get profile() { return _userProfile; },
  get db()      { return db; },

  // Arena XP — للميدان فقط
  addXP,
  ARENA_XP_CONFIG,

  // Leaderboard الميدان
  getLeaderboard,
  getArenaLeaderboard,
  updateArenaStats,

  // Badges
  checkBadges,
  unlockBadge,

  // Progress (ختمة، أذكار، إلخ — بدون XP)
  saveProgress,
  logActivity,
  updateStreak,

  // Helpers
  isArenaPage,
  isSpiritualPage,
  SPIRITUAL_PAGES,
};

export { addXP, loginWithGoogle, logout, getLeaderboard, getArenaLeaderboard, ARENA_XP_CONFIG };
