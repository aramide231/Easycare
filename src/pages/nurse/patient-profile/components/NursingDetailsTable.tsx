import type { ReactNode } from "react";
import { groupNursingRows, type Row } from "../lib/monthlyRecords";

export type NursingDetailColumn = {
  key: string;
  label: string;
  className?: string;
  render?: (row: Row, index: number) => ReactNode;
};

type Props = {
  title: string;
  columns: NursingDetailColumn[];
  rows: Row[];
  total?: string;
  minWidth?: string;
  emptyMessage?: string;
};

/** Nursing reference design: compact unstriped rows within one outlined details panel. */
export default function NursingDetailsTable({
  title, columns, rows, total, minWidth = "min-w-[720px]",
  emptyMessage = "No records documented yet.",
}: Props) {
  const groups = groupNursingRows(rows);
  const renderTable = (items: Row[]) => (
    <div className="max-w-full overflow-x-auto overscroll-x-contain pb-1" tabIndex={0} role="region" aria-label={`${title} table`}>
      <table className={`w-full border-separate border-spacing-0 text-left text-[11px] leading-5 text-black ${minWidth}`}>
        <thead>
          <tr>{columns.map((column) => (
            <th key={column.key} scope="col" className={`whitespace-nowrap px-2 py-2 font-normal ${column.className ?? ""}`}>
              {column.label}
            </th>
          ))}</tr>
        </thead>
        <tbody>
          {items.length ? items.map((row, index) => (
            <tr key={String(row.prescriptionKey ?? row.id ?? row.sn ?? index)}>
              {columns.map((column) => (
                <td key={column.key} className={`px-2 py-1.5 align-middle ${column.className ?? "whitespace-nowrap"}`}>
                  {column.render ? column.render(row, index) : String(row[column.key] ?? "—")}
                </td>
              ))}
            </tr>
          )) : <tr><td colSpan={columns.length} className="px-2 py-6 text-center text-gray-500">{emptyMessage}</td></tr>}
        </tbody>
      </table>
    </div>
  );
  return (
    <section className="min-w-0 w-full border border-[#262626] bg-white px-1 py-1.5" aria-label={title}>
      <div className="flex flex-wrap items-start justify-between gap-2 px-1 pb-1">
        <h3 className="text-[11px] font-semibold uppercase leading-5 text-black">{title}</h3>
        {total !== undefined && <p className="pr-2 text-[11px] font-semibold leading-5 text-[#71349a]">Overall Total: {total}</p>}
      </div>
      {groups.length ? groups.map(([month, items]) => (
        <div key={month}>
          <h4 className="px-2 pt-2 text-[10px] font-medium text-[#71349a]">{month}</h4>
          {renderTable(items)}
        </div>
      )) : renderTable([])}
    </section>
  );
}
