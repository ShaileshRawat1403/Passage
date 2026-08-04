import { create } from "zustand";

interface LayoutStore {
  // Left Sidebar
  sidebarWidth: number;
  isSidebarOpen: boolean;
  setSidebarWidth: (width: number) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;

  // Right Inspector
  inspectorWidth: number;
  isInspectorOpen: boolean;
  setInspectorWidth: (width: number) => void;
  toggleInspector: () => void;
  setInspectorOpen: (open: boolean) => void;

  // Reset defaults
  resetWidths: () => void;
}

export const useLayoutStore = create<LayoutStore>((set) => ({
  sidebarWidth: 260,
  isSidebarOpen: true,
  setSidebarWidth: (width) => set({ sidebarWidth: Math.max(180, Math.min(480, width)) }),
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setSidebarOpen: (open) => set({ isSidebarOpen: open }),

  inspectorWidth: 320,
  isInspectorOpen: true,
  setInspectorWidth: (width) => set({ inspectorWidth: Math.max(240, Math.min(600, width)) }),
  toggleInspector: () => set((state) => ({ isInspectorOpen: !state.isInspectorOpen })),
  setInspectorOpen: (open) => set({ isInspectorOpen: open }),

  resetWidths: () => set({ sidebarWidth: 260, inspectorWidth: 320 }),
}));
