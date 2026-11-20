import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadSource } from "./source-loader.mjs";

globalThis.window = { localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} } };
const originalFetch = globalThis.fetch;
const { useAuthStore: store } = loadSource("src/store/useAuthStore.ts");
const { setCsrfToken, SessionChangedError } = loadSource("src/api/client/apClient.ts");
const { WriteAttempt } = loadSource("src/api/client/writeAttempt.ts");
const api = loadSource("src/api/clinical.ts");
const fields = loadSource("src/components/visits/clinicalFields.ts");
const now = "2026-11-14T08:03:37.123456Z";
const permissions = ["patients.view", "encounters.view", "clinical.view", "clinical.write"];
function session(id = 1, grants = permissions) {
  store.getState().setUser({ id, department: null, is_active: true, roles: [{ code: "doctor" }], permissions: grants }, Date.now() + 60000);
  setCsrfToken("synthetic-csrf");
}
function record(changes = {}) {
  return { id: 10, patient_id: 4, encounter_id: 9, kind: "diagnosis", status: "draft", version: 1, authored_by: 1, finalized_by: null, amends_id: null, amendment_reason: null, void_reason: null, recorded_at: now, finalized_at: null, payload: { description: "Synthetic diagnosis", code_system: null, code_system_version: null, code: null }, superseded: false, author_name: "Synthetic Author", finalizer_name: null, template_version: null, body_mass_index: null, ...changes };
}
const page = (data) => ({ data, meta: { current_page: 1, last_page: 1, total: data.length, per_page: 20 } });
const signed = (changes = {}) => record({ status: "signed", version: 2, finalized_by: 1, finalized_at: now, ...changes });
const medication = { medication_name: "Synthetic medication", dose: "Staff-entered dose", route: "Staff-entered route", frequency: "Staff-entered frequency", duration_value: "2.000", duration_unit: "days", quantity: null, quantity_unit: null };
afterEach(() => { store.getState().clearAuth(); globalThis.fetch = originalFetch; });

