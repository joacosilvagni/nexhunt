import { create } from 'zustand'
import type { HttpFlow } from '@/types'

interface ProxyState {
  flows: HttpFlow[]
  selectedFlowId: string | null
  interceptEnabled: boolean
  interceptQueue: HttpFlow[]
  proxyPort: number
  proxyRunning: boolean
  filter: {
    host: string
    method: string
    statusCode: string
    search: string
  }
  addFlow: (flow: HttpFlow) => void
  setFlows: (flows: HttpFlow[]) => void
  selectFlow: (id: string | null) => void
  setInterceptEnabled: (enabled: boolean) => void
  addToInterceptQueue: (flow: HttpFlow) => void
  removeFromInterceptQueue: (id: string) => void
  setProxyPort: (port: number) => void
  setProxyRunning: (running: boolean) => void
  setFilter: (filter: Partial<ProxyState['filter']>) => void
  clearFlows: () => void
}

export const useProxyStore = create<ProxyState>((set) => ({
  flows: [],
  selectedFlowId: null,
  interceptEnabled: false,
  interceptQueue: [],
  proxyPort: 8080,
  proxyRunning: false,
  filter: {
    host: '',
    method: '',
    statusCode: '',
    search: ''
  },
  addFlow: (flow) => set((state) => ({
    flows: [flow, ...state.flows].slice(0, 10000) // Keep max 10k flows in memory
  })),
  setFlows: (flows) => set({ flows }),
  selectFlow: (id) => set({ selectedFlowId: id }),
  setInterceptEnabled: (enabled) => set({ interceptEnabled: enabled }),
  addToInterceptQueue: (flow) => set((state) => ({
    interceptQueue: [...state.interceptQueue, flow]
  })),
  removeFromInterceptQueue: (id) => set((state) => ({
    interceptQueue: state.interceptQueue.filter(f => f.id !== id)
  })),
  setProxyPort: (port) => set({ proxyPort: port }),
  setProxyRunning: (running) => set({ proxyRunning: running }),
  setFilter: (filter) => set((state) => ({
    filter: { ...state.filter, ...filter }
  })),
  clearFlows: () => set({ flows: [], selectedFlowId: null })
}))
