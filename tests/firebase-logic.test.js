import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ALLOWED_XP_REASONS_OUTSIDE_ARENA,
  SPIRITUAL_PAGES,
  buildActivityEntry,
  buildArenaLeaderboardEntry,
  buildArenaXPUpdatePayload,
  canAwardArenaXP,
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
} from '../core/firebase-logic.js';

test('path helpers normalize route segments correctly', () => {
  assert.equal(getPageFromPath('/'), 'home');
  assert.equal(getPageFromPath('/arena/'), 'arena');
  assert.equal(getPageFromPath('///prayer/today'), 'prayer');
  assert.equal(isArenaPath('/arena/weekly'), true);
  assert.equal(isSpiritualPath('/prayer/'), true);
  assert.equal(isSpiritualPath('/arena/'), false);
});

test('spiritual page list stays aligned with XP rules', () => {
  assert.ok(SPIRITUAL_PAGES.includes('khatma'));
  assert.ok(SPIRITUAL_PAGES.includes('articles'));
  assert.deepEqual(ALLOWED_XP_REASONS_OUTSIDE_ARENA, ['login_bonus', 'daily_visit']);
});

test('canAwardArenaXP blocks spiritual-page XP except for explicit allowed reasons', () => {
  assert.equal(canAwardArenaXP('/arena/', 'arena_correct'), true);
  assert.equal(canAwardArenaXP('/athkar/', 'dhikr_done'), false);
  assert.equal(canAwardArenaXP('/athkar/', 'login_bonus'), true);
  assert.equal(canAwardArenaXP('/prayer/', 'daily_visit'), true);
  assert.equal(canAwardArenaXP('/zakat/', ''), false);
});

test('buildArenaXPUpdatePayload aggregates queue entries into firestore-style updates', () => {
  const batch = [
    { amount: 5, reason: 'arena_answer' },
    { amount: 20, reason: 'arena_correct' },
    { amount: 5, reason: 'arena_answer' },
  ];
  const increment = value => ({ op: 'increment', value });

  const payload = buildArenaXPUpdatePayload(batch, increment);

  assert.equal(payload.total, 30);
  assert.deepEqual(payload.updates, {
    arenaXP: { op: 'increment', value: 30 },
    'arenaXPLog.arena_answer': { op: 'increment', value: 10 },
    'arenaXPLog.arena_correct': { op: 'increment', value: 20 },
  });
});

test('buildArenaXPUpdatePayload ignores malformed queue entries', () => {
  const payload = buildArenaXPUpdatePayload([
    { amount: 10, reason: 'daily_visit' },
    { amount: 'bad', reason: 'arena_correct' },
    null,
    { amount: 3 },
  ]);

  assert.equal(payload.total, 10);
  assert.deepEqual(payload.updates, {
    arenaXP: 10,
    'arenaXPLog.daily_visit': 10,
  });
});

test('getUnlockedBadges returns only newly satisfied rules', () => {
  const profile = {
    arenaXP: 120,
    badges: ['first_login'],
    arenaStats: { wins: 2 },
  };
  const rules = [
    { id: 'first_login', condition: current => current.arenaXP >= 25 },
    { id: 'arena_xp_100', condition: current => current.arenaXP >= 100 },
    { id: 'arena_win_1', condition: current => current.arenaStats.wins >= 1 },
  ];

  const unlocked = getUnlockedBadges(profile, rules);

  assert.deepEqual(unlocked.map(rule => rule.id), ['arena_xp_100', 'arena_win_1']);
});

test('mergeArenaStats increments numeric counters and overwrites scalar values', () => {
  const merged = mergeArenaStats(
    { wins: 3, totalGames: 8, bestStreak: 4, status: 'bronze' },
    { wins: 1, totalGames: 2, bestStreak: 7, status: 'silver' },
  );

  assert.deepEqual(merged, {
    wins: 4,
    totalGames: 10,
    bestStreak: 11,
    status: 'silver',
  });
});

test('buildActivityEntry zeroes XP on spiritual pages and preserves it elsewhere', () => {
  const spiritualEntry = buildActivityEntry({
    text: 'Prayer view',
    type: 'prayer_view',
    icon: 'icon',
    xp: 25,
    pathname: '/prayer/',
    date: '2026-03-10',
    now: 123,
  });
  const arenaEntry = buildActivityEntry({
    text: 'Arena win',
    type: 'arena_win',
    icon: 'icon',
    xp: 25,
    pathname: '/arena/',
    date: '2026-03-10',
    now: 456,
  });

  assert.equal(spiritualEntry.xp, 0);
  assert.equal(spiritualEntry.date, '2026-03-10');
  assert.equal(spiritualEntry.ts, 123);
  assert.equal(arenaEntry.xp, 25);
  assert.equal(arenaEntry.ts, 456);
});

