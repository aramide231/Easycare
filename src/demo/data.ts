import type { StaffUser } from "@/types/session";
import type { PatientRecord } from "@/api/patients";
import type { Booking, Visit, Assignment } from "@/api/visits";
import type { ClinicalRecord, ClinicalTemplate } from "@/api/clinical";
import type { Admission, Ward, Bed } from "@/api/admissions";
import type { CareProgram, Baby } from "@/api/care";
import type { ManagedStaff } from "@/api/staff";
import type { PrivateFile } from "@/api/files";

export const demoRoles = [
  { code: "frontdesk", label: "Front desk", id: 2 },
  { code: "doctor", label: "Doctor", id: 3 },
  { code: "nurse", label: "Nurse", id: 4 },
  { code: "pharmacy", label: "Pharmacy", id: 5 },
  { code: "hmo", label: "HMO", id: 6 },
  { code: "diagnostics-and-radiologist", label: "Diagnostics", id: 7 },
  { code: "admin", label: "Administrator", id: 1 },
] as const;

const demoPermissions = [
  "reference-data.view", "staff.view_self", "staff.view_any", "authorization.view", "staff.manage", "staff.reset_password", "audit.view", "files.view_own", "files.upload",
  "patients.view", "patients.create", "patients.update", "patients.flags.view", "patients.flags.manage", "patients.cards.manage", "patients.access.manage", "patients.merges.request", "patients.merges.approve",
  "appointments.view", "appointments.create", "appointments.update", "encounters.view", "encounters.view_any", "encounters.arrive", "encounters.assign", "encounters.progress", "encounters.cancel",
  ...["clinical", "prescriptions", "care"].flatMap((prefix) => ["view", "write", "sign", "amend", "void", "review"].map((suffix) => prefix + "." + suffix)),
  "clinical.history.view", "locations.view", "locations.manage", "admissions.view", "admissions.create", "admissions.allocate", "admissions.authorize_discharge", "admissions.complete_discharge",
  "care.manage", "care.link_birth", "care.forms.publish",
];
const instant = (offset = 0) => new Date(Date.now() + offset).toISOString();

export function demoUser(code: string): StaffUser {
  const role = demoRoles.find((item) => item.code === code);
  if (!role) throw new Error("Choose a listed demo role.");
  return {
    id: role.id, username: "demo." + code, staff_code: "DEMO-" + role.id,
    first_name: "Demo", last_name: role.label, middle_name: null, name: "Demo " + role.label,
    email: null, is_active: true, department: { id: role.id, code, name: role.label },
    roles: [{ code, name: role.label }],
    permissions: demoPermissions.filter((permission) => role.code === "admin"
      || !permission.startsWith("staff.manage") && !permission.startsWith("staff.reset") && permission !== "audit.view"),
    created_at: instant(-86400000), last_login_at: instant(),
  };
}

