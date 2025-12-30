// 填写这里后，tracker.html 才能“实时更新 + 上传记录”
// 1) 去 Firebase 控制台创建项目：https://console.firebase.google.com/
// 2) 创建 Firestore Database（Production mode）
// 3) 开启 Authentication -> Email/Password
// 4) 创建 Storage
// 5) 项目设置 -> 你的应用 -> Web 应用 -> 复制 firebaseConfig 到下面
//
// 注意：这是前端直连云端服务的配置，不是“密码”，但你需要在 Firebase 里设置安全规则，避免被别人写入。

export const PLAN = {
  // 你的计划区间（含起止日期）
  startDate: "2025-12-30",
  endDate: "2026-02-16",

  // 你的体重目标
  startWeightKg: 86,
  targetWeightKg: 78,
};

// 用于限制写入的邮箱（建议只允许你自己的账号写入）
// 你会在 Firebase Authentication 里创建这个账号（邮箱+密码）
export const OWNER_EMAIL = "gc556@cornell.edu";

// Firebase Web App 配置（从 Firebase 控制台复制粘贴）
export const firebaseConfig = {
  apiKey: "REPLACE_ME",
  authDomain: "REPLACE_ME",
  projectId: "REPLACE_ME",
  storageBucket: "REPLACE_ME",
  messagingSenderId: "REPLACE_ME",
  appId: "REPLACE_ME",
};
