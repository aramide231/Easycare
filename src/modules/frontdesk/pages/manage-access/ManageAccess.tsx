import { IS_DEMO } from "@/config/dataSource";
import PreviewComponent from "./ManageAccess.preview";
import SavedComponent from "@/pages/patients/PatientAccess";

export default function MergedComponent() {
  return IS_DEMO ? <PreviewComponent /> : <SavedComponent />;
}
