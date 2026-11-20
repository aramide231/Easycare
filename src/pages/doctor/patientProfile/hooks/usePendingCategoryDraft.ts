import {
  NursingPatientStatusContext,
  withNursingStatus,
} from "@/pages/nurse/patient-profile/lib/NursingContext";
import { useEffect, useContext } from "react";
import {
  setPendingSectionEntry,
  subscribeSectionFormClear,
} from "./useMedicalTable";

/** Syncs local form state to pending draft; clears on category Submit. */
export function usePendingCategoryDraft(
  tableKey: string,
  buildDraft: () => Record<string, string> | null,
  deps: React.DependencyList,
  onClear: () => void,
) {
  const nursingStatus = useContext(NursingPatientStatusContext);
  useEffect(() => {
    const draft = buildDraft();
    setPendingSectionEntry(
      tableKey,
      draft ? withNursingStatus(draft, nursingStatus) : null,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nursingStatus]);

  useEffect(() => {
    return subscribeSectionFormClear(tableKey, onClear);
  }, [tableKey, onClear]);
}
