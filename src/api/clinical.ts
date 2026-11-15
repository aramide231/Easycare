import { ApiError, apiFetch } from "@/api/client/apClient";
import { patientId, type PatientPage } from "@/api/patients";
import { HOSPITAL_TIMEZONE, type Filters } from "@/api/visits";

export type ClinicalKind = "vitals" | "entry" | "diagnosis" | "procedure" | "prescription";
export type ClinicalAction = "store" | "update" | "sign" | "amend" | "void" | "stop" | "complete";
export type Payload = Record<string, unknown>;
export interface TemplateField {
  type: "text" | "number" | "integer" | "boolean" | "date" | "select";
  label?: string; unit?: string; required?: boolean; max_length?: number; min?: number; max?: number; options?: string[];
}
export interface ClinicalTemplate {
  id: number; template_id: number; code: string; version: number; title: string;
  fields: Record<string, TemplateField> | null; supported?: boolean;
}
export interface ClinicalRecord {
  id: number; patient_id: number; encounter_id: number; kind: ClinicalKind; status: "draft" | "signed" | "voided";
  version: number; authored_by: number; finalized_by: number | null; amends_id: number | null;
  amendment_reason: string | null; void_reason: string | null; recorded_at: string; finalized_at: string | null;
  payload: Payload; superseded: boolean; author_name: string | null; finalizer_name: string | null;
  body_mass_index: number | null; template_version: ClinicalTemplate | null; is_active_order?: boolean;
  encounter?: { id: number; status: string; care_setting: string; opened_at: string; closed_at: string | null };
}
export interface ClinicalRevision {
  id: number; clinical_record_id: number; version: number; operation: string; actor_id: number; actor_name: string | null;
  reason: string | null; recorded_at: string; snapshot: Omit<ClinicalRecord, "superseded" | "template_version">;
}
export interface ClinicalOptions { timezone: string; kinds?: string[]; sections?: string[]; physical_examination_fields?: string[]; blood_glucose_units?: string[]; }
export interface ClinicalInput {
  encounter_version: number; version?: number; kind?: ClinicalKind; payload?: Payload; current_password?: string; reason?: string;
}
export const clinicalKinds: ClinicalKind[] = ["vitals", "entry", "diagnosis", "procedure", "prescription"];
export const clinicalLabel = (value: string) => value.replace(/_/g, " ").replace(/^./, (first) => first.toUpperCase());
export const clinicalPrefix = (kind: ClinicalKind) => kind === "prescription" ? "prescriptions" : "clinical";
export const canReadClinical = (permissions: string[] = [], kind?: ClinicalKind) =>
  ["patients.view", "encounters.view"].every((code) => permissions.includes(code))
  && (kind ? permissions.includes(clinicalPrefix(kind) + ".view") : permissions.includes("clinical.view") || permissions.includes("prescriptions.view"));
