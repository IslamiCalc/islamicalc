// ============================================================
// IslamiCalc — firebase.js v2.0
// الأمان + Auth + Profile + Levels + Badges + Leaderboard
// ============================================================

import { initializeApp }           from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged }
                                    from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, increment,
         collection, query, orderBy, limit, getDocs, serverTimestamp, arrayUnion }
                                    from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ============================================================
// ⚠️  إعدادات Firebase — مقيّدة بـ Domain في Firebase Console
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

// ============================================================
// تهيئة Firebase
// ============================================================
const app      = initializeApp(firebaseConfig);
const auth     = getAuth(app);
const db       = getFirestore(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

// ============================================================
// نظام المستويات — مكتمل بدون ثغرة المستوى 4
// ============================================================
const LEVELS = [
  { level: 1,  title: "مسلم مبتدئ",    xp: 0     },
  { level: 2,  title: "حلقة القرآن",   xp: 200   },
  { level: 3,  title: "طالب مسجد",     xp: 500   },
  { level: 4,  title: "حافظ متقدم",    xp: 900   },  // ✅ مضاف — كان مفقوداً
  { level: 5,  title: "طالب علم",      xp: 1500  },
  { level: 10, title: "فقيه ناشئ",     xp: 4000  },
  { level: 15, title: "عالم متقدم",    xp: 9000  },
  { level: 20, title: "شيخ",           xp: 18000 },
  { level: 25, title: "إمام الأرينا",  xp: 35000 }
];

// ============================================================
// الأوسمة المتاحة
// ============================================================
const BADGES_DEF = {
  "first_login":      { label: "أول خطوة",        icon: "🌱", desc: "سجّلت دخولك لأول مرة"           },
  "zakat_calc":       { label: "محاسب أمين",       icon: "💰", desc: "استخدمت حاسبة الزكاة"           },
  "khatma_done":      { label: "ختمة مباركة",      icon: "📖", desc: "أكملت ختمة القرآن"              },
  "streak_7":         { label: "أسبوع متواصل",     icon: "🔥", desc: "دخلت 7 أيام متتالية"            },
  "streak_30":        { label: "شهر إخلاص",        icon: "⭐", desc: "دخلت 30 يوماً متتالياً"         },
  "quiz_winner":      { label: "المسابقة الأولى",  icon: "🏆", desc: "فزت في تحدٍّ إسلامي"            },
  "level_5":          { label: "طالب علم",         icon: "📚", desc: "وصلت للمستوى الخامس"            },
  "level_10":         { label: "فقيه ناشئ",        icon: "🎓", desc: "وصلت للمستوى العاشر"            },
  "athkar_100":       { label: "ذاكر الله",        icon: "📿", desc: "قرأت الأذكار 100 مرة"           },
  "daily_q_10":       { label: "متعلم نشيط",       icon: "❓", desc: "أجبت على 10 أسئلة يومية صحيحة" }
};

// ============================================================
// حالة المستخدم
// ============================================================
let currentUser    = null;
let currentUserDoc = null;   // cache محلي لبيانات Firestore

// ============================================================
// مراقبة تسجيل الدخول
// ============================================================
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    currentUserDoc = await ensureUserDoc(user);
    updateNavbarUI(user);
    // إشعار بقية صفحات الموقع
    window.dispatchEvent(new CustomEvent("userReady", { detail: currentUserDoc }));
  } else {
    currentUser    = null;
    currentUserDoc = null;
    updateNavbarUI(null);
    window.dispatchEvent(new CustomEvent("userSignedOut"));
  }
});

// ============================================================
// تسجيل الدخول بـ Google
// ============================================================
async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, provider);
    const name   = result.user.displayName?.split(" ")[0] || "أهلاً";
    showToast("✅ أهلاً " + name + "!", "toast-success");
    closeLoginModal?.();
  } catch (error) {
    if (error.code !== "auth/popup-closed-by-user") {
      showToast("❌ خطأ في تسجيل الدخول", "toast-error");
      console.error("Login error:", error.code);
    }
  }
}

// ============================================================
// تسجيل الخروج
// ============================================================
async function logoutUser() {
  try {
    await signOut(auth);
    showToast("👋 تم تسجيل الخروج", "toast-gold");
  } catch (error) {
    console.error("Logout error:", error.code);
  }
}

