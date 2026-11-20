import { IS_DEMO } from "@/config/dataSource";
import PreviewComponent from "./ManageCard.preview";
import PatientRegistry from "@/pages/patients/PatientRegistry";

function ManageCard() {
  return <div className="space-y-4 px-4 sm:px-8"><p className="text-sm text-slate-600">Open the saved patient profile to change its card or request a duplicate merge.</p><PatientRegistry /></div>;
}

export default function MergedComponent() {
  return IS_DEMO ? <PreviewComponent /> : <ManageCard />;
}
