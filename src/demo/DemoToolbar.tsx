import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginStaff } from "@/api/auth/session";
import { useAuthStore } from "@/store/useAuthStore";
import { getRoleHomePath } from "@/lib/authRoutes";
import { demoRoles } from "./data";

export default function DemoToolbar() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const role = user?.roles[0]?.code || "";
  const switchRole = async (code: string) => {
    if (!code) return;
    setBusy(true); setError("");
    try { await loginStaff("demo." + code, "demo-only"); navigate(getRoleHomePath(code), { replace: true }); }
    catch { setError("Unable to switch the demo workspace."); }
    finally { setBusy(false); }
  };
  return <aside aria-label="Demo mode" className="fixed inset-x-0 bottom-0 z-[100] flex flex-wrap items-center justify-between gap-2 border-t border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-lg">
    <div><strong>DEMO · Dummy data</strong><span className="ml-2 hidden sm:inline">Backend disconnected. Reload resets sample records.</span>
      {error && <span role="alert" className="ml-2 text-red-700">{error}</span>}</div>
    <div className="flex items-center gap-3">{user && <label className="flex items-center gap-2">Workspace<select aria-label="Demo workspace" disabled={busy}
      className="max-w-40 rounded border border-amber-300 bg-white px-2 py-1" value={role} onChange={(event) => void switchRole(event.target.value)}>
      {demoRoles.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}</select></label>}
      <button type="button" className="rounded border border-amber-400 px-3 py-1 font-medium" onClick={() => window.location.reload()}>Reset demo</button></div>
  </aside>;
}
