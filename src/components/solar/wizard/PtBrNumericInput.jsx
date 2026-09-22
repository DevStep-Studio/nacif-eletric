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
        className={`h-11 font-medium transition ${
          suffix ? "pr-14" : ""
        } ${
          error ? "border-amber-400 focus-visible:ring-amber-400" : ""
        } ${className}`}
      />
      {suffix && (
        <span className="pointer-events-none absolute right-3 text-xs font-bold text-muted-foreground select-none">
          {suffix}
        </span>
      )}
    </div>
  );
}
