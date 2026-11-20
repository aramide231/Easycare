import { useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, MessageSquare } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  MEDICATION_REMARK_OPTIONS,
  recordNursingMedicationRemark,
  useMedicalTable,
} from "@/pages/doctor/patientProfile/hooks/useMedicalTable";
import NursingDetailsTable from "../components/NursingDetailsTable";
import { NursingPatientStatusContext } from "../lib/NursingContext";
import { nursingDisplayRow } from "../lib/recordDetails";
import { flattenPrescriptions, medicationDescription } from "../lib/medicationDisplay";
import { moneyValue, type Row } from "../lib/monthlyRecords";

const currency = (value: unknown) => moneyValue(value).toLocaleString("en-NG", {
  style: "currency", currency: "NGN",
});

type ViewProps = {
  rows: Row[];
  nurseId?: string;
  now: number;
  error?: string;
  onRemark: (row: Row, remark: string) => void;
};

export function MedicationDetailsScreen({ rows, nurseId, now, error, onRemark }: ViewProps) {
  const [notePreview, setNotePreview] = useState<{ text: string; left: number; top: number } | null>(null);
  const showNote = (button: HTMLButtonElement, text: string) => {
    if (!text) return;
    const bounds = button.getBoundingClientRect();
    setNotePreview({
      text,
      left: Math.max(8, Math.min(bounds.left, window.innerWidth - 288)),
      top: Math.max(8, bounds.top - 8),
    });
  };
  return (
    <div className="min-w-0 space-y-3">
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <NursingDetailsTable
        title="Medication Details"
        minWidth="min-w-[1040px]"
        rows={rows}
        total={currency(rows.reduce((sum, row) => sum + moneyValue(row.lineTotal ?? row.amount), 0))}
        emptyMessage="No clinician medications documented yet."
        columns={[
          { key: "sn", label: "S/N", className: "w-10 whitespace-nowrap", render: (_, index) => `${index + 1}.` },
          { key: "dateTime", label: "D | T", className: "w-24 whitespace-nowrap" },
          { key: "patientType", label: "Px Status", className: "w-20 whitespace-nowrap" },
          { key: "medication", label: "Medication", className: "min-w-[330px] whitespace-nowrap", render: medicationDescription },
          { key: "quantity", label: "Qty", className: "w-14 whitespace-nowrap", render: (row) => `Qty ${row.quantity ?? "—"}` },
          { key: "amount", label: "Amount", className: "w-20 whitespace-nowrap", render: (row) => currency(row.lineTotal ?? row.amount) },
          { key: "note", label: "Note", className: "w-10", render: (row) => {
            const note = String(row.note ?? row.notes ?? "").trim();
            return <button
              type="button"
              aria-label={note ? `Medication note: ${note}` : "No medication note"}
              title={note || "No medication note"}
              className={`inline-flex rounded-sm p-0.5 outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#71349a] ${note ? "text-[#71349a]" : "text-black"}`}
              onMouseEnter={(event) => showNote(event.currentTarget, note)}
              onFocus={(event) => showNote(event.currentTarget, note)}
              onMouseLeave={() => setNotePreview(null)}
              onBlur={() => setNotePreview(null)}
              onClick={(event) => notePreview ? setNotePreview(null) : showNote(event.currentTarget, note)}
            ><MessageSquare className="h-[17px] w-[17px]" strokeWidth={1.25} /></button>;
          } },
          { key: "remark", label: "Remark", className: "w-28 whitespace-nowrap", render: (row) => {
            const stamp = Number(row.nursingRemarkAt);
            const locked = Boolean(row.remark) && (!stamp || now - stamp >= 86400000 || String(row.nursingRemarkBy) !== nurseId);
            return <div className="relative inline-flex w-[104px] items-center">
              <select
                aria-label={`Remark for ${row.medication}`}
                disabled={locked || !nurseId}
                title={locked ? "Remarks can only be edited by their author within 24 hours" : "Select remark"}
                value={String(row.remark ?? "")}
                className="h-6 w-full appearance-none rounded-[3px] border border-[#8baabb] bg-white py-0 pl-1.5 pr-5 text-[10px] leading-5 text-black focus:border-[#71349a] focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-50"
                onChange={(event) => onRemark(row, event.target.value)}
              >
                <option value="" disabled>Select remark</option>
                {MEDICATION_REMARK_OPTIONS.map((option) => <option key={option}>{option}</option>)}
              </select>
              <ChevronDown aria-hidden className="pointer-events-none absolute right-1 h-3 w-3 text-gray-600" />
            </div>;
          } },
          { key: "clinician", label: "Clinician", className: "min-w-24 whitespace-nowrap" },
          { key: "dispensedBy", label: "Dispensed by", className: "min-w-28 whitespace-nowrap" },
        ]}
      />
      {notePreview && createPortal(
        <div role="tooltip" className="pointer-events-none fixed z-[100] w-[272px] -translate-y-full whitespace-pre-wrap rounded-md border border-purple-200 bg-white p-3 text-xs leading-relaxed text-gray-800 shadow-lg" style={{ left: notePreview.left, top: notePreview.top }}>
          {notePreview.text}
        </div>, document.body,
      )}
    </div>
  );
}

export default function MedicationDetails() {
  const { user } = useAuth();
  const { history } = useMedicalTable("MEDICATION");
  const status = useContext(NursingPatientStatusContext);
  const rows = flattenPrescriptions(history).map((row) => nursingDisplayRow(row, status));
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  return <MedicationDetailsScreen rows={rows} nurseId={user ? String(user.id) : undefined} now={now} error={error}
    onRemark={(row, remark) => {
      if (!user) return;
      const saved = recordNursingMedicationRemark(Number(row.rowIndex), row.lineIndex === null ? null : Number(row.lineIndex), remark, user.fullName, String(user.id));
      setError(saved ? "" : "This remark can no longer be changed. Refresh the record and try again.");
    }}
  />;
}
