import { useState } from "react";
import { getWard, listBeds, listWards, locationCommand, type Bed, type Ward } from "@/api/admissions";
import { useAuth } from "@/context/AuthContext";
import { HospitalGate, HospitalNav } from "@/components/visits/HospitalRecords";
import { CommandState, CommandSubmit, LoadState, Pager, control, onForm, primary, secondary, useCommand, useLoad } from "@/components/visits/visitWorkspace";

function CatalogForm({ kind, original, ward, saved, cancel }: { kind: "wards" | "beds"; original: Ward | Bed | null; ward: Ward | null; saved: () => void; cancel: () => void }) {
  const [name, setName] = useState(original ? kind === "wards" ? (original as Ward).name : (original as Bed).label : "");
  const [code, setCode] = useState("");
  const [type, setType] = useState((original as Ward | null)?.type ?? "");
  const [rate, setRate] = useState(original?.daily_rate ?? "");
  const [active, setActive] = useState(original?.is_active ?? true);
  const command = useCommand((input: Record<string, unknown>, key) => locationCommand(kind, original, input, key), saved, cancel);
  return <form className="space-y-4 rounded-xl border bg-white p-5" aria-label={(original ? "Edit " : "Create ") + kind} onSubmit={(event) => onForm(event, () => command.submit(() => {
    if (kind === "beds" && !original && !ward) throw new Error("Choose a saved ward.");
    return { ...(original ? { version: original.version, is_active: active } : kind === "wards" ? { code } : { ward_id: ward!.id, ward_version: ward!.version }),
      ...(kind === "wards" ? { name, type: type.trim() || null } : { label: name }), daily_rate: rate.trim() || null };
  }))}><h2 className="text-xl font-semibold">{original ? "Edit" : "Create"} {kind === "wards" ? "ward" : "bed"}</h2><CommandState command={command} reload={cancel} />
    <fieldset disabled={command.locked} className="grid gap-4 sm:grid-cols-2">{kind === "wards" && !original && <label className="text-sm">Ward code<input className={control} required maxLength={64} pattern="[A-Za-z0-9][A-Za-z0-9._-]*" value={code} onChange={(event) => setCode(event.target.value)} /></label>}
      <label className="text-sm">{kind === "wards" ? "Ward name" : "Bed label"}<input className={control} required maxLength={kind === "wards" ? 191 : 64} value={name} onChange={(event) => setName(event.target.value)} /></label>
      {kind === "wards" && <label className="text-sm">Ward type<input className={control} maxLength={64} value={type} onChange={(event) => setType(event.target.value)} /></label>}
      <label className="text-sm">Daily rate (optional)<input className={control} type="number" min="0" max="999999999999.99" step="0.01" value={rate} onChange={(event) => setRate(event.target.value)} /></label>
      {original && <label className="self-center text-sm"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /> Active location</label>}
      {kind === "beds" && ward && <p className="text-sm">Ward: {ward.name}. Used bed labels retain their original identity.</p>}
    </fieldset><div className="flex gap-3"><CommandSubmit command={command} label="Save location" /><button type="button" className={secondary} disabled={command.busy} onClick={cancel}>Cancel and reload</button></div></form>;
}
function WardRecords() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [bedPage, setBedPage] = useState(1);
  const [wardId, setWardId] = useState<number | null>(null);
  const [availability, setAvailability] = useState("");
  const [editing, setEditing] = useState<{ kind: "wards" | "beds"; record: Ward | Bed | null } | null>(null);
  const [notice, setNotice] = useState("");
  const wards = useLoad("ward-catalog-" + page, (signal) => listWards({ page }, signal));
  const ward = useLoad("selected-ward-" + wardId, (signal) => getWard(wardId!, signal), !!wardId);
  const beds = useLoad("bed-catalog-" + wardId + ":" + bedPage + ":" + availability, (signal) => listBeds({
    ...(wardId ? { ward_id: wardId } : {}), page: bedPage, ...(availability ? { available: Number(availability) } : {}) }, signal));
  const manage = user?.permissions?.includes("locations.manage");
  const reload = () => { setEditing(null); wards.reload(); beds.reload(); ward.reload(); };
  return <section className="space-y-5"><HospitalNav /><header className="flex flex-wrap justify-between gap-4"><div><h1 className="text-2xl font-bold">Wards and beds</h1><p className="mt-2 text-sm text-slate-600">Availability comes from current occupancy. Saving rechecks it.</p></div><button className={secondary} onClick={reload}>Refresh occupancy</button></header>
    {notice && <p role="status" className="rounded-lg bg-green-50 p-4">{notice}</p>}
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(240px,1fr)_2fr]"><section className="space-y-3 rounded-xl border bg-white p-5"><div className="flex flex-wrap justify-between gap-3"><h2 className="text-xl font-semibold">Ward catalog</h2>{manage && <button className={primary} onClick={() => setEditing({ kind: "wards", record: null })}>Add ward</button>}</div><LoadState {...wards} />
      <button className={secondary} onClick={() => { setWardId(null); setBedPage(1); setEditing(null); }}>All wards</button>
      {wards.data && <>{!wards.data.data.length && <p>No wards have been saved.</p>}{wards.data.data.map((row) => <div key={row.id} className="space-y-2 border-t pt-3"><button className={secondary + " w-full text-left"} onClick={() => { setWardId(row.id); setBedPage(1); setEditing(null); }}><span>{row.name} · {row.code}<span className="block text-xs">{row.is_active ? "Active" : "Retired"}{row.daily_rate !== null ? " · Daily rate " + row.daily_rate : ""}</span></span></button>{manage && <button className="text-sm text-violet-700 underline" onClick={() => setEditing({ kind: "wards", record: row })}>Edit {row.name}</button>}</div>)}<Pager meta={wards.data.meta} onPage={setPage} /></>}</section>
      <section className="space-y-4"><LoadState {...ward} /><div className="flex flex-wrap items-end justify-between gap-3"><h2 className="text-xl font-semibold">{ward.data?.data.name ?? "All beds"}</h2><label className="text-sm">Availability<select aria-label="Availability" className={control} value={availability} onChange={(event) => { setAvailability(event.target.value); setBedPage(1); }}><option value="">All beds</option><option value="1">Available</option><option value="0">Occupied or inactive</option></select></label>
        {manage && ward.data?.data.is_active && <button className={primary} onClick={() => setEditing({ kind: "beds", record: null })}>Add bed</button>}</div>
        {editing && manage && <CatalogForm key={editing.kind + ":" + (editing.record?.id ?? "new") + ":" + editing.record?.version + ":" + wardId} kind={editing.kind} original={editing.record} ward={ward.data?.data ?? null}
          cancel={reload} saved={() => { setNotice("The hospital server confirmed the saved location."); reload(); }} />}
        <LoadState {...beds} />{beds.data && <>{!beds.data.data.length && <p className="rounded-xl border bg-white p-5">No saved beds match this view.</p>}<div className="grid gap-3 sm:grid-cols-2">{beds.data.data.map((row) => <article className="space-y-2 rounded-xl border bg-white p-5" key={row.id}><h3 className="font-semibold">{row.label} · Ward #{row.ward_id}</h3><p className={row.available ? "text-green-800" : "text-slate-600"}>{row.available ? "Available" : row.is_active ? "Occupied or ward inactive" : "Retired"}</p><p className="text-sm">{row.daily_rate === null ? "No separate bed rate" : "Daily rate " + row.daily_rate}</p>{manage && <button className={secondary} onClick={() => { setWardId(row.ward_id); setEditing({ kind: "beds", record: row }); }}>Edit bed {row.label}</button>}</article>)}</div><Pager meta={beds.data.meta} onPage={setBedPage} /></>}
      </section></div></section>;
}
export default function Wards() { return <HospitalGate permission="locations.view"><WardRecords /></HospitalGate>; }
