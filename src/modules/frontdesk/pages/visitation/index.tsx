import { IS_DEMO } from "@/config/dataSource";
import PreviewComponent from "./index.preview";
import VisitRegister from "@/pages/visits/VisitRegister";

function Visitation() {
  return <div className="min-w-0 px-4 py-6 sm:px-6 lg:px-8"><VisitRegister /></div>;
}

export default function MergedComponent() {
  return IS_DEMO ? <PreviewComponent /> : <Visitation />;
}
