import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { admissionCommand, admissionHistory, admissionInput, admissionStatuses, allocationHistory, createAdmission, getAdmission, getWard, listAdmissions, listBeds, listWards, type Admission, type AdmissionAction, type Bed } from "@/api/admissions";
import { patientId } from "@/api/patients";
import { getVisit, hospitalTime, type Visit } from "@/api/visits";
import { useAuth } from "@/context/AuthContext";
import { HospitalGate, HospitalNav, VisitChooser } from "@/components/visits/HospitalRecords";
import { CommandState, CommandSubmit, LoadState, Pager, Reason, control, onForm, primary, secondary, useCommand, useLoad, relatedRecord } from "@/components/visits/visitWorkspace";

function AdmitForm({ initial, reload }: { initial: Visit | null; reload: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [visit, setVisit] = useState(initial);
  const [verified, setVerified] = useState(false);
  const [reason, setReason] = useState("");
  const command = useCommand((input: { visit: Visit; verified: boolean; reason: string }, key) => createAdmission(input.visit, input.reason, input.verified, key, user!.id!),
    (response) => navigate("/admissions/" + response.data.id), reload);
  return <form className="space-y-4" onSubmit={(event) => onForm(event, () => command.submit(() => {
    if (!visit) throw new Error("Choose a saved visit first.");
    return { visit, verified, reason };
  }))}><CommandState command={command} reload={reload} /><fieldset disabled={command.locked} className="space-y-4"><VisitChooser value={visit} onSelect={(value) => { setVisit(value); setVerified(false); }} />
    <label className="block text-sm"><input type="checkbox" checked={verified} required onChange={(event) => setVerified(event.target.checked)} /> I verified this patient's identity and hospital card.</label>
    <Reason value={reason} onChange={setReason} /></fieldset><CommandSubmit command={command} label="Admit patient" disabled={!visit || !verified || !["open", "in_progress"].includes(visit.status)} /></form>;
}
function RegisterAdmission({ visitId, reload }: { visitId: number | null; reload: () => void }) {
  const visit = useLoad("admit-initial-visit-" + visitId, (signal) => getVisit(visitId!, signal), !!visitId);
  return <section className="space-y-4 rounded-xl border bg-white p-5"><h2 className="text-xl font-semibold">New admission</h2>{visitId && <LoadState {...visit} />}
    {(!visitId || visit.data) && <AdmitForm key={visitId + ":" + visit.data?.data.version} initial={visit.data?.data ?? null} reload={reload} />}</section>;
}
function AdmissionList({ initialStatus = "" }: { initialStatus?: string }) {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [status, setStatus] = useState(initialStatus);
  const [page, setPage] = useState(1);
  const [patient, setPatient] = useState("");
  const [filter, setFilter] = useState("");
  const [creating, setCreating] = useState(params.has("visit"));
  const rows = useLoad("admission-list-" + status + ":" + page + ":" + filter, (signal) => listAdmissions({ page, status, ...(filter ? { patient_id: Number(filter) } : {}) }, signal));
  const reload = () => { setCreating(false); rows.reload(); };
  return <section className="space-y-5"><HospitalNav /><header className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-bold">Admissions and discharge</h1><p className="mt-2 text-sm text-slate-600">Saved hospital episodes. Times use Africa/Lagos.</p></div><button className={secondary} onClick={reload}>Refresh saved admissions</button></header>
    <div className="flex flex-wrap items-end gap-3"><label className="text-sm">Status<select aria-label="Status" className={control} value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>{["", ...admissionStatuses].map((value) => <option key={value} value={value}>{value.replace(/_/g, " ") || "All episodes"}</option>)}</select></label>
      <label className="text-sm">Patient ID<input className={control} type="number" min="1" value={patient} onChange={(event) => setPatient(event.target.value)} /></label><button className={secondary} onClick={() => { setFilter(patient); setPage(1); }}>Filter admissions</button>
      {user?.permissions?.includes("admissions.create") && <button className={primary} onClick={() => setCreating(true)}>New admission</button>}</div>
    {creating && user?.permissions?.includes("admissions.create") && <RegisterAdmission visitId={patientId(params.get("visit"))} reload={reload} />}
    <LoadState {...rows} />{rows.data && <>{!rows.data.data.length && <p className="rounded-xl border bg-white p-5">No saved admissions match this view.</p>}<div className="grid gap-3 md:grid-cols-2">{rows.data.data.map((row) => <Link className="space-y-2 rounded-xl border bg-white p-5 hover:border-violet-400" to={"/admissions/" + row.id} key={row.id}><h2 className="font-semibold">Admission #{row.id} · Patient #{row.patient_id}</h2><p>{row.status.replace(/_/g, " ")} · Visit #{row.encounter_id}</p><p className="text-sm text-slate-600">{hospitalTime(row.admitted_at)} · {row.current_allocation ? "Bed #" + row.current_allocation.bed_id : "No current bed"}</p>{row.discharged_at && <p className="text-sm">Discharged {hospitalTime(row.discharged_at)}</p>}</Link>)}</div><Pager meta={rows.data.meta} onPage={setPage} /></>}
  </section>;
}
export function AdmissionsPage({ initialStatus }: { initialStatus?: string }) { return <HospitalGate permission="admissions.view"><AdmissionList initialStatus={initialStatus} /></HospitalGate>; }

function BedPicker({ selected, onSelect }: { selected: Bed | null; onSelect: (bed: Bed | null) => void }) {
  const [ward, setWard] = useState<number | null>(null);
  const [wardPage, setWardPage] = useState(1);
  const [bedPage, setBedPage] = useState(1);
  const wards = useLoad("allocation-wards-" + wardPage, (signal) => listWards({ page: wardPage, active: 1 }, signal));
  const beds = useLoad("allocation-beds-" + ward + ":" + bedPage, (signal) => listBeds({ ward_id: ward!, page: bedPage, available: 1 }, signal), !!ward);
  return <div className="space-y-3"><LoadState {...wards} /><label className="block text-sm">Destination ward<select aria-label="Destination ward" className={control} value={ward ?? ""} onChange={(event) => { setWard(Number(event.target.value) || null); onSelect(null); setBedPage(1); }}>
    <option value="">Choose active ward</option>{ward && !wards.data?.data.some((row) => row.id === ward) && <option value={ward}>Selected ward #{ward}</option>}{wards.data?.data.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>{wards.data && <Pager meta={wards.data.meta} onPage={setWardPage} />}
    {ward && <><LoadState {...beds} /><label className="block text-sm">Available bed<select aria-label="Available bed" className={control} value={selected?.id ?? ""} onChange={(event) => onSelect(beds.data?.data.find((row) => row.id === Number(event.target.value)) ?? null)}><option value="">Choose available bed</option>{selected && !beds.data?.data.some((row) => row.id === selected.id) && <option value={selected.id}>{selected.label}</option>}{beds.data?.data.map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}</select></label>{beds.data && <>{!beds.data.data.length && <p>No available beds match this ward.</p>}<Pager meta={beds.data.meta} onPage={setBedPage} /></>}</>}
    <p className="text-xs text-slate-600">Availability is checked again when saving.</p></div>;
}
function AdmissionActionForm({ admission, action, saved, unavailable }: { admission: Admission; action: AdmissionAction; saved: () => void; unavailable: () => void }) {
  const { user } = useAuth();
  const [reason, setReason] = useState("");
  const [summary, setSummary] = useState("");
  const [bed, setBed] = useState<Bed | null>(null);
  const ward = useLoad("selected-bed-ward-" + bed?.ward_id, (signal) => getWard(bed!.ward_id, signal), !!bed);
  const allocation = ["allocate", "transfer"].includes(action);
  const command = useCommand((input: Record<string, unknown>, key) => admissionCommand(admission, action, input, key, user!.id!), saved, unavailable);
  return <form className="space-y-4 rounded-xl border bg-white p-5" aria-label={action.replace(/-/g, " ")} onSubmit={(event) => onForm(event, () => command.submit(() => {
    const input = admissionInput(admission, action, reason);
    if (allocation) {
      if (!bed || !ward.data || ward.data.data.id !== bed.ward_id) throw new Error("Choose a saved available bed and wait for its ward.");
      Object.assign(input, { bed_id: bed.id, bed_version: bed.version, ward_version: ward.data.data.version });
    }
    if (action === "authorize-discharge") input.discharge_summary = summary.trim() || null;
    return input;
  }))}><h2 className="text-lg font-semibold">{action.replace(/-/g, " ")}</h2><CommandState command={command} reload={unavailable} />
    <fieldset disabled={command.locked} className="space-y-4">{allocation && <><BedPicker selected={bed} onSelect={setBed} /><LoadState {...ward} /></>}
      {action === "complete-discharge" && <p className="text-sm">This completes the doctor's authorization and releases the current bed. Doctor: Staff #{admission.authorized_by} · {hospitalTime(admission.authorized_at!)}.</p>}
      <Reason value={reason} onChange={setReason} />{action === "authorize-discharge" && <label className="block text-sm">Discharge summary<textarea className={control} rows={4} maxLength={20000} value={summary} onChange={(event) => setSummary(event.target.value)} /></label>}</fieldset>
    <CommandSubmit command={command} label="Confirm saved action" disabled={allocation && (!bed || !ward.data)} /></form>;
}
function Timeline({ admission, unavailable }: { admission: Admission; unavailable: () => void }) {
  const [page, setPage] = useState(1);
  const [allocationPage, setAllocationPage] = useState(1);
  const history = useLoad("admission-history-" + admission.id + ":" + admission.workflow_version + ":" + page,
    (signal) => relatedRecord(admissionHistory(admission, page, signal), unavailable));
  const allocations = useLoad("allocation-history-" + admission.id + ":" + admission.workflow_version + ":" + allocationPage,
    (signal) => relatedRecord(allocationHistory(admission, allocationPage, signal), unavailable));
  return <div className="grid gap-5 lg:grid-cols-2"><section className="space-y-3 rounded-xl border bg-white p-5"><h2 className="text-lg font-semibold">Episode history</h2><LoadState {...history} />{history.data && <>{history.data.data.map((event) => <article className="border-t pt-3 text-sm" key={event.id}><p className="font-semibold">{event.operation.replace(/_/g, " ")} · {hospitalTime(event.recorded_at)}</p><p>Staff #{event.actor_id} · {event.reason}</p></article>)}<Pager meta={history.data.meta} onPage={setPage} /></>}</section>
    <section className="space-y-3 rounded-xl border bg-white p-5"><h2 className="text-lg font-semibold">Bed and transfer history</h2><LoadState {...allocations} />{allocations.data && <>{allocations.data.data.map((row) => <article key={row.id} className="border-t pt-3 text-sm"><p className="font-semibold">Bed #{row.bed_id} · Allocation #{row.id}</p><p>Assigned {hospitalTime(row.assigned_at)} by Staff #{row.assigned_by}</p><p>{row.assignment_reason}</p>{row.released_at && <><p>Released {hospitalTime(row.released_at)} by Staff #{row.released_by}</p><p>{row.release_reason}</p></>}</article>)}<Pager meta={allocations.data.meta} onPage={setAllocationPage} /></>}</section></div>;
}
function Detail({ id }: { id: number }) {
  const { user } = useAuth();
  const [denied, setDenied] = useState(false);
  const [action, setAction] = useState<AdmissionAction | null>(null);
  const [notice, setNotice] = useState("");
  const record = useLoad("admission-detail-" + id, (signal) => getAdmission(id, signal));
  const row = record.data?.data;
  const unavailable = () => { setDenied(true); setAction(null); };
  const visit = useLoad("admission-visit-" + row?.encounter_id + ":" + row?.workflow_version,
    (signal) => relatedRecord(getVisit(row!.encounter_id, signal), unavailable), !!row);
  const reload = () => { setDenied(false); setAction(null); record.reload(); visit.reload(); };
  const active = !!row && row.status !== "discharged" && !!visit.data && ["open", "in_progress"].includes(visit.data.data.status);
  const has = (permission: string) => !!user?.permissions?.includes(permission);
  const actions: Partial<Record<AdmissionAction, boolean>> = {
    allocate: active && !row?.current_allocation && has("admissions.allocate") && has("locations.view"),
    transfer: active && !!row?.current_allocation && has("admissions.allocate") && has("locations.view"),
    release: active && !!row?.current_allocation && has("admissions.allocate"),
    "authorize-discharge": active && row?.status === "admitted" && has("admissions.authorize_discharge") && !!user?.roles?.includes("doctor") && row.current_assignment?.doctor_id === user?.id,
    "complete-discharge": active && row?.status === "discharge_authorized" && has("admissions.complete_discharge") && !!user?.roles?.includes("nurse") && row.authorized_by !== user?.id,
  };
  if (denied) return <div role="alert" className="space-y-3"><p>This admission or its patient is unavailable. Reload to check your access.</p><button className={secondary} onClick={reload}>Reload admission and access</button></div>;
  return <section className="space-y-5"><HospitalNav /><LoadState {...record} /><LoadState {...visit} />{row && visit.data && visit.data.data.patient_id === row.patient_id && <>
    <header className="space-y-2 rounded-xl border bg-white p-5"><div className="flex flex-wrap justify-between gap-3"><h1 className="text-2xl font-bold">Admission #{row.id}</h1><button className={secondary} onClick={reload}>Refresh saved episode</button></div>
      <p className="font-semibold">{visit.data.data.patient.first_name} {visit.data.data.patient.last_name} · {visit.data.data.patient.mrn}</p><p>{row.status.replace(/_/g, " ")} · {row.current_allocation ? "Bed #" + row.current_allocation.bed_id : "No current bed"}</p>
      <p className="text-sm">Admitted {hospitalTime(row.admitted_at)} · Staff #{row.admitted_by}</p>{row.authorized_at && <p className="text-sm">Discharge authorized {hospitalTime(row.authorized_at)} · Doctor #{row.authorized_by}</p>}{row.discharged_at && <p className="text-sm">Discharge completed {hospitalTime(row.discharged_at)} · Nurse #{row.discharged_by}</p>}
      {row.discharge_reason && <p className="text-sm">Doctor's reason: {row.discharge_reason}</p>}{row.discharge_summary && <p className="whitespace-pre-wrap text-sm">{row.discharge_summary}</p>}
      <div className="flex flex-wrap gap-4 text-sm text-violet-700"><Link className="underline" to={"/patients/" + row.patient_id}>Patient details</Link><Link className="underline" to={"/visits/" + row.encounter_id}>Visit #{row.encounter_id}</Link></div></header>
    {notice && <p role="status" className="rounded-lg bg-green-50 p-4 text-green-800">{notice}</p>}
    <div className="flex flex-wrap gap-3">{Object.entries(actions).filter(([, allowed]) => allowed).map(([name]) => <button key={name} className={secondary} onClick={() => setAction(name as AdmissionAction)}>{name.replace(/-/g, " ")}</button>)}</div>
    {action && actions[action] && <AdmissionActionForm key={row.id + ":" + row.workflow_version + ":" + action} admission={row} action={action}
      saved={() => { setNotice("The hospital server confirmed the admission action."); reload(); }} unavailable={unavailable} />}
    {!active && <p role="status" className="rounded-lg border bg-white p-4">This episode or visit is read-only.</p>}
    <Timeline key={row.workflow_version} admission={row} unavailable={unavailable} />
  </>}</section>;
}
export default function AdmissionDetail() {
  const id = patientId(useParams().id);
  return <HospitalGate permission="admissions.view">{id ? <Detail key={id} id={id} /> : <p role="alert">A saved admission ID is required.</p>}</HospitalGate>;
}
