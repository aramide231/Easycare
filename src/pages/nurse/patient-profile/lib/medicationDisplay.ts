import type { Row } from "./monthlyRecords";
export function medicationDescription(row: Row): string {
  const name = String(row.medication ?? row.item ?? "");
  const strength = String(row.strength ?? "");
  const medication =
    strength && !name.toLowerCase().includes(strength.toLowerCase())
      ? `${name} ${strength}`
      : name;
  return [medication, row.adminRoute, row.dosage, row.interval, row.period]
    .filter((value) => value !== undefined && value !== null && value !== "")
    .join(" × ");
}
export function flattenPrescriptions(history: Row[]): Row[] {
  return history.flatMap((row, rowIndex) =>
    (Array.isArray(row.medications) ? row.medications : [row]).map(
      (med, index) => ({
        ...row,
        ...med,
        medications: undefined,
        rowIndex,
        lineIndex: Array.isArray(row.medications) ? index : null,
        prescriptionKey: `${rowIndex}:${index}`,
        clinician: row.doctor ?? row.enteredBy,
      }),
    ),
  );
}