// ============================================================
// إنشاء / تحديث وثيقة المستخدم
// ============================================================
async function ensureUserDoc(user) {
  try {
    const ref  = doc(db, "users", user.uid);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      // مستخدم جديد
      const country = await getUserCountry();
      const newDoc  = {
        uid:            user.uid,
        name:           user.displayName || "مجهول",
        email:          user.email,
        photo:          user.photoURL || "",
        xp:             0,
        level:          1,
        streak:         1,
        longestStreak:  1,
        lastLogin:      serverTimestamp(),
        badges:         ["first_login"],
        country,
        khatmaCount:    0,      // عدد مرات ختم القرآن
        athkarCount:    0,      // عدد مرات إتمام الأذكار
        quizWins:       0,      // عدد الانتصارات في التحديات
        dailyQCorrect:  0,      // أسئلة يومية صحيحة
        createdAt:      serverTimestamp()
      };
      await setDoc(ref, newDoc);
      return newDoc;
    } else {
      // مستخدم موجود — تحديث الـ Streak فقط
      const updated = await updateStreak(user.uid, snap.data());
      return { ...snap.data(), ...updated };
    }
  } catch (error) {
    console.error("ensureUserDoc error:", error.code);
    return null;
  }
}

// ============================================================
// تحديث الـ Streak — منطق مُصحَّح
// ============================================================
async function updateStreak(uid, data) {
  try {
    const lastLogin  = data.lastLogin?.toDate?.() || new Date(0);
    const now        = new Date();
    const diffDays   = Math.floor(
      (now.setHours(0,0,0,0) - new Date(lastLogin).setHours(0,0,0,0)) / 86400000
    );

    let newStreak = data.streak || 0;

    if (diffDays === 0) {
      // نفس اليوم — لا تغيير للـ streak
      return {};
    } else if (diffDays === 1) {
      newStreak += 1;
    } else {
      newStreak = 1;  // انقطع
    }

    const longestStreak = Math.max(newStreak, data.longestStreak || 0);
    const updateData    = { lastLogin: serverTimestamp(), streak: newStreak, longestStreak };

    await updateDoc(doc(db, "users", uid), updateData);

    // Badges للـ Streak
    if (newStreak >= 7)  await addBadgeInternal(uid, data.badges || [], "streak_7");
    if (newStreak >= 30) await addBadgeInternal(uid, data.badges || [], "streak_30");

    return updateData;
  } catch (error) {
    console.error("updateStreak error:", error.code);
    return {};
  }
}

// ============================================================
// إضافة XP — بدون قراءة مزدوجة
// ============================================================
async function addXPToFirebase(amount, reason = "") {
  // Fallback محلي إذا لم يسجّل الدخول
  if (!currentUser) {
    const local = parseInt(localStorage.getItem("userXP") || "0");
    localStorage.setItem("userXP", local + amount);
    showXPFloat(amount);
    return;
  }

  try {
    const ref     = doc(db, "users", currentUser.uid);
    const oldData = currentUserDoc || {};
    const oldXP   = oldData.xp || 0;
    const newXP   = oldXP + amount;

    await updateDoc(ref, { xp: increment(amount) });

    // تحديث الـ cache المحلي
    if (currentUserDoc) currentUserDoc.xp = newXP;
    localStorage.setItem("userXP", newXP);

    showXPFloat(amount);
    await checkLevelUp(newXP, currentUser.uid, oldData.level || 1);

  } catch (error) {
    console.error("addXP error:", error.code);
    const local = parseInt(localStorage.getItem("userXP") || "0");
    localStorage.setItem("userXP", local + amount);
  }
}

// ============================================================
// فحص ترقّي المستوى — بدون قراءة إضافية
// ============================================================
async function checkLevelUp(newXP, uid, oldLevel) {
  const lvl = getLevelFromXP(newXP);
  if (lvl.level > oldLevel) {
    if (currentUserDoc) currentUserDoc.level = lvl.level;
    localStorage.setItem("userLevel", lvl.level);
    showToast("🎉 ترقيت! أصبحت " + lvl.title, "toast-gold");
    await updateDoc(doc(db, "users", uid), { level: lvl.level });

    // Badge للمستوى
    const badges = currentUserDoc?.badges || [];
    if (lvl.level >= 5)  await addBadgeInternal(uid, badges, "level_5");
    if (lvl.level >= 10) await addBadgeInternal(uid, badges, "level_10");
  }
}

// ============================================================
// حساب المستوى من XP
// ============================================================
function getLevelFromXP(xp) {
  let current = LEVELS[0];
  for (const lvl of LEVELS) {
    if (xp >= lvl.xp) current = lvl;
    else break;
  }
  return current;
}

function getLevelProgress(xp) {
  const lvl     = getLevelFromXP(xp);
  const idx     = LEVELS.findIndex(l => l.level === lvl.level);
  const nextLvl = LEVELS[idx + 1];
  if (!nextLvl) return { percent: 100, current: xp, needed: xp };
  const progress = ((xp - lvl.xp) / (nextLvl.xp - lvl.xp)) * 100;
  return {
    percent: Math.min(Math.round(progress), 100),
    current: xp - lvl.xp,
    needed:  nextLvl.xp - lvl.xp
  };
}

