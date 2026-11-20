import { IS_DEMO } from "@/config/dataSource";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
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
  const { signIn } = useAuth();

  const handleSelect = async (module: PreviewModule) => {
    if (IS_DEMO) await signIn(`demo.${module}`, "demo-only");
    navigate(modulePaths[module]);
  };

  return <ModuleSelectionModal onSelect={handleSelect} />;
};

export default PreviewEntry;
