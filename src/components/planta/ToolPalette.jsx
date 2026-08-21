import { ElectricalSymbol, TOOL_TYPES, CATEGORY_LABELS, CATEGORY_STYLES } from "./ElectricalSymbols";

export default function ToolPalette({ activeTool, onSelect }) {
  const categories = [...new Set(TOOL_TYPES.map(t => t.category))];

  return (
    <div className="flex flex-col gap-3 h-full overflow-y-auto">
      {categories.map(cat => (
        <div key={cat}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1 mb-1.5">
            {CATEGORY_LABELS[cat]}
          </p>
          <div className="flex flex-col gap-0.5">
            {TOOL_TYPES.filter(t => t.category === cat).map(tool => {
              const style = CATEGORY_STYLES[tool.category] || {};
              const active = activeTool === tool.id;
              return (
                <button
                  key={tool.id}
                  onClick={() => onSelect(tool.id)}
                  className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs transition-all"
                  style={{
                    borderColor: active ? style.color : "transparent",
                    backgroundColor: active ? style.surface : undefined,
                    color: active ? style.text : undefined,
                    boxShadow: active ? "0 1px 3px rgba(15,23,42,0.10)" : undefined,
                  }}
                  onMouseEnter={(event) => {
                    if (active) return;
                    event.currentTarget.style.borderColor = style.border || "#B7D7EA";
                    event.currentTarget.style.backgroundColor = style.surface || "";
                  }}
                  onMouseLeave={(event) => {
                    if (active) return;
                    event.currentTarget.style.borderColor = "transparent";
                    event.currentTarget.style.backgroundColor = "";
                  }}
                >
                  <ElectricalSymbol type={tool.id} size={22} color={tool.color} />
                  <span className="truncate">{tool.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
