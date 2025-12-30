import { PLAN, OWNER_EMAIL, firebaseConfig } from "./tracker-config.js";

// Firebase v10（浏览器端 ESM CDN）
// 如果你想升级版本，只需要改这里的版本号。
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  query,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";

const el = (id) => /** @type {HTMLElement} */ (document.getElementById(id));

const chipRange = el("chipRange");
const chipGoal = el("chipGoal");
const btnSignOut = /** @type {HTMLButtonElement} */ (el("btnSignOut"));

const btnSignIn = /** @type {HTMLButtonElement} */ (el("btnSignIn"));
const authStatus = el("authStatus");
const emailInput = /** @type {HTMLInputElement} */ (el("email"));
const passwordInput = /** @type {HTMLInputElement} */ (el("password"));

const cardCheckin = el("cardCheckin");
const dateInput = /** @type {HTMLInputElement} */ (el("date"));
const weightInput = /** @type {HTMLInputElement} */ (el("weight"));
const activitySelect = /** @type {HTMLSelectElement} */ (el("activity"));
const minutesInput = /** @type {HTMLInputElement} */ (el("minutes"));
const distanceInput = /** @type {HTMLInputElement} */ (el("distance"));
const proofInput = /** @type {HTMLInputElement} */ (el("proof"));
const noteInput = /** @type {HTMLTextAreaElement} */ (el("note"));

const btnSave = /** @type {HTMLButtonElement} */ (el("btnSave"));
const btnDelete = /** @type {HTMLButtonElement} */ (el("btnDelete"));
const saveStatus = el("saveStatus");

const tbody = el("tbody");

function isFirebaseConfigured() {
  return (
    firebaseConfig &&
    typeof firebaseConfig === "object" &&
    Object.values(firebaseConfig).every((v) => typeof v === "string" && v && v !== "REPLACE_ME")
  );
}

