import { demoRoles, demoUser, seedDemoData } from "./data";
import type { ClinicalKind, ClinicalRecord, Payload } from "@/api/clinical";
import type { PatientRecord } from "@/api/patients";
import type { Booking, Visit, Assignment } from "@/api/visits";
import type { Admission, Allocation, Ward, Bed } from "@/api/admissions";
import type { Baby, CareProgram } from "@/api/care";
import type { ManagedStaff, StaffInput } from "@/api/staff";

type Body = Record<string, unknown>;
const roleKey = "easycare.demo.role";
class DemoFault extends Error {
  constructor(message: string, public status = 409, public code = "demo_conflict") { super(message); }
}
const now = () => new Date().toISOString();
const copy = <T,>(value: T): T => structuredClone(value);
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store, private" },
});
const positive = (value: unknown) => Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : 0;
const nextId = (rows: { id: number }[]) => Math.max(0, ...rows.map((row) => row.id)) + 1;
const find = <T extends { id: number }>(rows: T[], id: unknown): T => {
  const row = rows.find((candidate) => candidate.id === Number(id));
  if (!row) throw new DemoFault("This sample record was not found. Reset demo data to start again.", 404, "not_found");
  return row;
};
const expectVersion = (actual: number, expected: unknown) => {
  if (actual !== Number(expected)) throw new DemoFault("This sample record changed. Reload it before saving.", 409, "version_conflict");
};
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const nullable = (value: unknown) => text(value) || null;
const trimBody = (body: Body) => Object.fromEntries(Object.entries(body).map(([key, value]) => [key, typeof value === "string" ? value.trim() : value]));

