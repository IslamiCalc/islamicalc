// ============================================================
// IslamiCalc — firebase.js v3.0
// Auth + Firestore + XP + Levels + Badges + Leaderboard
// + islamiCalcReady (للتوافق مع كل الصفحات)
// + logActivity (للـ Profile heatmap)
// + logout alias
// ============================================================

import { initializeApp }
  from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup,
  signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc, updateDoc,
  increment, collection, query, orderBy, limit,
  getDocs, serverTimestamp, arrayUnion
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ============================================================
// Firebase Config
// ============================================================
const firebaseConfig = {
  apiKey:            "AIzaSyAFzGPiCFB6vEH-wylbW4zRxxgB_2vZSIs",
  authDomain:        "islamicalc.firebaseapp.com",
  projectId:         "islamicalc",
  storageBucket:     "islamicalc.firebasestorage.app",
  messagingSenderId: "708228371498",
  appId:             "1:708228371498:web:b71ec4a97af9f8fa0c9f53",
  measurementId:     "G-F2P38XX70Q"
};

const app      = initializeApp(firebaseConfig);
const auth     = getAuth(app);
const db       = getFirestore(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

// ============================================================
// المستويات — موحّدة مع الميدان والبروفايل
// ============================================================
const LEVELS = [
  { level:1,  title:"المبتدئ",       icon:"🌱",  xp:0     },
  { level:2,  title:"الطالب",        icon:"📚",  xp:100   },
  { level:3,  title:"الراسخ",        icon:"🎯",  xp:300   },
  { level:4,  title:"العارف",        icon:"💡",  xp:600   },
  { level:5,  title:"الحافظ",        icon:"🛡",  xp:1000  },
  { level:6,  title:"الفقيه",        icon:"⚖️", xp:1500  },
  { level:7,  title:"الشيخ",         icon:"🎓",  xp:2200  },
  { level:8,  title:"العلّامة",      icon:"🌟",  xp:3000  },
  { level:9,  title:"إمام الميدان", icon:"👑",  xp:4000  },
];

// ============================================================
// الأوسمة
// ============================================================
const BADGES_DEF = {
  "first_login":   { label:"أول خطوة",        icon:"🌱", desc:"سجّلت دخولك لأول مرة"              },
  "zakat_calc":    { label:"محاسب أمين",       icon:"💰", desc:"استخدمت حاسبة الزكاة"              },
  "khatma_done":   { label:"ختمة مباركة",     icon:"📖", desc:"أكملت ختمة القرآن"                 },
  "streak_7":      { label:"أسبوع متواصل",    icon:"🔥", desc:"دخلت 7 أيام متتالية"               },
  "streak_30":     { label:"شهر إخلاص",       icon:"⭐", desc:"دخلت 30 يوماً متتالياً"            },
  "maydan_win":    { label:"فائز الميدان",    icon:"🏆", desc:"فزت في جولة في الميدان"            },
  "maydan_streak": { label:"سلسلة النار",     icon:"⚡", desc:"حققت سلسلة 5 إجابات صحيحة"        },
  "level_5":       { label:"الحافظ",          icon:"🛡", desc:"وصلت للمستوى الخامس"               },
  "level_9":       { label:"إمام الميدان",   icon:"👑", desc:"وصلت للمستوى الأعلى"               },
  "athkar_100":    { label:"ذاكر الله",       icon:"📿", desc:"أتممت الأذكار 100 مرة"             },
  "daily_q_10":    { label:"متعلم نشيط",      icon:"❓", desc:"أجبت على 10 أسئلة يومية صحيحة"    },
};

// ============================================================
// الحالة
// ============================================================
let currentUser    = null;
let currentUserDoc = null;

// ============================================================
// مراقبة Auth
// ============================================================
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser    = user;
    currentUserDoc = await ensureUserDoc(user);
    updateNavbarUI(user);
    window.dispatchEvent(new CustomEvent("islamiCalcReady"));
    window.dispatchEvent(new CustomEvent("userReady", { detail: currentUserDoc }));
  } else {
    currentUser    = null;
    currentUserDoc = null;
    updateNavbarUI(null);
    window.dispatchEvent(new CustomEvent("islamiCalcReady")); // يُطلق دائماً
    window.dispatchEvent(new CustomEvent("userSignedOut"));
  }
});

// ============================================================
// تسجيل الدخول
// ============================================================
async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, provider);
    const name = result.user.displayName?.split(" ")[0] || "أهلاً";
    showToast("✅ أهلاً " + name + "!", "toast-success");
    // إغلاق مودال تسجيل الدخول إن كان مفتوحاً
    document.getElementById("loginModal")?.classList.remove("open");
  } catch (error) {
    if (error.code !== "auth/popup-closed-by-user")
      showToast("❌ خطأ في تسجيل الدخول", "toast-error");
  }
}

