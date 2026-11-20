import { createContext } from "react";
export const NursingContext = createContext(false);
export const NursingPatientStatusContext = createContext<string | null>(null);

export function withNursingStatus(
  data: Record<string, string>,
  status: string | null,
): Record<string, string> {
  if (!status) return data;
  const booking =
    data.patientType &&
    /^(un)?booked$/i.test(data.patientType);
  return {
    ...data,
    ...(booking ? { bookingStatus: data.patientType } : {}),
    patientType: status,
  };
}
