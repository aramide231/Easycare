import { useNavigate } from "react-router-dom";
import { IS_DEMO } from "@/config/dataSource";
import { loginStaff } from "@/api/auth/session";
import ModuleSelectionModal, {
  type PreviewModule,
} from "@/components/preview/ModuleSelectionModal";

const modulePaths: Record<PreviewModule, string> = {
  frontdesk: "/frontdesk",
  nurse: "/nurse/dashboard",
  doctor: "/doctor",
  hmo: "/hmo/dashboard",
  pharmacy: "/pharmacy",
  diagnostics: "/diagnostics",
  "diagnostics-and-radiologist": "/diagnostics-and-radiologist",
};

const PreviewEntry = () => {
  const navigate = useNavigate();

  const handleSelect = async (module: PreviewModule) => {
    if (IS_DEMO) await loginStaff("demo." + (module === "diagnostics" ? "diagnostics-and-radiologist" : module), "demo-only");
    navigate(modulePaths[module]);
  };

  return <ModuleSelectionModal onSelect={handleSelect} />;
};

export default PreviewEntry;
