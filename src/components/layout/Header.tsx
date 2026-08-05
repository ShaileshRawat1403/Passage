import React, { useState } from "react";
import {
  Home,
  Layers,
  Sparkles,
  Play,
  CheckCircle2,
  AlertTriangle,
  Activity,
  Plug,
  Package,
  Settings,
  List,
  PanelLeft,
  PanelRight,
  Menu,
  X,
} from "lucide-react";
import { useWorkflowStore, NavigationTab } from "../../store/workflowStore";
import { useLayoutStore } from "../../store/layoutStore";
import { DescribeWorkflowModal } from "../ai/DescribeWorkflowModal";
import { ThemeSelector } from "../theme/ThemeSelector";
import { getWorkflowReadiness } from "../../domain/readiness";

export const Header: React.FC = () => {
  const {
    workflows,
    activeWorkflowId,
    setActiveWorkflowId,
    activeTab,
    setActiveTab,
    startNewRun,
  } = useWorkflowStore();

  const {
    isSidebarOpen,
    toggleSidebar,
    isInspectorOpen,
    toggleInspector,
  } = useLayoutStore();

  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const activeWorkflow = workflows.find((w) => w.id === activeWorkflowId) || workflows[0];

  const navigationTabs = [
    { id: "home", label: "Home", icon: Home },
    { id: "designer", label: "Designer", icon: Layers },
    { id: "runs", label: "Runs", icon: Activity },
    { id: "workflows", label: "Workflows", icon: List },
    { id: "connections", label: "Connections", icon: Plug },
    { id: "components", label: "Components", icon: Package },
    { id: "settings", label: "Governance", icon: Settings },
  ];

  return (
    <>
      <header className="h-14 bg-black/40 backdrop-blur-xl border-b border-white/10 px-3 sm:px-6 flex items-center justify-between text-xs select-none z-30 relative gap-2">
        {/* Brand, Drawer Toggles & Workflow Selector */}
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          {/* Drawer Toggle Controls (Designer tab only) */}
          {activeTab === "designer" && (
            <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg border border-white/10">
              <button
                onClick={toggleSidebar}
                className={`p-1.5 rounded transition-all cursor-pointer ${
                  isSidebarOpen
                    ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40"
                    : "text-slate-400 hover:text-slate-100"
                }`}
                title="Toggle Left State Palette Drawer"
              >
                <PanelLeft className="w-4 h-4" />
              </button>
              <button
                onClick={toggleInspector}
                className={`p-1.5 rounded transition-all cursor-pointer ${
                  isInspectorOpen
                    ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40"
                    : "text-slate-400 hover:text-slate-100"
                }`}
                title="Toggle Right State Inspector Drawer"
              >
                <PanelRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Passage Brand Logo */}
          <button
            onClick={() => setActiveTab("home")}
            className="flex items-center gap-2 shrink-0 cursor-pointer group text-left rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            title="Return to Passage Home"
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 border border-cyan-400/40 rounded-xl bg-cyan-500/10 flex items-center justify-center shadow-[0_0_15px_rgba(var(--primary-rgb),0.25)] group-hover:border-cyan-400 transition-colors shrink-0">
              <Layers className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />
            </div>
            <div className="hidden md:flex flex-col">
              <div className="flex items-center gap-1.5 leading-none">
                <span className="font-black tracking-[0.2em] text-sm text-white font-mono uppercase drop-shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)] group-hover:text-cyan-300 transition-colors">
                  PASSAGE
                </span>
              </div>
              <p className="text-[9px] text-slate-400 tracking-wider font-mono mt-0.5">
                Human-readable workflow orchestration
              </p>
            </div>
          </button>

          {/* Workflow Picker - Hidden on Home */}
          {activeTab !== "home" && (
            <>
              <div className="hidden lg:block h-5 w-px bg-white/10 shrink-0" />
              <select
                value={activeWorkflowId}
                onChange={(e) => setActiveWorkflowId(e.target.value)}
                className="bg-white/5 border border-white/10 hover:border-cyan-500/50 text-slate-200 font-semibold text-xs px-2.5 py-1.5 rounded-lg outline-none font-mono focus:border-cyan-400 transition-colors max-w-[140px] sm:max-w-[200px] truncate cursor-pointer"
              >
                {workflows.map((wf) => (
                  <option key={wf.id} value={wf.id} className="bg-[#020617] text-slate-200">
                    {wf.name} (v{wf.version})
                  </option>
                ))}
              </select>
            </>
          )}
        </div>

        {/* Main Navigation Tabs - Desktop */}
        <div className="hidden md:flex items-center bg-white/5 p-1 rounded-xl border border-white/10 backdrop-blur-sm max-w-full overflow-x-auto no-scrollbar">
          {navigationTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as NavigationTab)}
                className={`px-2.5 sm:px-3 py-1 rounded-lg font-mono text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/40 shadow-[0_0_12px_rgba(var(--primary-rgb),0.2)]"
                    : "text-slate-400 hover:text-slate-100"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Action Controls & Validation Status */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Theme Selector */}
          <div className="hidden sm:block">
            <ThemeSelector />
          </div>

          {/* Lifecycle Status Pill - Hidden on Home */}
          {activeTab !== "home" && activeWorkflow && (
            <div className="hidden lg:flex px-2 py-1 rounded-lg font-mono text-[10px] uppercase tracking-wider border items-center gap-1 bg-white/5 border-white/10 text-slate-300">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
              <span>Status: {activeWorkflow.status}</span>
            </div>
          )}

          {/* Derived Readiness Pill - Hidden on Home */}
          {activeTab !== "home" && activeWorkflow && (() => {
            const readiness = getWorkflowReadiness(activeWorkflow);
            const badgeStyles =
              readiness === "executable"
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                : readiness === "structurally_valid"
                ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                : "bg-rose-500/10 text-rose-400 border-rose-500/30";

            const label =
              readiness === "executable"
                ? "Executable"
                : readiness === "structurally_valid"
                ? "Structurally Valid"
                : "Incomplete Draft";

            return (
              <div
                className={`hidden xl:flex px-2.5 py-1 rounded-lg font-mono text-[10px] uppercase tracking-wider border items-center gap-1.5 ${badgeStyles}`}
                title={`Workflow Readiness: ${label}`}
              >
                {readiness === "executable" ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : readiness === "structurally_valid" ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                )}
                <span>{label}</span>
              </div>
            );
          })()}

          {/* AI Workflow Creator - Hidden on Home */}
          {activeTab !== "home" && (
            <button
              onClick={() => setIsAiModalOpen(true)}
              className="px-2.5 sm:px-3.5 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Describe (AI)</span>
            </button>
          )}

          {/* Run / Simulate - Hidden on Home */}
          {activeTab !== "home" && (
            <button
              onClick={() => {
                if (activeWorkflow) {
                  startNewRun(activeWorkflow.id);
                  setActiveTab("runs");
                }
              }}
              className="px-3 sm:px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)] transition-all cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-slate-950" />
              <span className="hidden sm:inline">Simulate Case</span>
            </button>
          )}

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:text-white cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Navigation Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-slate-950/95 border-b border-white/10 backdrop-blur-2xl p-4 space-y-2 z-40 relative font-mono text-xs">
          <div className="grid grid-cols-2 gap-2">
            {navigationTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id as NavigationTab);
                    setMobileMenuOpen(false);
                  }}
                  className={`p-2.5 rounded-xl font-semibold flex items-center gap-2 border transition-all cursor-pointer ${
                    isActive
                      ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/40"
                      : "bg-white/5 text-slate-300 border-white/10"
                  }`}
                >
                  <Icon className="w-4 h-4 text-cyan-400" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="pt-2 border-t border-white/10 flex items-center justify-between">
            <span className="text-slate-400">Theme Skin</span>
            <ThemeSelector />
          </div>
        </div>
      )}

      <DescribeWorkflowModal isOpen={isAiModalOpen} onClose={() => setIsAiModalOpen(false)} />
    </>
  );
};
