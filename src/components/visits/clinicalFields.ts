import { clinicalLabel, sameClinicalValue, type ClinicalKind, type Payload } from "@/api/clinical";
import { hospitalInput, hospitalInstant } from "@/api/visits";

export interface ClinicalField { key: string; label: string; type?: "number" | "datetime-local" | "textarea"; required?: boolean; max?: number; step?: string; }
export const vitalFields: ClinicalField[] = [
  { key: "observed_at", label: "Observed at (Africa/Lagos)", type: "datetime-local", required: true },
  ...Object.entries({ temperature_c: ["Temperature (°C)", "0.01"], systolic_mmhg: ["Systolic blood pressure (mmHg)", "1"], diastolic_mmhg: ["Diastolic blood pressure (mmHg)", "1"], weight_kg: ["Weight (kg)", "0.001"], height_m: ["Height (m)", "0.001"], blood_glucose: ["Blood glucose", "0.001"], pulse_bpm: ["Pulse (beats/min)", "0.01"], respiratory_rate: ["Respiratory rate (breaths/min)", "0.01"], spo2_percent: ["Oxygen saturation (%)", "0.01"], fetal_heart_rate: ["Fetal heart rate (beats/min)", "0.01"] }).map(([key, [label, step]]) => ({ key, label, step, type: "number" as const })),
  { key: "urinalysis", label: "Urinalysis", type: "textarea", max: 5000 }, { key: "comment", label: "Observation comment", type: "textarea", max: 5000 },
];
export const diagnosisFields: ClinicalField[] = [{ key: "description", label: "Diagnosis description", required: true, type: "textarea", max: 10000 },
  { key: "code_system", label: "Code system", max: 32 }, { key: "code_system_version", label: "Code system version", max: 32 }, { key: "code", label: "Diagnosis code", max: 64 }];
export const procedureFields: ClinicalField[] = [{ key: "name", label: "Procedure name", required: true, max: 255 }, { key: "code", label: "Procedure code", max: 64 },
  { key: "performed_at", label: "Performed at (Africa/Lagos)", type: "datetime-local" }, { key: "remarks", label: "Procedure remarks", type: "textarea", max: 20000 },
  { key: "findings", label: "Procedure findings", type: "textarea", max: 20000 }, { key: "quoted_amount", label: "Quoted amount", type: "number", step: "0.01" }, { key: "currency", label: "Currency (3-letter code)", max: 3 }];
export const medicationFields: ClinicalField[] = [{ key: "medication_name", label: "Medication name", required: true, max: 255 }, { key: "form", label: "Form", max: 80 },
  { key: "strength", label: "Strength", max: 120 }, { key: "dose", label: "Dose (include units)", max: 255 }, { key: "route", label: "Route", max: 80 },
  { key: "frequency", label: "Frequency", max: 255 }, { key: "duration_value", label: "Duration", type: "number", step: "0.001" }, { key: "duration_unit", label: "Duration unit", max: 32 },
  { key: "quantity", label: "Quantity", type: "number", step: "0.001" }, { key: "quantity_unit", label: "Quantity unit", max: 64 }, { key: "instructions", label: "Medication instructions", type: "textarea", max: 10000 }];
export const writableFields: Record<ClinicalKind, string[]> = {
  vitals: [...vitalFields.map((field) => field.key), "blood_glucose_unit"], diagnosis: diagnosisFields.map((field) => field.key), procedure: procedureFields.map((field) => field.key),
  entry: ["section", "clinical_template_version_id", "fields", "content", "related_record_id"], prescription: ["instructions", "items"],
};
export const fieldLabel = (key: string, kind?: ClinicalKind | "medication") => {
  if (kind === "prescription" && key === "instructions") return "Overall prescription instructions";
  const fields = kind === "vitals" ? vitalFields : kind === "diagnosis" ? diagnosisFields : kind === "procedure" ? procedureFields : kind === "medication" ? medicationFields : [];
  return fields.find((field) => field.key === key)?.label ?? clinicalLabel(key);
};

export function initialClinicalPayload(kind: ClinicalKind, original?: Payload): Payload {
  if (original) return Object.fromEntries(writableFields[kind].filter((key) => key in original).map((key) => [key, structuredClone(original[key])]));
  if (kind === "vitals") return { observed_at: new Date().toISOString() };
  if (kind === "entry") return { section: "note", clinical_template_version_id: null, related_record_id: null, fields: {}, content: null };
  if (kind === "prescription") return { instructions: null, items: [{ medication_name: "" }] };
  return {};
}
/** Keep saved seconds/microseconds when an unchanged hospital-time control loses that precision. */
export function clinicalDateInput(input: string, saved: unknown): string | null {
  if (!input) return null;
  if (typeof saved === "string" && input === hospitalInput(saved)) return saved;
  return hospitalInstant(input);
}
export function clinicalPayload(kind: ClinicalKind, draft: Payload, original?: Payload): Payload {
  const payload: Payload = {};
  for (const key of writableFields[kind]) {
    let value = draft[key];
    if (value === undefined) continue;
    if (typeof value === "string") value = value.trim() || null;
    if (key.endsWith("_at") && typeof value === "string") value = clinicalDateInput(value.includes("Z") || /[+-]\d\d:\d\d$/.test(value) ? hospitalInput(value) : value, original?.[key] ?? value);
    payload[key] = value;
  }
  if (kind === "prescription") payload.items = (draft.items as Payload[]).map((item) => Object.fromEntries(medicationFields.map(({ key }) => [key, typeof item[key] === "string" ? item[key].trim() || null : item[key] ?? null])));
  if (!original) return payload;
  return Object.fromEntries(Object.entries(payload).filter(([key, value]) => !sameClinicalValue(value, original[key], key)));
}
