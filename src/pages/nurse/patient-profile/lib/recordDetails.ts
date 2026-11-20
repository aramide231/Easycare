import type { Row } from "./monthlyRecords";

const statuses = new Map([
  ["in-patient", "In-Patient"], ["inpatient", "In-Patient"], ["ipd", "In-Patient"],
  ["out-patient", "Out-Patient"], ["outpatient", "Out-Patient"], ["opd", "Out-Patient"],
]);

/** Legacy rows may use patientType for billing category, booking state or care status. */
export function nursingDisplayRow(row: Row, currentStatus: string | null): Row {
  const rawType = String(row.patientType ?? "");
  const status = statuses.get(String(row.patientStatus ?? "").toLowerCase())
    ?? statuses.get(rawType.toLowerCase()) ?? currentStatus ?? "—";
  const booking = /^(un)?booked$/i.test(rawType);
  return {
    ...row,
    patientType: status,
    ...(booking ? { bookingStatus: row.bookingStatus ?? rawType } : {}),
    ...(!booking && rawType && !statuses.has(rawType.toLowerCase())
      ? { patientCategory: row.patientCategory ?? rawType } : {}),
  };
}

export function nursingReportDraft(report: string, shift: string, ward: string) {
  if (!report.trim() && !shift) return null;
  const complete = report.trim() && ["Emergency", "Morning", "Afternoon", "Night"].includes(shift);
  return {
    report: report.trim(), comment: report.trim(), shift, ward,
    ...(!complete ? { __incomplete__: "true" } : {}),
  };
}

export function isNursingVolumeValid(value: string): boolean {
  const text = value.trim().replace(/\s*ml$/i, "");
  return !value.trim() || /^(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?|\.\d+)$/.test(text)
    && Number.isFinite(Number(text.replace(/,/g, "")));
}

export function parseNursingVolume(value: string): number {
  if (!isNursingVolumeValid(value)) return 0;
  return Number(value.trim().replace(/\s*ml$/i, "").replace(/,/g, ""));
}
