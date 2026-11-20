import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { loadSource } from "./source-loader.mjs";

globalThis.window = { localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} } };
const originalFetch = globalThis.fetch;
const { useAuthStore: store } = loadSource("src/store/useAuthStore.ts");
const { setCsrfToken, SessionChangedError } = loadSource("src/api/client/apClient.ts");
const admissions = loadSource("src/api/admissions.ts");
const care = loadSource("src/api/care.ts");
const clinical = loadSource("src/api/clinical.ts");
const now = "2026-11-14T12:00:00.123456Z";
const page = (data) => ({ data, meta: { current_page: 1, last_page: 1, per_page: 20, total: data.length } });
const visit = { id: 9, patient_id: 4, version: 1, patient: { id: 4, version: 2, mrn: "SYNTHETIC" } };
function session(id = 1) {
  store.getState().setUser({ id, department: null, is_active: true, roles: [{ code: "nurse" }], permissions: ["patients.view", "encounters.view", "admissions.view", "care.view"] }, Date.now() + 60000);
  setCsrfToken("synthetic-csrf");
}
const admission = (changes = {}) => ({ id: 10, patient_id: 4, encounter_id: 9, version: 1, workflow_version: 1,
  encounter_version: 1, encounter_status: "open", status: "admitted", admitted_by: 1, admitted_at: now,
  authorized_by: null, authorized_at: null, discharged_by: null, discharged_at: null, discharge_reason: null,
  discharge_summary: null, current_allocation: null, current_assignment: null, ...changes });
const allocation = (changes = {}) => ({ id: 50, admission_id: 10, bed_id: 3, version: 1, assigned_by: 1,
  assigned_at: now, released_by: null, released_at: null, assignment_reason: "Transfer reviewed", release_reason: null, ...changes });
const program = (changes = {}) => ({ id: 11, patient_id: 4, encounter_id: 9, version: 1, type: "antenatal", status: "active",
  started_by: 1, started_at: now, start_reason: "Reviewed program", completed_by: null, completed_at: null, completion_reason: null, ...changes });
const entry = (changes = {}) => ({ id: 30, patient_id: 4, encounter_id: 9, kind: "entry", status: "draft", version: 1,
  authored_by: 1, finalized_by: null, finalized_at: null, amends_id: null, amendment_reason: null, void_reason: null,
  recorded_at: now, superseded: false, payload: { section: "note", content: "Saved observation" }, care_program_id: 11, birth_id: null, ...changes });
afterEach(() => { store.getState().clearAuth(); globalThis.fetch = originalFetch; });

