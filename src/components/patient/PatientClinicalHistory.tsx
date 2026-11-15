import { useState } from "react";
import { Link } from "react-router-dom";
import { canReadClinical, clinicalKinds, clinicalLabel, patientHistory, type ClinicalKind } from "@/api/clinical";
import { useAuth } from "@/context/AuthContext";
import { LoadState, Pager, secondary, useLoad } from "@/components/visits/visitWorkspace";
import { ClinicalSummary } from "@/components/visits/ClinicalValues";

export default function PatientClinicalHistory({ patient }: { patient: number }) {
  const { user } = useAuth();
  const permissions = user?.permissions ?? [];
  const permitted = permissions.includes("clinical.history.view") && canReadClinical(permissions);
  const [filter, setFilter] = useState({ kind: "", status: "", include_superseded: "0", page: 1 });
  const records = useLoad("patient-clinical-history-" + patient + ":" + JSON.stringify(filter), (signal) => patientHistory(patient, filter, signal), permitted);
  return <section className="space-y-5"><div className="flex flex-wrap justify-between gap-3"><h2 className="text-xl font-semibold">Patient clinical history</h2>{permitted && <button className={secondary} onClick={records.reload}>Refresh history</button>}</div>
    {!permitted ? <p role="alert" className="rounded-xl border bg-white p-5">Your account does not have permission to review patient clinical history.</p> : <>
      <p className="text-sm text-slate-600">Signed and voided records from visits you can access. Drafts are excluded.</p>
      <div className="flex flex-wrap gap-4"><label className="text-sm">Record kind<select aria-label="Record kind" className={secondary + " ml-2"} value={filter.kind} onChange={(event) => setFilter((old) => ({ ...old, kind: event.target.value, page: 1 }))}><option value="">All permitted kinds</option>{clinicalKinds.filter((kind) => canReadClinical(permissions, kind)).map((kind) => <option key={kind} value={kind}>{clinicalLabel(kind)}</option>)}</select></label><label className="text-sm">History status<select aria-label="History status" className={secondary + " ml-2"} value={filter.status} onChange={(event) => setFilter((old) => ({ ...old, status: event.target.value, page: 1 }))}><option value="">Signed and voided</option><option value="signed">Signed</option><option value="voided">Voided</option></select></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={filter.include_superseded === "1"} onChange={(event) => setFilter((old) => ({ ...old, include_superseded: event.target.checked ? "1" : "0", page: 1 }))} />Include superseded records</label></div>
      <LoadState {...records} />{records.data && <>{!records.data.data.length && <p className="rounded-xl border bg-white p-5">No finalized records match this view.</p>}{records.data.data.map((record) => <div key={record.id} className="space-y-2"><p className="text-sm">Visit #{record.encounter_id} · {record.encounter?.care_setting} · {record.encounter?.status}</p><ClinicalSummary record={record} /><Link className="inline-block text-sm text-[#573FD1] underline" to={"/visits/" + record.encounter_id + "/clinical?kind=" + (record.kind as ClinicalKind) + "&record=" + record.id}>Open record and corrections</Link></div>)}<Pager meta={records.data.meta} onPage={(page) => setFilter((old) => ({ ...old, page }))} /></>}
    </>}
  </section>;
}
