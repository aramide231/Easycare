import { useCallback, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { usePatientManagement } from "../../shared/context/PatientManagementContext";
import { useMedicalTable } from "@/pages/doctor/patientProfile/hooks/useMedicalTable";
import { usePendingCategoryDraft } from "@/pages/doctor/patientProfile/hooks/usePendingCategoryDraft";
import CategoryMedicalTable from "@/pages/doctor/patientProfile/components/category/CategoryMedicalTable";
import { nursingReportKey } from "../lib/nursingSections";
export default function ReportWriting({
  category,
}: {
  category: string | null;
}) {
  const patient = useLocation().state?.patient;
  const { id } = useParams();
  const { admissions, wardBeds } = usePatientManagement();
  const admission = admissions.find(
    (row) => row.patientId === (patient?.patientId ?? id),
  );
  const bed = wardBeds.find((row) => row.id === admission?.assignedBedId);
  const ward = bed
    ? `${bed.wardName} ${bed.bedNumber}`
    : admission?.ward || "Not assigned";
  const key = nursingReportKey(category);
  const { history, save } = useMedicalTable(key);
  const [report, setReport] = useState("");
  const [shift, setShift] = useState("");
  const clear = useCallback(() => {
    setReport("");
    setShift("");
  }, []);
  usePendingCategoryDraft(
    key,
    (): Record<string, string> | null =>
      report.trim() && shift
        ? {
            report: report.trim(),
            comment: report.trim(),
            shift,
            ward,
            patientType: admission ? "In-Patient" : "Out-Patient",
          }
        : report.trim()
          ? { __incomplete__: "true" }
          : null,
    [report, shift, ward, admission],
    clear,
  );
  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium">
        Report
        <textarea
          className="mt-2 min-h-40 w-full rounded-lg border border-purple-300 p-3"
          placeholder="Enter report(s) here"
          value={report}
          onChange={(e) => setReport(e.target.value)}
        />
      </label>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <label className="text-sm">
          Shift
          <select
            aria-label="Shift"
            className="mt-1 block rounded-md border p-2"
            value={shift}
            onChange={(e) => setShift(e.target.value)}
          >
            <option value="">-- select shift --</option>
            {["Emergency", "Morning", "Afternoon", "Night"].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Ward
          <input
            className="mt-1 block rounded-md border bg-gray-100 p-2"
            readOnly
            value={ward}
          />
        </label>
      </div>
      <div className="flex justify-center">
        <button
          type="button"
          disabled={!report.trim() || !shift}
          className="rounded-lg bg-[#573FD1] px-10 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          onClick={() => {
            save({
              report: report.trim(),
              comment: report.trim(),
              shift,
              ward,
            });
            clear();
          }}
        >
          Submit Report
        </button>
      </div>
      {report.trim() && !shift && (
        <p role="alert" className="text-sm text-amber-700">
          Select a shift before confirming this report.
        </p>
      )}
      <CategoryMedicalTable
        title="Report Writing Details"
        columns={[
          { key: "sn", label: "S/N" },
          { key: "dateTime", label: "Date | Time" },
          { key: "patientType", label: "Patient Status" },
          { key: "report", label: "Report" },
          { key: "shift", label: "Shift" },
          { key: "ward", label: "Ward" },
          { key: "enteredBy", label: "Nurse" },
        ]}
        rows={history.map((row) => ({
          ...row,
          report: row.report ?? row.comment,
        }))}
        wrapColumns={["report"]}
      />
    </div>
  );
}
