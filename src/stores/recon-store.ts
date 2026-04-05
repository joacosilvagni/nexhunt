import { create } from 'zustand'
import type { SubdomainResult, UrlResult, PortResult, ScanJob } from '@/types'

export interface LiveHostResult {
  url: string
  host: string
  status_code: number | null
  title: string
  technologies: string[]
  content_type: string
  ip: string
}

interface ReconState {
  subdomains: SubdomainResult[]
  urls: UrlResult[]
  ports: PortResult[]
  liveHosts: LiveHostResult[]
  activeJobs: ScanJob[]
  addSubdomains: (results: SubdomainResult[]) => void
  addUrls: (results: UrlResult[]) => void
  addPorts: (results: PortResult[]) => void
  addLiveHosts: (results: LiveHostResult[]) => void
  updateJob: (job: ScanJob) => void
  clearRecon: () => void
}

export const useReconStore = create<ReconState>((set) => ({
  subdomains: [],
  urls: [],
  ports: [],
  liveHosts: [],
  activeJobs: [],
  addSubdomains: (results) => set((state) => ({
    subdomains: [
      ...state.subdomains,
      ...results.filter(r => !state.subdomains.some(s => s.subdomain === r.subdomain))
    ]
  })),
  addUrls: (results) => set((state) => ({
    urls: [...state.urls, ...results]
  })),
  addPorts: (results) => set((state) => ({
    ports: [...state.ports, ...results]
  })),
  addLiveHosts: (results) => set((state) => ({
    liveHosts: [
      ...state.liveHosts,
      ...results.filter(r => !state.liveHosts.some(h => h.url === r.url))
    ]
  })),
  updateJob: (job) => set((state) => ({
    activeJobs: state.activeJobs.some(j => j.id === job.id)
      ? state.activeJobs.map(j => j.id === job.id ? job : j)
      : [...state.activeJobs, job]
  })),
  clearRecon: () => set({ subdomains: [], urls: [], ports: [], liveHosts: [], activeJobs: [] })
}))
