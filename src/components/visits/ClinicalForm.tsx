import { useState } from "react";
import { ApiError } from "@/api/client/apClient";
import { clinicalCommand, clinicalLabel, clinicalTemplates, listClinical, supportedTemplateFields, type ClinicalAction, type ClinicalInput, type ClinicalKind, type ClinicalOptions, type ClinicalRecord, type ClinicalTemplate, type Payload, type TemplateField } from "@/api/clinical";
import { hospitalInput, type Visit } from "@/api/visits";
import { useAuth } from "@/context/AuthContext";
import { CommandState, CommandSubmit, LoadState, Pager, Reason, control, onForm, secondary, useCommand, useLoad } from "./visitWorkspace";
import { clinicalPayload, diagnosisFields, initialClinicalPayload, medicationFields, procedureFields, vitalFields, type ClinicalField } from "./clinicalFields";
import { ClinicalSummary } from "./ClinicalValues";
import { careForms } from "@/api/care";

function Field({ field, value, onChange }: { field: ClinicalField; value: unknown; onChange: (value: string) => void }) {
  const common = { "aria-label": field.label, className: control, required: field.required, maxLength: field.max, value: field.type === "datetime-local" ? typeof value === "string" && (value.endsWith("Z") || /[+-]\d\d:\d\d$/.test(value)) ? hospitalInput(value) : String(value ?? "") : String(value ?? ""), onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(event.target.value) };
  return <label className="block min-w-0 text-sm font-medium">{field.label}{field.type === "textarea" ? <textarea {...common} rows={3} /> : <input {...common} type={field.type ?? "text"} step={field.step} />}</label>;
}
function TemplateInput({ name, definition, value, onChange }: { name: string; definition: TemplateField; value: unknown; onChange: (value: unknown) => void }) {
  const label = (definition.label ?? clinicalLabel(name)) + (definition.unit ? " (" + definition.unit + ")" : "") + (definition.required ? " (required before signing)" : "");
  if (definition.type === "boolean" || definition.type === "select") return <label className="block text-sm font-medium">{label}<select aria-label={label} className={control} value={value === null || value === undefined ? "" : String(value)} onChange={(event) => onChange(event.target.value === "" ? null : definition.type === "boolean" ? event.target.value === "true" : event.target.value)}><option value="">Not recorded</option>{definition.type === "boolean" ? <><option value="true">Yes</option><option value="false">No</option></> : definition.options?.map((option) => <option key={option}>{option}</option>)}</select></label>;
  return <label className="block text-sm font-medium">{label}<input aria-label={label} className={control} value={String(value ?? "")} type={definition.type === "text" ? "text" : definition.type === "date" ? "date" : "number"} maxLength={definition.max_length ?? 5000} min={definition.min} max={definition.max} step={definition.type === "integer" ? "1" : "any"} onChange={(event) => onChange(event.target.value === "" ? null : ["number", "integer"].includes(definition.type) ? Number(event.target.value) : event.target.value)} /></label>;
}

