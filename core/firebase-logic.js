const SPIRITUAL_PAGES = [
  'khatma',
  'prayer',
  'athkar',
  'zakat',
  'hijri',
  'fasting',
  'kafara',
  'sadaqa',
  'asma',
  'fiqh',
  'names',
  'prophets',
  'seerah',
  'articles',
];

const ALLOWED_XP_REASONS_OUTSIDE_ARENA = ['login_bonus', 'daily_visit'];

const LEADERBOARD_SCOPE_META = {
  daily:   { key: 'daily',   bucketField: 'dailyKey',  xpField: 'dailyXP',  scoreField: 'dailyScore' },
  weekly:  { key: 'weekly',  bucketField: 'weeklyKey', xpField: 'weeklyXP', scoreField: 'weeklyScore' },
  alltime: { key: 'alltime', bucketField: '',          xpField: 'arenaXP',  scoreField: 'rankScore' },
};

function toSafeNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function getPageFromPath(pathname = '') {
  return String(pathname || '').replace(/^\/+/, '').split('/')[0] || 'home';
}

function isArenaPath(pathname = '') {
  return getPageFromPath(pathname) === 'arena';
}

function isSpiritualPath(pathname = '') {
  return SPIRITUAL_PAGES.includes(getPageFromPath(pathname));
}

function canAwardArenaXP(pathname = '', reason = '') {
  if (!reason) return false;
  return !isSpiritualPath(pathname) || ALLOWED_XP_REASONS_OUTSIDE_ARENA.includes(reason);
}