// ============================================================
// تسجيل الخروج
// ============================================================
async function logout() {
  try {
    await signOut(auth);
    showToast("👋 تم تسجيل الخروج", "toast-gold");
    setTimeout(() => location.href = "/", 800);
  } catch (e) { console.error("logout:", e.code); }
}
const logoutUser = logout; // alias للتوافق مع الكود القديم

// ============================================================
// إنشاء / تحديث وثيقة المستخدم
// ============================================================
async function ensureUserDoc(user) {
  try {
    const ref  = doc(db, "users", user.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      const country = await getUserCountry();
      const newDoc = {
        uid: user.uid,
        name: user.displayName || "مجهول",
        email: user.email,
        photo: user.photoURL || "",
        xp: 0, level: 1,
        streak: 1, longestStreak: 1,
        lastLogin: serverTimestamp(),
        badges: ["first_login"],
        country,
        khatmaCount: 0,
        athkarCount: 0,
        maydanWins: 0,
        maydanXP: 0,
        dailyQCorrect: 0,
        createdAt: serverTimestamp()
      };
      await setDoc(ref, newDoc);
      return newDoc;
    } else {
      const updated = await updateStreak(user.uid, snap.data());
      return { ...snap.data(), ...updated };
    }
  } catch (e) { console.error("ensureUserDoc:", e.code); return null; }
}

// ============================================================
// تحديث Streak
// ============================================================
async function updateStreak(uid, data) {
  try {
    const lastLogin = data.lastLogin?.toDate?.() || new Date(0);
    const now       = new Date();
    const diffDays  = Math.floor(
      (now.setHours(0,0,0,0) - new Date(lastLogin).setHours(0,0,0,0)) / 86400000
    );
    if (diffDays === 0) return {};
    const newStreak     = diffDays === 1 ? (data.streak || 0) + 1 : 1;
    const longestStreak = Math.max(newStreak, data.longestStreak || 0);
    const updateData    = { lastLogin: serverTimestamp(), streak: newStreak, longestStreak };
    await updateDoc(doc(db, "users", uid), updateData);
    if (newStreak >= 7)  await addBadgeInternal(uid, data.badges || [], "streak_7");
    if (newStreak >= 30) await addBadgeInternal(uid, data.badges || [], "streak_30");
    return updateData;
  } catch (e) { console.error("updateStreak:", e.code); return {}; }
}

// ============================================================
// إضافة XP
// ============================================================
async function addXPToFirebase(amount, reason = "") {
  if (!currentUser) {
    localStorage.setItem("userXP",
      parseInt(localStorage.getItem("userXP") || "0") + amount);
    showXPFloat(amount);
    return;
  }
  try {
    const oldXP = currentUserDoc?.xp || 0;
    const newXP = oldXP + amount;
    await updateDoc(doc(db, "users", currentUser.uid), { xp: increment(amount) });
    if (currentUserDoc) currentUserDoc.xp = newXP;
    localStorage.setItem("userXP", newXP);
    showXPFloat(amount);
    await checkLevelUp(newXP, currentUser.uid, currentUserDoc?.level || 1);
  } catch (e) {
    localStorage.setItem("userXP",
      parseInt(localStorage.getItem("userXP") || "0") + amount);
  }
}
const addXP = addXPToFirebase; // alias

// ============================================================
// فحص ترقّي المستوى
// ============================================================
async function checkLevelUp(newXP, uid, oldLevel) {
  const lvl = getLevelFromXP(newXP);
  if (lvl.level > oldLevel) {
    if (currentUserDoc) currentUserDoc.level = lvl.level;
    localStorage.setItem("userLevel", lvl.level);
    showToast(`🎉 ترقيت! أصبحت ${lvl.icon} ${lvl.title}`, "toast-gold");
    await updateDoc(doc(db, "users", uid), { level: lvl.level });
    const badges = currentUserDoc?.badges || [];
    if (lvl.level >= 5) await addBadgeInternal(uid, badges, "level_5");
    if (lvl.level >= 9) await addBadgeInternal(uid, badges, "level_9");
  }
}

// ============================================================
// حساب المستوى
// ============================================================
function getLevelFromXP(xp) {
  let current = LEVELS[0];
  for (const lvl of LEVELS) { if (xp >= lvl.xp) current = lvl; else break; }
  return current;
}

function getLevelProgress(xp) {
  const lvl  = getLevelFromXP(xp);
  const idx  = LEVELS.findIndex(l => l.level === lvl.level);
  const next = LEVELS[idx + 1];
  if (!next) return { percent: 100, current: xp, needed: xp };
  const progress = ((xp - lvl.xp) / (next.xp - lvl.xp)) * 100;
  return {
    percent: Math.min(Math.round(progress), 100),
    current: xp - lvl.xp,
    needed:  next.xp - lvl.xp
  };
}