export default function ClinicalForm({ visit, kind, action, original = null, options, onSaved, onReload, care }: {
  visit: Visit; kind: ClinicalKind; action: ClinicalAction; original?: ClinicalRecord | null; options: ClinicalOptions;
  onSaved: (record: ClinicalRecord) => void; onReload: () => void;
  care?: { id: number; version: number; birth_id: number | null; type: string };
}) {
  const { user } = useAuth();
  const [draft, setDraft] = useState<Payload>(() => ({ ...initialClinicalPayload(kind, original?.payload), ...(care && !original ? { section: "note" } : {}) }));
  const [template, setTemplate] = useState<ClinicalTemplate | null>(original?.template_version ?? null);
  const [templatePage, setTemplatePage] = useState(1);
  const [procedurePage, setProcedurePage] = useState(1);
  const [password, setPassword] = useState("");
  const [reason, setReason] = useState("");
  const editing = ["store", "update", "amend"].includes(action);
  const finalize = !["store", "update"].includes(action);
  const needsReason = ["amend", "void", "stop", "complete"].includes(action);
  const canChooseTemplate = kind === "entry" && (action === "store" || !!care && action === "update" && !original?.template_version);
  const templates = useLoad("clinical-templates-" + (care ? care.id + ":" + care.type + ":" + care.birth_id : "all") + ":" + templatePage,
    (signal) => care ? careForms(care.birth_id === null ? care.type : "birth", templatePage, signal) : clinicalTemplates(templatePage, signal), canChooseTemplate);
  const procedures = useLoad("clinical-procedure-picker-" + visit.id + ":" + procedurePage,
    (signal) => listClinical(visit.id, visit.patient_id, "procedure", { page: procedurePage, status: "signed" }, signal), kind === "entry" && action === "store" && draft.section === "procedure_findings");
  const set = (key: string, value: unknown) => setDraft((old) => ({ ...old, [key]: value }));
  const fields = (draft.fields ?? {}) as Payload;
  const items = (draft.items ?? []) as Payload[];
  const definition = template?.fields ?? (draft.section === "physical_examination" ? Object.fromEntries((options.physical_examination_fields ?? []).map((key) => [key, { type: "text", max_length: 5000 } as TemplateField])) : {});
  const command = useCommand((input: ClinicalInput, key) => clinicalCommand(visit.id, visit.patient_id, kind, action, original, input, key, user!.id!, care), (result) => { setPassword(""); onSaved(result.data); }, onReload);
  const makeInput = (): ClinicalInput => {
    const payload = editing ? clinicalPayload(kind, draft, original?.payload) : undefined;
    if (editing && original && Object.keys(payload!).length === 0) throw new ApiError("Change the clinical values before saving a correction or edit.", 422);
    return { encounter_version: visit.version, ...(original ? { version: original.version } : kind === "prescription" ? {} : { kind }),
      ...(payload ? { payload } : {}), ...(finalize ? { current_password: password } : {}), ...(needsReason ? { reason } : {}) };
  };
  const labels: Record<ClinicalAction, string> = { store: "Save draft", update: "Save draft changes", sign: "Sign saved draft", amend: "Sign correction", void: original?.status === "draft" ? "Void draft" : "Sign retraction", stop: "Sign stopped order", complete: "Sign completed order" };
  if (editing && template && !supportedTemplateFields(template.fields)) return <p role="alert" className="rounded-xl border bg-white p-5">This saved template format cannot be edited in this screen. Ask the hospital administrator to review the published definition.</p>;
  return <form onSubmit={(event) => onForm(event, () => command.submit(makeInput))} className="space-y-4" aria-label={labels[action]}>
    <CommandState command={command} reload={onReload} />
    {!editing && original && <ClinicalSummary record={original} />}
    <fieldset disabled={command.locked} className="space-y-5 rounded-xl border bg-white p-5"><legend className="px-2 text-lg font-semibold">{labels[action]} · {clinicalLabel(kind)}</legend>
      {action === "amend" && <p className="text-sm text-slate-600">This signs a replacement linked to record #{original?.id}. The original signed values remain in history.</p>}
      {["stop", "complete"].includes(action) && <p className="text-sm">This signs a replacement with the existing medication instructions and the new order status. The original order remains in history.</p>}
      {editing && <>
        {kind === "prescription" ? <><p className="text-sm text-slate-600">Enter medication instructions explicitly. Medication name, dose, route and frequency are required before signing. Enter a unit with each duration or quantity.</p>
          <Field field={{ key: "instructions", label: "Overall prescription instructions", type: "textarea", max: 20000 }} value={draft.instructions} onChange={(value) => set("instructions", value)} />
          {items.map((item, index) => <section className="space-y-3 rounded-lg border p-4" key={index}><div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold">Medication {index + 1}</h3><div className="flex flex-wrap gap-2"><button type="button" className={secondary} disabled={index === 0} onClick={() => { const next = [...items]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; set("items", next); }}>Move medication {index + 1} up</button><button type="button" className={secondary} onClick={() => set("items", items.filter((_, position) => index !== position))}>Remove medication {index + 1}</button></div></div><div className="grid gap-4 sm:grid-cols-2">{medicationFields.map((field) => <Field key={field.key} field={{ ...field, label: `Medication ${index + 1}: ${field.label}` }} value={item[field.key]} onChange={(value) => set("items", items.map((line, position) => position === index ? { ...line, [field.key]: value } : line))} />)}</div></section>)}
          <button type="button" className={secondary} disabled={items.length >= 100} onClick={() => set("items", [...items, { medication_name: "" }])}>Add medication</button></>
          : kind === "entry" ? <>
            <label className="block text-sm font-medium">Note section<select aria-label="Note section" className={control} disabled={!!original} value={String(draft.section)} onChange={(event) => setDraft((old) => ({ ...old, section: event.target.value, fields: {}, related_record_id: null }))}>{options.sections?.map((section) => <option key={section} value={section}>{clinicalLabel(section)}</option>)}</select></label>
            {canChooseTemplate ? <div className="space-y-3 rounded-lg border p-4"><h3 className="font-semibold">Published note template</h3><LoadState {...templates} /><label className="block text-sm">Template<select aria-label="Template" className={control} value={template?.id ?? ""} onChange={(event) => { const selected = templates.data?.data.find((item) => item.id === Number(event.target.value)) ?? null; setTemplate(selected); setDraft((old) => ({ ...old, clinical_template_version_id: selected?.id ?? null, fields: {} })); }}><option value="">Narrative / standard examination</option>{template && !templates.data?.data.some((item) => item.id === template.id) && <option value={template.id}>{template.title} · Version {template.version}</option>}{templates.data?.data.map((item) => <option key={item.id} value={item.id} disabled={!item.supported}>{item.title} · Version {item.version}{!item.supported ? " · Unavailable format" : ""}</option>)}</select></label>{templates.data && <Pager meta={templates.data.meta} onPage={setTemplatePage} />}</div> : <p className="text-sm">Saved section and template stay fixed. {template ? template.title + " · Version " + template.version : "Standard narrative / examination"}</p>}
            {action === "store" && draft.section === "procedure_findings" && <div className="space-y-3"><LoadState {...procedures} /><label className="block text-sm">Related signed procedure<select aria-label="Related signed procedure" className={control} required value={String(draft.related_record_id ?? "")} onChange={(event) => set("related_record_id", event.target.value ? Number(event.target.value) : null)}><option value="">Choose the saved procedure</option>{draft.related_record_id && !procedures.data?.data.some((item) => item.id === draft.related_record_id) ? <option value={String(draft.related_record_id)}>Selected procedure #{String(draft.related_record_id)}</option> : null}{procedures.data?.data.map((item) => <option key={item.id} value={item.id}>#{item.id} · {String(item.payload.name)}</option>)}</select></label>{procedures.data && <Pager meta={procedures.data.meta} onPage={setProcedurePage} />}</div>}
            {original?.payload.related_record_id ? <p className="text-sm">Related procedure #{String(original.payload.related_record_id)}</p> : null}
            <div className="grid gap-4 sm:grid-cols-2">{Object.entries(definition).map(([key, field]) => <TemplateInput key={key} name={key} definition={field} value={fields[key]} onChange={(value) => set("fields", { ...fields, [key]: value })} />)}</div>
            <Field field={{ key: "content", label: "Clinical narrative", type: "textarea", max: 20000 }} value={draft.content} onChange={(value) => set("content", value)} />
          </> : <div className="grid gap-4 sm:grid-cols-2">{(kind === "vitals" ? vitalFields : kind === "diagnosis" ? diagnosisFields : procedureFields).map((field) => <Field key={field.key} field={field} value={draft[field.key]} onChange={(value) => set(field.key, value)} />)}{kind === "vitals" && <label className="block text-sm font-medium">Blood glucose unit<select aria-label="Blood glucose unit" className={control} value={String(draft.blood_glucose_unit ?? "")} onChange={(event) => set("blood_glucose_unit", event.target.value || null)}><option value="">Not recorded</option>{options.blood_glucose_units?.map((unit) => <option key={unit}>{unit}</option>)}</select></label>}</div>}
      </>}
      {needsReason && <Reason value={reason} onChange={setReason} />}
      {finalize && <label className="block text-sm font-medium">Current password<input className={control} type="password" required maxLength={1024} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>}
    </fieldset>
    <div className="flex flex-wrap gap-3"><CommandSubmit command={command} label={labels[action]} /><button type="button" className={secondary} disabled={command.busy} onClick={onReload}>Cancel and reload saved records</button></div>
  </form>;
}
