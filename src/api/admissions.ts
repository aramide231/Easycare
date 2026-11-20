import { ApiError, apiFetch } from "@/api/client/apClient";
import { patientId, type PatientPage } from "@/api/patients";
import { sameClinicalValue } from "@/api/clinical";
import type { Assignment, Filters, Visit } from "@/api/visits";

export interface Allocation {
  id: number; admission_id: number; bed_id: number; version: number; assigned_by: number; assigned_at: string;
  released_by: number | null; released_at: string | null; assignment_reason: string; release_reason: string | null;
}
export interface Admission {
  id: number; patient_id: number; encounter_id: number; version: number; workflow_version: number;
  encounter_version: number; encounter_status: string; status: "admitted" | "discharge_authorized" | "discharged";
  admitted_by: number; admitted_at: string; authorized_by: number | null; authorized_at: string | null;
  discharged_by: number | null; discharged_at: string | null; discharge_reason: string | null; discharge_summary: string | null;
  current_allocation: Allocation | null; current_assignment: Assignment | null;
}
export interface Ward { id: number; code: string; name: string; type: string | null; daily_rate: string | null; is_active: boolean; version: number; }
export interface Bed { id: number; ward_id: number; label: string; daily_rate: string | null; is_active: boolean; version: number; available?: boolean; }
export interface AdmissionRevision { id: number; admission_id: number; workflow_version: number; operation: string; actor_id: number; reason: string; recorded_at: string; snapshot: Admission; }
export type AdmissionAction = "allocate" | "transfer" | "release" | "authorize-discharge" | "complete-discharge";
export type CommandData = Record<string, unknown>;
export const admissionStatuses = ["admitted", "discharge_authorized", "discharged"];
export const invalidHospitalResponse = () => new ApiError("The hospital server did not confirm the saved record. Retry the unchanged submission or reload saved records.", 200, "invalid_response");
export const savedId = (id: number) => { if (!patientId(id)) throw new ApiError("Choose a saved numeric record ID.", 422); return id; };
export const queryString = (filters: Filters) => {
  const params = new URLSearchParams({ per_page: "20" });
  for (const [key, value] of Object.entries(filters)) if (value !== undefined && value !== "") params.set(key, String(value));
  return params.toString();
};
export function checkedPage<T>(page: PatientPage<T>, valid: (row: T) => boolean): PatientPage<T> {
  if (!Array.isArray(page?.data) || !page.data.every(valid) || !page.meta || !patientId(page.meta.current_page)
    || !patientId(page.meta.last_page) || !Number.isSafeInteger(page.meta.total) || page.meta.total < 0) throw invalidHospitalResponse();
  return page;
}
export const validAllocation = (row: Allocation) => !!row && !!patientId(row.id) && !!patientId(row.admission_id) && !!patientId(row.bed_id)
  && !!patientId(row.version) && Number.isFinite(Date.parse(row.assigned_at));
