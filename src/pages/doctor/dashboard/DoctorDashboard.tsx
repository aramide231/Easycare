import { IS_DEMO } from "@/config/dataSource";
import PreviewComponent from "./DoctorDashboard.preview";
import VisitRegister from "@/pages/visits/VisitRegister";

function DoctorDashboard() {
  return <div className="min-w-0 px-2 py-4 sm:px-4"><VisitRegister initialQueues mineOnly /></div>;
}

export default function MergedComponent() {
  return IS_DEMO ? <PreviewComponent /> : <DoctorDashboard />;
}
