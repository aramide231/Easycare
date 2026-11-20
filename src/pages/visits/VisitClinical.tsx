import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { restoreSession } from "@/api/auth/session";
import { ApiError } from "@/api/client/apClient";
import { canReadClinical, clinicalHistory, clinicalKinds, clinicalLabel, clinicalOptions, clinicalPrefix, getClinical, listClinical, type ClinicalAction, type ClinicalKind, type ClinicalOptions, type ClinicalRecord } from "@/api/clinical";
import { patientId } from "@/api/patients";
import { getVisit, hospitalTime, type Visit } from "@/api/visits";
import { useAuth } from "@/context/AuthContext";
import { useAuthStore } from "@/store/useAuthStore";
import { LoadState, Pager, VisitPermission, WorkflowNav, primary, secondary, useLoad } from "@/components/visits/visitWorkspace";
import ClinicalForm from "@/components/visits/ClinicalForm";
import { ClinicalSummary, ClinicalValues } from "@/components/visits/ClinicalValues";

function SavedRecord({ visit, kind, id, options, onReload, onSaved, checked }: {
  visit: Visit; kind: ClinicalKind; id: number; options: ClinicalOptions; onReload: () => void; onSaved: (record: ClinicalRecord) => void;
  checked: <T>(request: Promise<T>) => Promise<T>;
}) {
  const { user } = useAuth();
  const current = useLoad("clinical-detail-" + visit.id + ":" + kind + ":" + id, (signal) => checked(getClinical(visit.id, visit.patient_id, kind, id, signal)));
  const record = current.data?.data;
  const [action, setAction] = useState<ClinicalAction | null>(null);
  const [review, setReview] = useState(false);
  const [page, setPage] = useState(1);
  const prefix = clinicalPrefix(kind);
  const has = (name: string) => !!user?.permissions?.includes(prefix + "." + name);
  const active = ["open", "in_progress"].includes(visit.status);
  const ownDraft = record?.status === "draft" && record.authored_by === user?.id;
  const rootDraft = ownDraft && record?.amends_id === null;
  const currentSigned = record?.status === "signed" && !record.superseded;
  const write = active && has("write");
  const amend = write && currentSigned && has("sign") && has("amend");
  const actions: Partial<Record<ClinicalAction, boolean>> = {
    update: write && ownDraft && (record?.amends_id === null || has("amend")),
    sign: write && ownDraft && has("sign") && (record?.amends_id === null || has("amend")),
    amend: amend && review,
    void: write && has("void") && (!!rootDraft || !!amend && review),
    stop: amend && review && kind === "prescription" && record?.payload.order_status === "active",
    complete: amend && review && kind === "prescription" && record?.payload.order_status === "active",
  };
  const revisions = useLoad("clinical-revisions-" + id + ":" + record?.version + ":" + page,
    (signal) => checked(clinicalHistory(record!, page, signal)), !!record && review && has("review"));
  const labels: Partial<Record<ClinicalAction, string>> = { update: "Edit draft", sign: "Sign draft", amend: "Correct signed record", void: ownDraft ? "Void draft" : "Retract signed record", stop: "Stop prescription", complete: "Complete prescription" };
  return <section className="space-y-4" aria-label="Selected clinical record"><LoadState {...current} />{record && <>
    <ClinicalSummary record={record} />
    {record.amends_id && <Link className="inline-block text-sm text-[#573FD1] underline" to={"/visits/" + visit.id + "/clinical?kind=" + kind + "&record=" + record.amends_id}>Review preceding record #{record.amends_id}</Link>}
    <div className="flex flex-wrap gap-3"><button className={secondary} onClick={() => { setReview(true); setAction(null); }}>Review corrections and history</button>{Object.entries(actions).filter(([, allowed]) => allowed).map(([name]) => <button key={name} className={secondary} onClick={() => setAction(name as ClinicalAction)}>{labels[name as ClinicalAction]}</button>)}</div>
    {review && <div className="space-y-4 rounded-xl border bg-white p-5"><h3 className="text-lg font-semibold">Record history</h3>{record.superseded && <p className="text-sm">This record has a finalized replacement. Return to the current records to review the latest head.</p>}{!has("review") ? <p className="text-sm text-slate-600">Your account does not have permission to view private draft revisions. Signed predecessors remain available through authorized patient history.</p> : <><LoadState {...revisions} />{revisions.data && <>{!revisions.data.data.length && <p>No private revisions were recorded for this earlier record.</p>}{revisions.data.data.map((revision) => <details key={revision.id} className="rounded-lg border p-4"><summary className="cursor-pointer text-sm font-semibold">Version {revision.version} · {clinicalLabel(revision.operation)} · {hospitalTime(revision.recorded_at)}</summary><div className="mt-4 space-y-3"><p className="text-sm">{revision.actor_name ?? "Staff #" + revision.actor_id}{revision.reason ? " · " + revision.reason : ""}</p><ClinicalValues payload={revision.snapshot.payload} kind={revision.snapshot.kind} /></div></details>)}<Pager meta={revisions.data.meta} onPage={setPage} /></>}</>}</div>}
    {action && actions[action] && <ClinicalForm key={action + ":" + record.id + ":" + record.version} visit={visit} kind={kind} action={action} original={record} options={options} onSaved={onSaved} onReload={onReload} />}
  </>}</section>;
}
function Records({ visit, kind, id, onReload, onSaved, checked, onSelect }: {
  visit: Visit; kind: ClinicalKind; id: number | null; onReload: () => void; onSaved: (record: ClinicalRecord) => void; checked: <T>(request: Promise<T>) => Promise<T>; onSelect: (id: number) => void;
}) {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [creating, setCreating] = useState(false);
  const options = useLoad("clinical-options-" + kind, (signal) => checked(clinicalOptions(kind, signal)));
  const records = useLoad("clinical-list-" + visit.id + ":" + kind + ":" + page + ":" + status,
    (signal) => checked(listClinical(visit.id, visit.patient_id, kind, { page, status }, signal)));
  const canCreate = ["open", "in_progress"].includes(visit.status) && user?.permissions?.includes(clinicalPrefix(kind) + ".write");
  return <div className="space-y-5"><LoadState {...options} /><LoadState {...records} />
    {!options.error && !records.error && <><div className="flex flex-wrap items-end justify-between gap-3"><label className="text-sm">Record status<select aria-label="Record status" className={secondary + " ml-3"} value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); setCreating(false); }}><option value="">All current records</option><option value="draft">My drafts</option><option value="signed">Signed</option><option value="voided">Voided</option></select></label>{canCreate && options.data && <button className={primary} onClick={() => setCreating(true)}>New {kind === "entry" ? "clinical note" : kind === "vitals" ? "vitals" : kind}</button>}</div>
      {creating && options.data ? <ClinicalForm visit={visit} kind={kind} action="store" options={options.data.data} onSaved={onSaved} onReload={onReload} /> : id && options.data ? <SavedRecord key={id} visit={visit} kind={kind} id={id} options={options.data.data} onReload={onReload} onSaved={onSaved} checked={checked} /> : null}
      {records.data && <section className="space-y-3" aria-label="Current clinical records"><h2 className="text-lg font-semibold">{clinicalLabel(kind)} records</h2>{!records.data.data.length && <p className="rounded-xl border bg-white p-5 text-sm">No saved records match this view. Other staff members' drafts stay private.</p>}{records.data.data.map((record: ClinicalRecord) => <button key={record.id} onClick={() => { setCreating(false); onSelect(record.id); }} className="block w-full space-y-1 rounded-xl border bg-white p-4 text-left hover:border-violet-400"><span className="block font-semibold">{clinicalLabel(kind)} #{record.id} · {clinicalLabel(record.status)} · Version {record.version}</span><span className="block text-sm text-slate-600">{hospitalTime(record.recorded_at)} (Africa/Lagos) · {record.author_name ?? "Staff #" + record.authored_by}</span><span className="block truncate text-sm">{String(record.payload.description ?? record.payload.name ?? record.payload.section ?? record.payload.order_status ?? "Saved observations")}</span></button>)}<Pager meta={records.data.meta} onPage={setPage} /></section>}
    </>}
  </div>;
}
function Workspace({ id }: { id: number }) {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [denied, setDenied] = useState(false);
  const [notice, setNotice] = useState("");
  const permissions = user?.permissions ?? [];
  const kinds = clinicalKinds.filter((kind) => canReadClinical(permissions, kind));
  const chosen = params.get("kind");
  const kind = clinicalKinds.includes(chosen as ClinicalKind) ? chosen as ClinicalKind : kinds[0];
  const selected = patientId(params.get("record"));
  const visit = useLoad("clinical-visit-" + id, (signal) => getVisit(id, signal), kinds.length > 0);
  const record = visit.data?.data;
  const reload = () => { setNotice(""); setDenied(false); visit.reload(); };
  const confirmed = (saved: ClinicalRecord) => {
    setParams({ kind: saved.kind, record: String(saved.id) });
    setNotice("The hospital server confirmed " + clinicalLabel(saved.kind).toLowerCase() + " #" + saved.id + ", version " + saved.version + ".");
    visit.reload();
  };
  const checked = async <T,>(request: Promise<T>): Promise<T> => {
    try { return await request; }
    catch (cause) {
      if (cause instanceof ApiError && [401, 403, 404].includes(cause.status)) { setDenied(true); if (cause.status === 403) void restoreSession(true); }
      throw cause;
    }
  };
  if (!kinds.length) return <p role="alert">Your account does not have permission to view clinical records or prescriptions.</p>;
  if (denied) return <div role="alert" className="space-y-4 rounded-xl border bg-white p-5"><p>This clinical record is unavailable or your access changed. Reload the visit to check your current access.</p><button className={secondary} onClick={reload}>Reload visit and access</button></div>;
  return <section className="space-y-5"><WorkflowNav /><Link className="text-sm text-[#573FD1] underline" to={"/visits/" + id}>Back to visit #{id}</Link><LoadState {...visit} />{record && <>
    <header className="space-y-3 rounded-xl border bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-bold">Clinical record · Visit #{record.id}</h1><p className="mt-2 font-semibold">{record.patient.first_name} {record.patient.last_name} · {record.patient.mrn}</p><p className="mt-1 text-sm text-slate-600">{record.status.replace(/_/g, " ")} · {record.care_setting} · Visit version {record.version}</p></div><button className={secondary} onClick={reload}>Refresh clinical records</button></div><div className="flex flex-wrap gap-4 text-sm"><Link className="text-[#573FD1] underline" to={"/patients/" + record.patient_id}>Patient details</Link>{permissions.includes("clinical.history.view") && <Link className="text-[#573FD1] underline" to={"/patients/" + record.patient_id + "/history"}>Patient clinical history</Link>}</div></header>
    {!["open", "in_progress"].includes(record.status) && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">This visit is closed or cancelled. Clinical records are read-only.</p>}
    {notice && <p role="status" className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">{notice}</p>}
    <nav aria-label="Clinical record categories" className="flex flex-wrap gap-2">{kinds.map((value) => <button className={kind === value ? primary : secondary} key={value} onClick={() => setParams({ kind: value })}>{value === "entry" ? "Clinical notes" : clinicalLabel(value)}</button>)}</nav>
    {kind && kinds.includes(kind) ? <Records key={id + ":" + record.patient_id + ":" + record.version + ":" + kind} visit={record} kind={kind} id={selected} onReload={reload} onSaved={confirmed} checked={checked} onSelect={(value) => setParams({ kind, record: String(value) })} /> : <p role="alert">Your account cannot view this clinical category.</p>}
  </>}</section>;
}
export default function VisitClinical() {
  const id = patientId(useParams().id);
  const revision = useAuthStore((state) => state.revision);
  return <VisitPermission>{id ? <Workspace key={revision + ":" + id} id={id} /> : <p role="alert">A saved numeric visit ID is required.</p>}</VisitPermission>;
}
