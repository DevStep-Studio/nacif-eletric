import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { parsePtBrFloat } from "@/lib/brFormatters";

/**
 * PtBrNumericInput.jsx — Input numérico otimizado para pt-BR (aceita vírgula e ponto com fluidez).
 */
export default function PtBrNumericInput({
  value,
  onChange,
  onBlur,
  min,
  max,
  suffix = "",
  placeholder = "",
  className = "",
  disabled = false,
  error = false,
}) {
  const [text, setText] = useState(() => {
    if (value === undefined || value === null || value === "") return "";
    return String(value).replace(".", ",");
  });

  useEffect(() => {
    if (value === undefined || value === null || value === "") {
      setText("");
      return;
    }
    const currentNum = parsePtBrFloat(text, null);
    const incomingNum = typeof value === "number" ? value : parsePtBrFloat(value, null);
    if (currentNum !== incomingNum) {
      setText(String(value).replace(".", ","));
    }
  }, [value]);

  const handleChange = (e) => {
    const raw = e.target.value;
    // Permite apenas números, uma única vírgula ou ponto
    const filtered = raw.replace(/[^0-9.,]/g, "");
    setText(filtered);

    const num = parsePtBrFloat(filtered, null);
    if (num !== null && Number.isFinite(num)) {
      onChange?.(num);
    } else if (filtered === "") {
      onChange?.("");
    }
  };

  const handleBlur = (e) => {
    const num = parsePtBrFloat(text, null);
    if (num !== null && Number.isFinite(num)) {
      let finalNum = num;
      if (min !== undefined && finalNum < min) finalNum = min;
      if (max !== undefined && finalNum > max) finalNum = max;
      setText(String(finalNum).replace(".", ","));
      onChange?.(finalNum);
    }
    onBlur?.(e);
  };

  return (
    <div className="relative flex items-center">
      <Input
        type="text"
        inputMode="decimal"
        placeholder={placeholder}
        value={text}
        disabled={disabled}
        onChange={handleChange}
        onBlur={handleBlur}
        className={`h-11 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 hover:border-slate-300 focus:border-[#00d8b8] focus:ring-2 focus:ring-[#00d8b8]/15 focus:outline-none transition-colors shadow-none ${
          suffix ? "pr-14" : ""
        } ${
          error ? "border-amber-400 focus:border-amber-400 focus:ring-amber-400/20" : ""
        } ${className}`}
      />
      {suffix && (
        <span className="pointer-events-none absolute right-3.5 text-xs font-bold text-slate-400 select-none">
          {suffix}
        </span>
      )}
    </div>
  );
}
