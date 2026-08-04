import React, { useState, useRef, useEffect } from "react";
import { Palette, Check, Sun, Moon, Sparkles } from "lucide-react";
import { useThemeStore, THEMES, ThemeId } from "../../store/themeStore";

export const ThemeSelector: React.FC = () => {
  const { currentThemeId, setTheme } = useThemeStore();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeTheme = THEMES.find((t) => t.id === currentThemeId) || THEMES[0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 font-mono text-xs font-semibold flex items-center gap-2 transition-all hover:border-cyan-500/40 cursor-pointer"
        title="Toggle Theme / Skin"
      >
        <Palette className="w-3.5 h-3.5 text-cyan-400" />
        <span className="hidden sm:inline font-mono">{activeTheme.name}</span>
        <div
          className="w-2.5 h-2.5 rounded-full border border-white/30"
          style={{ backgroundColor: activeTheme.colors.primary }}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-[#0a101d] border border-cyan-500/30 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.8)] backdrop-blur-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-cyan-400 font-mono text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Theme Skins ({THEMES.length})</span>
            </div>
            <span className="text-[10px] font-mono text-slate-400">Press Esc to close</span>
          </div>

          <div className="py-1.5 space-y-1">
            {THEMES.map((theme) => {
              const isSelected = theme.id === currentThemeId;
              return (
                <button
                  key={theme.id}
                  onClick={() => {
                    setTheme(theme.id);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between group transition-all cursor-pointer ${
                    isSelected
                      ? "bg-cyan-500/15 border border-cyan-500/40 text-white shadow-[0_0_12px_rgba(34,211,238,0.15)]"
                      : "hover:bg-white/5 border border-transparent text-slate-300 hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Swatch preview */}
                    <div className="flex items-center -space-x-1 shrink-0">
                      <div
                        className="w-3.5 h-3.5 rounded-full border border-black/40 shadow-xs"
                        style={{ backgroundColor: theme.colors.primary }}
                      />
                      <div
                        className="w-3.5 h-3.5 rounded-full border border-black/40 shadow-xs"
                        style={{ backgroundColor: theme.colors.secondary }}
                      />
                      <div
                        className="w-3.5 h-3.5 rounded-full border border-black/40 shadow-xs"
                        style={{ backgroundColor: theme.colors.appBg }}
                      />
                    </div>

                    <div className="min-w-0 flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-bold tracking-wide truncate">
                          {theme.name}
                        </span>
                        {theme.isDark ? (
                          <Moon className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                        ) : (
                          <Sun className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                        )}
                      </div>
                      <span className="text-[9.5px] text-slate-400 font-sans truncate leading-tight">
                        {theme.tagline}
                      </span>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="w-4 h-4 rounded-full bg-cyan-400 text-slate-950 flex items-center justify-center shrink-0 ml-2">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
