import { useEffect, useRef } from "react";
import flatpickr from "flatpickr";
import "flatpickr/dist/flatpickr.css";
import Label from "./Label";
import { CalenderIcon } from "../../icons";
import Hook = flatpickr.Options.Hook;
import DateOption = flatpickr.Options.DateOption;

type PropsType = {
  id: string;
  mode?: "single" | "multiple" | "range" | "time";
  onChange?: Hook | Hook[];
  defaultDate?: DateOption;
  value?: string;
  label?: string;
  placeholder?: string;
  maxDate?: string;
  minDate?: string;
};

export default function DatePicker({
  id,
  mode,
  onChange,
  label,
  defaultDate,
  value,
  placeholder,
  maxDate,
  minDate,
}: PropsType) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<flatpickr.Instance | null>(null);

  useEffect(() => {
    if (!inputRef.current) return;

    pickerRef.current = flatpickr(inputRef.current, {
      mode: mode || "single",
      static: true,
      monthSelectorType: "static",
      dateFormat: "Y-m-d",
      defaultDate: value || defaultDate,
      maxDate,
      minDate,
      onChange,
    });

    return () => {
      pickerRef.current?.destroy();
      pickerRef.current = null;
    };
    // Init once; value updates are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!pickerRef.current || value === undefined) return;
    pickerRef.current.setDate(value, false);
  }, [value]);

  useEffect(() => {
    if (!pickerRef.current) return;
    pickerRef.current.set("maxDate", maxDate ?? null);
    pickerRef.current.set("minDate", minDate ?? null);
  }, [maxDate, minDate]);

  return (
    <div>
      {label && <Label htmlFor={id}>{label}</Label>}

      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          placeholder={placeholder}
          className="h-11 w-full rounded-lg border appearance-none px-4 py-2.5 pr-11 text-sm shadow-theme-xs placeholder:text-gray-400 focus:outline-hidden focus:ring-3 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 bg-transparent text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20 dark:border-gray-700 dark:focus:border-brand-800"
        />

        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">
          <CalenderIcon className="size-6" />
        </span>
      </div>
    </div>
  );
}
