import React, { useEffect } from "react";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { WorkflowCanvas } from "../canvas/WorkflowCanvas";
import { WorkflowDiagnosticsPanel } from "../inspector/WorkflowDiagnosticsPanel";
import { SimulationBar } from "../runtime/SimulationBar";
import { RunTimeline } from "../runtime/RunTimeline";
import { HomeView } from "../views/HomeView";
import { WorkflowListView } from "../views/WorkflowListView";
import { ActivityView } from "../views/ActivityView";
import { ConnectionsView } from "../views/ConnectionsView";
import { ComponentsView } from "../views/ComponentsView";
import { SettingsView } from "../views/SettingsView";
import { useWorkflowStore } from "../../store/workflowStore";
import { useThemeStore, THEMES } from "../../store/themeStore";

export const MainLayout: React.FC = () => {
  const { activeTab, hydrateFromDurableStore } = useWorkflowStore();
  const { currentThemeId } = useThemeStore();

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", currentThemeId);
  }, [currentThemeId]);

  useEffect(() => {
    hydrateFromDurableStore();
  }, [hydrateFromDurableStore]);

  const activeTheme = THEMES.find((t) => t.id === currentThemeId) || THEMES[0];

  return (
    <div
      className="flex flex-col h-screen w-screen overflow-hidden relative select-none font-sans transition-colors duration-300"
      style={{
        backgroundColor: "var(--app-bg)",
        color: "var(--text-main)",
      }}
    >
      {/* Dynamic Theme Background Ambient Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div
          className="absolute -top-[10%] -left-[5%] w-[50%] h-[50%] rounded-full blur-[140px] opacity-20 transition-all duration-500"
          style={{ backgroundColor: activeTheme?.colors.primary || "#38bdf8" }}
        />
        <div
          className="absolute bottom-[10%] -right-[5%] w-[45%] h-[45%] rounded-full blur-[140px] opacity-20 transition-all duration-500"
          style={{ backgroundColor: activeTheme?.colors.secondary || "#818cf8" }}
        />
        <div className="absolute inset-0 bg-grid-pattern opacity-60" />
      </div>

      {/* Header */}
      <Header />

      {/* Main Workspace Area */}
      <div className="flex-1 flex overflow-hidden relative z-10">
        {activeTab === "home" && (
          <div className="flex-1 overflow-y-auto bg-transparent">
            <HomeView />
          </div>
        )}

        {activeTab === "designer" && (
          <>
            <Sidebar />
            <div className="flex-1 flex flex-col h-full relative">
              <SimulationBar />
              <div className="flex-1 relative">
                <WorkflowCanvas />
              </div>
            </div>
            <WorkflowDiagnosticsPanel />
          </>
        )}

        {activeTab === "runs" && (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            <SimulationBar />
            <div className="flex-1 overflow-y-auto bg-transparent">
              <RunTimeline />
            </div>
          </div>
        )}

        {activeTab === "workflows" && (
          <div className="flex-1 overflow-y-auto bg-transparent">
            <WorkflowListView />
          </div>
        )}

        {activeTab === "activity" && (
          <div className="flex-1 overflow-y-auto bg-transparent">
            <ActivityView />
          </div>
        )}

        {activeTab === "connections" && (
          <div className="flex-1 overflow-y-auto bg-transparent">
            <ConnectionsView />
          </div>
        )}

        {activeTab === "components" && (
          <div className="flex-1 overflow-y-auto bg-transparent">
            <ComponentsView />
          </div>
        )}

        {activeTab === "settings" && (
          <div className="flex-1 overflow-y-auto bg-transparent">
            <SettingsView />
          </div>
        )}
      </div>

      {/* Clean Status Bar */}
      <footer className="h-8 border-t border-white/10 bg-black/60 backdrop-blur-xl px-5 flex items-center justify-between z-30 text-[10px] font-mono text-slate-400 tracking-wider shrink-0">
        <div className="flex items-center gap-4">
          <span className="text-cyan-400 font-bold uppercase tracking-widest">PASSAGE v0.1.0-alpha</span>
          <span className="text-slate-600">|</span>
          <div className="flex items-center gap-1.5 text-emerald-400 uppercase text-[9px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
            Local Simulation Runtime
          </div>
        </div>

        <div className="flex items-center gap-5 text-[9px] text-slate-400 font-mono">
          <span>Human-readable workflow orchestration</span>
          <span className="text-slate-600">|</span>
          <span className="text-cyan-400/80">Deterministic Engine</span>
        </div>
      </footer>
    </div>
  );
};
