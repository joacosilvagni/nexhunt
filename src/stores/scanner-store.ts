import { create } from 'zustand'
import type { Finding, ScanJob } from '@/types'

interface ScannerState {
  findings: Finding[]
  scanJobs: ScanJob[]
  addFinding: (finding: Finding) => void
  setFindings: (findings: Finding[]) => void
  updateScanJob: (job: ScanJob) => void
  setScanJobs: (jobs: ScanJob[]) => void
  clearFindings: () => void
}

export const useScannerStore = create<ScannerState>((set) => ({
  findings: [],
  scanJobs: [],
  addFinding: (finding) => set((state) => ({
    findings: [finding, ...state.findings]
  })),
  setFindings: (findings) => set({ findings }),
  updateScanJob: (job) => set((state) => ({
    scanJobs: state.scanJobs.some(j => j.id === job.id)
      ? state.scanJobs.map(j => j.id === job.id ? job : j)
      : [...state.scanJobs, job]
  })),
  setScanJobs: (jobs) => set({ scanJobs: jobs }),
  clearFindings: () => set({ findings: [], scanJobs: [] })
}))