export function validAdmission(row: Admission): boolean {
  return !!row && !!patientId(row.id) && !!patientId(row.patient_id) && !!patientId(row.encounter_id) && !!patientId(row.version)
    && Number.isSafeInteger(row.workflow_version) && row.workflow_version >= 0 && !!patientId(row.encounter_version)
    && admissionStatuses.includes(row.status) && Number.isFinite(Date.parse(row.admitted_at))
    && (row.current_allocation === null || validAllocation(row.current_allocation) && row.current_allocation.admission_id === row.id)
    && (row.status !== "discharged" || row.current_allocation === null && !!row.discharged_by && !!row.discharged_at);
}
export const validWard = (row: Ward) => !!row && !!patientId(row.id) && !!patientId(row.version) && typeof row.name === "string" && typeof row.code === "string" && typeof row.is_active === "boolean";
export const validBed = (row: Bed) => !!row && !!patientId(row.id) && !!patientId(row.version) && !!patientId(row.ward_id) && typeof row.label === "string" && typeof row.is_active === "boolean";
export async function listAdmissions(filters: Filters = {}, signal?: AbortSignal) {
  const page = await apiFetch<PatientPage<Admission>>("/admissions?" + queryString(filters), { signal });
  return checkedPage(page, (row) => validAdmission(row) && (!filters.patient_id || row.patient_id === Number(filters.patient_id)) && (!filters.status || row.status === filters.status));
}
export async function getAdmission(id: number, signal?: AbortSignal) {
  const response = await apiFetch<{ data: Admission }>("/admissions/" + savedId(id), { signal });
  if (!validAdmission(response.data) || response.data.id !== id) throw invalidHospitalResponse();
  return response;
}
export async function admissionHistory(admission: Admission, page: number, signal?: AbortSignal) {
  const response = await apiFetch<PatientPage<AdmissionRevision>>("/admissions/" + savedId(admission.id) + "/history?" + queryString({ page }), { signal });
  return checkedPage(response, (row) => row.admission_id === admission.id && row.snapshot?.id === admission.id
    && row.snapshot.patient_id === admission.patient_id && row.snapshot.encounter_id === admission.encounter_id && validAdmission(row.snapshot));
}
export async function allocationHistory(admission: Admission, page: number, signal?: AbortSignal) {
  const response = await apiFetch<PatientPage<Allocation>>("/admissions/" + savedId(admission.id) + "/allocations?" + queryString({ page }), { signal });
  return checkedPage(response, (row) => validAllocation(row) && row.admission_id === admission.id);
}
export async function listWards(filters: Filters = {}, signal?: AbortSignal) {
  return checkedPage(await apiFetch<PatientPage<Ward>>("/locations/wards?" + queryString(filters), { signal }), validWard);
}
export async function getWard(id: number, signal?: AbortSignal) {
  const response = await apiFetch<{ data: Ward }>("/locations/wards/" + savedId(id), { signal });
  if (!validWard(response.data) || response.data.id !== id) throw invalidHospitalResponse();
  return response;
}
export async function listBeds(filters: Filters = {}, signal?: AbortSignal) {
  const response = await apiFetch<PatientPage<Bed>>("/locations/beds?" + queryString(filters), { signal });
  return checkedPage(response, (row) => validBed(row) && typeof row.available === "boolean"
    && (!filters.ward_id || row.ward_id === Number(filters.ward_id)) && (filters.available !== 1 || row.available === true));
}
export async function createAdmission(visit: Visit, reason: string, verified: boolean, key: string, actor: number) {
  const response = await apiFetch<{ data: Admission }>("/encounters/" + savedId(visit.id) + "/admission", { method: "POST",
    data: { encounter_version: visit.version, patient_version: visit.patient.version, identity_verified: verified, reason }, headers: { "Idempotency-Key": key } });
  const row = response.data;
  if (!validAdmission(row) || row.patient_id !== visit.patient_id || row.encounter_id !== visit.id || row.status !== "admitted"
    || row.version !== 1 || row.workflow_version !== 1 || row.admitted_by !== actor || row.current_allocation !== null) throw invalidHospitalResponse();
  return response;
}
export function admissionInput(row: Admission, action: AdmissionAction, reason: string): CommandData {
  const input: CommandData = { version: row.version, workflow_version: row.workflow_version, encounter_version: row.encounter_version, reason };
  if (["transfer", "release", "complete-discharge"].includes(action)) {
    input.allocation_id = row.current_allocation?.id ?? null; input.allocation_version = row.current_allocation?.version ?? null;
  }
  if (action === "authorize-discharge") { input.assignment_id = row.current_assignment?.id; input.assignment_version = row.current_assignment?.version; }
  return input;
}
export async function admissionCommand(original: Admission, action: AdmissionAction, input: CommandData, key: string, actor: number) {
  const response = await apiFetch<{ data: Admission }>("/admissions/" + savedId(original.id) + "/" + action, { method: "POST", data: input, headers: { "Idempotency-Key": key } });
  const row = response.data;
  const status = action === "authorize-discharge" ? "discharge_authorized" : action === "complete-discharge" ? "discharged" : original.status;
  const version = original.version + (["authorize-discharge", "complete-discharge"].includes(action) ? 1 : 0);
  if (!validAdmission(row) || row.id !== original.id || row.patient_id !== original.patient_id || row.encounter_id !== original.encounter_id
    || row.status !== status || row.version !== version || row.workflow_version !== original.workflow_version + 1
    || row.encounter_version !== original.encounter_version
    || row.admitted_by !== original.admitted_by || row.admitted_at !== original.admitted_at) throw invalidHospitalResponse();
  if (["allocate", "transfer"].includes(action) && (!row.current_allocation || row.current_allocation.bed_id !== input.bed_id
    || row.current_allocation.assigned_by !== actor || row.current_allocation.version !== 1
    || row.current_allocation.id === original.current_allocation?.id || row.current_allocation.assignment_reason !== String(input.reason).trim())) throw invalidHospitalResponse();
  if (["release", "complete-discharge"].includes(action) && row.current_allocation !== null) throw invalidHospitalResponse();
  if (action !== "authorize-discharge" && ["authorized_by", "authorized_at", "discharge_reason", "discharge_summary"].some((field) => row[field as keyof Admission] !== original[field as keyof Admission])) throw invalidHospitalResponse();
  if (action === "authorize-discharge" && (row.authorized_by !== actor || !row.authorized_at
    || row.discharge_reason !== String(input.reason).trim() || !sameClinicalValue(input.discharge_summary, row.discharge_summary)
    || !sameClinicalValue(original.current_allocation, row.current_allocation))) throw invalidHospitalResponse();
  if (action === "complete-discharge" && (row.discharged_by !== actor || !row.discharged_at || row.authorized_by === actor
    || row.authorized_by !== original.authorized_by || row.authorized_at !== original.authorized_at
    || row.discharge_reason !== original.discharge_reason || row.discharge_summary !== original.discharge_summary)) throw invalidHospitalResponse();
  return response;
}
export async function locationCommand<T extends Ward | Bed>(kind: "wards" | "beds", original: T | null, input: CommandData, key: string) {
  const response = await apiFetch<{ data: T }>("/locations/" + kind + (original ? "/" + savedId(original.id) : ""), {
    method: original ? "PATCH" : "POST", data: input, headers: { "Idempotency-Key": key } });
  const row = response.data;
  const expected = Object.fromEntries(Object.entries(input).filter(([name]) => !["version", "ward_version"].includes(name)));
  if (expected.daily_rate !== null && expected.daily_rate !== undefined) expected.daily_rate = Number(expected.daily_rate);
  if (!(kind === "wards" ? validWard(row as Ward) : validBed(row as Bed)) || row.version !== (original ? original.version + 1 : 1)
    || original && row.id !== original.id || !sameClinicalValue(expected, row)) throw invalidHospitalResponse();
  if (original && (kind === "wards" ? (row as Ward).code !== (original as Ward).code : (row as Bed).ward_id !== (original as Bed).ward_id)) throw invalidHospitalResponse();
  return response;
}