export function seedDemoData() {
  const categories = [
    { id: 1, code: "general", name: "General consultation" }, { id: 2, code: "antenatal", name: "Antenatal" },
    { id: 3, code: "postnatal", name: "Postnatal" }, { id: 4, code: "family_planning", name: "Family planning" },
    { id: 5, code: "delivery", name: "Delivery" }, { id: 6, code: "immunization", name: "Immunization" },
    { id: 7, code: "specialist", name: "Specialist consultation" },
  ];
  const patients: PatientRecord[] = ["Ada", "Bayo", "Chika"].map((name, index) => ({
    id: index + 1, mrn: "DEMO-00" + (index + 1), first_name: "Demo " + name, last_name: "Sample",
    middle_name: null, sex: index === 1 ? "male" : "female", date_of_birth: "1995-06-15", dob_estimated: false,
    category: categories[index === 2 ? 1 : 0], version: 1, created_at: instant(-86400000), updated_at: instant(-3600000),
    email: null, phone: null, marital_status: null, religion: null, occupation: null, state_of_origin: null,
    address: "Fictional demonstration record", life_status: "alive", deceased_at: null, created_by: 2,
    contacts: [], identifiers: [{ identifier: "DEMO-00" + (index + 1), kind: "mrn", retired_at: null }],
  }));
  const assignment = (id: number, accepted: boolean): Assignment => ({
    id, doctor_id: 3, doctor_name: "Demo Doctor", assigned_by: 2, ended_by: null, version: accepted ? 2 : 1,
    consultation_type: "General Consultation", status: accepted ? "accepted" : "assigned",
    assigned_at: instant(-1800000), accepted_at: accepted ? instant(-900000) : null, ended_at: null,
  });
  const visits: Visit[] = patients.map((patient, index) => ({
    id: index + 1, version: index === 0 ? 2 : 1, patient_id: patient.id, appointment_id: null, category_id: patient.category.id,
    opened_by: 2, visit_type: "General Consultation", care_setting: index === 1 ? "IPD" : "OPD",
    status: index === 0 ? "in_progress" : "open", opened_at: instant(-3600000), closed_at: null,
    queue: index === 0 ? "in_progress" : index === 1 ? "waiting" : "unassigned",
    current_assignment: index < 2 ? assignment(index + 1, index === 0) : null,
    patient: { id: patient.id, mrn: patient.mrn, first_name: patient.first_name, last_name: patient.last_name, version: patient.version },
  }));
  const bookings: Booking[] = patients.slice(0, 2).map((patient, index) => ({
    id: index + 1, version: 1, patient_id: patient.id, doctor_id: 3, doctor_name: "Demo Doctor", booked_by: 2,
    first_name: patient.first_name, last_name: patient.last_name, phone: "0800000000" + index, booking_channel: "In Person",
    visit_type: "General Consultation", specialist_name: null, specialist_email: null,
    starts_at: instant((index + 1) * 3600000), ends_at: instant((index + 1) * 3600000 + 1800000),
    status: "booked", follow_up_of_id: null, created_at: instant(), updated_at: instant(),
  }));
  const templates: ClinicalTemplate[] = [{
    id: 1, template_id: 1, code: "demo_note", version: 1, title: "Demo observation form", supported: true,
    fields: { observation: { type: "text", label: "Sample observation", max_length: 2000, required: true } },
  }];
  for (const type of ["antenatal", "postnatal", "family_planning", "delivery", "immunization"]) {
    templates.push({ ...templates[0], id: templates.length + 1, template_id: templates.length + 1,
      code: "care." + type + ".demo", title: "Demo " + type.replace(/_/g, " ") + " form" });
  }
  const clinical: ClinicalRecord[] = [
    { id: 1, patient_id: 1, encounter_id: 1, kind: "vitals", status: "signed", version: 2, authored_by: 4, finalized_by: 4,
      amends_id: null, amendment_reason: null, void_reason: null, recorded_at: instant(-800000), finalized_at: instant(-700000),
      payload: { observed_at: instant(-800000), temperature_c: "36.50", pulse_bpm: "72.00", comment: "Fictional measurements for screen preview only" },
      superseded: false, author_name: "Demo Nurse", finalizer_name: "Demo Nurse", body_mass_index: null, template_version: null },
    { id: 2, patient_id: 1, encounter_id: 1, kind: "entry", status: "signed", version: 2, authored_by: 3, finalized_by: 3,
      amends_id: null, amendment_reason: null, void_reason: null, recorded_at: instant(-600000), finalized_at: instant(-500000),
      payload: { section: "note", clinical_template_version_id: null, fields: {}, content: "Sample clinical note. This is dummy data." },
      superseded: false, author_name: "Demo Doctor", finalizer_name: "Demo Doctor", body_mass_index: null, template_version: null },
  ];
  const wards: Ward[] = [{ id: 1, code: "DEMO-GENERAL", name: "Demo General Ward", type: "General", daily_rate: "0.00", is_active: true, version: 1 }];
  const beds: Bed[] = [1, 2, 3].map((id) => ({ id, ward_id: 1, label: "Demo Bed " + id, daily_rate: null, is_active: true, version: 1, available: id !== 1 }));
  const admissions: Admission[] = [{
    id: 1, patient_id: 2, encounter_id: 2, version: 1, workflow_version: 1, encounter_version: 1, encounter_status: "open",
    status: "admitted", admitted_by: 4, admitted_at: instant(-1800000), authorized_by: null, authorized_at: null,
    discharged_by: null, discharged_at: null, discharge_reason: null, discharge_summary: null, current_assignment: visits[1].current_assignment,
    current_allocation: { id: 1, admission_id: 1, bed_id: 1, version: 1, assigned_by: 4, assigned_at: instant(-1700000),
      released_by: null, released_at: null, assignment_reason: "Sample bed allocation", release_reason: null },
  }];
  const programs: CareProgram[] = (["antenatal", "postnatal", "family_planning", "delivery", "immunization"] as const).map((type, index) => ({
    id: index + 1, patient_id: 3, encounter_id: 3, type, status: "active", version: 1, started_by: 4, started_at: instant(-1000000),
    start_reason: "Sample " + type.replace(/_/g, " ") + " program", completed_by: null, completed_encounter_id: null, completed_at: null, completion_reason: null,
  }));
  const babies: Baby[] = [{ id: 1, delivery_id: 4, encounter_id: 3, birth_order: 1, version: 1,
    recorded_by: 4, recorded_at: instant(-500000), reason: "Sample baby identity", link_exists: false, child_patient_id: null, link: null }];
  const staff: ManagedStaff[] = demoRoles.map((role) => ({ ...demoUser(role.code), version: 1 }));
  const files: PrivateFile[] = [];
  return { categories, patients, visits, bookings, templates, clinical, wards, beds, admissions, programs, babies, staff, files };
}
