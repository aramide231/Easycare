import { NursingPatientStatusContext } from "../lib/NursingContext";
import { nursingDisplayRow } from "../lib/recordDetails";
import { useContext, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  useMedicalTable,
  isNursingProcedureApproved,
  recordNursingProcedureFindings,
} from "@/pages/doctor/patientProfile/hooks/useMedicalTable";
import { categoryStorageKey } from "@/pages/doctor/patientProfile/lib/categoryStorage";
import { groupNursingRows, moneyValue } from "../lib/monthlyRecords";
export default function ProcedureDetails({
  category,
}: {
  category: string | null;
}) {
  const { user } = useAuth();
  const status = useContext(NursingPatientStatusContext);
  const key = categoryStorageKey(category, "PROCEDURE");
  const { history } = useMedicalTable(key);
  const [selected, setSelected] = useState<number | null>(null);
  const [view, setView] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const row = selected === null ? null : history[selected];
  const locked =
    !!row?.findings &&
    (!Number(row.nursingFindingsAt) ||
      Date.now() - Number(row.nursingFindingsAt) >= 86400000 ||
      String(row.nursingFindingsBy) !== String(user?.id));
  const close = () => {
    setSelected(null);
    setText("");
    setError("");
  };
  const open = (index: number, readOnly: boolean) => {
    setSelected(index);
    setView(readOnly);
    setText(String(history[index].findings ?? ""));
    setError("");
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between gap-2">
        <h3 className="font-bold">PROCEDURE DETAILS</h3>
        {history.length > 0 && (
          <p className="font-semibold text-[#573FD1]">
            Overall Total:{" "}
            {history
              .reduce(
                (sum, row) => sum + moneyValue(row.price ?? row.amount),
                0,
              )
              .toLocaleString("en-NG", { style: "currency", currency: "NGN" })}
          </p>
        )}
      </div>
      <p className="text-sm text-gray-500">
        Approved procedures appear in orange. Select a procedure to document
        findings.
      </p>
      {groupNursingRows(
        history.map((item, index) => ({ ...nursingDisplayRow(item, status), rowIndex: index })),
      ).map(([month, items]) => (
        <section key={month}>
          <h4 className="mb-2 font-semibold">{month}</h4>
          <div className="max-w-full overflow-x-auto">
            <table className="w-full min-w-max text-left text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {[
                    "S/N",
                    "Date | Time",
                    "Patient Status",
                    "Procedure",
                    "Amount",
                    "Result",
                    "Clinician",
                  ].map((label) => (
                    <th className="px-3 py-3" key={label}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={Number(item.rowIndex)} className="border-b">
                    <td className="px-3 py-3">{index + 1}</td>
                    <td className="px-3 py-3">
                      {String(item.dateTime ?? "—")}
                    </td>
                    <td className="px-3 py-3">
                      {String(item.patientType ?? "—")}
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        disabled={!isNursingProcedureApproved(item)}
                        title={
                          isNursingProcedureApproved(item)
                            ? "Document procedure findings"
                            : "Awaiting Cashier/HMO approval"
                        }
                        className="font-semibold text-orange-600 disabled:text-gray-500"
                        onClick={() => open(Number(item.rowIndex), false)}
                      >
                        {String(item.procedure ?? "—")}
                      </button>
                    </td>
                    <td className="px-3 py-3">
                      {String(item.price ?? item.amount ?? "—")}
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        disabled={!item.findings}
                        className="rounded-md border px-3 py-1 text-[#573FD1] disabled:text-gray-400"
                        onClick={() => open(Number(item.rowIndex), true)}
                      >
                        View
                      </button>
                    </td>
                    <td className="px-3 py-3">{String(item.doctor ?? "—")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      {!history.length && (
        <p className="py-6 text-center text-gray-500">
          No procedures documented yet.
        </p>
      )}
      {row && (
        <div className="fixed inset-0 z-50 flex">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close procedure note"
            onClick={close}
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="nursing-procedure-title"
            className="relative flex h-full min-h-0 w-full max-w-lg flex-col overflow-y-auto bg-white p-4 shadow-xl sm:p-6"
          >
            <div className="flex justify-between gap-4">
              <h3 id="nursing-procedure-title" className="font-bold">
                {String(row.procedure)}
              </h3>
              <button
                type="button"
                className="rounded border px-3 py-1"
                onClick={close}
              >
                Close
              </button>
            </div>
            {view || locked ? (
              <div className="mt-6 flex-1 overflow-auto whitespace-pre-wrap">
                {String(row.findings ?? "No findings documented.")}
              </div>
            ) : (
              <label className="mt-6 flex flex-1 flex-col gap-2">
                Procedure findings
                <textarea
                  className="min-h-48 flex-1 rounded-lg border p-3"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Enter procedure findings"
                />
              </label>
            )}
            {locked && !view && (
              <p className="mt-3 text-sm text-amber-700">
                Only the author may edit a note within 24 hours of first
                documenting it.
              </p>
            )}
            {error && (
              <p role="alert" className="mt-3 text-sm text-red-700">
                {error}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                className="rounded-lg border px-4 py-2"
                onClick={close}
              >
                Close
              </button>
              {!view && !locked && (
                <>
                  <button
                    type="button"
                    className="rounded-lg border px-4 py-2"
                    onClick={() => setText(String(row.findings ?? ""))}
                  >
                    Restore note
                  </button>
                  <button
                    type="button"
                    className="rounded-lg bg-[#573FD1] px-4 py-2 text-white disabled:opacity-50"
                    disabled={!text.trim() || !user}
                    onClick={() => {
                      if (
                        user &&
                        selected !== null &&
                        recordNursingProcedureFindings(
                          key,
                          selected,
                          text,
                          user.fullName,
                          String(user.id),
                        )
                      )
                        close();
                      else
                        setError(
                          "The note could not be saved. Approval or the editing period may have changed.",
                        );
                    }}
                  >
                    Confirm
                  </button>
                </>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
