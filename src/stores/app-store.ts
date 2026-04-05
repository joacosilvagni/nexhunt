import { create } from 'zustand'
import type { Project } from '@/types'

interface AppState {
  backendConnected: boolean
  wsConnected: boolean
  activeProject: string | null
  activeProjectData: Project | null
  sidebarCollapsed: boolean
  globalTarget: string
  setBackendConnected: (connected: boolean) => void
  setWsConnected: (connected: boolean) => void
  setActiveProject: (projectId: string | null) => void
  setActiveProjectData: (project: Project | null) => void
  toggleSidebar: () => void
  getActiveScope: () => string[]
  setGlobalTarget: (target: string) => void
}

export const useAppStore = create<AppState>((set, get) => ({
  backendConnected: false,
  wsConnected: false,
  activeProject: null,
  activeProjectData: null,
  sidebarCollapsed: false,
  globalTarget: '',
  setBackendConnected: (connected) => set({ backendConnected: connected }),
  setWsConnected: (connected) => set({ wsConnected: connected }),
  setActiveProject: (projectId) => set({ activeProject: projectId }),
  setActiveProjectData: (project) => set({ activeProjectData: project }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  getActiveScope: () => get().activeProjectData?.scope ?? [],
  setGlobalTarget: (target) => set({ globalTarget: target }),
}))
