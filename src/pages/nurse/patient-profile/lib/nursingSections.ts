import {
  getSubCategories,
  type SubCategory,
} from "@/pages/doctor/patientProfile/config/subCategoryMap";
export function getNursingSections(category: string | null): SubCategory[] {
  const sections = [...getSubCategories(category)];
  if (["Ante Natal Care", "Child Birth", "Surgical"].includes(category ?? ""))
    sections.push({ label: "REPORT WRITING" });
  if (category === "Neo Natal Care")
    sections.splice(1, 0, { label: "FEEDING CHART" });
  return sections;
}
export function nursingReportKey(category: string | null) {
  return !category || category === "Gen Consult"
    ? "REPORT WRITING"
    : `NURSING::${category}::REPORT WRITING`;
}
