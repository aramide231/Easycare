import { clinicalLabel, type ClinicalKind, type ClinicalRecord, type Payload } from "@/api/clinical";
import { hospitalTime } from "@/api/visits";
import { fieldLabel } from "./clinicalFields";

function Value({ value, name, template }: { value: unknown; name: string; template?: ClinicalRecord["template_version"] }) {
  if (value === null || value === undefined || value === "") return <span className="text-slate-500">Not recorded</span>;
  if (typeof value === "boolean") return <>{value ? "Yes" : "No"}</>;
  if (name.endsWith("_at") && typeof value === "string") return <>{hospitalTime(value)} (Africa/Lagos)</>;
  if (Array.isArray(value)) return <ol className="space-y-3">{value.map((item, index) => <li className="rounded-lg border p-3" key={index}><p className="mb-2 font-semibold">Medication {index + 1}</p><ClinicalValues payload={item as Payload} kind="medication" /></li>)}</ol>;
  if (typeof value === "object") return <ClinicalValues payload={value as Payload} template={name === "fields" ? template : undefined} />;
  return <>{String(value)}</>;
}
export function ClinicalValues({ payload, template, kind }: { payload: Payload; template?: ClinicalRecord["template_version"]; kind?: ClinicalKind | "medication" }) {
  const fields = Object.entries(payload).filter(([, value]) => value !== null && value !== undefined && value !== "");
  if (!fields.length) return <p className="text-sm text-slate-500">No clinical values on this record.</p>;
  return <dl className="space-y-3 text-sm">{fields.map(([key, value]) => <div key={key} className="min-w-0"><dt className="font-medium text-slate-600">{template?.fields?.[key]?.label ?? fieldLabel(key, kind)}{template?.fields?.[key]?.unit && " (" + template.fields[key].unit + ")"}</dt><dd className="mt-1 whitespace-pre-wrap break-words"><Value value={value} name={key} template={template} /></dd></div>)}</dl>;
}
export function ClinicalSummary({ record }: { record: ClinicalRecord }) {
  return <article className="space-y-4 rounded-xl border bg-white p-5">
    <div className="flex flex-wrap justify-between gap-3"><h3 className="font-semibold">{clinicalLabel(record.kind)} #{record.id} · Version {record.version}</h3><span className="rounded-full bg-violet-50 px-3 py-1 text-xs text-violet-800">{clinicalLabel(record.status)}{record.superseded ? " · Superseded" : ""}</span></div>
    <p className="text-sm text-slate-600">Recorded {hospitalTime(record.recorded_at)} (Africa/Lagos) by {record.author_name ?? "Staff #" + record.authored_by}</p>
    {record.finalized_at && <p className="text-sm text-slate-600">Finalized {hospitalTime(record.finalized_at)} by {record.finalizer_name ?? "Staff #" + record.finalized_by}</p>}
    {record.amends_id && <p className="text-sm">Replaces record #{record.amends_id}. Reason: {record.amendment_reason}</p>}{record.void_reason && <p className="text-sm">Retraction reason: {record.void_reason}</p>}
    {record.template_version && <p className="text-sm">{record.template_version.title} · Template version {record.template_version.version}</p>}
    {record.kind === "prescription" && <p className="font-medium">{record.is_active_order ? "Current signed active order" : "This record is not an active order"}</p>}
    <ClinicalValues payload={record.payload} template={record.template_version} kind={record.kind} />
    {record.body_mass_index !== null && record.body_mass_index !== undefined && <p className="text-sm">Calculated BMI: {record.body_mass_index} kg/m²</p>}
  </article>;
}