function getDateKey(input = Date.now()) {
  const date = input instanceof Date ? new Date(input.getTime()) : new Date(input);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getWeekKey(input = Date.now()) {
  const source = input instanceof Date ? new Date(input.getTime()) : new Date(input);
  const date = new Date(Date.UTC(source.getFullYear(), source.getMonth(), source.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function getLeaderboardScopeMeta(scope = 'alltime', now = Date.now()) {
  const safeScope = Object.prototype.hasOwnProperty.call(LEADERBOARD_SCOPE_META, scope) ? scope : 'alltime';
  const meta = LEADERBOARD_SCOPE_META[safeScope];

  return {
    ...meta,
    bucketValue: meta.bucketField
      ? (safeScope === 'daily' ? getDateKey(now) : getWeekKey(now))
      : '',
  };
}

function buildArenaXPUpdatePayload(batch, incrementValue = value => value) {
  const safeBatch = Array.isArray(batch)
    ? batch.filter(entry => entry && typeof entry.amount === 'number' && entry.reason)
    : [];

  const total = safeBatch.reduce((sum, entry) => sum + entry.amount, 0);
  if (!safeBatch.length) {
    return { total, updates: {} };
  }

  const totalsByReason = safeBatch.reduce((totals, { amount, reason }) => {
    totals[reason] = (totals[reason] || 0) + amount;
    return totals;
  }, {});

  const updates = {
    arenaXP: incrementValue(total),
  };

  Object.entries(totalsByReason).forEach(([reason, amount]) => {
    updates[`arenaXPLog.${reason}`] = incrementValue(amount);
  });

  return { total, updates };
}

function getUnlockedBadges(profile, badgeRules = []) {
  const earned = new Set(profile?.badges || []);
  return badgeRules.filter(rule => !earned.has(rule.id) && rule.condition(profile));
}

function mergeArenaStats(currentStats = {}, statsUpdate = {}) {
  const nextStats = { ...currentStats };

  Object.entries(statsUpdate).forEach(([key, value]) => {
    nextStats[key] = typeof value === 'number'
      ? (nextStats[key] || 0) + value
      : value;
  });

  return nextStats;
}

function buildActivityEntry({
  text,
  type,
  icon,
  extra = '',
  xp = 0,
  pathname = '',
  date,
  now,
}) {
  const timestamp = now ?? Date.now();

  return {
    text,
    type,
    icon,
    extra,
    xp: isSpiritualPath(pathname) ? 0 : xp,
    date: date ?? new Date(timestamp).toISOString().split('T')[0],
    ts: timestamp,
  };
}

function computeLeaderboardScore({
  xp = 0,
  wins = 0,
  bestStreak = 0,
  correctAnswers = 0,
  perfectGames = 0,
} = {}) {
  const safeXP = Math.max(0, toSafeNumber(xp));
  const safeWins = Math.max(0, toSafeNumber(wins));
  const safeBestStreak = Math.max(0, toSafeNumber(bestStreak));
  const safeCorrectAnswers = Math.max(0, toSafeNumber(correctAnswers));
  const safePerfectGames = Math.max(0, toSafeNumber(perfectGames));

  return (safeXP * 1000000)
    + (safeWins * 10000)
    + (safeBestStreak * 100)
    + (safePerfectGames * 10)
    + Math.min(safeCorrectAnswers, 9);
}

function getProfileArenaValue(profile = {}, currentEntry = {}, nestedKey, flatKey) {
  const nestedValue = profile?.arenaStats?.[nestedKey];
  if (typeof nestedValue === 'number' && Number.isFinite(nestedValue)) {
    return nestedValue;
  }

  const flatValue = profile?.[flatKey];
  if (typeof flatValue === 'number' && Number.isFinite(flatValue)) {
    return flatValue;
  }

  return toSafeNumber(currentEntry?.[nestedKey], 0);
}

function buildArenaLeaderboardEntry({
  currentEntry = {},
  user = {},
  profile = {},
  xpDelta = 0,
  now = Date.now(),
} = {}) {
  const updatedAtMs = toSafeNumber(now, Date.now());
  const dailyKey = getDateKey(updatedAtMs);
  const weeklyKey = getWeekKey(updatedAtMs);
  const safeDelta = Math.max(0, toSafeNumber(xpDelta, 0));

  const arenaXP = Math.max(0, toSafeNumber(profile?.arenaXP, 0));
  const wins = getProfileArenaValue(profile, currentEntry, 'wins', 'arenaWins');
  const totalGames = getProfileArenaValue(profile, currentEntry, 'totalGames', 'arenaPlayed');
  const correctAnswers = getProfileArenaValue(profile, currentEntry, 'correctAnswers', 'arenaCorrect');
  const bestStreak = getProfileArenaValue(profile, currentEntry, 'bestStreak', 'arenaStreak');
  const perfectGames = getProfileArenaValue(profile, currentEntry, 'perfectGames', 'arenaPerfect');

  const dailyXP = currentEntry?.dailyKey === dailyKey
    ? Math.max(0, toSafeNumber(currentEntry?.dailyXP, 0) + safeDelta)
    : safeDelta;
  const weeklyXP = currentEntry?.weeklyKey === weeklyKey
    ? Math.max(0, toSafeNumber(currentEntry?.weeklyXP, 0) + safeDelta)
    : safeDelta;

  const nextEntry = {
    uid: user?.uid || currentEntry?.uid || '',
    displayName: profile?.displayName || user?.displayName || currentEntry?.displayName || 'Muslim Karim',
    photoURL: profile?.photoURL || user?.photoURL || currentEntry?.photoURL || '',
    arenaXP,
    dailyXP,
    weeklyXP,
    dailyKey,
    weeklyKey,
    wins,
    totalGames,
    correctAnswers,
    bestStreak,
    perfectGames,
    updatedAtMs,
    createdAtMs: toSafeNumber(currentEntry?.createdAtMs, updatedAtMs),
  };

  nextEntry.rankScore = computeLeaderboardScore(nextEntry);
  nextEntry.dailyScore = computeLeaderboardScore({ ...nextEntry, xp: nextEntry.dailyXP });
  nextEntry.weeklyScore = computeLeaderboardScore({ ...nextEntry, xp: nextEntry.weeklyXP });

  return nextEntry;
}

function compareLeaderboardEntries(a = {}, b = {}, scope = 'alltime') {
  const meta = getLeaderboardScopeMeta(scope);
  const scoreField = meta.scoreField;
  const scoreDiff = toSafeNumber(b?.[scoreField], 0) - toSafeNumber(a?.[scoreField], 0);
  if (scoreDiff !== 0) return scoreDiff;

  const updatedDiff = toSafeNumber(a?.updatedAtMs, 0) - toSafeNumber(b?.updatedAtMs, 0);
  if (updatedDiff !== 0) return updatedDiff;

  return String(a?.uid || a?.displayName || '').localeCompare(String(b?.uid || b?.displayName || ''));
}

function rankLeaderboardEntries(entries = [], scope = 'alltime', currentUid = '') {
  const meta = getLeaderboardScopeMeta(scope);
  return [...entries]
    .filter(Boolean)
    .sort((a, b) => compareLeaderboardEntries(a, b, scope))
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
      scopeXP: Math.max(0, toSafeNumber(entry?.[meta.xpField], entry?.arenaXP)),
      isMe: !!currentUid && entry?.uid === currentUid,
      scope: meta.key,
    }));
}

export {
  ALLOWED_XP_REASONS_OUTSIDE_ARENA,
  LEADERBOARD_SCOPE_META,
  SPIRITUAL_PAGES,
  buildActivityEntry,
  buildArenaLeaderboardEntry,
  buildArenaXPUpdatePayload,
  canAwardArenaXP,
  compareLeaderboardEntries,
  computeLeaderboardScore,
  getDateKey,
  getLeaderboardScopeMeta,
  getPageFromPath,
  getUnlockedBadges,
  getWeekKey,
  isArenaPath,
  isSpiritualPath,
  mergeArenaStats,
  rankLeaderboardEntries,
};