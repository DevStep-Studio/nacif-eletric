import { getMaterialKind, getMaterialSymbolSvg, getMaterialSymbolDataUri } from "../lib/materialSymbolUtils.js";

export { getMaterialKind, getMaterialSymbolSvg, getMaterialSymbolDataUri };

export default function MaterialSymbol({ name = "", className = "" }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#CDEFE8] bg-white ${className}`}
      dangerouslySetInnerHTML={{ __html: getMaterialSymbolSvg(name) }}
      aria-hidden="true"
    />
  );
}
