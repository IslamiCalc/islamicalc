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
  where,
  orderBy,
  limit,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import Store  from '/core/store.js';
import Events from '/core/events.js';
import { EVENTS } from '/core/events.js';
import {
  buildActivityEntry,
  buildArenaLeaderboardEntry,
  buildArenaXPUpdatePayload,
  canAwardArenaXP,
  getLeaderboardScopeMeta,
  getUnlockedBadges,
  isArenaPath,
  isSpiritualPath,
  mergeArenaStats,
  rankLeaderboardEntries,
} from '/core/firebase-logic.js';

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
let analytics   = null;
try {
  analytics = getAnalytics(app);
} catch (err) {
  console.warn('[Firebase] Analytics unavailable:', err);
}
const auth      = getAuth(app);
const db        = getFirestore(app);
const provider  = new GoogleAuthProvider();
const LEADERBOARD_COLLECTION = 'leaderboard';
provider.setCustomParameters({ prompt: 'select_account' });

// ============================================================
// ARENA XP CONFIG — مخصص للميدان/المسابقات فقط
// الصفحات الروحانية (قرآن، أذكار، صلاة، زكاة) لا تعطي XP
// ============================================================
const ARENA_XP_CONFIG = {
  arena_answer:       5,   // arena answer reward
  arena_correct:     20,   // correct arena answer reward
  arena_streak_5:    50,   // 5-answer streak reward
  arena_streak_10:  100,   // 10-answer streak reward
  arena_win:        100,   // arena win reward
  arena_perfect:    200,   // perfect arena round reward
  age_calc:           5,   // age calculator reward
  login_bonus:       25,   // first login bonus
  daily_visit:       10,   // daily visit bonus
};

// الصفحات التي لا تعطي XP (روحانية)
const SPIRITUAL_PAGES = ['khatma', 'prayer', 'athkar', 'zakat', 'hijri', 'fasting', 'kafara', 'sadaqa', 'asma', 'fiqh', 'names', 'prophets', 'seerah', 'articles'];

const BADGE_RULES = [
  { id:'first_login',   label:'أول خطوة',        icon:'🌱', condition: p => (p.arenaXP || 0) >= 25         },
  { id:'arena_xp_100',  label:'مئة نقطة',         icon:'💯', condition: p => (p.arenaXP || 0) >= 100        },
  { id:'arena_xp_500',  label:'خمسمئة نقطة',      icon:'⭐', condition: p => (p.arenaXP || 0) >= 500        },
  { id:'arena_xp_1000', label:'ألف نقطة',         icon:'🌟', condition: p => (p.arenaXP || 0) >= 1000       },
  { id:'arena_win_1',   label:'أول انتصار',       icon:'🏅', condition: p => (p.arenaStats?.wins || 0) >= 1  },
  { id:'arena_win_10',  label:'عشر انتصارات',     icon:'🥇', condition: p => (p.arenaStats?.wins || 0) >= 10 },
  { id:'arena_win_50',  label:'خمسون انتصاراً',   icon:'🏆', condition: p => (p.arenaStats?.wins || 0) >= 50 },
  { id:'arena_streak_5',  label:'سلسلة 5 صحيحة',  icon:'🔥', condition: p => (p.arenaStats?.bestStreak || 0) >= 5  },
  { id:'arena_streak_10', label:'سلسلة 10 صحيحة', icon:'⚡', condition: p => (p.arenaStats?.bestStreak || 0) >= 10 },
  { id:'arena_perfect',   label:'جولة مثالية',    icon:'💎', condition: p => (p.arenaStats?.perfectGames || 0) >= 1 },
];

const USER_PROFILE_FIELDS = Object.freeze([
  'uid',
  'displayName',
  'email',
  'photoURL',
  'arenaXP',
  'streak',
  'lastVisit',
  'createdAt',
  'updatedAt',
  'khatmaStats',
  'khatmaPages',
  'athkarStats',
  'arenaStats',
  'zakatCalcs',
  'badges',
  'activity',
  'arenaXPLog',
]);

const REQUIRED_USER_PROFILE_FIELDS = Object.freeze(
  USER_PROFILE_FIELDS.filter(field => field !== 'updatedAt')
);

const ARENA_STAT_KEYS = Object.freeze([
  'wins',
  'totalGames',
  'correctAnswers',
  'wrongAnswers',
  'bestStreak',
  'perfectGames',
]);

const LEGACY_ARENA_STAT_FIELDS = Object.freeze({
  arenaWins: 'wins',
  arenaPlayed: 'totalGames',
  arenaCorrect: 'correctAnswers',
  arenaWrong: 'wrongAnswers',
  arenaStreak: 'bestStreak',
  arenaPerfect: 'perfectGames',
});

