import { nursingReportKey } from "../lib/nursingSections";
import MedicationDetails from "../nurse-categories/MedicationDetails";
import DispenseHistory from "../nurse-categories/DispenseHistory";
import ProcedureDetails from "../nurse-categories/ProcedureDetails";
import ReportWriting from "../nurse-categories/ReportWriting";
import OutputChart from "../nurse-categories/OutputChart";
import FeedingChart from "../nurse-categories/FeedingChart";
import { HealthCategoryContext } from "@/pages/doctor/patientProfile/lib/categoryStorage";
import { ChevronDown } from "lucide-react";
import { resolveCategoryForm } from "@/pages/doctor/patientProfile/lib/resolveCategoryForm";
import type { SubCategory } from "@/pages/doctor/patientProfile/config/subCategoryMap";

type Props = {
  sections: SubCategory[];
  disableEntry?: boolean;
  expandedCategories: string[];
  onToggle: (label: string) => void;
  /** When set, uses category-specific forms (e.g. Gen Consult Figma). */
  selectedCategory?: string | null;
};

const CategoryFormAccordion = ({
  sections,
  disableEntry = false,
  expandedCategories,
  onToggle,
  selectedCategory = null,
}: Props) => {
  return (
    <div className="flex min-w-0 w-full max-w-full flex-col divide-y divide-gray-200">
      {sections.map((section) => {
        const isOpen = expandedCategories.includes(section.label);
        const form =
          section.label === "REPORT WRITING" ? (
            <ReportWriting key={nursingReportKey(selectedCategory)} category={selectedCategory} showHeading={false} />
          ) : section.label === "OUTPUT CHART" ? (
            <OutputChart />
          ) : section.label === "FEEDING CHART" ? (
            <FeedingChart />
          ) : section.label === "MEDICATION" ? (
            <MedicationDetails />
          ) : section.label === "NURSING DISPENSES" ? (
            <DispenseHistory />
          ) : section.label === "PHARMACY DISPENSE" ? (
            <DispenseHistory pharmacy />
          ) : section.label === "PROCEDURE" ? (
            <ProcedureDetails category={selectedCategory ?? null} />
          ) : (
            resolveCategoryForm(selectedCategory, section.label, "nurse")
          );

        return (
          <div
            key={section.label}
            className="min-w-0 w-full max-w-full py-3 first:pt-0 last:pb-0"
          >
            <button
              type="button"
              onClick={() => onToggle(section.label)}
              className={section.label === "REPORT WRITING" ? "relative flex w-full items-center justify-between border-b border-[#71349a] pb-1 pt-2 text-left" : "relative w-full border-b-2 border-[#573FD1] py-3 text-left"}
            >
              <span className={section.label === "REPORT WRITING" ? "text-lg font-bold leading-6 text-black" : "absolute -bottom-0.5 left-0 z-10 max-w-[min(100%,20rem)] rounded-t-md bg-[#573FD1] px-4 py-2 text-xs font-bold uppercase tracking-wide text-white shadow-sm"}>
                {section.label === "REPORT WRITING" ? "Report Writing" : section.label}
              </span>
              <div className="flex min-h-[2.25rem] items-center justify-end pr-1">
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${
                    isOpen ? "rotate-180" : ""
                  }`}
                  aria-hidden
                />
              </div>
            </button>

            <div
              className={`min-w-0 w-full max-w-full overflow-x-auto pt-3 ${isOpen ? "" : "hidden"}`}
              aria-hidden={!isOpen}
            >
              <fieldset
                disabled={disableEntry}
                className="block min-w-0 w-full max-w-full border-0 p-0 m-0"
                style={{ minWidth: 0 }}
              >
                <HealthCategoryContext.Provider
                  value={selectedCategory ?? null}
                >
                  {form ?? (
                    <p className="px-1 py-2 text-sm text-gray-500">
                      Form for this section is not available yet.
                    </p>
                  )}
                </HealthCategoryContext.Provider>
              </fieldset>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default CategoryFormAccordion;
