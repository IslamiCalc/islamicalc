// ========================================
//   IslamiCalc - firebase.js
//   ربط Firebase + نظام المستخدمين
// ========================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, increment,
         collection, query, orderBy, limit, getDocs, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ========== إعدادات Firebase ==========
// ⚠️ ضع هنا بياناتك من Firebase Console
const firebaseConfig = {
  apiKey:            "AIzaSyAFzGPiCFB6vEH-wylbW4zRxxgB_2vZSIs",
  authDomain:        "islamicalc.firebaseapp.com",
  projectId:         "islamicalc",
  storageBucket:     "islamicalc.firebasestorage.app",
  messagingSenderId: "708228371498",
  appId:             "1:708228371498:web:b71ec4a97af9f8fa0c9f53",
  measurementId:     "G-F2P38XX70Q"
};

// ========== تهيئة Firebase ==========
const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

// ========== حالة المستخدم الحالي ==========
let currentUser = null;

// ========== مراقبة تسجيل الدخول ==========
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    await ensureUserDoc(user);
    updateNavbarUI(user);
    loadUserData(user.uid);
  } else {
    currentUser = null;
    updateNavbarUI(null);
  }
});

// ========== تسجيل الدخول بـ Google ==========
async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, provider);
    showToast("✅ أهلاً " + result.user.displayName + "!", "toast-success");
    closeLoginModal();
  } catch (error) {
    if (error.code !== "auth/popup-closed-by-user") {
      showToast("❌ خطأ في تسجيل الدخول", "toast-error");
      console.error("Login error:", error.message);
    }
  }
}

// ========== تسجيل الخروج ==========
async function logoutUser() {
  try {
    await signOut(auth);
    showToast("👋 تم تسجيل الخروج", "toast-gold");
    currentUser = null;
  } catch (error) {
    console.error("Logout error:", error.message);
  }
}

// ========== إنشاء وثيقة المستخدم (أول مرة) ==========
async function ensureUserDoc(user) {
  try {
    const ref  = doc(db, "users", user.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        uid:        user.uid,
        name:       user.displayName || "مجهول",
        email:      user.email,
        photo:      user.photoURL || "",
        xp:         0,
        level:      1,
        streak:     0,
        lastLogin:  serverTimestamp(),
        badges:     [],
        country:    await getUserCountry(),
        createdAt:  serverTimestamp()
      });
    } else {
      // تحديث آخر دخول وStreak
      await updateStreak(user.uid);
    }
  } catch (error) {
    console.error("ensureUserDoc error:", error.message);
    // نستخدم localStorage كبديل عند فشل Firebase
    useLocalFallback(user);
  }
}

// ========== تحديث الـ Streak ==========
async function updateStreak(uid) {
  try {
    const ref  = doc(db, "users", uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;

    const data = snap.data();
    const lastLogin = data.lastLogin?.toDate?.() || new Date(0);
    const now = new Date();
    const diffDays = Math.floor((now - lastLogin) / 86400000);

    let newStreak = data.streak || 0;
    if (diffDays === 1) {
      newStreak += 1; // يوم متتالي
    } else if (diffDays > 1) {
      newStreak = 1; // انقطع الـ Streak
    }

    await updateDoc(ref, {
      lastLogin: serverTimestamp(),
      streak:    newStreak
    });
  } catch (error) {
    console.error("updateStreak error:", error.message);
  }
}

// ========== إضافة XP ==========
async function addXPToFirebase(amount, reason = "") {
  if (!currentUser) {
    // حفظ محلياً بدون تسجيل
    const local = parseInt(localStorage.getItem("userXP") || "0");
    localStorage.setItem("userXP", local + amount);
    return;
  }
  try {
    const ref = doc(db, "users", currentUser.uid);
    await updateDoc(ref, { xp: increment(amount) });
    const snap = await getDoc(ref);
    const newXP = snap.data().xp;
    checkLevelUp(newXP, currentUser.uid);
    showXPFloat(amount);
  } catch (error) {
    console.error("addXP error:", error.message);
    // Fallback محلي
    const local = parseInt(localStorage.getItem("userXP") || "0");
    localStorage.setItem("userXP", local + amount);
  }
}

// ========== نظام الليفل ==========
const LEVELS = [
  { level: 1,  title: "مسلم مبتدئ",   xp: 0     },
  { level: 2,  title: "حلقة القرآن",  xp: 200   },
  { level: 3,  title: "طالب مسجد",    xp: 500   },
  { level: 5,  title: "طالب علم",     xp: 1500  },
  { level: 10, title: "فقيه ناشئ",    xp: 4000  },
  { level: 15, title: "عالم متقدم",   xp: 9000  },
  { level: 20, title: "شيخ",          xp: 18000 },
  { level: 25, title: "إمام الأرينا", xp: 35000 }
];

function getLevelFromXP(xp) {
  let current = LEVELS[0];
  for (const lvl of LEVELS) {
    if (xp >= lvl.xp) current = lvl;
    else break;
  }
  return current;
}

async function checkLevelUp(newXP, uid) {
  const lvl = getLevelFromXP(newXP);
  const savedLevel = parseInt(localStorage.getItem("userLevel") || "1");
  if (lvl.level > savedLevel) {
    localStorage.setItem("userLevel", lvl.level);
    showToast("🎉 ترقيت! أصبحت " + lvl.title, "toast-gold");
    await updateDoc(doc(db, "users", uid), { level: lvl.level });
  }
}

// ========== تحميل بيانات المستخدم ==========
async function loadUserData(uid) {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (snap.exists()) {
      const data = snap.data();
      localStorage.setItem("userXP",    data.xp    || 0);
      localStorage.setItem("userLevel", data.level || 1);
      localStorage.setItem("userStreak",data.streak|| 0);
    }
  } catch (error) {
    console.error("loadUserData error:", error.message);
  }
}