test("clinical navigation requires patient and encounter scope with independent kind permissions", () => {
  assert.equal(api.canReadClinical([], "vitals"), false);
  assert.equal(api.canReadClinical(["clinical.view"], "entry"), false);
  assert.equal(api.canReadClinical(permissions, "prescription"), false);
  assert.equal(api.canReadClinical(["patients.view", "encounters.view", "prescriptions.view"], "prescription"), true);
  assert.equal(api.canReadClinical(["patients.view", "encounters.view", "prescriptions.view"], "diagnosis"), false);
});
test("read lists and selected records reject mismatched patient, encounter, record and kind identities", async () => {
  session();
  for (const result of [record({ patient_id: 5 }), record({ encounter_id: 8 }), record({ kind: "prescription" }), record({ version: 0 })]) {
    globalThis.fetch = async () => Response.json(page([result]));
    await assert.rejects(api.listClinical(9, 4, "diagnosis"), (error) => error.code === "invalid_response");
  }
  globalThis.fetch = async () => Response.json({ data: record({ id: 11 }) });
  await assert.rejects(api.getClinical(9, 4, "diagnosis", 10), (error) => error.code === "invalid_response");
});
test("patient history excludes draft responses and rejects unrelated visit metadata", async () => {
  session();
  for (const result of [record(), signed({ patient_id: 5 }), signed({ encounter: { id: 8 } })]) {
    globalThis.fetch = async () => Response.json(page([result]));
    await assert.rejects(api.patientHistory(4), (error) => error.code === "invalid_response");
  }
  globalThis.fetch = async (url) => { assert.match(url, /patients\/4\/history\?.*include_superseded=1/); return Response.json(page([signed({ encounter: { id: 9 } })])); };
  assert.equal((await api.patientHistory(4, { include_superseded: 1 })).data.length, 1);
});
test("private revisions reject snapshots belonging to another patient or record", async () => {
  session();
  for (const snapshot of [record({ patient_id: 5 }), record({ encounter_id: 8 }), record({ id: 11 }), record({ kind: "entry" })]) {
    globalThis.fetch = async () => Response.json(page([{ id: 1, clinical_record_id: 10, version: 1, snapshot }]));
    await assert.rejects(api.clinicalHistory(record(), 1), (error) => error.code === "invalid_response");
  }
});
test("invalid numeric route IDs never issue clinical requests", async () => {
  session(); let calls = 0; globalThis.fetch = async () => { calls++; return Response.json({}); };
  for (const id of [0, -1, 1.5, "01", "P-01", Number.MAX_SAFE_INTEGER + 1]) {
    await assert.rejects(api.getClinical(id, 4, "diagnosis", 10)); await assert.rejects(api.patientHistory(id));
  }
  assert.equal(calls, 0);
});
test("saving a draft requires the confirmed author, version, kind, identity and values", async () => {
  session(); const data = { encounter_version: 1, kind: "diagnosis", payload: { description: " Synthetic diagnosis " } };
  globalThis.fetch = async (url, options) => { assert.equal(url, "/api/v1/encounters/9/clinical"); assert.equal(options.method, "POST"); assert.equal(options.headers.get("Idempotency-Key"), "synthetic-clinical-key"); assert.deepEqual(JSON.parse(options.body), data); return Response.json({ data: record() }); };
  await api.clinicalCommand(9, 4, "diagnosis", "store", null, data, "synthetic-clinical-key", 1);
  for (const result of [record({ authored_by: 2 }), record({ version: 2 }), record({ patient_id: 5 }), record({ kind: "entry" }), record({ payload: { description: "Other value" } })]) {
    globalThis.fetch = async () => Response.json({ data: result });
    await assert.rejects(api.clinicalCommand(9, 4, "diagnosis", "store", null, data, "synthetic-clinical-key", 1), (error) => error.code === "invalid_response");
  }
});
test("a partial draft edit confirms preserved values and cannot silently drop saved content", async () => {
  session(); const original = record({ payload: { description: "Synthetic diagnosis", code: "SYN", code_system: "Synthetic", code_system_version: "1" } });
  const data = { encounter_version: 1, version: 1, payload: { description: "Changed synthetic diagnosis" } };
  globalThis.fetch = async () => Response.json({ data: record({ version: 2, payload: { ...original.payload, ...data.payload } }) });
  await api.clinicalCommand(9, 4, "diagnosis", "update", original, data, "synthetic-edit-key", 1);
  globalThis.fetch = async () => Response.json({ data: record({ version: 2, payload: data.payload }) });
  await assert.rejects(api.clinicalCommand(9, 4, "diagnosis", "update", original, data, "synthetic-edit-key", 1), (error) => error.code === "invalid_response");
});
test("signing confirms unchanged saved content, original author and current finalizer", async () => {
  session(); const data = { encounter_version: 1, version: 1, current_password: "synthetic-only" };
  globalThis.fetch = async () => Response.json({ data: signed() });
  await api.clinicalCommand(9, 4, "diagnosis", "sign", record(), data, "synthetic-sign-key", 1);
  for (const result of [signed({ finalized_by: 2 }), signed({ authored_by: 2 }), signed({ payload: { description: "Unseen change" } }), signed({ finalized_at: "invalid" })]) {
    globalThis.fetch = async () => Response.json({ data: result });
    await assert.rejects(api.clinicalCommand(9, 4, "diagnosis", "sign", record(), data, "synthetic-sign-key", 1), (error) => error.code === "invalid_response");
  }
});
test("signed corrections must confirm a distinct linked replacement with the entered reason", async () => {
  session(); const data = { encounter_version: 1, version: 2, reason: "Synthetic correction", payload: { description: "Corrected" }, current_password: "synthetic-only" };
  const replacement = signed({ id: 11, amends_id: 10, amendment_reason: data.reason, payload: { ...record().payload, ...data.payload } });
  globalThis.fetch = async () => Response.json({ data: replacement });
  await api.clinicalCommand(9, 4, "diagnosis", "amend", signed(), data, "synthetic-amend-key", 1);
  for (const result of [{ ...replacement, id: 10 }, { ...replacement, amends_id: null }, { ...replacement, amendment_reason: "Other reason" }, { ...replacement, superseded: true }]) {
    globalThis.fetch = async () => Response.json({ data: result });
    await assert.rejects(api.clinicalCommand(9, 4, "diagnosis", "amend", signed(), data, "synthetic-amend-key", 1), (error) => error.code === "invalid_response");
  }
});
for (const [action, status] of [["stop", "stopped"], ["complete", "completed"]]) test(`${action} confirms a signed prescription replacement with unchanged medication lines`, async () => {
  session(); const original = signed({ kind: "prescription", payload: { instructions: "Synthetic", items: [medication], order_status: "active" } });
  const data = { encounter_version: 1, version: 2, reason: "Synthetic status change", current_password: "synthetic-only" };
  const replacement = signed({ id: 11, kind: "prescription", amends_id: 10, amendment_reason: data.reason, payload: { ...original.payload, order_status: status } });
  globalThis.fetch = async (url) => { assert.equal(url, `/api/v1/encounters/9/prescriptions/10/${action}`); return Response.json({ data: replacement }); };
  await api.clinicalCommand(9, 4, "prescription", action, original, data, "synthetic-status-key", 1);
  for (const payload of [{ ...replacement.payload, order_status: "active" }, { ...replacement.payload, items: [] }]) {
    globalThis.fetch = async () => Response.json({ data: { ...replacement, payload } });
    await assert.rejects(api.clinicalCommand(9, 4, "prescription", action, original, data, "synthetic-status-key", 1), (error) => error.code === "invalid_response");
  }
});
test("signed retractions require a reasoned replacement while draft voids retain their identity", async () => {
  session(); const data = { encounter_version: 1, version: 2, reason: "Synthetic retraction", current_password: "synthetic-only" };
  globalThis.fetch = async () => Response.json({ data: signed({ id: 11, amends_id: 10, status: "voided", amendment_reason: data.reason, void_reason: data.reason, payload: [] }) });
  await api.clinicalCommand(9, 4, "diagnosis", "void", signed(), data, "synthetic-void-key", 1);
  globalThis.fetch = async () => Response.json({ data: signed({ status: "voided", void_reason: data.reason }) });
  await api.clinicalCommand(9, 4, "diagnosis", "void", record(), { ...data, version: 1 }, "synthetic-void-key", 1);
});
test("form payloads exclude server identity, status, performer and order state", () => {
  const original = { ...record().payload, id: 99, authored_by: 5, status: "signed", performed_by: 8 };
  assert.deepEqual(fields.initialClinicalPayload("diagnosis", original), record().payload);
  assert.deepEqual(fields.clinicalPayload("prescription", { instructions: " A ", order_status: "completed", items: [{ id: 999, line_number: 8, ...medication }] }).items[0].medication_name, medication.medication_name);
  assert.equal("id" in fields.clinicalPayload("prescription", { items: [{ id: 999, ...medication }] }).items[0], false);
  assert.equal("order_status" in fields.clinicalPayload("prescription", { items: [] }), false);
});
test("unchanged clinical dates preserve microseconds and changed dates use Nigeria time", () => {
  assert.equal(fields.clinicalDateInput("2026-11-14T09:03", now), now);
  assert.equal(fields.clinicalDateInput("2026-11-14T10:04", now), "2026-11-14T10:04:00+01:00");
  assert.deepEqual(fields.clinicalPayload("vitals", { observed_at: "2026-11-14T09:03", weight_kg: "60" }, { observed_at: now, weight_kg: "60.000" }), {});
});
test("draft diffs preserve explicit nulls, boolean false and ordered medication changes", () => {
  assert.deepEqual(fields.clinicalPayload("entry", { fields: { confirmed: false }, content: "" }, { fields: { confirmed: true }, content: "Original" }), { fields: { confirmed: false }, content: null });
  assert.equal(api.sameClinicalValue({ fields: {} }, { fields: { unexpected: "value" } }), false);
  assert.equal(api.sameClinicalValue(false, "false"), false);
  assert.equal(api.sameClinicalValue({ items: [medication, { ...medication, medication_name: "Other" }] }, { items: [{ ...medication, medication_name: "Other" }, medication] }), false);
});
test("uncertain clinical saves retain the same explicit key without an automatic duplicate request", async () => {
  session(); const attempt = new WriteAttempt(); const key = attempt.key(); let calls = 0;
  globalThis.fetch = async (_url, options) => { calls++; assert.equal(options.headers.get("Idempotency-Key"), key); throw new TypeError("Synthetic lost response"); };
  const data = { encounter_version: 1, kind: "diagnosis", payload: { description: "Synthetic diagnosis" } };
  await assert.rejects(api.clinicalCommand(9, 4, "diagnosis", "store", null, data, attempt.key(), 1));
  assert.equal(calls, 1); assert.equal(attempt.key(), key);
  globalThis.fetch = async () => Response.json({ data: record() });
  await api.clinicalCommand(9, 4, "diagnosis", "store", null, data, attempt.key(), 1);
});
test("late clinical results and command receipts cannot cross staff or permission changes", async () => {
  session(); let finish; globalThis.fetch = () => new Promise((resolve) => { finish = resolve; });
  const pending = api.getClinical(9, 4, "diagnosis", 10); session(2); finish(Response.json({ data: record() }));
  await assert.rejects(pending, SessionChangedError);
  const attempt = new WriteAttempt(); const key = attempt.key(); session(2, ["patients.view"]); assert.notEqual(attempt.key(), key);
});
test("clinical time controls reject a mismatched hospital timezone", async () => {
  session(); globalThis.fetch = async () => Response.json({ data: { timezone: "UTC", sections: [], physical_examination_fields: [] } });
  await assert.rejects(api.clinicalOptions("entry"), (error) => error.code === "invalid_response");
  await assert.rejects(api.clinicalOptions("prescription"), (error) => error.code === "invalid_response");
});
test("unsupported template formats fail closed before exposing an editable field set", async () => {
  session();
  for (const fields of [null, [], { summary: null }, { summary: { type: "arbitrary" } }, { choice: { type: "select", options: [] } }]) {
    assert.equal(api.supportedTemplateFields(fields), false);
    globalThis.fetch = async () => Response.json(page([{ id: 1, title: "Synthetic unsupported template", supported: true, fields }]));
    await assert.rejects(api.clinicalTemplates(1), (error) => error.code === "invalid_response");
  }
  assert.equal(api.supportedTemplateFields({ summary: { type: "text" }, confirmed: { type: "boolean" } }), true);
});
test("read views label procedure codes and overall medication instructions in their own context", () => {
  const { ClinicalSummary } = loadSource("src/components/visits/ClinicalValues.tsx");
  const procedure = renderToStaticMarkup(createElement(ClinicalSummary, { record: record({ kind: "procedure", payload: { name: "Synthetic procedure", code: "SYN-P" } }) }));
  assert.match(procedure, /Procedure code/); assert.doesNotMatch(procedure, /Diagnosis code/);
  const prescription = renderToStaticMarkup(createElement(ClinicalSummary, { record: record({ kind: "prescription", payload: { instructions: "Synthetic overall instructions", items: [{ ...medication, instructions: "Synthetic line instructions" }] } }) }));
  assert.match(prescription, /Overall prescription instructions/); assert.match(prescription, /Medication instructions/);
});