const ALLOWED_ARENA_XP_LOG_REASONS = Object.freeze(Object.keys(ARENA_XP_CONFIG));
const ALLOWED_BADGE_IDS = Object.freeze([
  ...BADGE_RULES.map(rule => rule.id),
  'khatma_complete',
  'zakat_calc',
]);

// ============================================================
// STATE
// ============================================================
let _currentUser  = null;
let _userProfile  = null;
let _xpQueue      = [];
let _xpFlushTimer = null;

function dispatchReadyEvent(user = null, profile = null) {
  if (typeof window === 'undefined' || typeof CustomEvent === 'undefined') return;
  const detail = { user, profile, doc: profile };
  window.dispatchEvent(new CustomEvent('islamiCalcReady', { detail }));
  document.dispatchEvent(new CustomEvent('islamiCalcReady', { detail }));
}

function openLoginModal() {
  Events.emit(EVENTS.UI_MODAL_OPEN, {});
  const modal = document.getElementById('loginModal');
  if (!modal) return;
  if (modal.classList.contains('ic-modal') || modal.classList.contains('ic-modal--open')) {
    modal.classList.add('ic-modal--open');
  } else {
    modal.classList.add('open');
  }
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function toNonNegativeNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? num : fallback;
}

function toPositiveNumber(value, fallback = 1) {
  const num = Number(value);
  return Number.isFinite(num) && num >= 1 ? num : fallback;
}

