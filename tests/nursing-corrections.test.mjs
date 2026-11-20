import test from "node:test";
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