export function createDemoTransport() {
  let state = seedDemoData();
  let selectedRole: string | null = null;
  const receipts = new Map<string, { fingerprint: string; response: unknown }>();
  const histories = new Map<string, unknown[]>();
  const fileBytes = new Map<number, Blob>();
  const access = new Map<number, string>();
  const flags = new Map<number, Body[]>();
  const cards = new Map<number, Body[]>();
  const merges = new Map<number, Body[]>();
  const sessionRole = () => {
    try { selectedRole = window.sessionStorage.getItem(roleKey); } catch { /* Demo works without browser storage. */ }
    return demoRoles.some((role) => role.code === selectedRole) ? selectedRole : null;
  };
  const setRole = (role: string | null) => {
    selectedRole = role;
    try { if (role) window.sessionStorage.setItem(roleKey, role); else window.sessionStorage.removeItem(roleKey); } catch { /* Optional demo preference only. */ }
  };
  const actor = () => {
    const role = sessionRole();
    if (!role) throw new DemoFault("Choose a demo role to enter the sample workspace.", 401, "unauthenticated");
    return demoUser(role);
  };
  const session = () => ({ data: { user: actor(), csrf_token: "demo-local-csrf", expires_at: new Date(Date.now() + 8 * 3600000).toISOString() } });
  const visiblePatient = (id: unknown) => {
    const row = find(state.patients, id);
    if (access.get(row.id) && access.get(row.id) !== "active") throw new DemoFault("Sample patient is restricted.", 404, "not_found");
    return row;
  };
  const sync = () => {
    for (const visit of state.visits) {
      const patient = find(state.patients, visit.patient_id);
      visit.patient = { id: patient.id, mrn: patient.mrn, first_name: patient.first_name, last_name: patient.last_name, version: patient.version };
    }
    for (const row of state.admissions) {
      const visit = find(state.visits, row.encounter_id);
      row.current_assignment = copy(visit.current_assignment);
      row.encounter_status = visit.status;
      row.encounter_version = visit.version;
    }
    for (const bed of state.beds) bed.available = !state.admissions.some((row) => row.current_allocation?.bed_id === bed.id);
  };
  const page = (rows: unknown[], query: URLSearchParams) => {
    const size = Math.min(100, Math.max(1, positive(query.get("per_page")) || 20));
    const current = positive(query.get("page")) || 1;
    return { data: rows.slice((current - 1) * size, current * size), meta: { current_page: current, last_page: Math.max(1, Math.ceil(rows.length / size)), total: rows.length } };
  };
  const filtered = <T,>(rows: T[], query: URLSearchParams, fields: string[]) => rows.filter((row) => {
    const record = row as Record<string, unknown>;
    if (query.get("q") && !JSON.stringify(row).toLowerCase().includes(query.get("q")!.toLowerCase())) return false;
    return fields.every((field) => !query.has(field) || query.get(field) === ""
      || (typeof record[field] === "boolean" ? (record[field] ? "1" : "0") : String(record[field])) === query.get(field));
  });
  const journal = (key: string, snapshot: { id: number; version?: number }, operation: string, reason: unknown) => {
    const list = histories.get(key) ?? [];
    list.unshift({ id: list.length + 1, version: snapshot.version ?? list.length + 1, operation, actor_id: actor().id,
      actor_name: actor().name, reason: nullable(reason), recorded_at: now(), snapshot: copy(snapshot),
      clinical_record_id: snapshot.id, admission_id: snapshot.id, workflow_version: (snapshot as unknown as Body).workflow_version });
    histories.set(key, list);
  };
  const readHistory = (key: string, row: { id: number; version?: number }, query: URLSearchParams) => {
    if (!histories.has(key)) journal(key, row, "sample", "Fictional demonstration history");
    return page(histories.get(key)!, query);
  };
  const clinicalRows = (encounter?: number, program?: number) => state.clinical.filter((row) =>
    (!encounter || row.encounter_id === encounter) && (!program || row.care_program_id === program)
    && (row.status !== "draft" || row.authored_by === actor().id) && (!access.get(row.patient_id) || access.get(row.patient_id) === "active"));
  const normalizePayload = (payload: Payload, kind: ClinicalKind) => {
    const result = trimBody(payload);
    if (kind === "prescription") { result.order_status ??= "active"; result.medications ??= []; }
    if (kind === "entry") result.fields ??= {};
    return result;
  };

  function clinicalRoute(parts: string[], method: string, body: Body, query: URLSearchParams, programId?: number): unknown {
    const encounterId = Number(parts[1]);
    const prefix = parts[2];
    const id = positive(parts[3]);
    const operation = parts[4];
    const visit = find(state.visits, encounterId);
    visiblePatient(visit.patient_id);
    const kind = programId ? "entry" : prefix === "prescriptions" ? "prescription" : (body.kind || query.get("kind") || "entry") as ClinicalKind;
    const rows = clinicalRows(encounterId, programId).filter((row) => prefix === "prescriptions" ? row.kind === "prescription" : !query.get("kind") || row.kind === query.get("kind"));
    if (method === "GET") {
      if (!id) return page(rows.filter((row) => !query.get("status") || row.status === query.get("status")), query);
      const row = find(rows, id);
      if (operation === "history") return readHistory("clinical:" + row.id, row, query);
      return { data: row };
    }
    expectVersion(visit.version, body.encounter_version);
    if (!["open", "in_progress"].includes(visit.status)) throw new DemoFault("Closed sample visits are read-only.");
    const original = id ? find(state.clinical, id) : null;
    if (original) expectVersion(original.version, body.version);
    const action = !original ? "store" : method === "PATCH" ? "update" : operation;
    const replacement = ["amend", "stop", "complete"].includes(action) || action === "void" && original?.status === "signed";
    const payload = normalizePayload({ ...original?.payload, ...(body.payload as Payload ?? {}) }, original?.kind ?? kind);
    if (action === "stop") payload.order_status = "stopped";
    if (action === "complete") payload.order_status = "completed";
    const finalized = !["store", "update"].includes(action);
    const row: ClinicalRecord = {
      ...(original ? copy(original) : {}), id: original && !replacement ? original.id : nextId(state.clinical),
      patient_id: visit.patient_id, encounter_id: visit.id, kind: original?.kind ?? kind,
      status: !finalized ? "draft" : action === "void" ? "voided" : "signed",
      version: replacement ? 2 : original ? original.version + 1 : 1,
      authored_by: replacement || !original ? actor().id : original.authored_by,
      author_name: replacement || !original ? actor().name : original.author_name,
      finalized_by: finalized ? actor().id : null, finalizer_name: finalized ? actor().name : null,
      amends_id: replacement ? original!.id : original?.amends_id ?? null,
      amendment_reason: replacement ? text(body.reason) : original?.amendment_reason ?? null,
      void_reason: action === "void" ? text(body.reason) : null,
      recorded_at: original && !replacement ? original.recorded_at : now(), finalized_at: finalized ? now() : null,
      payload, superseded: false, body_mass_index: null,
      template_version: state.templates.find((template) => template.id === Number(payload.clinical_template_version_id)) ?? null,
      ...(programId ? { care_program_id: programId, birth_id: original?.birth_id ?? (body.birth_id ? Number(body.birth_id) : null) } : {}),
    };
    if (original && !replacement) Object.assign(original, row); else state.clinical.push(row);
    if (replacement) original!.superseded = true;
    journal("clinical:" + row.id, row, action, body.reason);
    return { data: row };
  }

  function route(path: string, method: string, body: Body, query: URLSearchParams): unknown {
    const parts = path.split("/").filter(Boolean);
    const root = parts[0];
    const id = positive(parts[1]);
    const suffix = parts[2];
    sync();
    if (path === "/auth/csrf-token") return { data: { csrf_token: "demo-local-csrf" } };
    if (path === "/auth/login" && method === "POST") {
      const code = text(body.email_or_username).replace(/^demo\./, "");
      if (!demoRoles.some((role) => role.code === code)) throw new DemoFault("Select one of the demo roles.", 422, "validation_failed");
      setRole(code);
      return session();
    }
    if (path === "/auth/logout") { setRole(null); return undefined; }
    if (path === "/auth/me") return session();
    actor();
    if (path === "/auth/password/reset") throw new DemoFault("Demo roles have no real passwords to recover. Use the demo role selector.", 422, "demo_only");
    if (root === "patients") {
      if (parts[1] === "options") return { data: { categories: state.categories } };
      if (parts[1] === "duplicate-check") return { data: [], meta: { has_more: false } };
      if (!id) {
        if (method === "GET") return page(filtered(state.patients.filter((row) => !access.get(row.id) || access.get(row.id) === "active"), query, ["mrn", "date_of_birth"])
          .filter((row) => !query.get("category_id") || row.category.id === Number(query.get("category_id"))), query);
        const row: PatientRecord = { ...copy(state.patients[0]), ...trimBody(body), id: nextId(state.patients), version: 1,
          mrn: text(body.mrn).toUpperCase(), category: find(state.categories, body.category_id), created_by: actor().id,
          created_at: now(), updated_at: now(), contacts: (body.contacts ?? []) as PatientRecord["contacts"],
          identifiers: [{ identifier: text(body.mrn).toUpperCase(), kind: "mrn", retired_at: null }] };
        if (!row.mrn || !row.first_name || !row.last_name) throw new DemoFault("Enter a sample card number and patient name.", 422, "validation_failed");
        state.patients.push(row);
        return { data: row };
      }
      const patient = suffix === "access-state" || suffix === "access" ? find(state.patients, id) : visiblePatient(id);
      if (method === "GET") {
        if (!suffix) return { data: patient, meta: { requested_id: id, canonical_id: id } };
        if (suffix === "access-state") return { data: { id, version: patient.version, access_status: access.get(id) || "active" } };
        if (suffix === "history") return page(clinicalRows().filter((row) => row.patient_id === id && row.status !== "draft"), query);
        return page((suffix === "flags" ? flags : suffix === "card-history" ? cards : merges).get(id) ?? [], query);
      }
      expectVersion(patient.version, body.version);
      if (method === "PATCH") { Object.assign(patient, trimBody(body), { version: patient.version + 1, updated_at: now() }); return { data: patient }; }
      let recordId = id;
      let operation = "";
      if (suffix === "flags") {
        const list = flags.get(id) ?? [];
        recordId = positive(parts[3]) || list.length + 1;
        operation = parts[4] === "resolve" ? "flags.resolve" : "flags.store";
        if (operation === "flags.store") list.push({ id: recordId, type: body.type, reason: body.reason, created_by: actor().id,
          created_at: now(), resolved_at: null, resolved_by: null, resolution_reason: null });
        else Object.assign(list.find((row) => row.id === recordId) ?? {}, { resolved_at: now(), resolved_by: actor().id, resolution_reason: body.reason });
        flags.set(id, list);
      } else if (suffix === "card") {
        operation = "cards.change";
        const list = cards.get(id) ?? [];
        recordId = list.length + 1;
        list.push({ id: recordId, previous_category_id: patient.category.id, new_category_id: body.category_id,
          previous_mrn: patient.mrn, new_mrn: text(body.mrn).toUpperCase(), reason: body.reason, changed_by: actor().id, changed_at: now() });
        patient.category = find(state.categories, body.category_id); patient.mrn = text(body.mrn).toUpperCase(); cards.set(id, list);
      } else if (suffix === "access") {
        operation = "access." + parts[3]; access.set(id, parts[3] === "restrict" ? "restricted" : "active");
      } else {
        const list = merges.get(id) ?? [];
        recordId = positive(parts[3]) || list.length + 1;
        const action = parts[4] || "request";
        operation = "merges." + action;
        if (action === "request") list.push({ id: recordId, source_patient_id: id, target_patient_id: body.target_patient_id,
          source_version: patient.version, target_version: body.target_version, requested_by: actor().id,
          status: "pending", version: 1, reviewed_by: null, reviewed_at: null, reason: body.reason });
        else {
          const merge = list.find((row) => row.id === recordId);
          if (!merge) throw new DemoFault("Sample merge request not found.", 404, "not_found");
          Object.assign(merge, { status: action === "approve" ? "approved" : action === "reject" ? "rejected" : "cancelled",
            version: Number(merge.version) + 1, reviewed_by: actor().id, reviewed_at: now(), review_reason: body.reason });
          if (action === "approve") access.set(id, "merged");
        }
        merges.set(id, list);
      }
      patient.version++;
      return { data: { id, version: patient.version, operation, record_id: recordId } };
    }

    if ((root === "clinical" || root === "prescriptions") && parts[1] === "options") return { data: {
      timezone: "Africa/Lagos", sections: ["presenting_complaints", "physical_examination", "assessment", "plan", "note", "procedure_findings"],
      physical_examination_fields: ["general", "cns", "chest", "cvs", "abdomen", "comment"], blood_glucose_units: ["mg/dL", "mmol/L"],
    } };
    if (path === "/clinical/templates") return page(state.templates.filter((row) => !row.code.startsWith("care.")), query);
    if (parts.includes("clinicians")) return page(state.staff.filter((row) => row.roles.some((role) => role.code === "doctor")), query);
    if (root === "appointments" && parts[1] === "options") return { data: { timezone: "Africa/Lagos",
      booking_channels: ["In Person", "Phone", "Online"], visit_types: ["General Consultation", "Specialist Consultation"],
      statuses: ["booked", "confirmed", "attended", "cancelled", "no_show"] } };
    if (root === "encounters" && parts[1] === "options") return { data: { timezone: "Africa/Lagos",
      care_settings: ["OPD", "IPD"], visit_types: ["General Consultation", "Specialist Consultation"], queues: ["unassigned", "waiting", "in_progress"] } };
    if (root === "appointments" && suffix !== "arrive") {
      if (method === "GET") {
        if (suffix === "history") return readHistory("booking:" + id, find(state.bookings, id), query);
        return id ? { data: find(state.bookings, id) } : page(filtered(state.bookings, query, ["patient_id", "doctor_id", "status"]), query);
      }
      const original = id ? find(state.bookings, id) : null;
      if (original) expectVersion(original.version, body.version);
      const row = original ?? { id: nextId(state.bookings), version: 0, booked_by: actor().id, status: "booked", follow_up_of_id: null, patient_id: null, created_at: now() } as Booking;
      if (suffix) row.status = ({ confirm: "confirmed", cancel: "cancelled", "no-show": "no_show" } as const)[suffix as "confirm"] || row.status;
      else Object.assign(row, trimBody(body));
      if (body.phone !== undefined) {
        const phone = text(body.phone).replace(/[ ()-]/g, "");
        row.phone = phone.startsWith("+") ? phone : "+" + phone;
      }
      if (body.specialist_email !== undefined) row.specialist_email = nullable(body.specialist_email)?.toLowerCase() ?? null;
      row.version++; row.updated_at = now();
      if (!original) state.bookings.push(row);
      journal("booking:" + row.id, row, suffix || "saved", body.reason);
      return { data: row };
    }
    if (root === "queues" || root === "encounters" || suffix === "arrive") {
      if (root === "encounters" && ["clinical", "prescriptions"].includes(suffix)) return clinicalRoute(parts, method, body, query);
      if (method === "GET") {
        if (suffix === "history") return readHistory("visit:" + id, find(state.visits, id), query);
        if (suffix === "assignments") { const visit = find(state.visits, id); return page(visit.current_assignment ? [visit.current_assignment] : [], query); }
        if (id) { const row = find(state.visits, id); visiblePatient(row.patient_id); return { data: row }; }
        return page(filtered(state.visits.filter((row) => !access.get(row.patient_id) || access.get(row.patient_id) === "active"), query, ["patient_id", "status", "queue"]), query);
      }
      if (root === "encounters" && suffix === "admission") {
        const visit = find(state.visits, id);
        const row: Admission = { id: nextId(state.admissions), patient_id: visit.patient_id, encounter_id: id, version: 1, workflow_version: 1,
          encounter_version: visit.version, encounter_status: visit.status, status: "admitted", admitted_by: actor().id, admitted_at: now(),
          authorized_by: null, authorized_at: null, discharged_by: null, discharged_at: null, discharge_reason: null, discharge_summary: null,
          current_allocation: null, current_assignment: copy(visit.current_assignment) };
        state.admissions.push(row); journal("admission:" + row.id, row, "admitted", body.reason); return { data: row };
      }
      if (root === "encounters" && suffix === "care-programs") {
        const visit = find(state.visits, id);
        const row: CareProgram = { id: nextId(state.programs), patient_id: visit.patient_id, encounter_id: id, type: body.type as CareProgram["type"],
          status: "active", version: 1, started_by: actor().id, started_at: now(), start_reason: text(body.reason),
          completed_by: null, completed_encounter_id: null, completed_at: null, completion_reason: null };
        state.programs.push(row); return { data: row };
      }
      if (!id || suffix === "arrive") {
        const patient = visiblePatient(body.patient_id);
        const row: Visit = { id: nextId(state.visits), version: 1, patient_id: patient.id, appointment_id: suffix === "arrive" ? id : null,
          category_id: patient.category.id, opened_by: actor().id, visit_type: text(body.visit_type) || "General Consultation",
          care_setting: text(body.care_setting) || "OPD", status: "open", opened_at: now(), closed_at: null,
          queue: "unassigned", current_assignment: null, patient: { id: patient.id, mrn: patient.mrn, first_name: patient.first_name, last_name: patient.last_name, version: patient.version } };
        state.visits.push(row);
        if (suffix === "arrive") { const booking = find(state.bookings, id); booking.status = "attended"; booking.version++; }
        return { data: row };
      }
      const visit = find(state.visits, id);
      expectVersion(visit.version, body.version);
      visit.version++;
      if (["assign", "reassign"].includes(suffix)) {
        const assignment: Assignment = { id: Date.now(), doctor_id: Number(body.doctor_id), doctor_name: find(state.staff, body.doctor_id).name,
          assigned_by: actor().id, ended_by: null, version: 1, consultation_type: text(body.consultation_type),
          status: "assigned", assigned_at: now(), accepted_at: null, ended_at: null };
        visit.current_assignment = assignment; visit.queue = "waiting";
      } else if (suffix === "accept") {
        if (!visit.current_assignment) throw new DemoFault("Assign a sample doctor first.");
        visit.status = "in_progress"; visit.queue = "in_progress";
        Object.assign(visit.current_assignment, { status: "accepted", version: Number(body.assignment_version) + 1, accepted_at: now() });
      } else { visit.status = suffix === "complete" ? "closed" : "cancelled"; visit.closed_at = now(); visit.queue = null; visit.current_assignment = null; }
      journal("visit:" + id, visit, suffix, body.reason);
      return { data: visit };
    }

    if (root === "locations") {
      const rows: (Ward | Bed)[] = parts[1] === "wards" ? state.wards : state.beds;
      const locationId = positive(parts[2]);
      if (method === "GET") return locationId ? { data: find(rows, locationId) } : page(filtered(rows, query, ["ward_id", "available", "is_active"])
        .filter((row) => query.get("available") !== "1" || "available" in row && row.available), query);
      const original = locationId ? find(rows, locationId) : null;
      if (original) expectVersion(original.version, body.version);
      const row = Object.assign(original ?? { id: nextId(rows), version: 0, is_active: true }, trimBody(body));
      delete (row as Body).ward_version;
      row.version = (original ? Number(body.version) : 0) + 1;
      if (!original) rows.push(row as Ward | Bed);
      return { data: row };
    }
    if (root === "admissions") {
      const row = id ? find(state.admissions, id) : null;
      if (method === "GET") {
        if (!row) return page(filtered(state.admissions, query, ["patient_id", "status"]), query);
        visiblePatient(row.patient_id);
        if (suffix === "history") return readHistory("admission:" + id, row, query);
        if (suffix === "allocations") return page(row.current_allocation ? [row.current_allocation] : [], query);
        return { data: row };
      }
      if (!row) throw new DemoFault("Choose a sample admission.", 422);
      expectVersion(row.workflow_version, body.workflow_version);
      row.workflow_version++;
      if (["allocate", "transfer"].includes(suffix)) {
        if (!find(state.beds, body.bed_id).available) throw new DemoFault("Choose an available sample bed.");
        row.current_allocation = { id: Date.now(), admission_id: id, bed_id: Number(body.bed_id), version: 1, assigned_by: actor().id,
          assigned_at: now(), released_by: null, released_at: null, assignment_reason: text(body.reason), release_reason: null } satisfies Allocation;
      } else if (suffix === "authorize-discharge") {
        row.status = "discharge_authorized"; row.version++; row.authorized_by = actor().id; row.authorized_at = now();
        row.discharge_reason = text(body.reason); row.discharge_summary = nullable(body.discharge_summary);
      } else {
        row.current_allocation = null;
        if (suffix === "complete-discharge") { row.status = "discharged"; row.version++; row.discharged_by = actor().id; row.discharged_at = now(); }
      }
      journal("admission:" + id, row, suffix, body.reason);
      return { data: row };
    }
    if (root === "care-programs") {
      if (parts[1] === "forms") return page(state.templates.filter((row) => row.code.startsWith("care." + query.get("type") + ".")), query);
      if (!id) return page(filtered(state.programs, query, ["patient_id", "type", "status"]), query);
      const program = find(state.programs, id);
      visiblePatient(program.patient_id);
      if (suffix === "encounters") return clinicalRoute(["encounters", parts[3], "records", ...parts.slice(5)], method, body, query, id);
      if (method === "GET") {
        if (suffix === "records") return page(clinicalRows(undefined, id), query);
        if (suffix === "births") return page(state.babies.filter((row) => row.delivery_id === id), query);
        return { data: program };
      }
      if (suffix === "complete") {
        expectVersion(program.version, body.version);
        Object.assign(program, { status: "completed", version: program.version + 1, completed_by: actor().id,
          completed_encounter_id: Number(body.encounter_id), completed_at: now(), completion_reason: text(body.reason) });
        return { data: program };
      }
      if (suffix === "births") {
        if (parts[4] === "link") {
          const baby = find(state.babies, parts[3]);
          Object.assign(baby, { version: 2, link_exists: true, child_patient_id: Number(body.child_patient_id),
            link: { encounter_id: Number(body.encounter_id), verified_by: actor().id, verified_at: now(), reason: text(body.reason) } });
          return { data: baby };
        }
        const baby: Baby = { id: nextId(state.babies), delivery_id: id, encounter_id: Number(body.encounter_id),
          birth_order: Number(body.birth_order), version: 1, recorded_by: actor().id, recorded_at: now(),
          reason: text(body.reason), link_exists: false, child_patient_id: null, link: null };
        state.babies.push(baby); return { data: baby };
      }
    }
    if (root === "staff-management") {
      if (parts[1] === "options") return { data: { departments: state.staff.map((row) => row.department), roles: demoRoles.map((role) => ({ code: role.code, name: role.label, assignable: true })) } };
      if (method === "GET") return id ? { data: find(state.staff, id) } : page(filtered(state.staff, query, []), query);
      const original = id ? find(state.staff, id) : null;
      if (suffix === "password-reset") {
        const row = find(state.staff, id); row.version++;
        return { data: { user: row, reset_code: "d".repeat(48), expires_at: new Date(Date.now() + 900000).toISOString() } };
      }
      const data = body as unknown as StaffInput;
      const row: ManagedStaff = { ...demoUser(data.role_codes[0] || "frontdesk"), ...original, ...trimBody(body),
        id: original?.id ?? nextId(state.staff), username: original?.username ?? text(body.username),
        version: original ? original.version + 1 : 1, name: [data.first_name, data.middle_name, data.last_name].filter(Boolean).join(" "),
        roles: data.role_codes.map((code) => ({ code, name: demoRoles.find((role) => role.code === code)?.label ?? code })),
        department: state.staff.find((staff) => staff.department?.id === data.department_id)?.department ?? null };
      if (original) Object.assign(original, row); else state.staff.push(row);
      return { data: row };
    }
    if (root === "audit-events") return { ...page(filtered([{ id: 1, action: "auth.login", actor_id: actor().id,
      subject_type: "staff", subject_id: actor().id, safe_summary: {}, outcome: "succeeded", channel: "http",
      http_status: 200, request_id: "demo-event", occurred_at: now() }], query,
      ["action", "actor_id", "subject_type", "subject_id", "outcome", "channel"]), query), through_id: 1 };
    if (root === "staff") return id ? { data: find(state.staff, id) } : page(state.staff, query);
    if (root === "departments") return { data: state.staff.map((row) => row.department) };
    throw new DemoFault("This sample action is not available in the disconnected preview. No backend request was sent.", 422, "demo_only");
  }

  async function request(url: string, options: RequestInit = {}): Promise<Response> {
    if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const parsed = new URL(url, "https://demo.invalid");
    const path = parsed.pathname.replace(/^.*?\/api\/v1(?=\/|$)/, "");
    const method = (options.method || "GET").toUpperCase();
    try {
      if (path.startsWith("/files")) {
        const id = positive(path.split("/")[2]);
        actor();
        if (method === "GET" && id && find(state.files, id).uploaded_by !== actor().id) {
          throw new DemoFault("Sample file not found.", 404, "not_found");
        }
        if (method === "GET" && id && path.endsWith("/download")) {
          const blob = fileBytes.get(id);
          if (!blob) throw new DemoFault("Sample file not found.", 404, "not_found");
          return new Response(blob, { headers: { "Content-Type": "application/octet-stream", "Cache-Control": "no-store" } });
        }
        if (method === "GET") return json(id ? { data: find(state.files, id) } : page(state.files.filter((row) => row.uploaded_by === actor().id), parsed.searchParams));
        const upload = options.body instanceof FormData ? options.body.get("file") : null;
        if (!(upload instanceof Blob)) throw new DemoFault("Choose a sample file.", 422);
        if (upload.size === 0 || upload.size > 10 * 1024 * 1024 || !["application/pdf", "image/jpeg", "image/png"].includes(upload.type)) {
          throw new DemoFault("Choose a non-empty sample PDF, JPEG or PNG up to 10 MB.", 422, "validation_failed");
        }
        const fileId = nextId(state.files);
        const row = { id: fileId, original_name: upload instanceof File ? upload.name : "sample-file", mime_type: upload.type,
          byte_size: upload.size, scan_status: "not_scanned", uploaded_by: actor().id, created_at: now() };
        state.files.push(row); fileBytes.set(fileId, upload);
        return json({ data: row }, 201);
      }
      const body: Body = typeof options.body === "string" ? JSON.parse(options.body) : {};
      const key = new Headers(options.headers).get("Idempotency-Key");
      const receiptKey = key ? [sessionRole(), method, path, key].join(":") : null;
      const fingerprint = JSON.stringify(body);
      const saved = receiptKey ? receipts.get(receiptKey) : null;
      if (saved) {
        if (saved.fingerprint !== fingerprint) throw new DemoFault("Use a new demo submission for changed values.", 409, "idempotency_conflict");
        actor();
        return json(saved.response);
      }
      const backup = method !== "GET" ? copy(state) : null;
      let response: unknown;
      try { response = route(path, method, body, parsed.searchParams); }
      catch (error) { if (backup) state = backup; throw error; }
      if (receiptKey) receipts.set(receiptKey, { fingerprint, response: copy(response) });
      return response === undefined ? new Response(null, { status: 204 }) : json(response, method === "POST" ? 201 : 200);
    } catch (error) {
      if (!(error instanceof DemoFault)) throw error;
      return json({ message: error.message, code: error.code }, error.status);
    }
  }

  return { request, reset: () => { state = seedDemoData(); receipts.clear(); histories.clear(); fileBytes.clear(); access.clear(); flags.clear(); cards.clear(); merges.clear(); } };
}

const demo = createDemoTransport();
export const demoFetch = demo.request;
export const resetDemoData = demo.reset;
