import { useCallback, useState } from "react";
import { useMedicalTable } from "@/pages/doctor/patientProfile/hooks/useMedicalTable";
import { usePendingCategoryDraft } from "@/pages/doctor/patientProfile/hooks/usePendingCategoryDraft";
import CategoryMedicalTable from "@/pages/doctor/patientProfile/components/category/CategoryMedicalTable";
import { dayOfLife } from "../lib/feedingChart";
const feedingTypes = [
  "Direct Breast Feeding (baby feeding straight from the breast)",
  "Mother’s Own Milk/Expressed Breast Milk (MOM or EBM)",
  "Pasteurized Donor Human Milk (PDHM/DBM)",
  "Fortified Breast Milk (FEBM)",
  "Infant Formula (commercial milk)",
  "Mixed Feeds (breast milk and formula)",
];
const methods = [
  "Oral / Suck (breastfeeding or bottle)",
  "Cup or Spoon Feeding (cup or syringe)",
  "Tube / Gavage Feeding (NGT or OGT)",
  "Parenteral Nutrition / IV Fluids",
];
const empty = {
  dob: "",
  birthWeight: "",
  currentWeight: "",
  feedingType: "",
  deliveryMethod: "",
  diapers: "",
  feedVolume: "",
  remarks: "",
};
const fields = [
  { key: "dob", label: "Date of Birth", type: "datetime-local" },
  { key: "birthWeight", label: "Birth Weight (kg)", type: "number" },
  { key: "currentWeight", label: "Current Weight (kg)", type: "number" },
  { key: "diapers", label: "Diapers", type: "number" },
  {
    key: "feedVolume",
    label: "Feed Volume/Duration",
    type: "text",
    placeholder: "mL or oz OR 15 mins left breast, 15 mins right breast",
  },
  {
    key: "remarks",
    label: "Remarks",
    type: "text",
    placeholder: "Spit-up, sleepiness, latch quality",
  },
] as const;
export default function FeedingChart() {
  const [form, setForm] = useState(empty);
  const [recordedAt, setRecordedAt] = useState(() => Date.now());
  const { history } = useMedicalTable("NURSING::FEEDING CHART");
  const clear = useCallback(() => {
    setForm(empty);
    setRecordedAt(Date.now());
  }, []);
  const age = dayOfLife(form.dob, new Date(recordedAt));
  const invalidDob = !!form.dob && !age;
  usePendingCategoryDraft(
    "NURSING::FEEDING CHART",
    (): Record<string, string> | null =>
      form.dob && age && form.feedingType && form.deliveryMethod
        ? { ...form, dayOfLife: age }
        : Object.values(form).some((value) => value.trim())
          ? { __incomplete__: "true" }
          : null,
    [form, age],
    clear,
  );
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {fields.map((field) => (
          <label key={field.key} className="text-sm font-medium">
            {field.label}
            <input
              className="mt-1 block w-full rounded-md border p-2.5"
              type={field.type}
              min={field.type === "number" ? "0" : undefined}
              step={field.type === "number" ? "any" : undefined}
              value={form[field.key]}
              placeholder={
                "placeholder" in field ? field.placeholder : undefined
              }
              onChange={(e) => {
                setRecordedAt(Date.now());
                setForm((prev) => ({ ...prev, [field.key]: e.target.value }));
              }}
            />
          </label>
        ))}
        <label className="text-sm font-medium">
          Day of Life
          <input
            readOnly
            value={age}
            className="mt-1 block w-full rounded-md border bg-gray-100 p-2.5"
            placeholder="Calculated from date of birth"
          />
        </label>
        {(
          [
            {
              key: "feedingType",
              label: "Type of Feeding",
              options: feedingTypes,
            },
            {
              key: "deliveryMethod",
              label: "Feeding Delivery Method",
              options: methods,
            },
          ] as const
        ).map((field) => (
          <label key={field.key} className="text-sm font-medium">
            {field.label}
            <select
              value={form[field.key]}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, [field.key]: e.target.value }))
              }
              className="mt-1 block w-full rounded-md border p-2.5"
            >
              <option value="">-- select an option --</option>
              {field.options.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
        ))}
      </div>
      {invalidDob && (
        <p role="alert" className="text-sm text-red-600">
          Date of birth must be a valid date in the past.
        </p>
      )}
      <CategoryMedicalTable
        title="Feeding Chart Details"
        columns={[
          { key: "sn", label: "S/N" },
          { key: "dateTime", label: "Date | Time" },
          { key: "patientType", label: "Patient Status" },
          ...fields.map((field) => ({ key: field.key, label: field.label })),
          { key: "dayOfLife", label: "Day of Life" },
          { key: "feedingType", label: "Type of Feeding" },
          { key: "deliveryMethod", label: "Feeding Delivery Method" },
          { key: "enteredBy", label: "Nurse" },
        ]}
        rows={history}
        wrapColumns={["feedVolume", "remarks", "feedingType", "deliveryMethod"]}
      />
    </div>
  );
}
