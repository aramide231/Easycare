import { useCallback, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useLocation, useParams } from "react-router-dom";
import { usePatientManagement } from "../../shared/context/PatientManagementContext";
import { nursingReportDraft, nursingDisplayRow } from "../lib/recordDetails";
import {
  useMedicalTable, getPendingSectionEntry, clearPendingSectionEntries,
} from "@/pages/doctor/patientProfile/hooks/useMedicalTable";
import { usePendingCategoryDraft } from "@/pages/doctor/patientProfile/hooks/usePendingCategoryDraft";
import NursingDetailsTable from "../components/NursingDetailsTable";
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
    <div className="min-w-0 w-full bg-white text-black">
      {showHeading && <h2 className="mb-2 border-b border-[#71349a] pb-1 text-lg font-bold leading-6">Report Writing</h2>}
      <form className="px-2 pb-2 sm:px-3" onSubmit={(event) => { event.preventDefault(); if (valid) onSubmit(); }}>
        <label className="sr-only" htmlFor="nursing-report-text">Report</label>
        <textarea
          id="nursing-report-text"
          className="block h-[120px] min-h-[120px] w-full resize-y rounded-[14px] border border-[#916daa] bg-white px-3 py-3 text-xs leading-5 outline-none placeholder:text-[10px] placeholder:text-[#9a80ab] focus:ring-1 focus:ring-[#916daa]"
          placeholder="enter report(s) here"
          value={report}
          onChange={(event) => onReportChange(event.target.value)}
        />
        <div className="mt-2 grid grid-cols-2 items-end gap-x-3 gap-y-2 sm:grid-cols-[minmax(0,1fr)_9rem_minmax(0,1fr)]">
          <label className="block w-full max-w-[145px] text-[11px] leading-5">
            Shift
            <span className="relative block">
              <select aria-label="Shift" value={shift} onChange={(event) => onShiftChange(event.target.value)}
                className="h-8 w-full appearance-none rounded-[3px] border border-[#999] bg-white pl-3 pr-7 text-[11px] text-black outline-none focus:border-[#71349a]"
              >
                <option value="">Select shift</option>
                {shifts.map((value) => <option key={value}>{value}</option>)}
              </select>
              <ChevronDown aria-hidden className="pointer-events-none absolute right-3 top-2.5 h-3 w-3" strokeWidth={1.25} />
            </span>
          </label>
          <label className="col-start-2 block w-full max-w-[180px] justify-self-end text-[11px] leading-5 sm:col-start-3">
            Ward
            <input aria-label="Assigned ward and bed" readOnly value={ward}
              className="block h-8 w-full rounded-[3px] border border-[#999] bg-[#aaa] px-2 text-center text-[11px] text-white outline-none"
            />
          </label>
          <button type="submit" disabled={!valid}
            className="col-span-2 row-start-2 mx-auto h-9 w-36 rounded-[5px] bg-[#71349a] text-xl font-medium leading-9 text-white transition hover:bg-[#602982] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#71349a] disabled:cursor-not-allowed sm:col-span-1 sm:col-start-2"
          >Submit</button>
        </div>
        {(report.trim() || shift) && !valid && <p role="alert" className="mt-2 text-xs text-amber-700">Enter a report and select a shift before confirming.</p>}
      </form>
      <NursingDetailsTable title="Report Writing Details" rows={rows}
        emptyMessage="No nursing reports documented yet."
        columns={[
          { key: "sn", label: "S/N", className: "w-10 whitespace-nowrap", render: (_, index) => `${index + 1}.` },
          { key: "dateTime", label: "D | T", className: "w-28 whitespace-nowrap" },
          { key: "patientType", label: "Px Status", className: "w-24 whitespace-nowrap" },
          { key: "report", label: "Report", className: "min-w-[180px] max-w-xs whitespace-pre-wrap break-words" },
          { key: "shift", label: "Shift", className: "w-24 whitespace-nowrap" },
          { key: "ward", label: "Ward", className: "min-w-[150px] whitespace-nowrap" },
          { key: "enteredBy", label: "Nurse", className: "min-w-[120px] whitespace-nowrap" },
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
