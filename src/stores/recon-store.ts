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

export interface ScreenshotResult {
  url: string
  filename: string
  screenshot_url: string  // e.g. /screenshots/filename.jpeg
  path?: string
}

interface ReconState {
  subdomains: SubdomainResult[]
  urls: UrlResult[]
  ports: PortResult[]
  liveHosts: LiveHostResult[]
  screenshots: ScreenshotResult[]
  screenshotRunning: boolean
  screenshotProgress: { done: number; total: number }
  activeJobs: ScanJob[]
  addSubdomains: (results: SubdomainResult[]) => void
  addUrls: (results: UrlResult[]) => void
  addPorts: (results: PortResult[]) => void
  addLiveHosts: (results: LiveHostResult[]) => void
  addScreenshots: (results: ScreenshotResult[]) => void
  setScreenshotRunning: (running: boolean, progress?: { done: number; total: number }) => void
  updateJob: (job: ScanJob) => void
  clearRecon: () => void
}

export const useReconStore = create<ReconState>((set) => ({
  subdomains: [],
  urls: [],
  ports: [],
  liveHosts: [],
  screenshots: [],
  screenshotRunning: false,
  screenshotProgress: { done: 0, total: 0 },
  activeJobs: [],
  addSubdomains: (results) => set((state) => ({
    subdomains: [
      ...state.subdomains,
      ...results.filter(r => !state.subdomains.some(s => s.subdomain === r.subdomain))
    ]
  })),
  addUrls: (results) => set((state) => ({ urls: [...state.urls, ...results] })),
  addPorts: (results) => set((state) => ({ ports: [...state.ports, ...results] })),
  addLiveHosts: (results) => set((state) => ({
    liveHosts: [
      ...state.liveHosts,
      ...results.filter(r => !state.liveHosts.some(h => h.url === r.url))
    ]
  })),
  addScreenshots: (results) => set((state) => ({
    screenshots: [
      ...state.screenshots,
      ...results.filter(r => !state.screenshots.some(s => s.url === r.url))
    ]
  })),
  setScreenshotRunning: (running, progress) => set((state) => ({
    screenshotRunning: running,
    screenshotProgress: progress ?? state.screenshotProgress,
  })),
  updateJob: (job) => set((state) => ({
    activeJobs: state.activeJobs.some(j => j.id === job.id)
      ? state.activeJobs.map(j => j.id === job.id ? job : j)
      : [...state.activeJobs, job]
  })),
  clearRecon: () => set({ subdomains: [], urls: [], ports: [], liveHosts: [], screenshots: [], activeJobs: [] })
}))
