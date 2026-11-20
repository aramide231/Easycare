import { useEffect, useState } from "react";
import { MessageSquare } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  MEDICATION_REMARK_OPTIONS,
  recordNursingMedicationRemark,
  useMedicalTable,
} from "@/pages/doctor/patientProfile/hooks/useMedicalTable";
import {
  flattenPrescriptions,
  medicationDescription,
} from "../lib/medicationDisplay";
import { groupNursingRows, moneyValue } from "../lib/monthlyRecords";
export default function MedicationDetails() {
  const { user } = useAuth();
  const { history } = useMedicalTable("MEDICATION");
  const rows = flattenPrescriptions(history);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between gap-2">
        <h3 className="font-bold">MEDICATION DETAILS</h3>
        <p className="font-semibold text-[#573FD1]">
          Overall Total:{" "}
          {rows
            .reduce(
              (sum, row) => sum + moneyValue(row.lineTotal ?? row.amount),
              0,
            )
            .toLocaleString("en-NG", { style: "currency", currency: "NGN" })}
        </p>
      </div>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      {groupNursingRows(rows).map(([month, items]) => (
        <section key={month}>
          <h4 className="mb-2 font-semibold text-gray-600">{month}</h4>
          <div className="max-w-full overflow-x-auto">
            <table className="w-full min-w-max text-left text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  {[
                    "S/N",
                    "Date | Time",
                    "Patient Status",
                    "Medication",
                    "Qty",
                    "Amount",
                    "Note",
                    "Remark",
                    "Clinician",
                    "Dispensed By",
                  ].map((label) => (
                    <th key={label} className="px-3 py-3">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((row, index) => {
                  const note = String(row.note ?? row.notes ?? "");
                  const stamp = Number(row.nursingRemarkAt);
                  const locked =
                    !!row.remark &&
                    (!stamp ||
                      now - stamp >= 86400000 ||
                      String(row.nursingRemarkBy) !== String(user?.id));
                  return (
                    <tr key={String(row.prescriptionKey)} className="border-b">
                      <td className="px-3 py-3">{index + 1}</td>
                      <td className="px-3 py-3">
                        {String(row.dateTime ?? "—")}
                      </td>
                      <td className="px-3 py-3">
                        {String(row.patientType ?? "—")}
                      </td>
                      <td className="px-3 py-3">
                        {medicationDescription(row)}
                      </td>
                      <td className="px-3 py-3">
                        {String(row.quantity ?? "—")}
                      </td>
                      <td className="px-3 py-3">
                        {moneyValue(row.lineTotal ?? row.amount).toLocaleString(
                          "en-NG",
                          { style: "currency", currency: "NGN" },
                        )}
                      </td>
                      <td className="group relative px-3 py-3">
                        <button
                          type="button"
                          aria-label={
                            note
                              ? `Medication note: ${note}`
                              : "No medication note"
                          }
                          title={note || "No medication note"}
                          className={note ? "text-[#573FD1]" : "text-gray-800"}
                        >
                          <MessageSquare className="h-4 w-4" />
                        </button>
                        {note && (
                          <span
                            role="tooltip"
                            className="pointer-events-none absolute right-0 top-0 z-10 hidden w-64 whitespace-normal rounded-md border bg-white p-3 shadow-lg group-hover:block group-focus-within:block"
                          >
                            {note}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <select
                          aria-label={`Remark for ${row.medication}`}
                          disabled={locked || !user}
                          title={
                            locked
                              ? "Remarks can only be edited by their author within 24 hours"
                              : "Select remark"
                          }
                          value={String(row.remark ?? "")}
                          className="rounded-md border p-2 disabled:bg-gray-100"
                          onChange={(e) => {
                            if (!user) return;
                            const saved = recordNursingMedicationRemark(
                              Number(row.rowIndex),
                              row.lineIndex === null
                                ? null
                                : Number(row.lineIndex),
                              e.target.value,
                              user.fullName,
                              String(user.id),
                            );
                            setError(
                              saved
                                ? ""
                                : "This remark can no longer be changed. Refresh the record and try again.",
                            );
                          }}
                        >
                          <option value="" disabled>
                            Select remark
                          </option>
                          {MEDICATION_REMARK_OPTIONS.map((option) => (
                            <option key={option}>{option}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-3">
                        {String(row.clinician ?? "—")}
                      </td>
                      <td className="px-3 py-3">
                        {String(row.dispensedBy ?? "—")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      {!rows.length && (
        <p className="py-6 text-center text-gray-500">
          No clinician medications documented yet.
        </p>
      )}
    </div>
  );
}
