import { IS_DEMO } from "@/config/dataSource";
import PreviewComponent from "./DiagnosticsDashboard.preview";
import PatientRegistry from "@/pages/patients/PatientRegistry";

function PatientDashboard() {
  return <div className="px-4 py-4 sm:px-8"><PatientRegistry /></div>;
}

export default function MergedComponent() {
  return IS_DEMO ? <PreviewComponent /> : <PatientDashboard />;
}
