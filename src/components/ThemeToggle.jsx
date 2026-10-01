import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/lib/ThemeContext";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function ThemeToggle({ className = "", compact = false }) {
  const { theme, toggleTheme, isDark } = useTheme();

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={isDark ? "Mudar para Modo Claro" : "Mudar para Modo Escuro"}
            className={`group relative flex items-center justify-center rounded-xl border border-[#E2E8F0] dark:border-[#1E293B] bg-[#F8FAFC] dark:bg-[#131D2E] text-[#64748B] dark:text-[#94A3B8] transition-all duration-200 hover:border-[#00d8b8] dark:hover:border-[#00d8b8] hover:bg-white dark:hover:bg-[#1E293B] hover:text-[#00d8b8] dark:hover:text-[#00d8b8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00d8b8] shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.3)] cursor-pointer ${
              compact ? "h-8 w-8" : "h-9 w-9"
            } ${className}`}
          >
            {isDark ? (
              <Moon className="h-4 w-4 transition-transform duration-300 group-hover:-rotate-12 group-hover:scale-110 text-[#00d8b8]" />
            ) : (
              <Sun className="h-4 w-4 transition-transform duration-300 group-hover:rotate-45 group-hover:scale-110 text-amber-500" />
            )}
            <span className="sr-only">
              {isDark ? "Ativar Modo Claro" : "Ativar Modo Escuro"}
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="center" className="rounded-lg text-xs font-bold bg-[#0F172A] text-white border-none py-1 px-2.5 shadow-xl">
          <p>{isDark ? "☀️ Modo Claro" : "🌙 Modo Escuro"}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
