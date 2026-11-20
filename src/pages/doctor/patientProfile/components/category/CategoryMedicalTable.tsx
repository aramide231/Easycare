import { useContext } from "react";
import { nursingDisplayRow } from "@/pages/nurse/patient-profile/lib/recordDetails";
import { NursingContext, NursingPatientStatusContext } from "@/pages/nurse/patient-profile/lib/NursingContext";
import {
  groupNursingRows,
  moneyValue,
} from "@/pages/nurse/patient-profile/lib/monthlyRecords";
import type { CategoryTableColumn } from "../../config/categoryFieldTypes";

export type MedicalTableRow = Record<string, unknown>;

type Props = {
  /** Table heading, e.g. "VITAL SIGNS DETAILS". */
  title: string;
  columns: CategoryTableColumn[];
  rows: MedicalTableRow[];
  emptyMessage?: string;
  /** Shown when a cell value is empty. Defaults to "â€”". */
  emptyCellLabel?: string;
  /** Column keys that render as a purple VIEW link. */
  linkColumns?: string[];
  /** Fired when a VIEW link cell is clicked. */
  onLinkClick?: (row: MedicalTableRow, columnKey: string) => void;
  /** Column keys that allow wrapped / multiline cell text. */
  wrapColumns?: string[];
};

const DEFAULT_WRAP_COLUMNS = new Set([
  "comment",
  "comments",
  "complaint",
  "findings",
  "notes",
  "description",
]);

/**
 * Shared details-table design for patient-profile categories.
 * Supports horizontal scrolling for wide tables (e.g. 15-column Vital Signs details)
 * without clipping or breaking the layout.
 */
const MedicalTable = ({
  title,
  columns,
  rows,
  emptyMessage = "No records yet.",
  emptyCellLabel = "â€”",
  linkColumns = [],
  onLinkClick,
  wrapColumns = [],
}: Props) => {
  const isWrapColumn = (key: string) =>
    wrapColumns.includes(key) || DEFAULT_WRAP_COLUMNS.has(key);

  return (
    <div className="min-w-0 w-full max-w-full border-t border-gray-200 pt-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wide text-gray-800">
          {title}
        </h3>
        {columns.length > 5 && (
          <span className="text-[11px] font-medium text-[#573FD1]">
            Scroll horizontally to view all columns &rarr;
          </span>
        )}
      </div>
      <div className="w-full max-w-full overflow-x-auto pb-3 overscroll-x-contain">
        <table className="min-w-max w-full text-left text-sm border-collapse">
          <thead className="border-b border-[#D4D4D4] bg-gray-50/50 text-xs uppercase text-gray-500">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="whitespace-nowrap px-4 py-2.5 font-medium"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows.map((row, index) => (
                <tr
                  key={index}
                  className={`border-b border-[#D4D4D4] transition hover:bg-purple-50/20 ${
                    index % 2 === 0 ? "bg-white" : "bg-[#FAFAFA]"
                  }`}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-4 py-3 text-gray-800 ${
                        isWrapColumn(col.key)
                          ? "max-w-xs whitespace-normal break-words"
                          : "whitespace-nowrap"
                      }`}
                    >
                      {linkColumns.includes(col.key) &&
                      formatCell(row[col.key], emptyCellLabel) === "VIEW" ? (
                        <button
                          type="button"
                          onClick={() => onLinkClick?.(row, col.key)}
                          className="text-sm font-semibold text-[#573FD1] hover:underline"
                        >
                          VIEW
                        </button>
                      ) : col.key === "patientType" ? (
                        <span className="text-xs font-medium text-gray-600">
                          {formatCell(row[col.key], emptyCellLabel)}
                        </span>
                      ) : (
                        formatCell(row[col.key], emptyCellLabel)
                      )}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={columns.length}
                  className="bg-white py-8 text-center text-sm text-gray-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

function formatCell(value: unknown, emptyLabel: string): string {
  if (value === null || value === undefined || value === "") return emptyLabel;
  return String(value);
}

const CategoryMedicalTable = (props: Props) => {
  const nursing = useContext(NursingContext);
  const currentStatus = useContext(NursingPatientStatusContext);
  if (!nursing) return <MedicalTable {...props} />;
  const columns = props.columns.map((col) =>
    col.key === "patientType" ? { ...col, label: "PATIENT STATUS" } : col,
  );
  if (!columns.some(col => col.key === "patientType")) columns.splice(Math.min(2,columns.length),0,{key:"patientType",label:"PATIENT STATUS"});
  if (["PUSHING & BIRTHING DETAILS","DELIVERY OF PLACENTA"].includes(props.title) && !columns.some(col => col.key === "additional")) columns.push({key:"additional",label:"ADDITIONAL(S)"});
  const displayRows = props.rows.map((row) => nursingDisplayRow(row, currentStatus));
  if (displayRows.some((row) => row.patientCategory) && !columns.some((col) => col.key === "patientCategory"))
    columns.push({ key: "patientCategory", label: "PATIENT TYPE" });
  if (
    displayRows.some((row) => row.bookingStatus) &&
    !columns.some((col) => col.key === "bookingStatus")
  )
    columns.push({ key: "bookingStatus", label: "BOOKING STATUS" });
  if (props.title === "DELIVERY NOTE DETAILS") {
    const extra = {
      patientType: "PATIENT STATUS",
      ega: "E.G.A",
      babyLength: "BABY LENGTH",
      headCircumference: "HEAD CIRCUMFERENCE",
      babyCondition: "BABY CONDITION",
      babyGender: "BABY GENDER",
      babyImmunization: "IMMUNIZATION",
      motherCondition: "MOTHER CONDITION",
      anyComplication: "COMPLICATIONS",
      clinician: "CLINICIAN",
      physicalExam: "PHYSICAL EXAMINATION",
      additional: "ADDITIONAL(S)",
    };
    Object.entries(extra).forEach(([key, label]) => {
      if (!columns.some((column) => column.key === key))
        columns.push({ key, label });
    });
  }
  const amountColumn = columns.find((col) =>
    ["amount", "price", "lineTotal"].includes(col.key),
  );
  const groups = groupNursingRows(displayRows);
  return (
    <div className="space-y-5">
      {amountColumn && props.rows.length > 0 && (
        <p className="text-right text-sm font-semibold text-[#573FD1]">
          Overall Total:{" "}
          {props.rows
            .reduce(
              (total, row) => total + moneyValue(row[amountColumn.key]),
              0,
            )
            .toLocaleString("en-NG", { style: "currency", currency: "NGN" })}
        </p>
      )}
      {groups.length ? (
        groups.map(([month, rows]) => (
          <MedicalTable
            key={month}
            {...props}
            title={`${props.title} — ${month}`}
            columns={columns}
            rows={rows}
          />
        ))
      ) : (
        <MedicalTable {...props} columns={columns} />
      )}
    </div>
  );
};
export default CategoryMedicalTable;