// ========== Leaderboard ==========
async function getLeaderboard(type = "global", country = "") {
  try {
    let q;
    if (type === "country" && country) {
      q = query(
        collection(db, "users"),
        orderBy("xp", "desc"),
        limit(50)
      );
      // نفلتر حسب الدولة بعد الجلب (Firestore مجاني محدود الـ where)
    } else {
      q = query(collection(db, "users"), orderBy("xp", "desc"), limit(50));
    }
    const snap = await getDocs(q);
    return snap.docs.map((d, i) => ({ rank: i + 1, ...d.data() }));
  } catch (error) {
    console.error("getLeaderboard error:", error.message);
    return [];
  }
}

// ========== إضافة شارة ==========
async function addBadge(badgeId) {
  if (!currentUser) return;
  try {
    const ref  = doc(db, "users", currentUser.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const badges = snap.data().badges || [];
    if (!badges.includes(badgeId)) {
      await updateDoc(ref, { badges: [...badges, badgeId] });
      showToast("🏅 حصلت على شارة جديدة!", "toast-gold");
    }
  } catch (error) {
    console.error("addBadge error:", error.message);
  }
}

// ========== تحديث واجهة النافبار ==========
function updateNavbarUI(user) {
  const loginBtn = document.getElementById("loginBtn");
  if (!loginBtn) return;

  if (user) {
    loginBtn.innerHTML = `
      <img src="${user.photoURL || ''}" 
           style="width:28px;height:28px;border-radius:50%;border:2px solid var(--gold);vertical-align:middle;"
           onerror="this.style.display='none'"
           alt="صورة المستخدم">
      ${user.displayName?.split(" ")[0] || "حسابي"} ▾
    `;
    loginBtn.onclick = showUserMenu;
  } else {
    loginBtn.textContent = "دخول بـ Google 🔵";
    loginBtn.onclick = openLoginModal;
  }
}

// ========== قائمة المستخدم ==========
function showUserMenu() {
  const existing = document.getElementById("userMenuPopup");
  if (existing) { existing.remove(); return; }

  const menu = document.createElement("div");
  menu.id = "userMenuPopup";
  menu.style.cssText = `
    position:fixed; top:64px; left:16px; right:16px;
    background:var(--bg-card); border:1px solid var(--border);
    border-radius:16px; padding:16px; z-index:9999;
    box-shadow:var(--shadow-lg); max-width:280px;
    margin:0 auto;
  `;

  const xp     = localStorage.getItem("userXP")     || 0;
  const level  = localStorage.getItem("userLevel")  || 1;
  const streak = localStorage.getItem("userStreak") || 0;
  const lvl    = getLevelFromXP(parseInt(xp));

  menu.innerHTML = `
    <div style="text-align:center; padding-bottom:16px; border-bottom:1px solid var(--border); margin-bottom:12px;">
      <img src="${currentUser?.photoURL || ''}"
           style="width:56px;height:56px;border-radius:50%;border:3px solid var(--gold);margin-bottom:8px;"
           onerror="this.style.display='none'">
      <div style="font-weight:800; font-size:16px;">${currentUser?.displayName || "مستخدم"}</div>
      <div style="color:var(--gold); font-size:13px; font-weight:600;">${lvl.title}</div>
    </div>
    <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-bottom:12px;">
      <div style="text-align:center;">
        <div style="font-size:20px; font-weight:900; color:var(--gold);">${xp}</div>
        <div style="font-size:11px; color:var(--text-muted);">XP</div>
      </div>
      <div style="text-align:center;">
        <div style="font-size:20px; font-weight:900;">🔥 ${streak}</div>
        <div style="font-size:11px; color:var(--text-muted);">أيام</div>
      </div>
      <div style="text-align:center;">
        <div style="font-size:20px; font-weight:900; color:var(--primary-light);">${level}</div>
        <div style="font-size:11px; color:var(--text-muted);">مستوى</div>
      </div>
    </div>
    <button onclick="logoutUser(); document.getElementById('userMenuPopup')?.remove();"
      class="btn btn-outline btn-sm" style="width:100%;">
      تسجيل الخروج 👋
    </button>
  `;

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

// ========== تحديد الدولة ==========
async function getUserCountry() {
  try {
    const r = await fetch("https://api.country.is/");
    const d = await r.json();
    return d.country || "unknown";
  } catch {
    return "unknown";
  }
}

// ========== Fallback محلي عند فشل Firebase ==========
function useLocalFallback(user) {
  localStorage.setItem("userName",  user?.displayName || "مستخدم");
  localStorage.setItem("userEmail", user?.email       || "");
}

// ========== تصدير الدوال للاستخدام في الصفحات ==========
window.islamiCalc = {
  loginWithGoogle,
  logoutUser,
  addXP:          addXPToFirebase,
  addBadge,
  getLeaderboard,
  getLevelFromXP,
  getCurrentUser: () => currentUser,
  auth,
  db
};

// جعل الدوال متاحة عالمياً أيضاً
window.loginWithGoogle = loginWithGoogle;
window.logoutUser      = logoutUser;
