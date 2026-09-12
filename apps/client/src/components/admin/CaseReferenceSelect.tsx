import type { ReferenceOption } from "../../hooks/useCaseReferences";

type Props = {
  label: string;
  value: string;
  options: ReferenceOption[];
  onChange: (value: string) => void;
  emptyLabel?: string;
};

export function CaseReferenceSelect({ label, value, options, onChange, emptyLabel = "Select an option" }: Props) {
  const missing = value && !options.some((option) => option.value === value);
  return <label className="grid min-w-0 gap-1 text-[11px] font-bold">
    {label}
    <select className="h-9 w-full min-w-0 border border-[#9eabb3] bg-white px-2 text-xs font-normal" value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">{emptyLabel}</option>
      {missing && <option value={value} disabled>Missing reference: {value}</option>}
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  </label>;
}

export function CaseReferenceMultiSelect({ label, values, options, onChange }: {
  label: string;
  values: string[];
  options: ReferenceOption[];
  onChange: (values: string[]) => void;
}) {
  const allOptions = [...options, ...values.filter((value) => !options.some((option) => option.value === value)).map((value) => ({ value, label: `Missing reference: ${value}` }))];
  return <div className="min-w-0 text-[11px]">
    <div className="mb-1 font-bold">{label}</div>
    <details className="relative border border-[#9eabb3] bg-white">
      <summary className="flex min-h-9 cursor-pointer items-center px-2">{values.length ? `${values.length} selected` : "None selected"}</summary>
      <div className="absolute left-0 top-full z-20 max-h-56 w-full min-w-64 overflow-auto border border-[#9eabb3] bg-white p-2 shadow-md">
        {!allOptions.length && <p>No options available</p>}
        {allOptions.map((option) => <label key={option.value} className="flex items-start gap-2 py-1.5 break-words">
          <input type="checkbox" checked={values.includes(option.value)} onChange={(event) => onChange(event.target.checked ? [...values, option.value] : values.filter((value) => value !== option.value))} />
          {option.label}
        </label>)}
      </div>
    </details>
  </div>;
}