const invalid = () => new ApiError("The hospital server did not confirm the clinical record. Retry the unchanged submission or reload saved records.", 200, "invalid_response");
const identity = (id: number) => { if (!patientId(id)) throw new ApiError("Choose a valid saved record ID.", 422, "invalid_record_id"); return id; };
const base = (encounter: number, kind: ClinicalKind) => "/encounters/" + identity(encounter) + "/" + clinicalPrefix(kind);
const query = (filters: Filters) => {
  const params = new URLSearchParams({ per_page: "20" });
  for (const [key, value] of Object.entries(filters)) if (value !== undefined && value !== "") params.set(key, String(value));
  return params.toString();
};
function valid(record: ClinicalRecord): boolean {
  return !!record && !!patientId(record.id) && !!patientId(record.version) && !!patientId(record.patient_id)
    && !!patientId(record.encounter_id) && !!patientId(record.authored_by) && clinicalKinds.includes(record.kind)
    && ["draft", "signed", "voided"].includes(record.status) && typeof record.superseded === "boolean"
    && !!record.payload && typeof record.payload === "object" && Number.isFinite(Date.parse(record.recorded_at));
}
export function supportedTemplateFields(fields: unknown): fields is Record<string, TemplateField> {
  if (!fields || typeof fields !== "object" || Array.isArray(fields) || Object.keys(fields).length > 50) return false;
  return Object.entries(fields).every(([key, field]) => /^[a-z][a-z0-9_]{0,63}$/.test(key) && field && typeof field === "object"
    && ["text", "number", "integer", "boolean", "date", "select"].includes(field.type)
    && (field.type !== "select" || Array.isArray(field.options) && field.options.length > 0 && field.options.every((value: unknown) => typeof value === "string")));
}
function page<T>(value: PatientPage<T>, check: (item: T) => boolean): PatientPage<T> {
  if (!Array.isArray(value?.data) || !value.data.every(check) || !value.meta || !patientId(value.meta.current_page)
    || !patientId(value.meta.last_page) || !Number.isSafeInteger(value.meta.total) || value.meta.total < 0) throw invalid();
  return value;
}
export async function clinicalOptions(kind: ClinicalKind, signal?: AbortSignal) {
  const result = await apiFetch<{ data: ClinicalOptions }>("/" + clinicalPrefix(kind) + "/options", { signal });
  if (result.data?.timezone !== HOSPITAL_TIMEZONE || kind !== "prescription" && (!Array.isArray(result.data.sections) || !Array.isArray(result.data.physical_examination_fields))) throw invalid();
  return result;
}
export async function listClinical(encounter: number, patient: number, kind: ClinicalKind, filters: Filters = {}, signal?: AbortSignal) {
  const result = await apiFetch<PatientPage<ClinicalRecord>>(base(encounter, kind) + "?" + query({ ...filters, ...(kind === "prescription" ? {} : { kind }) }), { signal });
  return page(result, (record) => valid(record) && record.encounter_id === encounter && record.patient_id === patient && record.kind === kind);
}
export async function getClinical(encounter: number, patient: number, kind: ClinicalKind, id: number, signal?: AbortSignal) {
  const result = await apiFetch<{ data: ClinicalRecord }>(base(encounter, kind) + "/" + identity(id), { signal });
  if (!valid(result.data) || result.data.id !== id || result.data.encounter_id !== encounter || result.data.patient_id !== patient || result.data.kind !== kind) throw invalid();
  return result;
}
export async function clinicalHistory(record: ClinicalRecord, currentPage: number, signal?: AbortSignal) {
  const result = await apiFetch<PatientPage<ClinicalRevision>>(base(record.encounter_id, record.kind) + "/" + identity(record.id) + "/history?" + query({ page: currentPage }), { signal });
  return page(result, (revision) => revision.clinical_record_id === record.id && revision.snapshot?.id === record.id
    && revision.snapshot.patient_id === record.patient_id && revision.snapshot.encounter_id === record.encounter_id
    && revision.snapshot.kind === record.kind && !!revision.snapshot.payload && typeof revision.snapshot.payload === "object" && !!patientId(revision.version));
}
export async function clinicalTemplates(currentPage: number, signal?: AbortSignal) {
  const result = await apiFetch<PatientPage<ClinicalTemplate>>("/clinical/templates?" + query({ page: currentPage }), { signal });
  return page(result, (template) => !!patientId(template.id) && typeof template.title === "string" && typeof template.supported === "boolean"
    && (!template.supported || supportedTemplateFields(template.fields)));
}
export async function patientHistory(patient: number, filters: Filters = {}, signal?: AbortSignal) {
  const result = await apiFetch<PatientPage<ClinicalRecord>>("/patients/" + identity(patient) + "/history?" + query(filters), { signal });
  return page(result, (record) => valid(record) && record.patient_id === patient && record.status !== "draft"
    && record.encounter?.id === record.encounter_id);
}
/** Compare server-normalized decimals, text, dates and nested values without weakening boolean semantics. */
export function sameClinicalValue(expected: unknown, actual: unknown, field = ""): boolean {
  if (expected === null || expected === undefined || typeof expected === "string" && expected.trim() === "") return actual === null || actual === undefined || actual === "";
  if (Array.isArray(expected)) return Array.isArray(actual) && expected.length === actual.length && expected.every((item, index) => sameClinicalValue(item, actual[index]));
  if (typeof expected === "object") return !!actual && typeof actual === "object"
    && (field !== "fields" || Object.keys(expected).length === Object.keys(actual).length)
    && Object.entries(expected).every(([key, value]) => sameClinicalValue(value, (actual as Payload)[key], key));
  if (typeof expected === "boolean") return actual === expected;
  if (field.endsWith("_at")) return typeof actual === "string" && Date.parse(String(expected)) === Date.parse(actual);
  const numeric = ["temperature_c", "systolic_mmhg", "diastolic_mmhg", "weight_kg", "height_m", "blood_glucose", "pulse_bpm", "respiratory_rate", "spo2_percent", "fetal_heart_rate", "quoted_amount", "duration_value", "quantity"];
  if (typeof expected === "number" || numeric.includes(field)) return actual !== null && actual !== undefined && Number(expected) === Number(actual);
  return actual === (typeof expected === "string" ? expected.trim() : expected);
}
export async function clinicalCommand(encounter: number, patient: number, kind: ClinicalKind, action: ClinicalAction,
  original: ClinicalRecord | null, data: ClinicalInput, key: string, actor: number) {
  if (action !== "store" && !original) throw new ApiError("Reload the saved clinical record first.", 422);
  const url = base(encounter, kind) + (original ? "/" + identity(original.id) : "") + (["store", "update"].includes(action) ? "" : "/" + action);
  const result = await apiFetch<{ data: ClinicalRecord }>(url, { method: action === "update" ? "PATCH" : "POST", data, headers: { "Idempotency-Key": key } });
  const record = result.data;
  const replacement = ["amend", "stop", "complete"].includes(action) || action === "void" && original?.status === "signed";
  const status = ["store", "update"].includes(action) ? "draft" : action === "void" ? "voided" : "signed";
  const version = action === "store" ? 1 : replacement ? 2 : (data.version ?? 0) + 1;
  if (!valid(record) || record.encounter_id !== encounter || record.patient_id !== patient || record.kind !== kind
    || record.status !== status || record.version !== version || record.superseded
    || record.authored_by !== (replacement || action === "store" ? actor : original?.authored_by)
    || (status !== "draft" && (record.finalized_by !== actor || !record.finalized_at || !Number.isFinite(Date.parse(record.finalized_at))))
    || original && (replacement ? record.id === original.id || record.amends_id !== original.id : record.id !== original.id)) throw invalid();
  if (data.payload) {
    const expected = { ...original?.payload, ...data.payload };
    delete expected.performed_by;
    if (!sameClinicalValue(expected, record.payload)) throw invalid();
  }
  if (replacement && record.amendment_reason !== data.reason?.trim() || action === "void" && record.void_reason !== data.reason?.trim()) throw invalid();
  if (action === "sign" && !sameClinicalValue(original?.payload, record.payload)) throw invalid();
  if (kind === "prescription" && action !== "void") {
    const expected = action === "stop" ? "stopped" : action === "complete" ? "completed" : original?.payload.order_status ?? "active";
    if (record.payload.order_status !== expected) throw invalid();
    if (["stop", "complete"].includes(action) && !sameClinicalValue({ ...original!.payload, order_status: expected }, record.payload)) throw invalid();
  }
  return result;
}
