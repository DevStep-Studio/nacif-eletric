import { useState } from "react";
import MaterialSymbol from "@/components/MaterialSymbol";
import { getMaterialProductInfo } from "@/lib/materialProductCatalog";

export default function MaterialProductThumb({
  material,
  name,
  size = "normal",
  className = "",
  showHoverZoom = true,
  alt,
}) {
  const [hasError, setHasError] = useState(false);
  const materialObj = typeof material === "object" && material !== null ? material : { name: name || material || "" };
  const info = getMaterialProductInfo(materialObj);

  const sizeClasses = {
    tiny: "h-8 w-8 min-w-8 rounded-lg p-1",
    small: "h-10 w-10 min-w-10 rounded-xl p-1",
    compact: "h-12 w-12 min-w-12 rounded-xl p-1.5",
    normal: "h-16 w-16 min-w-16 sm:h-[72px] sm:w-[72px] sm:min-w-[72px] rounded-2xl p-1.5",
    expanded: "h-28 w-28 min-w-28 sm:h-[118px] sm:w-[118px] sm:min-w-[118px] rounded-2xl p-2",
  };

  const selectedSizeClass = sizeClasses[size] || sizeClasses.normal;

  if (hasError || !info.imageUrl) {
    return (
      <div className={`relative flex shrink-0 items-center justify-center overflow-hidden border border-[#e2e8f0] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] ${selectedSizeClass} ${className}`}>
        <MaterialSymbol name={info.name} className="h-full w-full rounded-none border-0 bg-transparent" />
      </div>
    );
  }

  return (
    <div
      className={`group/thumb relative flex shrink-0 items-center justify-center overflow-hidden border border-[#e2e8f0] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-all duration-200 hover:border-[#cbd5e1] hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] ${selectedSizeClass} ${className}`}
      title={`${info.name} · ${info.brand}`}
    >
      <img
        src={info.imageUrl}
        alt={alt || info.name}
        loading="lazy"
        decoding="async"
        onError={() => setHasError(true)}
        className={`h-full w-full object-contain ${
          showHoverZoom ? "transition-transform duration-200 ease-out group-hover/thumb:scale-105" : ""
        }`}
      />
    </div>
  );
}
