import { useCallback, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useLocation, useParams } from "react-router-dom";
import { usePatientManagement } from "../../shared/context/PatientManagementContext";
import { nursingReportDraft, nursingDisplayRow } from "../lib/recordDetails";
import {
  useMedicalTable, getPendingSectionEntry, clearPendingSectionEntries,
} from "@/pages/doctor/patientProfile/hooks/useMedicalTable";
import { usePendingCategoryDraft } from "@/pages/doctor/patientProfile/hooks/usePendingCategoryDraft";
import CategoryMedicalTable from "@/pages/doctor/patientProfile/components/category/CategoryMedicalTable";
import {
  formFieldInputClass, formFieldSelectClass, formFieldTextareaClass,
} from "@/pages/doctor/patientProfile/lib/formFieldStyles";
import { nursingReportKey } from "../lib/nursingSections";
import type { Row } from "../lib/monthlyRecords";

const shifts = ["Emergency", "Morning", "Afternoon", "Night"];

type ScreenProps = {
  report: string;
  shift: string;
  ward: string;
  rows: Row[];
  showHeading?: boolean;
  onReportChange: (value: string) => void;
  onShiftChange: (value: string) => void;
  onSubmit: () => void;
};

export function ReportWritingScreen({
  report, shift, ward, rows, showHeading = true, onReportChange, onShiftChange, onSubmit,
}: ScreenProps) {
  const valid = Boolean(report.trim()) && shifts.includes(shift);
  return (
    <div className="min-w-0 w-full space-y-6">
      {showHeading && (
        <div className="border-b-2 border-[#573FD1]">
          <h2 className="inline-block rounded-t-md bg-[#573FD1] px-4 py-2 text-xs font-bold uppercase tracking-wide text-white">
            Report Writing
          </h2>
        </div>
      )}
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (valid) onSubmit(); }}>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="nursing-report-text">Report</label>
          <textarea
            id="nursing-report-text"
            className={`${formFieldTextareaClass} min-h-[180px]`}
            placeholder="Enter report(s) here"
            value={report}
            onChange={(event) => onReportChange(event.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="nursing-report-shift">Shift</label>
            <div className="relative">
              <select id="nursing-report-shift" aria-label="Shift" value={shift}
                onChange={(event) => onShiftChange(event.target.value)}
                className={`${formFieldSelectClass} pr-10`}
              >
                <option value="">Select shift</option>
                {shifts.map((value) => <option key={value}>{value}</option>)}
              </select>
              <ChevronDown aria-hidden className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="nursing-report-ward">Ward</label>
            <input id="nursing-report-ward" aria-label="Assigned ward and bed" readOnly value={ward}
              className={`${formFieldInputClass} bg-gray-100 text-gray-700`}
            />
          </div>
        </div>
        <div className="flex justify-center pt-2">
          <button type="submit" disabled={!valid}
            className="w-full max-w-xs rounded-lg bg-[#573FD1] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#4a35b8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#573FD1] disabled:cursor-not-allowed disabled:opacity-50"
          >Submit</button>
        </div>
        {(report.trim() || shift) && !valid && <p role="alert" className="text-sm text-amber-700">Enter a report and select a shift before confirming.</p>}
      </form>
      <CategoryMedicalTable title="Report Writing Details" rows={rows}
        emptyMessage="No nursing reports documented yet."
        wrapColumns={["report"]}
        columns={[
          { key: "sn", label: "S/N" },
          { key: "dateTime", label: "Date | Time" },
          { key: "patientType", label: "Patient Status" },
          { key: "report", label: "Report" },
          { key: "shift", label: "Shift" },
          { key: "ward", label: "Ward" },
          { key: "enteredBy", label: "Nurse" },
        ]}
      />
    </div>
  );
}

export default function ReportWriting({ category, showHeading = true, patientId }: { category: string | null; showHeading?: boolean; patientId?: string }) {
  const patient = useLocation().state?.patient;
  const { id } = useParams();
  const { admissions, wardBeds } = usePatientManagement();
  const admission = admissions.find((row) => row.patientId === (patientId ?? patient?.patientId ?? id));
  const bed = wardBeds.find((row) => row.id === admission?.assignedBedId);
  const ward = bed ? `${bed.wardName} ${bed.bedNumber}` : admission?.ward || "Not assigned";
  const key = nursingReportKey(category);
  const { history, save } = useMedicalTable(key);
  const [report, setReport] = useState(() => getPendingSectionEntry(key)?.report ?? "");
  const [shift, setShift] = useState(() => getPendingSectionEntry(key)?.shift ?? "");
  const clear = useCallback(() => { setReport(""); setShift(""); }, []);
  usePendingCategoryDraft(key, () => nursingReportDraft(report, shift, ward), [report, shift, ward], clear);
  return <ReportWritingScreen report={report} shift={shift} ward={ward} showHeading={showHeading}
    onReportChange={setReport} onShiftChange={setShift}
    rows={history.map((row) => nursingDisplayRow({ ...row, report: row.report ?? row.comment }, admission ? "In-Patient" : "Out-Patient"))}
    onSubmit={() => {
      save({ report: report.trim(), comment: report.trim(), shift, ward });
      clearPendingSectionEntries([key]);
    }}
  />;
}
