export const PACKAGING_SIZES = ["5 لتر", "2 لتر", "1.5 لتر", "750 مل"];

export const SIZE_VOLUME_LITERS = {
  "5 لتر": 5,
  "2 لتر": 2,
  "1.5 لتر": 1.5,
  "750 مل": 0.75,
};

export const UNITS = ["كجم", "لتر", "وحدة"];

export const DEFAULT_MANUAL_COSTS = [
  { name: "ترية", default_amount: 0, category: "مواد مساعدة" },
  { name: "عمالة", default_amount: 0, category: "تشغيل" },
  { name: "كهرباء", default_amount: 0, category: "تشغيل" },
  { name: "ماء", default_amount: 0, category: "تشغيل" },
  { name: "صيانة", default_amount: 0, category: "تشغيل" },
  { name: "نقل", default_amount: 0, category: "نقل" },
  { name: "أخرى", default_amount: 0, category: "متفرقات" },
];

export const ROLES = [
  { value: "admin", label: "مدير النظام" },
  { value: "production_manager", label: "مدير الإنتاج" },
  { value: "accountant", label: "محاسب" },
  { value: "viewer", label: "مشاهد (قراءة فقط)" },
];

export const ROLE_PERMISSIONS = {
  admin: { create: true, update: true, delete: true, read: true },
  production_manager: { create: true, update: true, delete: true, read: true },
  accountant: { create: true, update: true, delete: false, read: true },
  viewer: { create: false, update: false, delete: false, read: true },
};

export function can(role, action) {
  return ROLE_PERMISSIONS[role]?.[action] === true;
}

export function roleLabel(role) {
  return ROLES.find((r) => r.value === role)?.label || "مشاهد";
}

export function formatCurrency(value) {
  if (value == null || isNaN(value)) return "0.00";
  return Number(value).toLocaleString("ar-EG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatNumber(value) {
  if (value == null || isNaN(value)) return "0";
  return Number(value).toLocaleString("ar-EG");
}