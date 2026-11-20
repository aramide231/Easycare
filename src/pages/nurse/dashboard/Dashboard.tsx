import { useState } from "react";
import { useNavigate } from "react-router-dom";
import PatientsLog from "./components/patientLog";
import Summary from "./components/summary";
import Calendar, { type DashboardDateRange } from "./components/calendar";
import { buildMockPatients, type Patient } from "./data/mockPatients";
export default function NurseDashboard() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState(buildMockPatients);
  const [selected, setSelected] = useState<Patient | null>(null);
  const [dateRange, setDateRange] = useState<DashboardDateRange>();
  return (
    <div className="space-y-5">
      <Summary
        outPatientCount={patients.length}
        onRefreshPatients={() => setPatients(buildMockPatients())}
      />
      <div className="grid min-w-0 grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0">
          <PatientsLog
            patients={patients}
            onPatientsChange={setPatients}
            onSelectPatient={setSelected}
            dateRange={dateRange}
          />
        </div>
        <div className="space-y-4">
          <Calendar value={dateRange} onChange={setDateRange} />
          <button
            type="button"
            disabled={!selected}
            className="w-full rounded-lg border border-[#573FD1] bg-purple-50 px-4 py-3 text-sm font-semibold text-[#573FD1] hover:bg-purple-100 disabled:opacity-50"
            onClick={() =>
              selected &&
              navigate(`/nurse/patient-profile/${selected.patientId}`, {
                state: { patient: selected },
              })
            }
          >
            View Patient Profile
          </button>
          {!selected && (
            <p className="text-sm text-gray-500">
              Select a patient from the log to view their profile.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
