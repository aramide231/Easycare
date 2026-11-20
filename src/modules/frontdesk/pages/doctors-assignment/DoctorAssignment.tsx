import { IS_DEMO } from "@/config/dataSource";
import PreviewComponent from "./DoctorAssignment.preview";
import VisitRegister from "@/pages/visits/VisitRegister";

function DoctorAssignment() {
  return <div className="min-w-0 px-4 py-6 sm:px-6 lg:px-8"><VisitRegister initialQueues /></div>;
}

export default function MergedComponent() {
  return IS_DEMO ? <PreviewComponent /> : <DoctorAssignment />;
}