// ============================================================
// إضافة Badge — دالة داخلية (لا تستدعيها مباشرة)
// ============================================================
async function addBadgeInternal(uid, currentBadges, badgeId) {
  if (currentBadges.includes(badgeId)) return;
  try {
    await updateDoc(doc(db, "users", uid), { badges: arrayUnion(badgeId) });
    if (currentUserDoc) currentUserDoc.badges = [...(currentUserDoc.badges || []), badgeId];
    const def = BADGES_DEF[badgeId];
    if (def) showToast(`${def.icon} حصلت على وسام: ${def.label}`, "toast-gold");
  } catch (e) {
    console.error("addBadge error:", e.code);
  }
}

// ============================================================
// إضافة Badge — للاستخدام الخارجي من الصفحات
// ============================================================
async function addBadge(badgeId) {
  if (!currentUser || !currentUserDoc) return;
  await addBadgeInternal(currentUser.uid, currentUserDoc.badges || [], badgeId);
}

// ============================================================
// Leaderboard — مع فلترة صحيحة للدولة
// ============================================================
async function getLeaderboard(type = "global") {
  try {
    const q    = query(collection(db, "users"), orderBy("xp", "desc"), limit(100));
    const snap = await getDocs(q);
    const all  = snap.docs.map((d, i) => ({ rank: i + 1, ...d.data() }));

    if (type === "country" && currentUserDoc?.country) {
      const filtered = all
        .filter(u => u.country === currentUserDoc.country)
        .map((u, i) => ({ ...u, rank: i + 1 }));
      return filtered;
    }
    return all;
  } catch (error) {
    console.error("getLeaderboard error:", error.code);
    return [];
  }
}

// ============================================================
// تحديث واجهة الـ Navbar — بدون innerHTML للاسم (حماية XSS)
// ============================================================
function updateNavbarUI(user) {
  const loginBtn = document.getElementById("loginBtn");
  if (!loginBtn) return;

  if (user) {
    // إنشاء العناصر بـ DOM API بدلاً من innerHTML للحماية من XSS
    loginBtn.innerHTML = "";

    const img  = document.createElement("img");
    img.src    = user.photoURL || "";
    img.alt    = "";
    img.width  = 28;
    img.height = 28;
    img.style.cssText = "border-radius:50%; margin-left:6px; vertical-align:middle;";
    img.onerror = () => { img.style.display = "none"; };

    const span     = document.createElement("span");
    span.textContent = (user.displayName?.split(" ")[0] || "حسابي") + " ▾";

    loginBtn.appendChild(img);
    loginBtn.appendChild(span);
    loginBtn.onclick = showUserMenu;

    // إضافة زر الـ Profile في القائمة الجانبية إن وجدت
    const navProfile = document.getElementById("navProfile");
    if (navProfile) navProfile.style.display = "block";

  } else {
    loginBtn.textContent = "دخول بـ Google";
    loginBtn.onclick     = () => openLoginModal?.();

    const navProfile = document.getElementById("navProfile");
    if (navProfile) navProfile.style.display = "none";
  }
}

