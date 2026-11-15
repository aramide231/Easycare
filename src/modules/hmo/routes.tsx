import { lazy } from "react";
import { Route } from "react-router-dom";
import { PatientRouteRedirect } from "@/components/patient/patientWorkspace";

import HmoLayout from "@hmo/layouts/HmoLayout";
import { AdmissionsPage } from "@/pages/visits/Admissions";
import Wards from "@/pages/visits/Wards";
import { CareProgramsPage } from "@/pages/visits/CarePrograms";

const HmoDashboard = lazy(() => import("@hmo/pages/dashboard/Dashboard"));
const HmoNotifications = lazy(
  () => import("@hmo/pages/notifications/Notifications"),
);
const HmoRegistration = lazy(
  () => import("@hmo/pages/hmo-management/registration/Registration"),
);
const HmoAccountReview = lazy(
  () => import("@hmo/pages/hmo-management/account-review/AccountReview"),
);
const HmoBillSummary = lazy(
  () => import("@hmo/pages/hmo-management/bill-summary/BillSummary"),
);
const HmoClaimsProcessor = lazy(
  () => import("@hmo/pages/hmo-management/claims-processor/ClaimsProcessor"),
);
const HmoServiceList = lazy(
  () => import("@hmo/pages/perform-action/service-list/ServiceList"),
);
const HmoSetReminder = lazy(
  () => import("@hmo/pages/perform-action/set-reminder/SetReminder"),
);
const HmoInsRegistrationLogs = lazy(
  () => import("@hmo/pages/reports/ins-registration-logs/InsRegistrationLogs"),
);
const HmoPreAuthorisationLogs = lazy(
  () =>
    import("@hmo/pages/reports/pre-authorisation-logs/PreAuthorisationLogs"),
);
/**
 * HMO module routes — self-contained under /hmo.
 * Mount inside RoleBasedRoutes (preview-accessible like frontdesk).
 */
export function HmoRoutes() {
  return (
    <Route path="/hmo" element={<HmoLayout />}>
      <Route index element={<HmoDashboard />} />
      <Route path="dashboard" element={<HmoDashboard />} />
      <Route path="notifications" element={<HmoNotifications />} />
      <Route path="registration" element={<HmoRegistration />} />
      <Route path="account-review" element={<HmoAccountReview />} />
      <Route path="bill-summary" element={<HmoBillSummary />} />
      <Route path="claims-processor" element={<HmoClaimsProcessor />} />
      <Route path="admission" element={<AdmissionsPage />} />
      <Route path="available-ward" element={<Wards />} />
      <Route path="discharge" element={<AdmissionsPage initialStatus="discharged" />} />
      <Route path="service-list" element={<HmoServiceList />} />
      <Route path="reminder" element={<HmoSetReminder />} />
      <Route path="ante-natal-logs" element={<CareProgramsPage initialType="antenatal" />} />
      <Route path="child-birth-logs" element={<CareProgramsPage initialType="delivery" />} />
      <Route path="discharged-logs" element={<AdmissionsPage initialStatus="discharged" />} />
      <Route path="ins-registration-logs" element={<HmoInsRegistrationLogs />} />
      <Route
        path="pre-authorisation-logs"
        element={<HmoPreAuthorisationLogs />}
      />
      <Route path="patient-profile/:id" element={<PatientRouteRedirect />} />
      <Route path="flag-profile/:id" element={<PatientRouteRedirect />} />
      <Route
        path="previous-patient-records/:patientId"
        element={<PatientRouteRedirect suffix="/history" />}
      />
    </Route>
  );
}

export { HmoLayout };
