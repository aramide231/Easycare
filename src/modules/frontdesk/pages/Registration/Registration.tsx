import { IS_DEMO } from "@/config/dataSource";
import PreviewComponent from "./Registration.preview";
import type { ComponentProps } from "react";
import SavedComponent from "@/pages/patients/PatientEditor";

export type PatientData = {
  firstName?: string;
  surname?: string;
  middleName?: string;
  gender?: string;
  email?: string;
  phone?: string;
  maritalStatus?: string;
  dob?: string;
  stateOfOrigin?: string;
  age?: string;
  religion?: string;
  occupation?: string;
  address?: string;
  picture?: File | null;
  patientType?: string;
  insuranceProvider?: string;
  insuranceProviderCode?: string;
  patientId?: string;
  insurancePolicyNumber?: string;
  employerName?: string;
  treatmentGuide?: string;
  planType?: string;
  eligibility?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelationship?: string;
};

export default function MergedComponent(props: ComponentProps<typeof SavedComponent>) {
  return IS_DEMO ? <PreviewComponent /> : <SavedComponent {...props} />;
}
