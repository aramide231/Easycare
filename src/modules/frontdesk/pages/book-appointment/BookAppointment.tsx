import { IS_DEMO } from "@/config/dataSource";
import PreviewComponent from "./BookAppointment.preview";
import Appointments from "@/pages/visits/Appointments";

function BookAppointment() {
  return <div className="min-w-0 px-4 py-6 sm:px-6 lg:px-8"><Appointments /></div>;
}

export default function MergedComponent() {
  return IS_DEMO ? <PreviewComponent /> : <BookAppointment />;
}
