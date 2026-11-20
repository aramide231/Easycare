import { Outlet } from "react-router-dom";
import { NursingContext } from "@/pages/nurse/patient-profile/lib/NursingContext";
import { PatientManagementProvider } from "@/pages/nurse/shared/context/PatientManagementContext";
import Sidebar from "./nurse/components/Sidebar";
import Topbar from "./nurse/components/Topbar";

const NurseLayout = () => {
  return (
    <PatientManagementProvider>
      <NursingContext.Provider value={true}>
        <div className="flex h-screen w-full overflow-hidden bg-gray-50/30">
          <aside className="hidden md:flex h-screen shrink-0 overflow-hidden flex-col">
            <Sidebar />
          </aside>

          <main className="flex flex-col flex-1 min-w-0 overflow-hidden">
            <Topbar />
            <div
              className="flex-1 overflow-y-auto px-4 md:px-6 py-4 hide-scrollbar"
              data-app-page-content
            >
              <Outlet />
            </div>
          </main>
        </div>
      </NursingContext.Provider>
    </PatientManagementProvider>
  );
};

export default NurseLayout;