// ============================================================
// Popup صغير في الـ Navbar عند الضغط
// ============================================================
function showUserMenu() {
  const existing = document.getElementById("userMenuPopup");
  if (existing) { existing.remove(); return; }

  const xp      = currentUserDoc?.xp     ?? parseInt(localStorage.getItem("userXP")     || "0");
  const level   = currentUserDoc?.level  ?? parseInt(localStorage.getItem("userLevel")  || "1");
  const streak  = currentUserDoc?.streak ?? parseInt(localStorage.getItem("userStreak") || "0");
  const lvl     = getLevelFromXP(xp);
  const prog    = getLevelProgress(xp);
  const photo   = currentUser?.photoURL || "";
  const name    = currentUser?.displayName || "مستخدم";

  const menu         = document.createElement("div");
  menu.id            = "userMenuPopup";
  menu.style.cssText = `
    position:fixed; top:68px; left:50%; transform:translateX(-50%);
    background:var(--bg-card,#1a1a2e); border:1px solid var(--border,#333);
    border-radius:20px; padding:20px; z-index:99999;
    box-shadow:0 20px 60px rgba(0,0,0,0.4);
    width:min(300px, calc(100vw - 32px));
    font-family: inherit; direction: rtl;
  `;

  // بناء المحتوى بأمان
  const photoEl = document.createElement("img");
  photoEl.src   = photo;
  photoEl.alt   = "";
  photoEl.style.cssText = "width:60px;height:60px;border-radius:50%;border:3px solid var(--gold,#c9a84c);display:block;margin:0 auto 10px;";
  photoEl.onerror = () => { photoEl.src = ""; photoEl.style.display="none"; };

  const nameEl       = document.createElement("div");
  nameEl.textContent = name;
  nameEl.style.cssText = "text-align:center;font-weight:700;font-size:1rem;margin-bottom:4px;";

  const titleEl       = document.createElement("div");
  titleEl.textContent = lvl.title;
  titleEl.style.cssText = "text-align:center;color:var(--gold,#c9a84c);font-size:0.85rem;margin-bottom:14px;";

  // شريط التقدم
  const progressBar = document.createElement("div");
  progressBar.style.cssText = "background:rgba(255,255,255,0.1);border-radius:10px;height:8px;margin-bottom:4px;overflow:hidden;";
  const progressFill = document.createElement("div");
  progressFill.style.cssText = `width:${prog.percent}%;height:100%;background:linear-gradient(90deg,var(--primary,#2d6a4f),var(--gold,#c9a84c));border-radius:10px;transition:width 0.6s;`;
  progressBar.appendChild(progressFill);

  const progressText       = document.createElement("div");
  progressText.textContent = `${prog.current} / ${prog.needed} XP للمستوى القادم`;
  progressText.style.cssText = "text-align:center;font-size:0.75rem;opacity:0.6;margin-bottom:14px;";

  // إحصائيات
  const stats = document.createElement("div");
  stats.style.cssText = "display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:16px;";
  [
    ["⭐", xp,     "نقطة XP"],
    ["🔥", streak, "أيام Streak"],
    ["📊", level,  "المستوى"]
  ].forEach(([icon, val, lbl]) => {
    const cell       = document.createElement("div");
    cell.style.cssText = "background:rgba(255,255,255,0.05);border-radius:10px;padding:8px;text-align:center;";
    cell.innerHTML   = `<div style="font-size:1.2rem">${icon}</div>
                        <div style="font-weight:700;font-size:1rem">${val}</div>
                        <div style="font-size:0.7rem;opacity:0.6">${lbl}</div>`;
    stats.appendChild(cell);
  });

  // أزرار
  const btnProfile       = document.createElement("a");
  btnProfile.href        = "/profile";
  btnProfile.textContent = "👤 صفحة البروفايل";
  btnProfile.style.cssText = `
    display:block;width:100%;padding:10px;margin-bottom:8px;border-radius:12px;
    background:linear-gradient(135deg,var(--primary,#2d6a4f),#1a4a35);
    color:#fff;text-align:center;text-decoration:none;font-weight:600;font-size:0.9rem;
    box-sizing:border-box;
  `;

  const btnLogout       = document.createElement("button");
  btnLogout.textContent = "تسجيل الخروج";
  btnLogout.style.cssText = `
    display:block;width:100%;padding:10px;border-radius:12px;
    background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);
    color:#ef4444;font-weight:600;font-size:0.9rem;cursor:pointer;
  `;
  btnLogout.onclick = () => { menu.remove(); logoutUser(); };

  menu.append(photoEl, nameEl, titleEl, progressBar, progressText, stats, btnProfile, btnLogout);
  document.body.appendChild(menu);

  // إغلاق عند النقر خارج
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
// تحديد الدولة
// ============================================================
async function getUserCountry() {
  try {
    const r = await fetch("https://api.country.is/");
    const d = await r.json();
    return d.country || "unknown";
  } catch {
    return "unknown";
  }
}

// ============================================================
// دوال مساعدة للصفحات الأخرى
// ============================================================
function showToast(msg, type = "") {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = msg;
  toast.className   = "toast show " + type;
  setTimeout(() => toast.classList.remove("show"), 3500);
}

function showXPFloat(amount) {
  const el            = document.createElement("div");
  el.className        = "xp-float";
  el.textContent      = "+" + amount + " XP";
  el.style.cssText    = "position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:99999;pointer-events:none;";
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}

// ============================================================
// تصدير API موحّد للاستخدام في جميع الصفحات
// ============================================================
const islamiCalc = {
  // Auth
  loginWithGoogle,
  logoutUser,
  // User
  getCurrentUser:   () => currentUser,
  getCurrentDoc:    () => currentUserDoc,
  // XP & Levels
  addXP:            addXPToFirebase,
  getLevelFromXP,
  getLevelProgress,
  // Badges
  addBadge,
  BADGES_DEF,
  // Leaderboard
  getLeaderboard,
  // Firebase instances (للصفحات التي تحتاجها)
  auth,
  db,
  doc,
  updateDoc,
  increment,
  serverTimestamp,
  arrayUnion
};

window.islamiCalc     = islamiCalc;
window.loginWithGoogle = loginWithGoogle;   // ← للتوافق مع الكود القديم
window.logoutUser      = logoutUser;