test('leaderboard bucket helpers derive daily and weekly keys', () => {
  const now = new Date('2026-03-10T12:00:00Z');

  assert.equal(getDateKey(now), '2026-03-10');
  assert.equal(getWeekKey(now), '2026-W11');
  assert.deepEqual(getLeaderboardScopeMeta('daily', now), {
    key: 'daily',
    bucketField: 'dailyKey',
    xpField: 'dailyXP',
    scoreField: 'dailyScore',
    bucketValue: '2026-03-10',
  });
  assert.equal(getLeaderboardScopeMeta('alltime', now).bucketValue, '');
});

test('computeLeaderboardScore rewards XP first and then arena tie-breakers', () => {
  const base = computeLeaderboardScore({ xp: 200, wins: 1, bestStreak: 4, correctAnswers: 10 });
  const moreWins = computeLeaderboardScore({ xp: 200, wins: 2, bestStreak: 4, correctAnswers: 10 });
  const moreXp = computeLeaderboardScore({ xp: 201, wins: 0, bestStreak: 0, correctAnswers: 0 });

  assert.ok(moreWins > base);
  assert.ok(moreXp > moreWins);
});

test('buildArenaLeaderboardEntry resets expired buckets and preserves total profile stats', () => {
  const entry = buildArenaLeaderboardEntry({
    currentEntry: {
      uid: 'u1',
      displayName: 'Existing',
      arenaXP: 250,
      dailyKey: '2026-03-09',
      dailyXP: 90,
      weeklyKey: '2026-W10',
      weeklyXP: 180,
      wins: 2,
      totalGames: 12,
      correctAnswers: 50,
      bestStreak: 6,
      perfectGames: 1,
      createdAtMs: 111,
    },
    user: { uid: 'u1', displayName: 'Ali', photoURL: 'avatar.png' },
    profile: {
      displayName: 'Ali',
      photoURL: 'avatar.png',
      arenaXP: 300,
      arenaCorrect: 55,
      arenaPlayed: 13,
      arenaStreak: 8,
      arenaPerfect: 2,
      arenaStats: { wins: 3 },
    },
    xpDelta: 25,
    now: new Date('2026-03-10T09:15:00Z').getTime(),
  });

  assert.equal(entry.uid, 'u1');
  assert.equal(entry.displayName, 'Ali');
  assert.equal(entry.arenaXP, 300);
  assert.equal(entry.dailyKey, '2026-03-10');
  assert.equal(entry.weeklyKey, '2026-W11');
  assert.equal(entry.dailyXP, 25);
  assert.equal(entry.weeklyXP, 25);
  assert.equal(entry.wins, 3);
  assert.equal(entry.totalGames, 13);
  assert.equal(entry.correctAnswers, 55);
  assert.equal(entry.bestStreak, 8);
  assert.equal(entry.perfectGames, 2);
  assert.equal(entry.createdAtMs, 111);
  assert.equal(entry.rankScore, computeLeaderboardScore(entry));
});

test('buildArenaLeaderboardEntry treats profile arenaXP as the only all-time XP source', () => {
  const entry = buildArenaLeaderboardEntry({
    currentEntry: {
      uid: 'u1',
      arenaXP: 999,
      dailyKey: '2026-03-10',
      dailyXP: 40,
      weeklyKey: '2026-W11',
      weeklyXP: 70,
      createdAtMs: 200,
    },
    user: { uid: 'u1' },
    profile: {
      displayName: 'Ali',
      photoURL: '',
      arenaStats: { wins: 1 },
    },
    xpDelta: 0,
    now: new Date('2026-03-10T09:15:00Z').getTime(),
  });

  assert.equal(entry.arenaXP, 0);
  assert.equal(entry.dailyXP, 40);
  assert.equal(entry.weeklyXP, 70);
});

test('rankLeaderboardEntries sorts by score and annotates rank and current user', () => {
  const rows = rankLeaderboardEntries([
    { uid: 'u2', displayName: 'B', arenaXP: 200, dailyXP: 15, rankScore: 2000010000, dailyScore: 150000000, updatedAtMs: 200 },
    { uid: 'u1', displayName: 'A', arenaXP: 220, dailyXP: 10, rankScore: 2200000000, dailyScore: 100000000, updatedAtMs: 300 },
    { uid: 'u3', displayName: 'C', arenaXP: 200, dailyXP: 15, rankScore: 2000010000, dailyScore: 150000000, updatedAtMs: 100 },
  ], 'daily', 'u3');

  assert.deepEqual(rows.map(row => row.uid), ['u3', 'u2', 'u1']);
  assert.deepEqual(rows.map(row => row.rank), [1, 2, 3]);
  assert.equal(rows[0].scopeXP, 15);
  assert.equal(Object.prototype.hasOwnProperty.call(rows[0], 'xp'), false);
  assert.equal(rows[0].isMe, true);
  assert.equal(rows[1].isMe, false);
});