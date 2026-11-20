import { IS_DEMO } from "@/config/dataSource";
import PreviewComponent from "./AdminDashboard.preview";
import { useAuth } from "@/context/AuthContext";
import { Navigate } from "react-router-dom";

function AdminDashboard() {
  const { user } = useAuth();
  return <Navigate to={user?.permissions?.includes("staff.manage") ? "/admin/users" : user?.permissions?.includes("audit.view") ? "/admin/audit" : "/admin/files"} replace />;
}

export default function MergedComponent() {
  return IS_DEMO ? <PreviewComponent /> : <AdminDashboard />;
}
