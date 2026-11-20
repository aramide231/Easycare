import { IS_DEMO } from "@/config/dataSource";
import PreviewComponent from "./Dashboard.preview";
import PatientRegistry from "@/pages/patients/PatientRegistry";

function FrontdeskDashboard() {
  return <div className="px-4 py-4 sm:px-8"><PatientRegistry /></div>;
}

export default function MergedComponent() {
  return IS_DEMO ? <PreviewComponent /> : <FrontdeskDashboard />;
}
