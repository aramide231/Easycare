import test, { beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadSource } from "./source-loader.mjs";

const values = new Map();
globalThis.window = { sessionStorage: { getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) },
  localStorage: { removeItem() {} } };
const originalFetch = globalThis.fetch;
let networkCalls = 0;
globalThis.fetch = async () => { networkCalls++; throw new Error("A disconnected demo must never access the network."); };
const source = (path) => loadSource(path, "demo");
const { apiFetch, ApiError } = source("src/api/client/apClient.ts");
const { resetDemoData } = source("src/demo/transport.ts");
const { useAuthStore } = source("src/store/useAuthStore.ts");
const { demoRoles } = source("src/demo/data.ts");
const patients = source("src/api/patients.ts");
const visits = source("src/api/visits.ts");
const clinical = source("src/api/clinical.ts");
const admissions = source("src/api/admissions.ts");
const care = source("src/api/care.ts");
const login = async (role = "doctor") => {
  const response = await apiFetch("/auth/login", { method: "POST", data: { email_or_username: "demo." + role, password: "demo-only" } });
  useAuthStore.getState().setUser(response.data.user, Date.parse(response.data.expires_at));
  return response.data.user;
};
beforeEach(() => { values.clear(); resetDemoData(); useAuthStore.getState().clearAuth(); networkCalls = 0; });
after(() => { globalThis.fetch = originalFetch; });