// ============================================================
// Badges
// ============================================================
async function addBadgeInternal(uid, currentBadges, badgeId) {
  if (currentBadges.includes(badgeId)) return;
  try {
    await updateDoc(doc(db, "users", uid), { badges: arrayUnion(badgeId) });
    if (currentUserDoc)
      currentUserDoc.badges = [...(currentUserDoc.badges || []), badgeId];
    const def = BADGES_DEF[badgeId];
    if (def) showToast(`${def.icon} وسام جديد: ${def.label}`, "toast-gold");
  } catch (e) { console.error("addBadge:", e.code); }
}

async function addBadge(badgeId) {
  if (!currentUser || !currentUserDoc) return;
  await addBadgeInternal(currentUser.uid, currentUserDoc.badges || [], badgeId);
}

// ============================================================
// Leaderboard
// ============================================================
async function getLeaderboard(type = "global") {
  try {
    const q    = query(collection(db, "users"), orderBy("xp", "desc"), limit(100));
    const snap = await getDocs(q);
    const all  = snap.docs.map((d, i) => ({ rank: i + 1, ...d.data() }));
    if (type === "country" && currentUserDoc?.country)
      return all
        .filter(u => u.country === currentUserDoc.country)
        .map((u, i) => ({ ...u, rank: i + 1 }));
    return all;
  } catch (e) { console.error("getLeaderboard:", e.code); return []; }
}

// ============================================================
// تسجيل نشاط — للـ Profile heatmap
// ============================================================
function logActivity(text, sub = "", icon = "⭐",
                     color = "rgba(45,106,79,0.1)", xp = 0) {
  const activity = JSON.parse(localStorage.getItem("ic_activity") || "[]");
  const now = new Date();
  activity.push({
    text, sub, icon, color, xp,
    time: now.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })
  });
  if (activity.length > 50) activity.shift();
  localStorage.setItem("ic_activity", JSON.stringify(activity));

  // تحديث heatmap
  const hm  = JSON.parse(localStorage.getItem("ic_heatmap") || "{}");
  const key = now.toISOString().split("T")[0];
  hm[key]   = (hm[key] || 0) + 1;
  localStorage.setItem("ic_heatmap", JSON.stringify(hm));
}

