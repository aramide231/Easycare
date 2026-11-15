import { Fragment, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useAuthStore } from "@/store/useAuthStore";
import { listVisits, hospitalTime, type Visit } from "@/api/visits";
import { LoadState, Pager, control, secondary, useLoad } from "./visitWorkspace";

export function HospitalGate({ permission, children }: { permission: string; children: ReactNode }) {
  const { user } = useAuth();
  const revision = useAuthStore((state) => state.revision);
  const allowed = user?.permissions?.includes(permission) && (permission === "locations.view"
    || ["patients.view", "encounters.view"].every((code) => user.permissions?.includes(code)));
  return allowed ? <Fragment key={revision}>{children}</Fragment> : <p role="alert" className="rounded-xl border bg-white p-5">Your account does not have permission to view this feature.</p>;
}
export function HospitalNav() {
  const { user } = useAuth();
  return <nav aria-label="Nursing and ward records" className="flex flex-wrap gap-4 text-sm text-violet-700">
    {user?.permissions?.includes("admissions.view") && <Link className="underline" to="/admissions">Admissions and discharge</Link>}
    {user?.permissions?.includes("locations.view") && <Link className="underline" to="/wards">Wards and beds</Link>}
    {user?.permissions?.includes("care.view") && <Link className="underline" to="/care-programs">Care programs</Link>}
    {user?.permissions?.includes("encounters.view") && <Link className="underline" to="/visits">Saved visits</Link>}
  </nav>;
}
export function VisitChooser({ value, onSelect, patient }: { value: Visit | null; onSelect: (visit: Visit | null) => void; patient?: number }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const visits = useLoad("program-visit-picker-" + patient + ":" + page + ":" + filter,
    (signal) => listVisits({ page, ...(patient ? { patient_id: patient } : {}), ...(filter ? { patient_id: Number(filter) } : {}) }, false, signal), !value);
  return <section className="space-y-3 rounded-xl border bg-white p-4" aria-label="Choose saved visit">{value
    ? <><p className="font-semibold">{value.patient.first_name} {value.patient.last_name} · {value.patient.mrn}</p><p className="text-sm">Visit #{value.id} · {value.status} · Version {value.version}</p><button type="button" className={secondary} onClick={() => onSelect(null)}>Choose another visit</button></>
    : <><h2 className="font-semibold">Choose a saved visit</h2>{!patient && <div className="flex flex-wrap gap-2"><label className="text-sm">Patient ID filter<input className={control} type="number" min="1" value={search} onChange={(event) => setSearch(event.target.value)} /></label><button type="button" className={secondary} onClick={() => { setFilter(search); setPage(1); }}>Filter visits</button></div>}
      <LoadState {...visits} />{visits.data && <>{!visits.data.data.length && <p>No visible visits match this page.</p>}<div className="grid gap-2 sm:grid-cols-2">{visits.data.data.map((visit) => <button type="button" className={secondary + " text-left"} key={visit.id} disabled={!["open", "in_progress"].includes(visit.status)} onClick={() => onSelect(visit)}>
        <span>{visit.patient.first_name} {visit.patient.last_name} · {visit.patient.mrn}<span className="block text-xs">Visit #{visit.id} · {visit.status} · {hospitalTime(visit.opened_at)}</span></span>
      </button>)}</div><Pager meta={visits.data.meta} onPage={setPage} /></>}</>}</section>;
}