function sanitizeString(value, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function sanitizeNonEmptyString(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function sanitizeDateKey(value, fallback = todayStr()) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback;
}

function sanitizeKhatmaStats(value = {}) {
  const source = isPlainObject(value) ? value : {};
  return {
    completed: toNonNegativeNumber(source.completed, 0),
    currentPage: toPositiveNumber(source.currentPage, 1),
    currentJuz: toPositiveNumber(source.currentJuz, 1),
    streak: toNonNegativeNumber(source.streak, 0),
    lastRead: sanitizeString(source.lastRead, ''),
  };
}

function sanitizeAthkarStats(value = {}) {
  const source = isPlainObject(value) ? value : {};
  return {
    totalDone: toNonNegativeNumber(source.totalDone, 0),
    totalTasbih: toNonNegativeNumber(source.totalTasbih, 0),
  };
}

function sanitizeKhatmaPages(value = {}) {
  const source = isPlainObject(value) ? value : {};
  const pages = {};

  Object.entries(source).forEach(([key, val]) => {
    const page = Number(key);
    const stamp = Number(val);
    if (Number.isInteger(page) && page >= 1 && page <= 604 && Number.isFinite(stamp) && stamp >= 0) {
      pages[String(page)] = stamp;
    }
  });

  return pages;
}

function sanitizeArenaStats(value = {}, legacy = {}) {
  const source = isPlainObject(value) ? value : {};
  return {
    wins: toNonNegativeNumber(source.wins, toNonNegativeNumber(legacy.arenaWins, 0)),
    totalGames: toNonNegativeNumber(source.totalGames, toNonNegativeNumber(legacy.arenaPlayed, 0)),
    correctAnswers: toNonNegativeNumber(source.correctAnswers, toNonNegativeNumber(legacy.arenaCorrect, 0)),
    wrongAnswers: toNonNegativeNumber(source.wrongAnswers, toNonNegativeNumber(legacy.arenaWrong, 0)),
    bestStreak: toNonNegativeNumber(source.bestStreak, toNonNegativeNumber(legacy.arenaStreak, 0)),
    perfectGames: toNonNegativeNumber(source.perfectGames, toNonNegativeNumber(legacy.arenaPerfect, 0)),
  };
}

function sanitizeArenaXpLog(value = {}) {
  const source = isPlainObject(value) ? value : {};
  const log = {};

  ALLOWED_ARENA_XP_LOG_REASONS.forEach(reason => {
    if (Object.prototype.hasOwnProperty.call(source, reason)) {
      log[reason] = toNonNegativeNumber(source[reason], 0);
    }
  });

  return log;
}

function sanitizeBadgeList(value) {
  if (!Array.isArray(value)) return [];

  const badges = [];
  value.forEach(badgeId => {
    if (typeof badgeId === 'string' && ALLOWED_BADGE_IDS.includes(badgeId) && !badges.includes(badgeId)) {
      badges.push(badgeId);
    }
  });

  return badges;
}

function sanitizeActivityEntry(value) {
  if (!isPlainObject(value)) return null;

  const text = sanitizeNonEmptyString(value.text, '');
  const type = sanitizeNonEmptyString(value.type, '');
  if (!text || !type) return null;

  return {
    text,
    type,
    icon: sanitizeString(value.icon, ''),
    extra: sanitizeString(value.extra, ''),
    xp: toNonNegativeNumber(value.xp, 0),
    date: sanitizeDateKey(value.date, todayStr()),
    ts: toNonNegativeNumber(value.ts, Date.now()),
  };
}

function sanitizeActivityList(value) {
  if (!Array.isArray(value)) return [];
  return value.map(entry => sanitizeActivityEntry(entry)).filter(Boolean).slice(-50);
}

function buildDefaultUserProfile(uid) {
  return {
    uid,
    displayName: sanitizeNonEmptyString(_currentUser?.displayName, 'مسلم كريم'),
    email: typeof _currentUser?.email === 'string' ? _currentUser.email : null,
    photoURL: sanitizeString(_currentUser?.photoURL, ''),
    arenaXP: 0,
    streak: 0,
    lastVisit: todayStr(),
    createdAt: serverTimestamp(),
    khatmaStats: sanitizeKhatmaStats(),
    khatmaPages: {},
    athkarStats: sanitizeAthkarStats(),
    arenaStats: sanitizeArenaStats(),
    zakatCalcs: 0,
    badges: [],
    activity: [],
    arenaXPLog: {},
  };
}

function normalizeUserProfileData(rawProfile = {}) {
  const profile = isPlainObject(rawProfile) ? rawProfile : {};

  return {
    uid: sanitizeNonEmptyString(profile.uid, _currentUser?.uid || ''),
    displayName: sanitizeNonEmptyString(
      profile.displayName,
      sanitizeNonEmptyString(profile.name, sanitizeNonEmptyString(_currentUser?.displayName, 'مسلم كريم'))
    ),
    email: typeof profile.email === 'string' || profile.email == null ? profile.email : (_currentUser?.email || null),
    photoURL: sanitizeString(profile.photoURL, sanitizeString(_currentUser?.photoURL, '')),
    arenaXP: toNonNegativeNumber(profile.arenaXP, 0),
    streak: toNonNegativeNumber(profile.streak, 0),
    lastVisit: sanitizeDateKey(profile.lastVisit, todayStr()),
    createdAt: profile.createdAt || null,
    updatedAt: profile.updatedAt || null,
    khatmaStats: sanitizeKhatmaStats(profile.khatmaStats),
    khatmaPages: sanitizeKhatmaPages(profile.khatmaPages),
    athkarStats: sanitizeAthkarStats(profile.athkarStats),
    arenaStats: sanitizeArenaStats(profile.arenaStats, profile),
    zakatCalcs: toNonNegativeNumber(profile.zakatCalcs, 0),
    badges: sanitizeBadgeList(profile.badges),
    activity: sanitizeActivityList(profile.activity),
    arenaXPLog: sanitizeArenaXpLog(profile.arenaXPLog),
  };
}

function comparableUserProfileData(profile = {}) {
  const normalized = normalizeUserProfileData(profile);
  return JSON.stringify({
    ...normalized,
    createdAt: Boolean(normalized.createdAt),
    updatedAt: Boolean(normalized.updatedAt),
  });
}

function needsUserProfileMigration(rawProfile = {}, normalizedProfile = normalizeUserProfileData(rawProfile)) {
  const rawKeys = isPlainObject(rawProfile) ? Object.keys(rawProfile) : [];
  const hasUnexpectedFields = rawKeys.some(key => !USER_PROFILE_FIELDS.includes(key));
  const missingRequiredFields = REQUIRED_USER_PROFILE_FIELDS.some(key => !rawKeys.includes(key));

  return hasUnexpectedFields
    || missingRequiredFields
    || comparableUserProfileData(rawProfile) !== comparableUserProfileData(normalizedProfile);
}

function sanitizeArenaXpReason(reason) {
  return ALLOWED_ARENA_XP_LOG_REASONS.includes(reason) ? reason : '';
}

function buildProgressUpdatePayload(data = {}) {
  if (!isPlainObject(data)) {
    return { updates: null, profilePatch: null, syncArenaLeaderboard: false };
  }

  const updates = {};
  const profilePatch = {};
  const arenaStatsPatch = {};
  const setArenaStat = (field, value) => {
    const currentValue = toNonNegativeNumber(_userProfile?.arenaStats?.[field], 0);
    arenaStatsPatch[field] = Math.max(currentValue, toNonNegativeNumber(value, currentValue));
  };

  if (isPlainObject(data.arenaStats)) {
    ARENA_STAT_KEYS.forEach(field => {
      if (Object.prototype.hasOwnProperty.call(data.arenaStats, field)) {
        setArenaStat(field, data.arenaStats[field]);
      }
    });
  }

  Object.entries(LEGACY_ARENA_STAT_FIELDS).forEach(([legacyKey, field]) => {
    if (Object.prototype.hasOwnProperty.call(data, legacyKey)) {
      setArenaStat(field, data[legacyKey]);
    }
  });

  if (Object.keys(arenaStatsPatch).length) {
    Object.entries(arenaStatsPatch).forEach(([field, value]) => {
      updates[`arenaStats.${field}`] = value;
    });
    profilePatch.arenaStats = { ...sanitizeArenaStats(_userProfile?.arenaStats), ...arenaStatsPatch };
  }

  if (Object.prototype.hasOwnProperty.call(data, 'khatmaPages')) {
    const currentPages = sanitizeKhatmaPages(_userProfile?.khatmaPages);
    const nextPages = { ...currentPages };
    Object.entries(sanitizeKhatmaPages(data.khatmaPages)).forEach(([page, stamp]) => {
      nextPages[page] = Math.max(toNonNegativeNumber(nextPages[page], 0), stamp);
    });
    updates.khatmaPages = nextPages;
    profilePatch.khatmaPages = nextPages;
  }

  if (!Object.keys(updates).length) {
    return { updates: null, profilePatch: null, syncArenaLeaderboard: false };
  }

  return {
    updates,
    profilePatch,
    syncArenaLeaderboard: Object.prototype.hasOwnProperty.call(profilePatch, 'arenaStats'),
  };
}

function sanitizeArenaStatsDelta(statsUpdate = {}) {
  if (!isPlainObject(statsUpdate)) return {};

  const safeStats = {};
  ARENA_STAT_KEYS.forEach(field => {
    if (!Object.prototype.hasOwnProperty.call(statsUpdate, field)) return;
    const value = Number(statsUpdate[field]);
    if (Number.isFinite(value) && value >= 0) {
      safeStats[field] = value;
    }
  });

  return safeStats;
}

function isArenaPage() {
  return isArenaPath(window.location.pathname);
}

function isSpiritualPage() {
  return isSpiritualPath(window.location.pathname);
}

// ============================================================
// USER PROFILE
// ============================================================
async function loadUserProfile(uid) {
  try {
    const ref  = doc(db, 'users', uid);
    const snap = await getDoc(ref);

    if (snap.exists()) {
      const rawProfile = snap.data();
      const normalizedProfile = normalizeUserProfileData(rawProfile);

      if (needsUserProfileMigration(rawProfile, normalizedProfile)) {
        await setDoc(ref, {
          ...normalizedProfile,
          createdAt: rawProfile.createdAt || serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      _userProfile = normalizedProfile;
    } else {
      _userProfile = buildDefaultUserProfile(uid);
      await setDoc(ref, _userProfile);
      Events.emit(EVENTS.UI_TOAST, { message:'🎉 مرحباً بك في IslamiCalc!', type:'success' });
      await _addArenaXPImmediate(25, 'login_bonus');
    }

    if (_userProfile.lastVisit !== todayStr()) {
      await updateDoc(ref, {
        lastVisit: todayStr(),
        updatedAt: serverTimestamp(),
      });
      _userProfile.lastVisit = todayStr();
      await _addArenaXPImmediate(10, 'daily_visit');
      Events.emit(EVENTS.UI_TOAST, { message:'🌤 مرحباً بعودتك!', type:'success' });
    }

    Store.patch({
      user:    _currentUser,
      profile: _userProfile,
      arenaXP: _userProfile.arenaXP || 0,
    });

    await checkBadges();
    await _updateArenaLeaderboard({ xpDelta: 0 });

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
  const safeAmount = toNonNegativeNumber(amount, 0);
  const safeReason = sanitizeArenaXpReason(reason);
  if (!_currentUser || !safeAmount || !safeReason) return;

  try {
    await updateDoc(doc(db, 'users', _currentUser.uid), {
      arenaXP: increment(safeAmount),
      [`arenaXPLog.${safeReason}`]: increment(safeAmount),
    });

    if (_userProfile) _userProfile.arenaXP = (_userProfile.arenaXP || 0) + safeAmount;
    Store.set('arenaXP', _userProfile?.arenaXP || 0);
    if (_userProfile) Store.set('profile', { ..._userProfile });

    _floatXP(safeAmount);
    _checkLevelUp(safeAmount);
    await _updateArenaLeaderboard({ xpDelta: safeAmount });

  } catch (err) {
    console.error('[Firebase] addArenaXPImmediate error:', err);
  }
}

/**
 * addXP — يُستدعى من صفحة الميدان فقط
 * إذا استُدعي من صفحة روحانية يُتجاهل تلقائياً
 */
function addXP(amount, reason) {
  const safeAmount = toNonNegativeNumber(amount, 0);
  const safeReason = sanitizeArenaXpReason(reason);
  if (!_currentUser || !safeAmount || !safeReason) return;

  if (!canAwardArenaXP(window.location.pathname, safeReason)) {
    return;
  }

  _xpQueue.push({ amount: safeAmount, reason: safeReason });

  if (_userProfile) {
    _userProfile.arenaXP = (_userProfile.arenaXP || 0) + safeAmount;
    Store.set('arenaXP', _userProfile.arenaXP);
    Store.set('profile', { ..._userProfile });
  }

  _floatXP(safeAmount);
  _checkLevelUp(safeAmount);

  clearTimeout(_xpFlushTimer);
  _xpFlushTimer = setTimeout(_flushXP, 3000);

  Events.emit(EVENTS.XP_ADDED, { amount: safeAmount, reason: safeReason, total: _userProfile?.arenaXP });
}

async function _flushXP() {
  if (!_xpQueue.length || !_currentUser) return;

  const batch = _xpQueue.map(entry => ({
    amount: toNonNegativeNumber(entry?.amount, 0),
    reason: sanitizeArenaXpReason(entry?.reason),
  })).filter(entry => entry.amount && entry.reason);
  _xpQueue = [];

  if (!batch.length) return;

  const { total, updates } = buildArenaXPUpdatePayload(batch, increment);

  try {
    await updateDoc(doc(db, 'users', _currentUser.uid), updates);
    await checkBadges();
    await _updateArenaLeaderboard({ xpDelta: total });
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
async function _updateArenaLeaderboard({ xpDelta = 0 } = {}) {
  if (!_currentUser || !_userProfile) return null;

  const ref = doc(db, LEADERBOARD_COLLECTION, _currentUser.uid);
  let currentEntry = null;

  try {
    const snap = await getDoc(ref);
    if (snap.exists()) currentEntry = snap.data();
  } catch {}

  try {
    const level = Store.computeLevel(_userProfile.arenaXP || 0);
    const nextEntry = buildArenaLeaderboardEntry({
      currentEntry,
      user: _currentUser,
      profile: _userProfile,
      xpDelta,
      now: Date.now(),
    });

    await setDoc(ref, {
      ...nextEntry,
      level: level.name,
      levelIcon: level.icon,
      updatedAt: serverTimestamp(),
    });

    return nextEntry;
  } catch (err) {
    console.error('[Firebase] updateArenaLeaderboard error:', err);
    return null;
  }
}

async function getArenaLeaderboard(limitCount = 20, scope = 'alltime') {
  const meta = getLeaderboardScopeMeta(scope);
  const safeLimit = Math.max(1, Math.min(Number(limitCount) || 20, 50));

  try {
    const constraints = [];
    if (meta.bucketField && meta.bucketValue) {
      constraints.push(where(meta.bucketField, '==', meta.bucketValue));
    }
    constraints.push(orderBy(meta.scoreField, 'desc'));
    constraints.push(orderBy('updatedAtMs', 'asc'));
    constraints.push(limit(safeLimit));

    const snap = await getDocs(query(collection(db, LEADERBOARD_COLLECTION), ...constraints));
    return rankLeaderboardEntries(
      snap.docs.map(entryDoc => ({ uid: entryDoc.id, ...entryDoc.data() })),
      meta.key,
      _currentUser?.uid || ''
    );
  } catch (err) {
    console.error('[Firebase] getArenaLeaderboard error:', err);
    return [];
  }
}

// للتوافق مع الكود القديم
async function getLeaderboard(limitCount = 20, scope = 'alltime') {
  return getArenaLeaderboard(limitCount, scope);
}

// ============================================================
// BADGES
// ============================================================
async function checkBadges() {
  if (!_currentUser || !_userProfile) return;
  const earned    = _userProfile.badges || [];
  const newBadges = getUnlockedBadges(_userProfile, BADGE_RULES);
  if (!newBadges.length) return;

  const ids = newBadges.map(b => b.id);
  try {
    await updateDoc(doc(db, 'users', _currentUser.uid), {
      badges: arrayUnion(...ids),
    });
    _userProfile.badges = sanitizeBadgeList([...earned, ...ids]);
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
    const entry = buildActivityEntry({
      text,
      type,
      icon,
      extra,
      xp,
      pathname: window.location.pathname,
      date: todayStr(),
      now: Date.now(),
    });
    const nextActivity = sanitizeActivityList([...(Array.isArray(_userProfile?.activity) ? _userProfile.activity : []), entry]);
    await updateDoc(doc(db, 'users', _currentUser.uid), {
      activity: nextActivity,
      updatedAt: serverTimestamp(),
    });
    if (_userProfile) {
      _userProfile.activity = nextActivity;
      Store.set('profile', { ..._userProfile });
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

  const { updates, profilePatch, syncArenaLeaderboard } = buildProgressUpdatePayload(data);
  if (!updates) return;

  try {
    await updateDoc(doc(db, 'users', _currentUser.uid), {
      ...updates,
      updatedAt: serverTimestamp(),
    });

    if (_userProfile && profilePatch) {
      _userProfile = {
        ..._userProfile,
        ...profilePatch,
        arenaStats: profilePatch.arenaStats || _userProfile.arenaStats,
        khatmaPages: profilePatch.khatmaPages || _userProfile.khatmaPages,
      };
      Store.set('profile', { ..._userProfile });
    }

    if (syncArenaLeaderboard) {
      await _updateArenaLeaderboard({ xpDelta: 0 });
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

  const safeStreak = toNonNegativeNumber(newStreak, 0);
  try {
    await updateDoc(doc(db, 'users', _currentUser.uid), {
      'khatmaStats.streak': safeStreak,
      streak: safeStreak,
      updatedAt: serverTimestamp(),
    });
    if (_userProfile) {
      _userProfile.streak = safeStreak;
      if (_userProfile.khatmaStats) _userProfile.khatmaStats.streak = safeStreak;
      Store.set('profile', { ..._userProfile });
    }
    await checkBadges();
  } catch (err) {
    console.error('[Firebase] updateStreak error:', err);
  }
}

// ============================================================
// UNLOCK BADGE — فتح شارة
// ============================================================
async function unlockBadge(id, label) {
  if (!_currentUser || !ALLOWED_BADGE_IDS.includes(id)) return;
  try {
    const earned = _userProfile?.badges || [];
    if (earned.includes(id)) return;
    await updateDoc(doc(db, 'users', _currentUser.uid), {
      badges: arrayUnion(id),
      updatedAt: serverTimestamp(),
    });
    if (_userProfile) {
      _userProfile.badges = sanitizeBadgeList([...earned, id]);
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

  const safeStats = sanitizeArenaStatsDelta(statsUpdate);
  if (!Object.keys(safeStats).length) return;

  try {
    const updates = {};
    for (const [key, val] of Object.entries(safeStats)) {
      updates[`arenaStats.${key}`] = increment(val);
    }
    await updateDoc(doc(db, 'users', _currentUser.uid), updates);
    if (_userProfile) {
      _userProfile.arenaStats = mergeArenaStats(_userProfile.arenaStats, safeStats);
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
// ============================================================
// KHATMA ROOMS — ختمة جماعية مع العائلة والأصدقاء
// ============================================================
function sanitizeRoomCode(value) {
  const raw = sanitizeNonEmptyString(value, '');
  if (!raw) return '';

  try {
    const parsed = new URL(raw, typeof window !== 'undefined' ? window.location.origin : 'https://islamicalc.com');
    const roomParam = parsed.searchParams.get('room');
    if (roomParam) return sanitizeRoomCode(roomParam);
  } catch {
    // Continue with plain room ids.
  }

  return /^[A-Za-z0-9_-]{10,128}$/.test(raw) ? raw : '';
}

function getKhatmaRoomDisplayName() {
  return sanitizeNonEmptyString(
    _userProfile?.displayName,
    sanitizeNonEmptyString(_currentUser?.displayName, 'قارئ جديد')
  ).slice(0, 80);
}

function getKhatmaRoomPhotoURL() {
  return sanitizeString(_userProfile?.photoURL || _currentUser?.photoURL || '', '').slice(0, 500);
}

function getKhatmaRoomProgress(progress = {}) {
  const currentPage = Math.min(
    604,
    toPositiveNumber(progress.currentPage, _userProfile?.khatmaStats?.currentPage || 1)
  );
  const completedPages = Math.min(
    604,
    toNonNegativeNumber(progress.completedPages, Object.keys(_userProfile?.khatmaPages || {}).length)
  );
  const completedSurahs = Math.min(114, toNonNegativeNumber(progress.completedSurahs, 0));
  const streak = Math.min(3650, toNonNegativeNumber(progress.streak, _userProfile?.khatmaStats?.streak || 0));

  return {
    currentPage,
    completedPages,
    completedSurahs,
    streak,
  };
}

async function readKhatmaRoomMembers(roomId) {
  const membersSnap = await getDocs(collection(db, 'khatmaRooms', roomId, 'members'));
  return membersSnap.docs
    .map(memberDoc => {
      const data = memberDoc.data() || {};
      return {
        uid: sanitizeNonEmptyString(data.uid, memberDoc.id),
        displayName: sanitizeNonEmptyString(data.displayName, 'قارئ'),
        photoURL: sanitizeString(data.photoURL, ''),
        currentPage: Math.min(604, toPositiveNumber(data.currentPage, 1)),
        completedPages: Math.min(604, toNonNegativeNumber(data.completedPages, 0)),
        completedSurahs: Math.min(114, toNonNegativeNumber(data.completedSurahs, 0)),
        streak: Math.min(3650, toNonNegativeNumber(data.streak, 0)),
        lastActivityAtMs: toNonNegativeNumber(data.lastActivityAtMs, 0),
      };
    })
    .sort((left, right) => (
      (right.completedPages - left.completedPages)
      || (right.lastActivityAtMs - left.lastActivityAtMs)
      || left.displayName.localeCompare(right.displayName, 'ar')
    ));
}

async function upsertKhatmaRoomMember(roomId, progress = {}) {
  if (!_currentUser) return null;

  const memberRef = doc(db, 'khatmaRooms', roomId, 'members', _currentUser.uid);
  const memberSnap = await getDoc(memberRef);
  const snapshot = getKhatmaRoomProgress(progress);

  const nextMember = {
    uid: _currentUser.uid,
    displayName: getKhatmaRoomDisplayName(),
    photoURL: getKhatmaRoomPhotoURL(),
    currentPage: snapshot.currentPage,
    completedPages: snapshot.completedPages,
    completedSurahs: snapshot.completedSurahs,
    streak: snapshot.streak,
    joinedAt: memberSnap.exists() ? memberSnap.data().joinedAt : serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastActivityAtMs: Date.now(),
  };

  await setDoc(memberRef, nextMember);
  return nextMember;
}

async function rebuildKhatmaRoom(roomId) {
  const roomRef = doc(db, 'khatmaRooms', roomId);
  const roomSnap = await getDoc(roomRef);
  if (!roomSnap.exists()) return null;

  const currentRoom = roomSnap.data() || {};
  const members = await readKhatmaRoomMembers(roomId);
  const memberCount = members.length;
  const totalCompletedPages = members.reduce((sum, member) => sum + member.completedPages, 0);
  const progressPercent = memberCount
    ? Math.min(100, Math.round((totalCompletedPages / (memberCount * 604)) * 100))
    : 0;

  const nextRoom = {
    name: sanitizeNonEmptyString(currentRoom.name, 'ختمة جماعية').slice(0, 80),
    ownerUid: sanitizeNonEmptyString(currentRoom.ownerUid, _currentUser?.uid || ''),
    ownerName: sanitizeNonEmptyString(currentRoom.ownerName, getKhatmaRoomDisplayName()).slice(0, 80),
    inviteCode: roomId,
    memberCount,
    totalCompletedPages,
    progressPercent,
    createdAt: currentRoom.createdAt || serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastActivityAtMs: Date.now(),
  };

  await setDoc(roomRef, nextRoom);

  return {
    roomId,
    ...nextRoom,
    members,
    inviteUrl: typeof window !== 'undefined' ? `${window.location.origin}/khatma?room=${roomId}` : `/khatma?room=${roomId}`,
  };
}

async function getKhatmaRoom(roomId) {
  if (!_currentUser) return null;

  const safeRoomId = sanitizeRoomCode(roomId);
  if (!safeRoomId) return null;

  const roomSnap = await getDoc(doc(db, 'khatmaRooms', safeRoomId));
  if (!roomSnap.exists()) return null;

  const room = roomSnap.data() || {};
  const members = await readKhatmaRoomMembers(safeRoomId);

  return {
    roomId: safeRoomId,
    name: sanitizeNonEmptyString(room.name, 'ختمة جماعية'),
    ownerUid: sanitizeNonEmptyString(room.ownerUid, ''),
    ownerName: sanitizeNonEmptyString(room.ownerName, 'منشئ الغرفة'),
    inviteCode: safeRoomId,
    memberCount: toNonNegativeNumber(room.memberCount, members.length),
    totalCompletedPages: toNonNegativeNumber(room.totalCompletedPages, members.reduce((sum, member) => sum + member.completedPages, 0)),
    progressPercent: toNonNegativeNumber(room.progressPercent, 0),
    members,
    inviteUrl: typeof window !== 'undefined' ? `${window.location.origin}/khatma?room=${safeRoomId}` : `/khatma?room=${safeRoomId}`,
  };
}

async function createKhatmaRoom(name = 'ختمة جماعية') {
  if (!_currentUser) return null;

  const roomId = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID().replace(/-/g, '')
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
  const roomName = sanitizeNonEmptyString(name, 'ختمة جماعية').slice(0, 80);

  await setDoc(doc(db, 'khatmaRooms', roomId), {
    name: roomName,
    ownerUid: _currentUser.uid,
    ownerName: getKhatmaRoomDisplayName(),
    inviteCode: roomId,
    memberCount: 0,
    totalCompletedPages: 0,
    progressPercent: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastActivityAtMs: Date.now(),
  });

  await upsertKhatmaRoomMember(roomId);
  return rebuildKhatmaRoom(roomId);
}

async function joinKhatmaRoom(roomId, progress = {}) {
  if (!_currentUser) return null;

  const safeRoomId = sanitizeRoomCode(roomId);
  if (!safeRoomId) return null;

  const roomSnap = await getDoc(doc(db, 'khatmaRooms', safeRoomId));
  if (!roomSnap.exists()) {
    Events.emit(EVENTS.UI_TOAST, { message:'⚠️ رابط الختمة غير صالح أو أن الغرفة لم تعد متاحة.', type:'warning' });
    return null;
  }

  await upsertKhatmaRoomMember(safeRoomId, progress);
  return rebuildKhatmaRoom(safeRoomId);
}

async function syncKhatmaRoomProgress(roomId, progress = {}) {
  if (!_currentUser) return null;

  const safeRoomId = sanitizeRoomCode(roomId);
  if (!safeRoomId) return null;

  const roomSnap = await getDoc(doc(db, 'khatmaRooms', safeRoomId));
  if (!roomSnap.exists()) return null;

  await upsertKhatmaRoomMember(safeRoomId, progress);
  return rebuildKhatmaRoom(safeRoomId);
}
async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (err) {
    if (err.code === 'auth/popup-closed-by-user') {
      return null;
    }

    if (err.code === 'auth/popup-blocked' || err.code === 'auth/cancelled-popup-request') {
      try {
        await signInWithRedirect(auth, provider);
        return null;
      } catch (redirectErr) {
        console.error('[Firebase] loginWithGoogle redirect fallback error:', redirectErr);
        Events.emit(EVENTS.UI_TOAST, { message:'\u062a\u0639\u0630\u0631 \u0628\u062f\u0621 \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644 \u0627\u0644\u0622\u0646. \u062d\u0627\u0648\u0644 \u0645\u062c\u062f\u062f\u064b\u0627 \u0623\u0648 \u0623\u0639\u062f \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u0635\u0641\u062d\u0629.', type:'error' });
        return null;
      }
    }

    if (err.code === 'auth/unauthorized-domain') {
      if (typeof window !== 'undefined' && window.location?.hostname === '127.0.0.1') {
        const localhostUrl = `${window.location.protocol}//localhost:${window.location.port}${window.location.pathname}${window.location.search}${window.location.hash}`;
        Events.emit(EVENTS.UI_TOAST, { message:'\u062a\u0633\u062c\u064a\u0644 Google \u064a\u0639\u0645\u0644 \u0647\u0646\u0627 \u0639\u0628\u0631 localhost \u0641\u0642\u0637. \u0633\u064a\u062a\u0645 \u062a\u062d\u0648\u064a\u0644\u0643 \u0627\u0644\u0622\u0646.', type:'warning' });
        setTimeout(() => window.location.replace(localhostUrl), 1200);
        return null;
      }

      Events.emit(EVENTS.UI_TOAST, { message:'\u064a\u062c\u0628 \u0625\u0636\u0627\u0641\u0629 \u0647\u0630\u0627 \u0627\u0644\u0646\u0637\u0627\u0642 \u0625\u0644\u0649 Authorized Domains \u0641\u064a Firebase Authentication.', type:'warning' });
      return null;
    }

    console.error('[Firebase] loginWithGoogle error:', err);
    Events.emit(EVENTS.UI_TOAST, { message:'\u0641\u0634\u0644 \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644. \u062d\u0627\u0648\u0644 \u0645\u0631\u0629 \u0623\u062e\u0631\u0649.', type:'error' });
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
    dispatchReadyEvent(Store.get('user'), _userProfile);
  } else {
    Store.patch({ user: null, profile: null, arenaXP: 0, authReady: true });
    dispatchReadyEvent(null, null);
  }

  Events.emit(EVENTS.AUTH_READY, { user, profile: _userProfile });
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
  addBadge: (id, label = 'New badge') => unlockBadge(id, label),

  // Progress (ختمة، أذكار، إلخ — بدون XP)
  saveProgress,
  logActivity,
  updateStreak,
  openLoginModal,
  openModal: openLoginModal,

  // Helpers
  isArenaPage,
  isSpiritualPage,
  SPIRITUAL_PAGES,
};

export { addXP, loginWithGoogle, logout, getLeaderboard, getArenaLeaderboard, createKhatmaRoom, joinKhatmaRoom, getKhatmaRoom, syncKhatmaRoomProgress, ARENA_XP_CONFIG };




