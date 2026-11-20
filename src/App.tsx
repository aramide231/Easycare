import RoleBasedRoutes from "./routes/RoleBasedRoutes";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import SessionBoundary from "@/components/guards/SessionBoundary";
import { IS_DEMO } from "@/config/dataSource";
import DemoToolbar from "@/demo/DemoToolbar";

function App() {
  return (
    <div className={IS_DEMO ? "pb-28 sm:pb-20" : undefined}>
    <SessionBoundary>
      <RoleBasedRoutes />
      <ToastContainer position="bottom-center" autoClose={2500} />
    </SessionBoundary>
    {IS_DEMO && <DemoToolbar />}
    </div>
  );
}

export default App;
