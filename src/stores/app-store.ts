import { create } from 'zustand'

interface AppState {
  backendConnected: boolean
  wsConnected: boolean
  activeProject: string | null
  sidebarCollapsed: boolean
  setBackendConnected: (connected: boolean) => void
  setWsConnected: (connected: boolean) => void
  setActiveProject: (projectId: string | null) => void
  toggleSidebar: () => void
}

export const useAppStore = create<AppState>((set) => ({
  backendConnected: false,
  wsConnected: false,
  activeProject: null,
  sidebarCollapsed: false,
  setBackendConnected: (connected) => set({ backendConnected: connected }),
  setWsConnected: (connected) => set({ wsConnected: connected }),
  setActiveProject: (projectId) => set({ activeProject: projectId }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }))
}))
