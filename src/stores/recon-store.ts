import { create } from 'zustand'
import type { SubdomainResult, UrlResult, PortResult, ScanJob } from '@/types'

interface ReconState {
  subdomains: SubdomainResult[]
  urls: UrlResult[]
  ports: PortResult[]
  activeJobs: ScanJob[]
  addSubdomains: (results: SubdomainResult[]) => void
  addUrls: (results: UrlResult[]) => void
  addPorts: (results: PortResult[]) => void
  updateJob: (job: ScanJob) => void
  clearRecon: () => void
}

export const useReconStore = create<ReconState>((set) => ({
  subdomains: [],
  urls: [],
  ports: [],
  activeJobs: [],
  addSubdomains: (results) => set((state) => ({
    subdomains: [...state.subdomains, ...results]
  })),
  addUrls: (results) => set((state) => ({
    urls: [...state.urls, ...results]
  })),
  addPorts: (results) => set((state) => ({
    ports: [...state.ports, ...results]
  })),
  updateJob: (job) => set((state) => ({
    activeJobs: state.activeJobs.some(j => j.id === job.id)
      ? state.activeJobs.map(j => j.id === job.id ? job : j)
      : [...state.activeJobs, job]
  })),
  clearRecon: () => set({ subdomains: [], urls: [], ports: [], activeJobs: [] })
}))