// ============================================================
// تحديث Navbar
// ============================================================
function updateNavbarUI(user) {
  const loginBtn = document.getElementById("loginBtn");
  if (!loginBtn) return;
  if (user) {
    loginBtn.innerHTML = "";
    const img = document.createElement("img");
    img.src = user.photoURL || ""; img.alt = ""; img.width = 28; img.height = 28;
    img.style.cssText = "border-radius:50%;margin-left:6px;vertical-align:middle;";
    img.onerror = () => img.style.display = "none";
    const span = document.createElement("span");
    span.textContent = (user.displayName?.split(" ")[0] || "حسابي") + " ▾";
    loginBtn.appendChild(img);
    loginBtn.appendChild(span);
    loginBtn.onclick = showUserMenu;
    const navProfile = document.getElementById("navProfile");
    if (navProfile) navProfile.style.display = "block";
  } else {
    loginBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="2" width="16" height="16">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg> دخول`;
    loginBtn.onclick = loginWithGoogle;
    const navProfile = document.getElementById("navProfile");
    if (navProfile) navProfile.style.display = "none";
  }
}

// ============================================================
// User Menu Popup
// ============================================================
function showUserMenu() {
  const existing = document.getElementById("userMenuPopup");
  if (existing) { existing.remove(); return; }

  const xp     = currentUserDoc?.xp     ?? parseInt(localStorage.getItem("userXP")     || "0");
  const streak = currentUserDoc?.streak ?? parseInt(localStorage.getItem("userStreak") || "0");
  const lvl    = getLevelFromXP(xp);
  const prog   = getLevelProgress(xp);

  const menu = document.createElement("div");
  menu.id = "userMenuPopup";
  menu.style.cssText = `
    position:fixed; top:68px; left:50%; transform:translateX(-50%);
    background:var(--bg-card); border:1px solid var(--border);
    border-radius:20px; padding:20px; z-index:99999;
    box-shadow:0 20px 60px rgba(0,0,0,0.5);
    width:min(300px, calc(100vw - 32px));
    font-family:inherit; direction:rtl;
  `;

  const photoEl = document.createElement("img");
  photoEl.src = currentUser?.photoURL || ""; photoEl.alt = "";
  photoEl.style.cssText = "width:60px;height:60px;border-radius:50%;border:3px solid var(--gold);display:block;margin:0 auto 10px;";
  photoEl.onerror = () => photoEl.style.display = "none";

  const nameEl = document.createElement("div");
  nameEl.textContent = currentUser?.displayName || "مستخدم";
  nameEl.style.cssText = "text-align:center;font-weight:800;font-size:16px;margin-bottom:2px;";

  const titleEl = document.createElement("div");
  titleEl.textContent = `${lvl.icon} ${lvl.title}`;
  titleEl.style.cssText = "text-align:center;color:var(--gold);font-size:13px;margin-bottom:12px;";

  const barWrap = document.createElement("div");
  barWrap.style.cssText = "background:rgba(255,255,255,0.08);border-radius:999px;height:8px;overflow:hidden;margin-bottom:4px;";
  const barFill = document.createElement("div");
  barFill.style.cssText = `width:${prog.percent}%;height:100%;background:linear-gradient(90deg,var(--primary),var(--gold));border-radius:999px;`;
  barWrap.appendChild(barFill);

  const barTxt = document.createElement("div");
  barTxt.textContent = `${prog.current} / ${prog.needed} XP`;
  barTxt.style.cssText = "text-align:center;font-size:11px;color:var(--text-muted);margin-bottom:12px;";

  const stats = document.createElement("div");
  stats.style.cssText = "display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px;";
  [
    ["⭐", xp,          "XP"       ],
    ["🔥", streak,      "يوم"      ],
    [lvl.icon, lvl.level, "المستوى"],
  ].forEach(([ic, v, lb]) => {
    const c = document.createElement("div");
    c.style.cssText = "background:rgba(255,255,255,0.05);border-radius:10px;padding:8px;text-align:center;";
    const ico = document.createElement("div"); ico.textContent = ic; ico.style.fontSize = "18px";
    const val = document.createElement("div"); val.textContent = v;  val.style.cssText = "font-size:15px;font-weight:900;";
    const lbl = document.createElement("div"); lbl.textContent = lb; lbl.style.cssText = "font-size:10px;color:var(--text-muted);";
    c.append(ico, val, lbl);
    stats.appendChild(c);
  });

  const btnProfile = document.createElement("a");
  btnProfile.href = "/profile";
  btnProfile.textContent = "👤 صفحة البروفايل";
  btnProfile.style.cssText = "display:block;width:100%;padding:10px;margin-bottom:8px;border-radius:12px;background:linear-gradient(135deg,var(--primary),#1a4a35);color:#fff;text-align:center;text-decoration:none;font-weight:800;font-size:13px;box-sizing:border-box;";

  const btnLogout = document.createElement("button");
  btnLogout.textContent = "تسجيل الخروج";
  btnLogout.style.cssText = "display:block;width:100%;padding:10px;border-radius:12px;background:rgba(248,81,73,0.1);border:1px solid rgba(248,81,73,0.3);color:#f85149;font-family:inherit;font-weight:700;font-size:13px;cursor:pointer;";
  btnLogout.onclick = () => { menu.remove(); logout(); };

  menu.append(photoEl, nameEl, titleEl, barWrap, barTxt, stats, btnProfile, btnLogout);
  document.body.appendChild(menu);

  setTimeout(() => {
    document.addEventListener("click", function close(e) {
      if (!menu.contains(e.target) && e.target.id !== "loginBtn") {
        menu.remove();
        document.removeEventListener("click", close);
      }
    });
  }, 100);
}

// ============================================================
// مساعدات
// ============================================================
async function getUserCountry() {
  try {
    const r = await fetch("https://api.country.is/");
    return (await r.json()).country || "unknown";
  } catch { return "unknown"; }
}

function showToast(msg, type = "") {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = msg;
  toast.className = "toast show " + type;
  setTimeout(() => toast.classList.remove("show"), 3500);
}

function showXPFloat(amount) {
  const el = document.createElement("div");
  el.className = "xp-float";
  el.textContent = "+" + amount + " XP";
  el.style.cssText = "position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:99999;pointer-events:none;";
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}

// ============================================================
// API الموحّد — window.islamiCalc
// ============================================================
window.islamiCalc = {
  // Auth
  loginWithGoogle,
  logout,
  logoutUser,           // alias للتوافق

  // User
  getCurrentUser:  () => currentUser,
  getCurrentDoc:   () => currentUserDoc,

  // XP & Levels
  addXP: addXPToFirebase,
  getLevelFromXP,
  getLevelProgress,
  LEVELS,

  // Badges
  addBadge,
  BADGES_DEF,

  // Leaderboard
  getLeaderboard,

  // Activity Log
  logActivity,

  // Firebase refs (للصفحات التي تحتاجها)
  auth, db,
  doc, updateDoc, increment,
  serverTimestamp, arrayUnion,
};

// Aliases عالمية للتوافق مع الكود القديم
window.loginWithGoogle = loginWithGoogle;
window.logoutUser      = logoutUser;
window.addXP           = addXPToFirebase;
window.showToast       = showToast;
window.showXPFloat     = showXPFloat;
window.logActivity     = logActivity;