test("admission registration confirms saved identity, author and initial state", async () => {
  session();
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "/api/v1/encounters/9/admission");
    assert.equal(options.headers.get("Idempotency-Key"), "registration-key");
    assert.deepEqual(JSON.parse(options.body), { encounter_version: 1, patient_version: 2, identity_verified: true, reason: "Verified identity" });
    return Response.json({ data: admission() });
  };
  await admissions.createAdmission(visit, "Verified identity", true, "registration-key", 1);
  for (const row of [admission({ patient_id: 5 }), admission({ encounter_id: 8 }), admission({ admitted_by: 2 }), admission({ workflow_version: 2 })]) {
    globalThis.fetch = async () => Response.json({ data: row });
    await assert.rejects(admissions.createAdmission(visit, "Verified identity", true, "registration-key", 1), (error) => error.code === "invalid_response");
  }
});
test("transfers confirm a new allocation without silently retaining the original bed", async () => {
  session();
  const original = admission({ current_allocation: allocation({ bed_id: 2 }) });
  const data = { ...admissions.admissionInput(original, "transfer", "Transfer reviewed"), bed_id: 3, bed_version: 1, ward_version: 1 };
  const saved = admission({ workflow_version: 2, current_allocation: allocation({ id: 51 }) });
  globalThis.fetch = async () => Response.json({ data: saved });
  await admissions.admissionCommand(original, "transfer", data, "transfer-key", 1);
  for (const row of [{ ...saved, workflow_version: 1 }, { ...saved, current_allocation: allocation({ id: 50 }) }, { ...saved, current_allocation: allocation({ id: 51, bed_id: 2 }) }]) {
    globalThis.fetch = async () => Response.json({ data: row });
    await assert.rejects(admissions.admissionCommand(original, "transfer", data, "transfer-key", 1), (error) => error.code === "invalid_response");
  }
});
test("completion confirms independent nursing provenance and unchanged doctor authorization", async () => {
  session();
  const original = admission({ status: "discharge_authorized", version: 2, workflow_version: 3, authorized_by: 2, authorized_at: now,
    discharge_reason: "Doctor authorization", discharge_summary: "Saved summary", current_allocation: allocation() });
  const data = admissions.admissionInput(original, "complete-discharge", "Nursing completion");
  const saved = { ...original, status: "discharged", version: 3, workflow_version: 4, discharged_by: 1, discharged_at: now, current_allocation: null };
  globalThis.fetch = async () => Response.json({ data: saved });
  await admissions.admissionCommand(original, "complete-discharge", data, "complete-key", 1);
  for (const row of [{ ...saved, authorized_by: 1 }, { ...saved, discharge_reason: "Changed authorization" }, { ...saved, current_allocation: allocation() }]) {
    globalThis.fetch = async () => Response.json({ data: row });
    await assert.rejects(admissions.admissionCommand(original, "complete-discharge", data, "complete-key", 1), (error) => error.code === "invalid_response");
  }
});
test("admission histories and filtered reads reject unrelated patient and encounter identities", async () => {
  session();
  globalThis.fetch = async () => Response.json(page([admission({ patient_id: 5 })]));
  await assert.rejects(admissions.listAdmissions({ patient_id: 4 }), (error) => error.code === "invalid_response");
  globalThis.fetch = async () => Response.json(page([{ id: 1, admission_id: 10, snapshot: admission({ encounter_id: 8 }) }]));
  await assert.rejects(admissions.admissionHistory(admission(), 1), (error) => error.code === "invalid_response");
});
test("location writes accept normalized decimal rates and preserve stable ward identity", async () => {
  session();
  const ward = { id: 6, code: "SYN", name: "Synthetic ward", type: null, daily_rate: "10.00", is_active: true, version: 1 };
  globalThis.fetch = async () => Response.json({ data: ward });
  await admissions.locationCommand("wards", null, { code: "SYN", name: "Synthetic ward", daily_rate: "10" }, "ward-key");
  globalThis.fetch = async () => Response.json({ data: { ...ward, id: 7, version: 2 } });
  await assert.rejects(admissions.locationCommand("wards", ward, { version: 1, name: "Synthetic ward" }, "ward-key"), (error) => error.code === "invalid_response");
});
test("care-program creation confirms program type and original patient", async () => {
  session();
  globalThis.fetch = async () => Response.json({ data: program() });
  await care.openCareProgram(visit, "antenatal", "Reviewed program", true, "care-key", 1);
  globalThis.fetch = async () => Response.json({ data: program({ type: "immunization" }) });
  await assert.rejects(care.openCareProgram(visit, "antenatal", "Reviewed program", true, "care-key", 1), (error) => error.code === "invalid_response");
});
test("care records and form catalogs cannot cross programs or babies", async () => {
  session();
  globalThis.fetch = async () => Response.json(page([entry({ care_program_id: 12 })]));
  await assert.rejects(care.listCareRecords(program(), 1), (error) => error.code === "invalid_response");
  globalThis.fetch = async () => Response.json(page([{ id: 1, code: "care.immunization.test", supported: true, fields: { value: { type: "text" } } }]));
  await assert.rejects(care.careForms("antenatal", 1), (error) => error.code === "invalid_response");
  const input = { encounter_version: 1, kind: "entry", payload: { section: "note", content: "Saved observation" } };
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "/api/v1/care-programs/11/encounters/9/records");
    const body = JSON.parse(options.body); assert.equal(body.program_version, 1); assert.equal(body.birth_id, 7); assert.equal("kind" in body, false);
    return Response.json({ data: entry({ birth_id: 8 }) });
  };
  await assert.rejects(clinical.clinicalCommand(9, 4, "entry", "store", null, input, "care-entry-key", 1, { id: 11, version: 1, birth_id: 7 }), (error) => error.code === "invalid_response");
});
test("late hospital reads cannot survive an account boundary", async () => {
  session(); let resolve;
  globalThis.fetch = () => new Promise((done) => { resolve = done; });
  const pending = admissions.getAdmission(10);
  session(2);
  resolve(Response.json({ data: admission() }));
  await assert.rejects(pending, SessionChangedError);
});

test("baby linking confirms the individual child, verifier and management visit", async () => {
  session();
  const delivery = program({ type: "delivery" });
  const baby = { id: 7, delivery_id: 11, encounter_id: 9, birth_order: 1, version: 1, recorded_by: 1, recorded_at: now, reason: "Recorded baby", link_exists: false, child_patient_id: null, link: null };
  const input = { encounter_id: 12, encounter_version: 1, program_version: 1, child_patient_id: 8, child_patient_version: 1, identity_verified: true, reason: "Verified child identity" };
  const saved = { ...baby, version: 2, link_exists: true, child_patient_id: 8, link: { encounter_id: 12, verified_by: 1, verified_at: now, reason: input.reason } };
  globalThis.fetch = async () => Response.json({ data: saved });
  await care.careProgramCommand(delivery, "link", input, "baby-link-key", 1, baby);
  for (const row of [{ ...saved, id: 6 }, { ...saved, child_patient_id: 9 }, { ...saved, link: { ...saved.link, verified_by: 2 } }, { ...saved, link: { ...saved.link, encounter_id: 9 } }]) {
    globalThis.fetch = async () => Response.json({ data: row });
    await assert.rejects(care.careProgramCommand(delivery, "link", input, "baby-link-key", 1, baby), (error) => error.code === "invalid_response");
  }
});
test("invalid saved record IDs issue no hospital requests", async () => {
  session(); let calls = 0; globalThis.fetch = async () => { calls++; return Response.json({}); };
  for (const id of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    await assert.rejects(admissions.getAdmission(id));
    await assert.rejects(care.getCareProgram(id));
  }
  assert.equal(calls, 0);
});
