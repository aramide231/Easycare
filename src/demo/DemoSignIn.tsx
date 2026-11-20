import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { getRoleHomePath } from "@/lib/authRoutes";
import { demoRoles } from "./data";

export default function DemoSignIn() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const enter = async (role: string) => {
    setBusy(true); setError("");
    try {
      const user = await signIn("demo." + role, "demo-only");
      if (user) navigate(getRoleHomePath(user.userRole), { replace: true });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to open this demo."); }
    finally { setBusy(false); }
  };
  return <section className="my-6 space-y-5">
    <div><p className="text-sm font-semibold text-amber-700">Disconnected demo</p>
      <h2 className="mt-2 text-2xl font-bold text-slate-900">Choose a sample workspace</h2>
      <p className="mt-2 text-sm text-slate-600">Explore with fictional records. Changes stay in this tab and reset when you reload. Use sample data only.</p></div>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <div className="grid grid-cols-2 gap-3">{demoRoles.map((role) => <button key={role.code} disabled={busy} type="button"
      className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-4 text-left font-semibold text-violet-900 hover:bg-violet-100 disabled:opacity-50"
      onClick={() => void enter(role.code)}>{role.label}<span className="mt-1 block text-xs font-normal text-slate-600">Open demo</span></button>)}</div>
    <p className="text-xs text-slate-500">No real account is needed. Use <strong>demo-only</strong> in any password confirmation field.</p>
  </section>;
}
