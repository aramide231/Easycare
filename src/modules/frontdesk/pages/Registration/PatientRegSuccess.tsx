import { IS_DEMO } from "@/config/dataSource";
import PreviewComponent from "./PatientRegSuccess.preview";
import { Navigate } from "react-router-dom";

function PatientRegSuccess() {
  return <Navigate to="/patients" replace state={null} />;
}

export default function MergedComponent() {
  return IS_DEMO ? <PreviewComponent /> : <PatientRegSuccess />;
}