test("the default deployment has no external API forwarding and demo is the default data source", () => {
  const config = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
  assert.ok(config.rewrites.every((row) => !/^https?:/.test(row.destination)));
  assert.equal(loadSource("src/config/dataSource.ts", "").IS_DEMO, true);
  assert.equal(loadSource("src/config/dataSource.ts", "backend").IS_DEMO, false);
  assert.throws(() => loadSource("src/config/dataSource.ts", "invalid"), /must be demo or backend/);
});
test("session restore, role selection and sign out never contact the backend", async () => {
  await assert.rejects(apiFetch("/auth/me"), (error) => error instanceof ApiError && error.status === 401);
  for (const role of demoRoles) {
    const user = await login(role.code);
    assert.equal(user.roles[0].code, role.code);
    assert.equal((await apiFetch("/auth/me")).data.user.id, user.id);
  }
  await apiFetch("/auth/logout", { method: "POST" });
  await assert.rejects(apiFetch("/auth/me"), (error) => error.status === 401);
  assert.equal(networkCalls, 0);
});
test("patient search, card filters and registration use isolated sample records", async () => {
  await login("frontdesk");
  assert.equal((await patients.listPatients({ q: "Demo Ada" })).meta.total, 1);
  assert.equal((await patients.listPatients({ category_id: "2" })).meta.total, 1);
  const original = (await patients.getPatient(1)).data;
  const input = { ...original, first_name: "Demo New", mrn: "demo-new", category_id: 1, contacts: [] };
  const saved = await patients.savePatient(null, input, "demo-patient-create");
  assert.equal(saved.data.mrn, "DEMO-NEW");
  assert.equal((await patients.listPatients()).meta.total, 4);
  resetDemoData();
  assert.equal((await patients.listPatients()).meta.total, 3);
  assert.equal(networkCalls, 0);
});
test("sample booking and visit commands keep the existing client response checks", async () => {
  const user = await login("frontdesk");
  const input = { first_name: "Demo", last_name: "Visitor", phone: "08000000000", booking_channel: "Phone",
    visit_type: "General Consultation", specialist_name: null, specialist_email: null, doctor_id: 3,
    patient_id: 1, starts_at: new Date(Date.now() + 3600000).toISOString(), ends_at: new Date(Date.now() + 5400000).toISOString() };
  const booking = (await visits.saveBooking(null, input, "demo-booking", user.id)).data;
  assert.equal((await visits.bookingCommand(booking.id, "confirm", { version: booking.version, reason: "Sample confirmation" }, "demo-confirm")).data.status, "confirmed");
  const visit = await visits.openVisit(null, { patient_id: 1, patient_version: 1, identity_verified: true, care_setting: "OPD", visit_type: "General Consultation" }, "demo-arrival");
  assert.equal(visit.data.patient_id, 1);
  assert.equal(networkCalls, 0);
});
test("clinical drafts, signatures and corrections stay in memory with patient and author identity", async () => {
  const actor = await login();
  const visit = (await visits.getVisit(1)).data;
  const payload = { section: "note", content: "Dummy note", clinical_template_version_id: null, fields: {} };
  const draft = (await clinical.clinicalCommand(1, 1, "entry", "store", null, { encounter_version: visit.version, kind: "entry", payload }, "demo-note", actor.id)).data;
  const signed = (await clinical.clinicalCommand(1, 1, "entry", "sign", draft, { encounter_version: visit.version, version: draft.version, current_password: "demo-only" }, "demo-sign", actor.id)).data;
  const correction = (await clinical.clinicalCommand(1, 1, "entry", "amend", signed, { encounter_version: visit.version, version: signed.version,
    reason: "Sample correction", current_password: "demo-only", payload: { content: "Dummy correction" } }, "demo-correct", actor.id)).data;
  assert.equal(correction.amends_id, signed.id);
  assert.notEqual(correction.id, signed.id);
  assert.equal((await clinical.listClinical(2, 2, "entry")).meta.total, 0);
  assert.equal(networkCalls, 0);
});
test("nursing sample occupancy and new admissions pass existing client validation", async () => {
  const actor = await login("nurse");
  assert.equal((await admissions.listBeds({ available: 1 })).meta.total, 2);
  assert.equal((await admissions.listAdmissions()).meta.total, 1);
  const visit = (await visits.getVisit(3)).data;
  const row = (await admissions.createAdmission(visit, "Sample admission", true, "demo-admit", actor.id)).data;
  assert.equal(row.patient_id, 3);
  assert.equal(row.current_allocation, null);
  assert.equal(networkCalls, 0);
});
test("care programs, illustrative forms, births and child links use matching sample identities", async () => {
  const actor = await login("nurse");
  const program = (await care.getCareProgram(4)).data;
  const forms = await care.careForms("delivery", 1);
  assert.match(forms.data[0].code, /^care.delivery\./);
  const baby = (await care.careProgramCommand(program, "birth", { version: 1, encounter_id: 3, encounter_version: 1,
    birth_order: 2, reason: "Sample birth identity" }, "demo-birth", actor.id)).data;
  assert.equal(baby.birth_order, 2);
  const linked = await care.careProgramCommand(program, "link", { version: baby.version, encounter_id: 3, child_patient_id: 1,
    reason: "Sample child linking" }, "demo-link", actor.id, baby);
  assert.equal(linked.data.child_patient_id, 1);
  assert.equal(networkCalls, 0);
});
test("admin pages receive valid sample audit and staff data without making requests", async () => {
  await login("admin");
  const staff = source("src/api/staff.ts");
  assert.equal((await staff.listStaff("", 1)).meta.total, 7);
  const audit = await apiFetch("/audit-events");
  assert.deepEqual(audit.data[0].safe_summary, {});
  assert.equal(audit.through_id, 1);
  assert.equal(networkCalls, 0);
});
test("sample uploads stay local and do not become another demo role's files", async () => {
  await login("admin");
  const files = source("src/api/files.ts");
  const upload = new File(["%PDF-1.4 sample"], "sample.pdf", { type: "application/pdf" });
  const saved = (await files.uploadFile(upload, "demo-file")).data;
  assert.equal((await files.downloadFile(saved.id)).size, upload.size);
  await login("doctor");
  assert.equal((await files.listFiles(1)).meta.total, 0);
  await assert.rejects(files.downloadFile(saved.id), (error) => error.status === 404);
  assert.equal(networkCalls, 0);
});
test("unsupported demo operations and aborted requests cannot fall through to a live backend", async () => {
  await login();
  await assert.rejects(apiFetch("/not-supported", { method: "POST", data: {} }), (error) => error.code === "demo_only");
  const controller = new AbortController(); controller.abort();
  await assert.rejects(apiFetch("/patients", { signal: controller.signal }));
  assert.equal(networkCalls, 0);
});
test("a changed sample submission cannot silently reuse a previous command key", async () => {
  await login();
  const data = { version: 1, reason: "Sample booking confirmation" };
  const options = { method: "POST", data, headers: { "Idempotency-Key": "sample-same-key" } };
  assert.equal((await apiFetch("/appointments/1/confirm", options)).data.status, "confirmed");
  assert.equal((await apiFetch("/appointments/1/confirm", options)).data.version, 2);
  await assert.rejects(apiFetch("/appointments/1/confirm", { ...options, data: { ...data, reason: "Changed sample" } }), (error) => error.code === "idempotency_conflict");
  assert.equal(networkCalls, 0);
});
