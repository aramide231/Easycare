import { IS_DEMO } from "@/config/dataSource";
import PreviewComponent from "./HeaderPatientSearch.preview";
import type { ComponentProps } from "react";
import SavedComponent from "@/components/header/HeaderPatientSearch";

export default function MergedComponent(props: ComponentProps<typeof SavedComponent>) {
  return IS_DEMO ? <PreviewComponent {...props} /> : <SavedComponent {...props} />;
}
