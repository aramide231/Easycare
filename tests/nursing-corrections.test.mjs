import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import assert from "node:assert/strict";
import { loadSource } from "./source-loader.mjs";
const { dayOfLife } = loadSource(
  "src/pages/nurse/patient-profile/lib/feedingChart.ts",
);
const { groupNursingRows, moneyValue } = loadSource(
  "src/pages/nurse/patient-profile/lib/monthlyRecords.ts",
);
const { getNursingSections, nursingReportKey } = loadSource(
  "src/pages/nurse/patient-profile/lib/nursingSections.ts",
);
const { getSubCategories } = loadSource(
  "src/pages/doctor/patientProfile/config/subCategoryMap.ts",
);
const { medicationDescription, flattenPrescriptions } = loadSource(
  "src/pages/nurse/patient-profile/lib/medicationDisplay.ts",
);
const records = loadSource(
  "src/pages/doctor/patientProfile/hooks/useMedicalTable.ts",
);
test("nursing feeding age handles boundaries, invalid/future births and completed calendar months", () => {
  const born = "2026-01-01T00:00:00";
  for (const [date, expected] of [
    ["2026-01-01T00:05:00", "5 minutes"],
    ["2026-01-01T01:00:00", "1 hour"],
    ["2026-01-02T00:00:00", "1 day"],
    ["2026-01-08T00:00:00", "1 week"],
    ["2026-02-01T00:00:00", "1 month"],
  ])
    assert.equal(dayOfLife(born, new Date(date)), expected);
  assert.equal(dayOfLife("invalid"), "");
  assert.equal(dayOfLife("2027-01-01", new Date("2026-01-01")), "");
});
test("nursing category additions preserve clinician sections and isolate reports", () => {
  assert.equal(getNursingSections("Neo Natal Care")[1].label, "FEEDING CHART");
  assert.ok(
    !getSubCategories("Neo Natal Care").some(
      (row) => row.label === "FEEDING CHART",
    ),
  );
  for (const category of ["Ante Natal Care", "Child Birth", "Surgical"]) {
    assert.equal(getNursingSections(category).at(-1).label, "REPORT WRITING");
    assert.notEqual(
      nursingReportKey(category),
      nursingReportKey("Gen Consult"),
    );
    assert.ok(
      !getSubCategories(category).some((row) => row.label === "REPORT WRITING"),
    );
  }
});
test("monthly groups order years and months and parse formatted amounts", () => {
  const rows = [
    { dateTime: "15-Feb-2025 10:25 AM" },
    { dateTime: "15-Feb-2026 10:25 AM" },
    { createdAtMs: new Date("2026-03-01").getTime() },
    { dateTime: "unknown" },
  ];
  assert.deepEqual(
    groupNursingRows(rows).map(([month]) => month),
    ["March 2026", "February 2026", "February 2025", "Earlier records"],
  );
  assert.equal(moneyValue("₦ 1,250.50"), 1250.5);
  assert.equal(moneyValue("N 2,000.00"), 2000);
});
test("prescription batches expose every line and retain full instructions", () => {
  const rows = flattenPrescriptions([
    {
      doctor: "Dr Example",
      medications: [
        {
          medication: "Drug A",
          strength: "250mg",
          adminRoute: "Oral",
          dosage: "2",
          interval: "ONCE",
          period: "3/7",
        },
        { medication: "Drug B" },
      ],
    },
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[1].lineIndex, 1);
  assert.equal(
    medicationDescription(rows[0]),
    "Drug A 250mg × Oral × 2 × ONCE × 3/7",
  );
});
test("nursing medication remarks affect only the selected line, retain history, lock after 24h and isolate patients", () => {
  records.openPatientRecord("NURSING-TEST-A");
  records.setPendingSectionEntry("MEDICATION", {
    __payload__: JSON.stringify({
      medications: [
        { medication: "Drug A", quantity: 2, lineTotal: 10 },
        { medication: "Drug B", quantity: 1, lineTotal: 20 },
      ],
    }),
  });
  records.commitPendingCategoryEntries("Doctor", "Doctor", ["MEDICATION"]);
  const index = records.getSectionTableRows("MEDICATION").length - 1;
  const before = records.getSectionTableRows("NURSING DISPENSES").length;
  const now = Date.now();
  assert.equal(
    records.recordNursingMedicationRemark(
      index,
      null,
      "Given",
      "Nurse One",
      "1",
      now,
    ),
    true,
  );
  assert.equal(records.getSectionTableRows("MEDICATION")[index - 1].remark, "");
  assert.equal(
    records.getSectionTableRows("NURSING DISPENSES").length,
    before + 1,
  );
  assert.equal(
    records.recordNursingMedicationRemark(
      index,
      null,
      "Completed",
      "Nurse Two",
      "2",
      now + 1000,
    ),
    false,
  );
  assert.equal(
    records.recordNursingMedicationRemark(
      index,
      null,
      "Completed",
      "Nurse One",
      "1",
      now + 2000,
    ),
    true,
  );
  assert.equal(
    records.getSectionTableRows("NURSING DISPENSES").length,
    before + 1,
  );
  assert.equal(
    records.recordNursingMedicationRemark(
      index,
      null,
      "Missed",
      "Nurse One",
      "1",
      now + 86400000,
    ),
    false,
  );
  records.openPatientRecord("NURSING-TEST-B");
  assert.equal(records.getSectionTableRows("NURSING DISPENSES").length, before);
  records.openPatientRecord("NURSING-TEST-A");
  assert.equal(
    records.getSectionTableRows("NURSING DISPENSES").at(-1).remark,
    "Completed",
  );
});
test("nursing procedure notes require explicit approval and enforce author and original 24h deadline", () => {
  records.openPatientRecord("NURSING-PROCEDURES");
  assert.equal(
    records.recordNursingProcedureFindings(
      "PROCEDURE",
      0,
      "Notes",
      "Nurse",
      "1",
    ),
    false,
  );
  records.setPendingSectionEntry("PROCEDURE", {
    __payload__: JSON.stringify({
      procedure: "SUTURING",
      approvalStatus: "approved",
    }),
  });
  records.commitPendingCategoryEntries("Doctor", "Doctor", ["PROCEDURE"]);
  const index = records.getSectionTableRows("PROCEDURE").length - 1,
    now = Date.now();
  assert.equal(
    records.recordNursingProcedureFindings(
      "PROCEDURE",
      index,
      "Notes",
      "Nurse",
      "1",
      now,
    ),
    true,
  );
  assert.equal(
    records.recordNursingProcedureFindings(
      "PROCEDURE",
      index,
      "Other",
      "Other",
      "2",
      now + 1000,
    ),
    false,
  );
  assert.equal(
    records.recordNursingProcedureFindings(
      "PROCEDURE",
      index,
      "Edited",
      "Nurse",
      "1",
      now + 86399999,
    ),
    true,
  );
  assert.equal(
    records.recordNursingProcedureFindings(
      "PROCEDURE",
      index,
      "Late",
      "Nurse",
      "1",
      now + 86400000,
    ),
    false,
  );
});

test("nursing report confirmation stays category-scoped and incomplete drafts cannot become records", () => {
  records.openPatientRecord("NURSING-REPORT-CATEGORIES");
  const anc=nursingReportKey("Ante Natal Care"), general=nursingReportKey("Gen Consult");
  records.setPendingSectionEntry(anc,{report:"ANC shift review",shift:"Night",ward:"Female Ward Bed 1"});
  records.setPendingSectionEntry(general,{__incomplete__:"true"});
  assert.deepEqual(records.getIncompleteDraftSections([general]),[general]);
  records.commitPendingCategoryEntries("Nurse One","Nurse",[anc,general]);
  assert.equal(records.getSectionTableRows(anc).length,1);
  assert.equal(records.getSectionTableRows(general).length,0);
  assert.equal(records.getSectionTableRows(anc)[0].ward,"Female Ward Bed 1");
});
test("nursing status preserves booking information and leaves clinician form values untouched", () => {
  const {withNursingStatus}=loadSource("src/pages/nurse/patient-profile/lib/NursingContext.ts");
  const source={patientType:"Booked",report:"Review"};
  assert.equal(withNursingStatus(source,null),source);
  assert.deepEqual(withNursingStatus(source,"In-Patient"),{patientType:"In-Patient",bookingStatus:"Booked",report:"Review"});
  assert.equal(withNursingStatus({patientType:"Out-Patient"},"Out-Patient").bookingStatus,undefined);
});


test("nursing details distinguish care status from billing category and preserve historical status", () => {
  const { nursingDisplayRow } = loadSource("src/pages/nurse/patient-profile/lib/recordDetails.ts");
  const source = { patientType: "HMO", report: "Review" };
  assert.deepEqual(nursingDisplayRow(source, "In-Patient"), {
    patientType: "In-Patient", patientCategory: "HMO", report: "Review",
  });
  assert.equal(source.patientType, "HMO");
  assert.equal(nursingDisplayRow({ patientType: "OPD" }, "In-Patient").patientType, "Out-Patient");
  assert.equal(nursingDisplayRow({ patientType: "Booked" }, "Out-Patient").bookingStatus, "Booked");
  const { withNursingStatus } = loadSource("src/pages/nurse/patient-profile/lib/NursingContext.ts");
  assert.deepEqual(withNursingStatus({ patientType: "PRIVATE" }, "Out-Patient"), {
    patientType: "Out-Patient", patientCategory: "PRIVATE",
  });
});

test("incomplete report drafts retain their text and shift without crossing treatment categories", () => {
  const { nursingReportDraft } = loadSource("src/pages/nurse/patient-profile/lib/recordDetails.ts");
  records.openPatientRecord("NURSING-REPORT-DRAFT-ISOLATION");
  const anc = nursingReportKey("Ante Natal Care"), surgical = nursingReportKey("Surgical");
  const partial = nursingReportDraft("ANC handover", "", "Female Ward Bed 1");
  records.setPendingSectionEntry(anc, partial);
  records.setPendingSectionEntry(surgical, nursingReportDraft("Surgical handover", "Night", "Surgical Ward Bed 2"));
  const copy = records.getPendingSectionEntry(anc);
  assert.equal(copy.report, "ANC handover");
  copy.report = "Changed outside the store";
  assert.equal(records.getPendingSectionEntry(anc).report, "ANC handover");
  records.commitPendingCategoryEntries("Nurse One", "Nurse One", [anc, surgical]);
  assert.equal(records.getSectionTableRows(anc).length, 0);
  assert.equal(records.getSectionTableRows(surgical).at(-1).ward, "Surgical Ward Bed 2");
  assert.equal(records.getPendingSectionEntry(anc).report, "ANC handover");
  assert.equal(nursingReportDraft("", "", "Not assigned"), null);
  assert.equal(nursingReportDraft("", "Morning", "Bed 1").__incomplete__, "true");
  assert.equal(nursingReportDraft("Report", "Unexpected", "Bed 1").__incomplete__, "true");
  records.clearPendingSectionEntries([anc]);
  assert.equal(records.getPendingSectionEntry(anc), null);
});

test("nursing volume parsing preserves zero and decimals and rejects negative or malformed output", () => {
  const { parseNursingVolume, isNursingVolumeValid } = loadSource("src/pages/nurse/patient-profile/lib/recordDetails.ts");
  for (const [input, expected] of [["0", 0], ["12.5 mL", 12.5], ["1,000", 1000], [".5", .5]]) {
    assert.equal(isNursingVolumeValid(input), true);
    assert.equal(parseNursingVolume(input), expected);
  }
  for (const input of ["-5", "5garbage", "Infinity", "3.2.1"]) assert.equal(isNursingVolumeValid(input), false);
  assert.equal(parseNursingVolume("700") - parseNursingVolume("900"), -200);
  assert.equal(parseNursingVolume("700") - parseNursingVolume("700"), 0);
});

test("nursing month groups use the hospital timezone at UTC month boundaries", () => {
  const rows = [{ createdAtMs: Date.parse("2026-11-30T23:30:00Z") }];
  assert.equal(groupNursingRows(rows)[0][0], "December 2026");
});

test("nursing medication descriptions include form once and retain per-line notes", () => {
  assert.equal(medicationDescription({ medication: "PCM", drugForm: "Tablet", strength: "250mg", adminRoute: "Oral", dosage: "2", interval: "ONCE (Single dose)", period: "3/7" }),
    "PCM Tablet 250mg × Oral × 2 × ONCE (Single dose) × 3/7");
  assert.equal(medicationDescription({ medication: "PCM Tablet 250mg", drugForm: "Tablet", strength: "250mg" }), "PCM Tablet 250mg");
  const rows = flattenPrescriptions([{ doctor: "Dr Example", medications: [{ medication: "A", note: "After meal" }, { medication: "B", note: "Before bed" }] }]);
  assert.equal(rows[0].note, "After meal");
  assert.equal(rows[1].note, "Before bed");
});

test("missed and declined nursing remarks remain unserved and preserve the original edit deadline", () => {
  records.openPatientRecord("NURSING-NOT-GIVEN");
  records.setPendingSectionEntry("MEDICATION", { __payload__: JSON.stringify({ medications: [{ medication: "Drug", quantity: 1 }] }) });
  records.commitPendingCategoryEntries("Doctor", "Doctor", ["MEDICATION"]);
  const index = records.getSectionTableRows("MEDICATION").length - 1;
  const now = Date.now();
  assert.equal(records.recordNursingMedicationRemark(index, null, "Declined", "Nurse One", "1", now), true);
  assert.equal(records.getSectionTableRows("NURSING DISPENSES").at(-1).served, false);
  assert.equal(records.recordNursingMedicationRemark(index, null, "Given", "Nurse One", "1", now + 1000), true);
  assert.equal(records.getSectionTableRows("NURSING DISPENSES").at(-1).served, true);
  assert.equal(records.getSectionTableRows("MEDICATION")[index].nursingRemarkAt, now);
  assert.equal(records.recordNursingMedicationRemark(index, null, "Missed", "Nurse One", "1", now + 86400000), false);
});


test("nursing details render care status, billing type and totals without altering clinician tables", () => {
  const Table = loadSource("src/pages/doctor/patientProfile/components/category/CategoryMedicalTable.tsx").default;
  const { NursingContext, NursingPatientStatusContext } = loadSource("src/pages/nurse/patient-profile/lib/NursingContext.ts");
  const props = {
    title: "Nursing report details",
    columns: [{ key: "dateTime", label: "Date" }, { key: "patientType", label: "Patient Type" }, { key: "report", label: "Report" }],
    rows: [{ dateTime: "20-Nov-2026 10:00 AM", patientType: "HMO", report: "Shift handover" }],
  };
  const nursing = renderToStaticMarkup(createElement(NursingContext.Provider, { value: true },
    createElement(NursingPatientStatusContext.Provider, { value: "In-Patient" }, createElement(Table, props))));
  assert.match(nursing, /PATIENT STATUS/);
  assert.match(nursing, /In-Patient/);
  assert.match(nursing, /PATIENT TYPE/);
  assert.match(nursing, /HMO/);
  assert.doesNotMatch(nursing, /Overall Total/);
  const clinician = renderToStaticMarkup(createElement(Table, props));
  assert.match(clinician, /Patient Type/);
  assert.doesNotMatch(clinician, /PATIENT STATUS|In-Patient/);
  const financial = renderToStaticMarkup(createElement(NursingContext.Provider, { value: true },
    createElement(Table, { ...props, columns: [...props.columns, { key: "amount", label: "Amount" }], rows: [{ ...props.rows[0], amount: "1,250.50" }] })));
  assert.match(financial, /Overall Total/);
  assert.match(financial, /1,250.50/);
});


test("nursing output chart renders one urine input and the input-minus-output balance", () => {
  const OutputChart = loadSource("src/pages/nurse/patient-profile/nurse-categories/OutputChart.tsx").default;
  const html = renderToStaticMarkup(createElement(OutputChart));
  assert.equal((html.match(/>Urine<\/label>/g) ?? []).length, 1);
  assert.match(html, /Fluid Balance \(Input - Output\)/);
});
