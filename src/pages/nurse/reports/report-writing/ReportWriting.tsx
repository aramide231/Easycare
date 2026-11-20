import { useLayoutEffect, useMemo, useState } from "react";
import { buildMockPatients } from "../../dashboard/data/mockPatients";
import { usePatientManagement } from "../../shared/context/PatientManagementContext";
import NursingReportWriting, { ReportWritingScreen } from "../../patient-profile/nurse-categories/ReportWriting";
import { NursingPatientStatusContext } from "../../patient-profile/lib/NursingContext";
import { openPatientRecord } from "@/pages/doctor/patientProfile/hooks/useMedicalTable";

const categories = ["Gen Consult", "Ante Natal Care", "Child Birth", "Surgical"];
const noop = () => {};

export default function ReportWritingPage() {
  const { admissions } = usePatientManagement();
  const [patientId, setPatientId] = useState("");
  const [category, setCategory] = useState("Gen Consult");
  const [readyPatient, setReadyPatient] = useState("");
  const patients = useMemo(() => {
    const entries = new Map(buildMockPatients().map((patient) => [patient.patientId, {
      id: patient.patientId,
      name: `${patient.firstName} ${patient.lastName}`.trim(),
    }]));
    admissions.forEach((admission) => entries.set(admission.patientId, { id: admission.patientId, name: admission.name }));
    return [...entries.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [admissions]);

  useLayoutEffect(() => {
    if (patientId) openPatientRecord(patientId);
    setReadyPatient(patientId);
  }, [patientId]);

  return (
    <div className="mx-auto w-full max-w-5xl rounded-lg border border-gray-200 bg-white p-4 sm:p-6">
      <div className="mb-5 grid gap-4 sm:grid-cols-2">
        <label className="text-xs font-medium text-gray-700">
          Patient
          <select aria-label="Patient for nursing report" value={patientId}
            className="mt-1 block h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm focus:border-[#71349a] focus:outline-none"
            onChange={(event) => {
              const nextId = event.target.value;
              setPatientId(nextId);
              const treatment = admissions.find((admission) => admission.patientId === nextId)?.treatmentCategory;
              setCategory(treatment && categories.includes(treatment) ? treatment : "Gen Consult");
            }}
          >
            <option value="">Select a patient</option>
            {patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.name} — {patient.id}</option>)}
          </select>
        </label>
        <label className="text-xs font-medium text-gray-700">
          Treatment Category
          <select aria-label="Report treatment category" value={category}
            className="mt-1 block h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm focus:border-[#71349a] focus:outline-none"
            onChange={(event) => setCategory(event.target.value)}
          >{categories.map((value) => <option key={value}>{value}</option>)}</select>
        </label>
      </div>
      {patientId && readyPatient === patientId ? (
        <NursingPatientStatusContext.Provider value={admissions.some((admission) => admission.patientId === patientId) ? "In-Patient" : "Out-Patient"}>
          <NursingReportWriting key={`${patientId}:${category}`} patientId={patientId} category={category} />
        </NursingPatientStatusContext.Provider>
      ) : (
        <>
          <p className="mb-3 text-xs text-gray-500">Select a patient to write a report.</p>
          <fieldset disabled className="min-w-0 border-0 p-0">
            <ReportWritingScreen report="" shift="" ward="Not assigned" rows={[]} onReportChange={noop} onShiftChange={noop} onSubmit={noop} />
          </fieldset>
        </>
      )}
    </div>
  );
}
