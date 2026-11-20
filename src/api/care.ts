import { apiFetch } from "@/api/client/apClient";
import { checkedPage, invalidHospitalResponse, queryString, savedId, type CommandData } from "@/api/admissions";
import { type ClinicalRecord, type ClinicalRevision, type ClinicalTemplate, supportedTemplateFields } from "@/api/clinical";
import { patientId, type PatientPage } from "@/api/patients";
import type { Filters, Visit } from "@/api/visits";

export const careTypes = ["antenatal", "postnatal", "family_planning", "delivery", "immunization"] as const;
export type CareType = typeof careTypes[number];
export interface CareProgram {
  id: number; patient_id: number; encounter_id: number; type: CareType; status: "active" | "completed"; version: number;
  started_by: number; started_at: string; start_reason: string; completed_by: number | null; completed_encounter_id: number | null; completed_at: string | null; completion_reason: string | null;
}
export interface Baby {
  id: number; delivery_id: number; encounter_id: number; birth_order: number; version: number; recorded_by: number; recorded_at: string; reason: string;
  link_exists: boolean; child_patient_id: number | null; link: { encounter_id: number; verified_by: number; verified_at: string; reason: string } | null;
}
export const validProgram = (row: CareProgram) => !!row && !!patientId(row.id) && !!patientId(row.patient_id) && !!patientId(row.encounter_id)
  && !!patientId(row.version) && careTypes.includes(row.type) && ["active", "completed"].includes(row.status) && Number.isFinite(Date.parse(row.started_at));
export const validBaby = (row: Baby) => !!row && !!patientId(row.id) && !!patientId(row.delivery_id) && !!patientId(row.encounter_id) && !!patientId(row.birth_order)
  && [1,2].includes(row.version) && typeof row.link_exists === "boolean";
export async function listCarePrograms(filters: Filters = {}, signal?: AbortSignal) {
  return checkedPage(await apiFetch<PatientPage<CareProgram>>("/care-programs?" + queryString(filters), { signal }),
    (row) => validProgram(row) && (!filters.type || row.type === filters.type) && (!filters.patient_id || row.patient_id === Number(filters.patient_id)));
}
export async function getCareProgram(id: number, signal?: AbortSignal) {
  const response = await apiFetch<{ data: CareProgram }>("/care-programs/" + savedId(id), { signal });
  if (!validProgram(response.data) || response.data.id !== id) throw invalidHospitalResponse();
  return response;
}
export async function listBabies(program: CareProgram, page: number, signal?: AbortSignal) {
  return checkedPage(await apiFetch<PatientPage<Baby>>("/care-programs/" + savedId(program.id) + "/births?" + queryString({ page }), { signal }),
    (row) => validBaby(row) && row.delivery_id === program.id);
}
export async function careForms(type: string, page: number, signal?: AbortSignal) {
  return checkedPage(await apiFetch<PatientPage<ClinicalTemplate>>("/care-programs/forms?" + queryString({ type, page }), { signal }),
    (row) => !!patientId(row.id) && row.code.startsWith("care." + type + ".") && row.supported === true && supportedTemplateFields(row.fields));
}
export async function listCareRecords(program: CareProgram, page: number, signal?: AbortSignal) {
  return checkedPage(await apiFetch<PatientPage<ClinicalRecord>>("/care-programs/" + savedId(program.id) + "/records?" + queryString({ page }), { signal }),
    (row) => !!patientId(row.id) && row.kind === "entry" && row.care_program_id === program.id && row.patient_id === program.patient_id
      && ["draft", "signed", "voided"].includes(row.status) && !!patientId(row.version));
}
export async function careHistory(program: CareProgram, record: ClinicalRecord, page: number, signal?: AbortSignal) {
  return checkedPage(await apiFetch<PatientPage<ClinicalRevision>>("/care-programs/" + savedId(program.id) + "/encounters/" + savedId(record.encounter_id)
    + "/records/" + savedId(record.id) + "/history?" + queryString({ page }), { signal }),
    (row) => row.clinical_record_id === record.id && row.snapshot?.id === record.id && row.snapshot.patient_id === program.patient_id
      && (row.snapshot as ClinicalRecord).care_program_id === program.id && row.snapshot.encounter_id === record.encounter_id);
}
export async function getCareRecord(program: CareProgram, encounter: number, id: number, signal?: AbortSignal) {
  const response = await apiFetch<{ data: ClinicalRecord }>("/care-programs/" + savedId(program.id) + "/encounters/" + savedId(encounter) + "/records/" + savedId(id), { signal });
  const row = response.data;
  if (!row || row.id !== id || row.care_program_id !== program.id || row.encounter_id !== encounter || row.patient_id !== program.patient_id || row.kind !== "entry") throw invalidHospitalResponse();
  return response;
}
export async function openCareProgram(visit: Visit, type: CareType, reason: string, identity_verified: boolean, key: string, actor: number) {
  const response = await apiFetch<{ data: CareProgram }>("/encounters/" + savedId(visit.id) + "/care-programs", { method: "POST",
    data: { type, reason, identity_verified, encounter_version: visit.version, patient_version: visit.patient.version }, headers: { "Idempotency-Key": key } });
  const row = response.data;
  if (!validProgram(row) || row.patient_id !== visit.patient_id || row.encounter_id !== visit.id || row.type !== type
    || row.status !== "active" || row.version !== 1 || row.started_by !== actor || row.start_reason !== reason.trim()) throw invalidHospitalResponse();
  return response;
}
export async function careProgramCommand<T extends CareProgram | Baby>(program: CareProgram, action: "complete" | "birth" | "link",
  input: CommandData, key: string, actor: number, baby?: Baby): Promise<{ data: T }> {
  const suffix = action === "complete" ? "/complete" : action === "birth" ? "/births" : "/births/" + savedId(baby!.id) + "/link";
  const response = await apiFetch<{ data: T }>("/care-programs/" + savedId(program.id) + suffix, { method: "POST", data: input, headers: { "Idempotency-Key": key } });
  if (action === "complete") {
    const row = response.data as CareProgram;
    if (!validProgram(row) || row.id !== program.id || row.patient_id !== program.patient_id || row.status !== "completed"
      || row.version !== program.version + 1 || row.completed_by !== actor || row.completed_encounter_id !== input.encounter_id || !row.completed_at || row.completion_reason !== String(input.reason).trim()) throw invalidHospitalResponse();
  } else {
    const row = response.data as Baby;
    if (!validBaby(row) || row.delivery_id !== program.id || action === "birth" && (row.version !== 1 || row.birth_order !== input.birth_order || row.recorded_by !== actor || row.encounter_id !== input.encounter_id)
      || action === "link" && (row.id !== baby?.id || row.version !== 2 || row.child_patient_id !== input.child_patient_id || row.link?.verified_by !== actor
        || row.link.reason !== String(input.reason).trim() || row.link.encounter_id !== input.encounter_id)) throw invalidHospitalResponse();
  }
  return response;
}