function toISODate(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseISODate(s) {
  // 只用于 YYYY-MM-DD
  const [y, m, d] = s.split("-").map((x) => Number(x));
  return new Date(y, m - 1, d);
}

function daysBetweenInclusive(startISO, endISO) {
  const a = parseISODate(startISO);
  const b = parseISODate(endISO);
  const ms = 24 * 60 * 60 * 1000;
  return Math.floor((b.getTime() - a.getTime()) / ms) + 1;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function fmt(n, digits = 1) {
  if (typeof n !== "number" || Number.isNaN(n)) return "";
  return n.toFixed(digits);
}

function setStatus(node, kind, text) {
  node.classList.remove("ok", "warn", "err");
  if (kind) node.classList.add(kind);
  node.textContent = text;
}

function computeTargetWeightByDate(dateISO) {
  const totalDays = daysBetweenInclusive(PLAN.startDate, PLAN.endDate);
  const dayIndex = clamp(daysBetweenInclusive(PLAN.startDate, dateISO) - 1, 0, totalDays - 1);
  const t = totalDays <= 1 ? 1 : dayIndex / (totalDays - 1);
  const w = PLAN.startWeightKg + (PLAN.targetWeightKg - PLAN.startWeightKg) * t;
  return Math.round(w * 10) / 10;
}

function buildCalendarRows(checkinsByDate) {
  const totalDays = daysBetweenInclusive(PLAN.startDate, PLAN.endDate);
  const start = parseISODate(PLAN.startDate);
  const rows = [];
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const dateISO = toISODate(d);
    const target = computeTargetWeightByDate(dateISO);
    const c = checkinsByDate.get(dateISO) || null;
    rows.push({ dateISO, target, checkin: c });
  }
  return rows;
}

function renderTable(checkinsByDate) {
  const rows = buildCalendarRows(checkinsByDate);
  tbody.innerHTML = "";

  for (const r of rows) {
    const tr = document.createElement("tr");

    const tdDate = document.createElement("td");
    tdDate.textContent = r.dateISO;

    const tdTarget = document.createElement("td");
    tdTarget.textContent = fmt(r.target, 1);

    const tdActual = document.createElement("td");
    tdActual.textContent = r.checkin?.weightKg != null ? fmt(r.checkin.weightKg, 1) : "";

    const tdDelta = document.createElement("td");
    if (r.checkin?.weightKg != null) {
      const delta = r.checkin.weightKg - r.target;
      tdDelta.innerHTML = `<span class="pill ${delta <= 0 ? "ok" : "miss"}">${delta <= 0 ? "≤目标" : ">目标"} ${fmt(delta, 1)}</span>`;
    } else {
      tdDelta.innerHTML = `<span class="pill miss">未打卡</span>`;
    }

    const tdAct = document.createElement("td");
    if (r.checkin?.activity) {
      tdAct.textContent = r.checkin.activity === "run" ? "跑步" : "篮球";
    }

    const tdMin = document.createElement("td");
    tdMin.textContent = r.checkin?.minutes != null ? String(r.checkin.minutes) : "";

    const tdDist = document.createElement("td");
    tdDist.textContent = r.checkin?.distanceKm != null ? fmt(r.checkin.distanceKm, 2) : "";

    const tdProof = document.createElement("td");
    if (r.checkin?.proofUrl) {
      const a = document.createElement("a");
      a.href = r.checkin.proofUrl;
      a.target = "_blank";
      a.rel = "noopener";
      a.className = "link";
      a.textContent = "查看";
      tdProof.appendChild(a);
    }

    const tdNote = document.createElement("td");
    tdNote.textContent = r.checkin?.note || "";

    const tdUpdated = document.createElement("td");
    tdUpdated.textContent = r.checkin?.updatedAtText || "";

    tr.append(tdDate, tdTarget, tdActual, tdDelta, tdAct, tdMin, tdDist, tdProof, tdNote, tdUpdated);
    tbody.appendChild(tr);
  }
}

function normalizeCheckinDoc(d) {
  const data = d.data();
  const updatedAt = data.updatedAt?.toDate ? data.updatedAt.toDate() : null;
  return {
    date: data.date,
    weightKg: typeof data.weightKg === "number" ? data.weightKg : null,
    activity: data.activity,
    minutes: typeof data.minutes === "number" ? data.minutes : null,
    distanceKm: typeof data.distanceKm === "number" ? data.distanceKm : null,
    proofUrl: typeof data.proofUrl === "string" ? data.proofUrl : null,
    note: typeof data.note === "string" ? data.note : "",
    updatedAtText: updatedAt ? updatedAt.toLocaleString() : "",
  };
}

// 初始化日期/目标展示
chipRange.textContent = `日期：${PLAN.startDate} → ${PLAN.endDate}`;
chipGoal.textContent = `目标：${PLAN.startWeightKg}kg → ${PLAN.targetWeightKg}kg`;
dateInput.value = toISODate(new Date());

// 先渲染空表（未登录也能看目标）
renderTable(new Map());

if (!isFirebaseConfigured()) {
  setStatus(authStatus, "warn", "未配置 Firebase：请先填写 tracker-config.js");
  btnSignIn.disabled = true;
} else {
  btnSignIn.disabled = false;
}

let app = null;
let auth = null;
let db = null;
let storage = null;

/** @type {null | (() => void)} */
let unsubscribe = null;

function stopRealtime() {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
}

function currentDateISO() {
  return dateInput.value || toISODate(new Date());
}

function fillFormFromCheckin(dateISO, checkinsByDate) {
  const c = checkinsByDate.get(dateISO);
  if (!c) {
    weightInput.value = "";
    activitySelect.value = "run";
    minutesInput.value = "";
    distanceInput.value = "";
    noteInput.value = "";
    proofInput.value = "";
    return;
  }
  weightInput.value = c.weightKg != null ? String(c.weightKg) : "";
  activitySelect.value = c.activity || "run";
  minutesInput.value = c.minutes != null ? String(c.minutes) : "";
  distanceInput.value = c.distanceKm != null ? String(c.distanceKm) : "";
  noteInput.value = c.note || "";
  proofInput.value = "";
}

function requireInRange(dateISO) {
  if (dateISO < PLAN.startDate || dateISO > PLAN.endDate) {
    throw new Error(`日期必须在 ${PLAN.startDate} 到 ${PLAN.endDate} 之间`);
  }
}

function requireOwnerEmail(user) {
  if (!OWNER_EMAIL) return;
  if (user.email !== OWNER_EMAIL) {
    throw new Error(`当前登录邮箱不是允许的账号（需要：${OWNER_EMAIL}）`);
  }
}

async function main() {
  if (!isFirebaseConfigured()) return;

  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);

  onAuthStateChanged(auth, (user) => {
    stopRealtime();
    btnSignOut.style.display = user ? "" : "none";
    cardCheckin.style.display = user ? "" : "none";

    if (!user) {
      setStatus(authStatus, "warn", "未登录");
      setStatus(saveStatus, "", "请先登录");
      renderTable(new Map());
      return;
    }

    try {
      requireOwnerEmail(user);
      setStatus(authStatus, "ok", `已登录：${user.email || "(unknown)"}`);
    } catch (e) {
      setStatus(authStatus, "err", String(e.message || e));
      renderTable(new Map());
      return;
    }

    setStatus(saveStatus, "", "正在同步数据…");

    const q = query(collection(db, "users", user.uid, "checkins"), orderBy("date", "asc"));
    unsubscribe = onSnapshot(
      q,
      (snap) => {
        const map = new Map();
        for (const d of snap.docs) {
          const c = normalizeCheckinDoc(d);
          if (c.date) map.set(c.date, c);
        }
        renderTable(map);

        // 如果用户正在看的日期有记录，就自动带入表单，方便更新
        fillFormFromCheckin(currentDateISO(), map);
        setStatus(saveStatus, "ok", "已同步（实时）");
      },
      (err) => {
        setStatus(saveStatus, "err", `同步失败：${err?.message || err}`);
      },
    );
  });

  btnSignIn.addEventListener("click", async () => {
    if (!auth) return;
    const email = emailInput.value.trim();
    const pass = passwordInput.value;
    if (!email || !pass) {
      setStatus(authStatus, "warn", "请输入邮箱和密码");
      return;
    }
    try {
      setStatus(authStatus, "", "登录中…");
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (e) {
      setStatus(authStatus, "err", `登录失败：${e?.message || e}`);
    }
  });

  btnSignOut.addEventListener("click", async () => {
    if (!auth) return;
    await signOut(auth);
  });

  // 日期变化时：如果有记录，自动带入表单（靠实时 map 才能做到）
  dateInput.addEventListener("change", () => {
    // 不额外处理：实时回调里会 fillFormFromCheckin
  });

  btnSave.addEventListener("click", async () => {
    if (!auth || !db || !storage) return;
    const user = auth.currentUser;
    if (!user) return;

    try {
      requireOwnerEmail(user);

      const dateISO = currentDateISO();
      requireInRange(dateISO);

      const weightKg = Number(weightInput.value);
      if (!Number.isFinite(weightKg) || weightKg <= 0) {
        throw new Error("请输入正确体重（kg）");
      }

      const activity = activitySelect.value;
      if (!["run", "basketball"].includes(activity)) {
        throw new Error("请选择运动类型");
      }

      const minutesRaw = minutesInput.value.trim();
      const minutes = minutesRaw ? Number(minutesRaw) : null;
      if (minutes != null && (!Number.isFinite(minutes) || minutes < 0)) {
        throw new Error("时长（分钟）不正确");
      }

      const distanceRaw = distanceInput.value.trim();
      const distanceKm = distanceRaw ? Number(distanceRaw) : null;
      if (distanceKm != null && (!Number.isFinite(distanceKm) || distanceKm < 0)) {
        throw new Error("距离（km）不正确");
      }

      setStatus(saveStatus, "", "保存中…");

      let proofUrl = null;
      const file = proofInput.files && proofInput.files[0] ? proofInput.files[0] : null;
      if (file) {
        // 10MB 限制
        if (file.size > 10 * 1024 * 1024) {
          throw new Error("上传文件太大（最大 10MB）");
        }
        const safeName = file.name.replace(/[^\w.\-()]+/g, "_");
        const path = `proofs/${user.uid}/${dateISO}/${Date.now()}-${safeName}`;
        const r = ref(storage, path);
        await uploadBytes(r, file, { contentType: file.type || undefined });
        proofUrl = await getDownloadURL(r);
      }

      const payload = {
        date: dateISO,
        weightKg,
        activity,
        minutes: minutes == null ? null : Math.round(minutes),
        distanceKm: distanceKm == null ? null : Math.round(distanceKm * 100) / 100,
        proofUrl,
        note: noteInput.value.trim(),
        updatedAt: serverTimestamp(),
      };

      // 以日期为文档 ID：每天一条，重复提交就是更新
      const refDoc = doc(db, "users", user.uid, "checkins", dateISO);
      await setDoc(refDoc, payload, { merge: true });
      proofInput.value = "";
      setStatus(saveStatus, "ok", "保存成功（已同步）");
    } catch (e) {
      setStatus(saveStatus, "err", `保存失败：${e?.message || e}`);
    }
  });

  btnDelete.addEventListener("click", async () => {
    if (!auth || !db) return;
    const user = auth.currentUser;
    if (!user) return;
    try {
      requireOwnerEmail(user);
      const dateISO = currentDateISO();
      requireInRange(dateISO);
      const ok = confirm(`确认删除 ${dateISO} 的打卡记录？`);
      if (!ok) return;
      setStatus(saveStatus, "", "删除中…");
      await deleteDoc(doc(db, "users", user.uid, "checkins", dateISO));
      setStatus(saveStatus, "ok", "已删除");
    } catch (e) {
      setStatus(saveStatus, "err", `删除失败：${e?.message || e}`);
    }
  });
}

main().catch((e) => {
  setStatus(authStatus, "err", `初始化失败：${e?.message || e}`);
});

