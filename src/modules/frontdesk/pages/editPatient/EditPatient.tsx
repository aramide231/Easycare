import { IS_DEMO } from "@/config/dataSource";
import PreviewComponent from "./EditPatient.preview";
import { PatientRouteRedirect } from "@/components/patient/patientWorkspace";

function EditPatient() {
  return <PatientRouteRedirect suffix="/edit" />;
}

export default function MergedComponent() {
  return IS_DEMO ? <PreviewComponent /> : <EditPatient />;
}
