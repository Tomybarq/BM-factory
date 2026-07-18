import { SIZE_VOLUME_LITERS } from "@/lib/constants";

export function calcRawMaterialCost(ingredients = []) {
  return ingredients.reduce(
    (sum, ing) => sum + (Number(ing.quantity) || 0) * (Number(ing.price_at_time) || 0),
    0
  );
}

export function calcPackagingCost(pkg = {}) {
  const fields = [
    "bottle_cost",
    "cap_cost",
    "label_cost",
    "carton_cost",
    "operational_cost",
    "transportation_cost",
    "miscellaneous_cost",
  ];
  return fields.reduce((sum, f) => sum + (Number(pkg[f]) || 0), 0);
}

export function calcManualCost(manualCosts = []) {
  return manualCosts.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
}

export function calcTotal(rm, pkg, manual) {
  return (Number(rm) || 0) + (Number(pkg) || 0) + (Number(manual) || 0);
}

export function calcCostPerLiter(total, size) {
  const vol = SIZE_VOLUME_LITERS[size];
  if (!vol) return 0;
  return (Number(total) || 0) / vol;
}

export function packagingFieldLabels() {
  return [
    { key: "bottle_cost", label: "العبوة (الزجاجة)" },
    { key: "cap_cost", label: "الغطاء" },
    { key: "label_cost", label: "الملصق" },
    { key: "carton_cost", label: "الكرتون" },
    { key: "operational_cost", label: "تكاليف تشغيلية" },
    { key: "transportation_cost", label: "نقل" },
    { key: "miscellaneous_cost", label: "متفرقات" },
  ];
}