import { moneyValue } from "../lib/monthlyRecords";
import { useMedicalTable } from "@/pages/doctor/patientProfile/hooks/useMedicalTable";
import CategoryMedicalTable from "@/pages/doctor/patientProfile/components/category/CategoryMedicalTable";
import { flattenPrescriptions, medicationDescription } from "../lib/medicationDisplay";
export default function DispenseHistory({
  pharmacy = false,
}: {
  pharmacy?: boolean;
}) {
  const { history } = useMedicalTable(
    pharmacy ? "PHARMACY DISPENSE" : "NURSING DISPENSES",
  );
  return (
    <CategoryMedicalTable
      title={
        pharmacy ? "Pharmacy Dispense Details" : "Nursing Dispense Details"
      }
      columns={[
        { key: "sn", label: "S/N" },
        { key: "dateTime", label: "Date | Time" },
        { key: "patientType", label: "Patient Status" },
        { key: "medication", label: "Medication" },
        { key: "quantity", label: "Qty" },
        { key: "amount", label: "Amount" },
        ...(!pharmacy ? [{ key: "remark", label: "Remark" }] : []),
        { key: "dispensedBy", label: "Dispensed By" },
      ]}
      wrapColumns={["medication"]}
      rows={flattenPrescriptions(history).map((row) => ({
        ...row,
        medication: medicationDescription(row),
        amount: moneyValue(row.lineTotal ?? row.amount).toLocaleString(
          "en-NG",
          { style: "currency", currency: "NGN" },
        ),
        remark: row.remark ?? row.notes,
        dispensedBy: row.dispensedBy ?? row.nurse,
      }))}
    />
  );
}
