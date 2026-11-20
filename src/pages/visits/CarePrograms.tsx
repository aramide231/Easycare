import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { careHistory, careProgramCommand, careTypes, getCareProgram, getCareRecord, listBabies, listCarePrograms, listCareRecords, openCareProgram, type Baby, type CareProgram, type CareType } from "@/api/care";
import { clinicalLabel, type ClinicalAction, type ClinicalRecord } from "@/api/clinical";
import { patientId, type PatientRecord } from "@/api/patients";
import { getVisit, hospitalTime, type Visit } from "@/api/visits";
import { useAuth } from "@/context/AuthContext";
import ClinicalForm from "@/components/visits/ClinicalForm";
import { ClinicalSummary, ClinicalValues } from "@/components/visits/ClinicalValues";
import { HospitalGate, HospitalNav, VisitChooser } from "@/components/visits/HospitalRecords";
import { CommandState, CommandSubmit, LoadState, Pager, PatientPicker, Reason, control, onForm, primary, relatedRecord, secondary, useCommand, useLoad } from "@/components/visits/visitWorkspace";

function OpenProgram({ initial, initialType, reload }: { initial: Visit | null; initialType: CareType; reload: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [visit, setVisit] = useState(initial);
  const [type, setType] = useState<CareType>(initialType);
  const [reason, setReason] = useState("");
  const [verified, setVerified] = useState(false);
  const command = useCommand((input: { visit: Visit; type: CareType; reason: string; verified: boolean }, key) => openCareProgram(input.visit, input.type, input.reason, input.verified, key, user!.id!),
    (response) => navigate("/care-programs/" + response.data.id), reload);
  return <form className="space-y-4 rounded-xl border bg-white p-5" onSubmit={(event) => onForm(event, () => command.submit(() => {
    if (!visit) throw new Error("Choose a saved visit.");
    return { visit, type, reason, verified };
  }))}><h2 className="text-xl font-semibold">Open care program</h2><CommandState command={command} reload={reload} />
    <fieldset className="space-y-4" disabled={command.locked}><VisitChooser value={visit} onSelect={(value) => { setVisit(value); setVerified(false); }} />
      <label className="block text-sm">Program type<select aria-label="Program type" className={control} value={type} onChange={(event) => setType(event.target.value as CareType)}>{careTypes.map((value) => <option key={value} value={value}>{clinicalLabel(value)}</option>)}</select></label>
      <label className="block text-sm"><input type="checkbox" checked={verified} required onChange={(event) => setVerified(event.target.checked)} /> I verified the patient's identity and hospital card.</label><Reason value={reason} onChange={setReason} />
    </fieldset><CommandSubmit command={command} label="Open saved care program" disabled={!visit || !verified || !["open", "in_progress"].includes(visit.status)} /></form>;
}
function CareList({ initialType = "" }: { initialType?: string }) {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const initial = patientId(params.get("visit"));
  const [type, setType] = useState(initialType);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(!!initial);
  const programs = useLoad("care-program-list-" + type + ":" + status + ":" + page, (signal) => listCarePrograms({ type, status, page }, signal));
  const visit = useLoad("new-care-initial-visit-" + initial, (signal) => getVisit(initial!, signal), !!initial && creating);
  const reload = () => { setCreating(false); programs.reload(); };
  return <section className="space-y-5"><HospitalNav /><header className="flex flex-wrap justify-between gap-3"><div><h1 className="text-2xl font-bold">Care programs and nursing records</h1><p className="mt-2 text-sm text-slate-600">Hospital-approved forms, saved visits and individual baby records. Times use Africa/Lagos.</p></div><button className={secondary} onClick={reload}>Refresh saved programs</button></header>
    <div className="flex flex-wrap items-end gap-3"><label className="text-sm">Program type<select aria-label="Program type" className={control} value={type} onChange={(event) => { setType(event.target.value); setPage(1); }}><option value="">All programs</option>{careTypes.map((value) => <option key={value} value={value}>{clinicalLabel(value)}</option>)}</select></label><label className="text-sm">Status<select aria-label="Status" className={control} value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">All statuses</option><option value="active">Active</option><option value="completed">Completed</option></select></label>
      {user?.permissions?.includes("care.manage") && <button className={primary} onClick={() => setCreating(true)}>Open care program</button>}</div>
    {creating && user?.permissions?.includes("care.manage") && <><LoadState {...visit} />{(!initial || visit.data) && <OpenProgram key={initial + ":" + visit.data?.data.version} initial={visit.data?.data ?? null} initialType={careTypes.includes(type as CareType) ? type as CareType : "antenatal"} reload={reload} />}</>}
    <LoadState {...programs} />{programs.data && <>{!programs.data.data.length && <p className="rounded-xl border bg-white p-5">No saved care programs match this view.</p>}<div className="grid gap-3 md:grid-cols-2">{programs.data.data.map((program) => <Link key={program.id} className="space-y-2 rounded-xl border bg-white p-5 hover:border-violet-400" to={"/care-programs/" + program.id}><h2 className="font-semibold">{clinicalLabel(program.type)} #{program.id}</h2><p>Patient #{program.patient_id} · {program.status}</p><p className="text-sm">{hospitalTime(program.started_at)} · Opening visit #{program.encounter_id}</p>{program.type === "delivery" && <p className="text-sm text-violet-700">Review individual babies and birth records</p>}</Link>)}</div><Pager meta={programs.data.meta} onPage={setPage} /></>}
  </section>;
}
export function CareProgramsPage({ initialType }: { initialType?: string }) { return <HospitalGate permission="care.view"><CareList initialType={initialType} /></HospitalGate>; }

function ProgramCommandForm({ program, action, baby, initialVisit, reload, unavailable }: {
  program: CareProgram; action: "complete" | "birth" | "link"; baby?: Baby; initialVisit: Visit; reload: () => void; unavailable: () => void;
}) {
  const { user } = useAuth();
  const [visit, setVisit] = useState<Visit | null>(["open", "in_progress"].includes(initialVisit.status) ? initialVisit : null);
  const [order, setOrder] = useState("");
  const [reason, setReason] = useState("");
  const [child, setChild] = useState<PatientRecord | null>(null);
  const [verified, setVerified] = useState(false);
  const command = useCommand((input: Record<string, unknown>, key) => careProgramCommand(program, action, input, key, user!.id!, baby), reload, unavailable);
  return <form aria-label={action === "birth" ? "Record individual baby" : action === "link" ? "Link baby identity" : "Complete care program"} className="space-y-4 rounded-xl border bg-white p-5" onSubmit={(event) => onForm(event, () => command.submit(() => {
    if (!visit || visit.patient_id !== program.patient_id) throw new Error("Choose a saved open visit for this patient.");
    const input: Record<string, unknown> = { encounter_id: visit.id, encounter_version: visit.version, program_version: program.version, reason };
    if (action === "birth") input.birth_order = Number(order);
    if (action === "link") {
      if (!child || child.id === program.patient_id) throw new Error("Choose the registered baby, with a different patient identity from the mother.");
      Object.assign(input, { child_patient_id: child.id, child_patient_version: child.version, identity_verified: verified });
    }
    return input;
  }))}><h2 className="text-lg font-semibold">{action === "birth" ? "Record individual baby" : action === "link" ? "Link baby #" + baby?.birth_order + " to registered patient" : "Complete care program"}</h2>
    <CommandState command={command} reload={unavailable} /><fieldset disabled={command.locked} className="space-y-4"><VisitChooser value={visit} onSelect={setVisit} patient={program.patient_id} />
      {action === "birth" && <><p className="text-sm">Add one identity per baby. Clinical observations are recorded separately using the approved birth form.</p><label className="block text-sm">Birth order<input className={control} type="number" min="1" max="4294967294" step="1" required value={order} onChange={(event) => setOrder(event.target.value)} /></label></>}
      {action === "link" && <><PatientPicker value={child} onChange={(value) => { setChild(value); setVerified(false); }} /><label className="block text-sm"><input type="checkbox" required checked={verified} onChange={(event) => setVerified(event.target.checked)} /> I verified this baby and its registered patient identity. This saved link is permanent.</label></>}
      <Reason value={reason} onChange={setReason} /></fieldset><CommandSubmit command={command} label="Confirm saved program action" disabled={!visit || action === "link" && (!child || !verified)} /></form>;
}
function SavedCareEntry({ program, record, unavailable, onSaved, reload }: { program: CareProgram; record: ClinicalRecord; unavailable: () => void; onSaved: (record: ClinicalRecord) => void; reload: () => void }) {
  const { user } = useAuth();
  const [action, setAction] = useState<ClinicalAction | null>(null);
  const [review, setReview] = useState(false);
  const [page, setPage] = useState(1);
  const visit = useLoad("care-record-visit-" + record.encounter_id + ":" + record.id + ":" + record.version,
    (signal) => relatedRecord(getVisit(record.encounter_id, signal), unavailable));
  const history = useLoad("care-entry-history-" + record.id + ":" + record.version + ":" + page, (signal) => relatedRecord(careHistory(program, record, page, signal), unavailable), review && !!user?.permissions?.includes("care.review"));
  const predecessor = useLoad("care-entry-predecessor-" + record.id + ":" + record.amends_id,
    (signal) => relatedRecord(getCareRecord(program, record.encounter_id, record.amends_id!, signal), unavailable), review && !!record.amends_id);
  const has = (name: string) => !!user?.permissions?.includes("care." + name);
  const active = program.status === "active" && !!visit.data && ["open", "in_progress"].includes(visit.data.data.status);
  const own = record.status === "draft" && record.authored_by === user?.id;
  const currentSigned = record.status === "signed" && !record.superseded;
  const allowed: Partial<Record<ClinicalAction, boolean>> = {
    update: active && has("write") && own, sign: active && has("write") && has("sign") && own,
    amend: active && has("write") && has("sign") && has("amend") && currentSigned,
    void: active && has("write") && has("void") && (own || currentSigned && has("amend") && has("sign")),
  };
  return <section aria-label="Selected care entry" className="space-y-4"><LoadState {...visit} /><ClinicalSummary record={record} /><p className="text-sm">{record.birth_id ? "Baby identity #" + record.birth_id : "Program patient / mother"} · Visit #{record.encounter_id}</p>
    <div className="flex flex-wrap gap-3">{Object.entries(allowed).filter(([, yes]) => yes).map(([value]) => <button key={value} className={secondary} onClick={() => setAction(value as ClinicalAction)}>{value === "update" ? "Edit draft" : value === "sign" ? "Sign draft" : value === "amend" ? "Correct signed care record" : own ? "Void draft" : "Retract signed care record"}</button>)}
      {(has("review") || record.amends_id) && <button className={secondary} onClick={() => setReview(true)}>Review care revisions</button>}</div>
    {review && record.amends_id && <section className="space-y-3 rounded-xl border bg-white p-5"><h3 className="font-semibold">Retained preceding record #{record.amends_id}</h3><LoadState {...predecessor} />{predecessor.data && <ClinicalSummary record={predecessor.data.data} />}</section>}
    {review && has("review") && <section className="space-y-3"><LoadState {...history} />{history.data && <>{history.data.data.map((revision) => <details key={revision.id} className="rounded-xl border bg-white p-4"><summary>Version {revision.version} · {clinicalLabel(revision.operation)} · {hospitalTime(revision.recorded_at)}</summary><p className="my-3 text-sm">{revision.reason} · Staff #{revision.actor_id}</p><ClinicalValues payload={revision.snapshot.payload} kind="entry" /></details>)}<Pager meta={history.data.meta} onPage={setPage} /></>}</section>}
    {action && allowed[action] && visit.data && visit.data.data.patient_id === program.patient_id && <ClinicalForm key={record.id + ":" + record.version + ":" + action} visit={visit.data.data} kind="entry" action={action} original={record}
      care={{ id: program.id, version: program.version, birth_id: record.birth_id ?? null, type: program.type }} options={{ timezone: "Africa/Lagos", sections: ["note"] }} onSaved={onSaved} onReload={reload} />}
  </section>;
}
function CreateCareEntry({ program, initialVisit, babies, reload, saved }: { program: CareProgram; initialVisit: Visit; babies: Baby[]; reload: () => void; saved: (record: ClinicalRecord) => void }) {
  const [visit, setVisit] = useState<Visit | null>(["open", "in_progress"].includes(initialVisit.status) ? initialVisit : null);
  const [birth, setBirth] = useState<number | null>(null);
  return <section className="space-y-4"><VisitChooser value={visit} onSelect={setVisit} patient={program.patient_id} />
    {program.type === "delivery" && <label className="block text-sm">Record subject<select aria-label="Record subject" className={control} value={birth ?? ""} onChange={(event) => setBirth(Number(event.target.value) || null)}><option value="">Mother / delivery episode</option>{birth && !babies.some((baby) => baby.id === birth) && <option value={birth}>Selected baby identity #{birth}</option>}{babies.map((baby) => <option key={baby.id} value={baby.id}>Baby {baby.birth_order} · Identity #{baby.id}</option>)}</select></label>}
    {visit && <ClinicalForm key={program.id + ":" + visit.id + ":" + visit.version + ":" + birth} visit={visit} kind="entry" action="store" care={{ id: program.id, version: program.version, birth_id: birth, type: program.type }}
      options={{ timezone: "Africa/Lagos", sections: ["note"] }} onSaved={saved} onReload={reload} />}
  </section>;
}
function CareDetail({ id }: { id: number }) {
  const { user } = useAuth();
  const [denied, setDenied] = useState(false);
  const [page, setPage] = useState(1);
  const [babyPage, setBabyPage] = useState(1);
  const [selected, setSelected] = useState<ClinicalRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [action, setAction] = useState<{ name: "complete" | "birth" | "link"; baby?: Baby } | null>(null);
  const [notice, setNotice] = useState("");
  const program = useLoad("care-program-" + id, (signal) => getCareProgram(id, signal));
  const row = program.data?.data;
  const unavailable = () => { setDenied(true); setAction(null); setSelected(null); setCreating(false); };
  const visit = useLoad("care-opening-visit-" + row?.encounter_id + ":" + row?.version, (signal) => relatedRecord(getVisit(row!.encounter_id, signal), unavailable), !!row);
  const records = useLoad("care-records-" + row?.id + ":" + row?.version + ":" + page, (signal) => relatedRecord(listCareRecords(row!, page, signal), unavailable), !!row);
  const babies = useLoad("care-babies-" + row?.id + ":" + row?.version + ":" + babyPage, (signal) => relatedRecord(listBabies(row!, babyPage, signal), unavailable), row?.type === "delivery");
  const reload = () => { setDenied(false); setAction(null); setSelected(null); setCreating(false); program.reload(); records.reload(); babies.reload(); visit.reload(); };
  const saved = (record: ClinicalRecord) => { setSelected(record); setCreating(false); setNotice("The hospital server confirmed care record #" + record.id + ", version " + record.version + "."); records.reload(); };
  const has = (name: string) => !!user?.permissions?.includes("care." + name);
  if (denied) return <div role="alert" className="space-y-3"><p>This program, patient or visit is unavailable. Reload to check your access.</p><button className={secondary} onClick={reload}>Reload program and access</button></div>;
  return <section className="space-y-5"><HospitalNav /><LoadState {...program} /><LoadState {...visit} />{row && visit.data && visit.data.data.patient_id === row.patient_id && <>
    <header className="space-y-3 rounded-xl border bg-white p-5"><div className="flex flex-wrap justify-between gap-3"><h1 className="text-2xl font-bold">{clinicalLabel(row.type)} #{row.id}</h1><button className={secondary} onClick={reload}>Refresh saved care program</button></div>
      <p className="font-semibold">{visit.data.data.patient.first_name} {visit.data.data.patient.last_name} · {visit.data.data.patient.mrn}</p><p>{row.status} · Started {hospitalTime(row.started_at)} by Staff #{row.started_by}</p><p className="text-sm">{row.start_reason}</p>
      {row.completed_at && <p className="text-sm">Completed {hospitalTime(row.completed_at)} · {row.completion_reason}</p>}
      <div className="flex flex-wrap gap-4 text-sm text-violet-700"><Link className="underline" to={"/patients/" + row.patient_id}>Patient details</Link><Link className="underline" to={"/visits/" + row.encounter_id}>Opening visit #{row.encounter_id}</Link></div></header>
    {notice && <p role="status" className="rounded-lg bg-green-50 p-4">{notice}</p>}
    {row.status === "active" && <div className="flex flex-wrap gap-3">{has("write") && <button className={primary} onClick={() => { setCreating(true); setSelected(null); setAction(null); }}>New care entry</button>}
      {has("manage") && <><button className={secondary} onClick={() => { setAction({ name: "complete" }); setCreating(false); setSelected(null); }}>Complete care program</button>{row.type === "delivery" && <button className={secondary} onClick={() => { setAction({ name: "birth" }); setCreating(false); setSelected(null); }}>Record individual baby</button>}</>}</div>}
    {action && row.status === "active" && <ProgramCommandForm key={action.name + ":" + action.baby?.id} program={row} action={action.name} baby={action.baby} initialVisit={visit.data.data} reload={() => { setNotice("The hospital server confirmed the program action."); reload(); }} unavailable={unavailable} />}
    {row.type === "delivery" && <section className="space-y-3 rounded-xl border bg-white p-5"><h2 className="text-lg font-semibold">Individual babies</h2><LoadState {...babies} />{babies.data && <>{!babies.data.data.length && <p>No baby identities have been saved for this delivery.</p>}{babies.data.data.map((baby) => <article key={baby.id} className="space-y-2 border-t pt-3"><h3 className="font-semibold">Baby {baby.birth_order} · Identity #{baby.id}</h3><p className="text-sm">{baby.child_patient_id ? "Registered patient #" + baby.child_patient_id : baby.link_exists ? "Registered identity is outside your current access" : "Not yet linked to a registered child"}</p>{row.status === "active" && !baby.link_exists && has("link_birth") && <button className={secondary} onClick={() => { setAction({ name: "link", baby }); setCreating(false); setSelected(null); }}>Link baby {baby.birth_order} identity</button>}</article>)}<Pager meta={babies.data.meta} onPage={setBabyPage} /></>}</section>}
    {creating && row.status === "active" && has("write") && <CreateCareEntry program={row} initialVisit={visit.data.data} babies={babies.data?.data ?? []} reload={reload} saved={saved} />}
    {selected && <SavedCareEntry key={selected.id + ":" + selected.version} program={row} record={selected} unavailable={unavailable} onSaved={saved} reload={reload} />}
    <section className="space-y-3"><h2 className="text-xl font-semibold">Saved program records</h2><LoadState {...records} />{records.data && <>{!records.data.data.length && <p className="rounded-xl border bg-white p-5">No saved records match this program. Other authors' drafts remain private.</p>}{records.data.data.map((record) => <button key={record.id} className="block w-full space-y-1 rounded-xl border bg-white p-4 text-left" onClick={() => { setSelected(record); setCreating(false); setAction(null); }}><span className="font-semibold">Record #{record.id} · {record.status} · {record.birth_id ? "Baby identity #" + record.birth_id : "Program patient / mother"}</span><span className="block text-sm">Visit #{record.encounter_id} · {hospitalTime(record.recorded_at)} · {record.author_name ?? "Staff #" + record.authored_by}</span></button>)}<Pager meta={records.data.meta} onPage={setPage} /></>}</section>
  </>}</section>;
}
export default function CareProgramDetail() {
  const id = patientId(useParams().id);
  return <HospitalGate permission="care.view">{id ? <CareDetail key={id} id={id} /> : <p role="alert">A saved care-program ID is required.</p>}</HospitalGate>;
}
