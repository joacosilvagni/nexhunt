import { create } from 'zustand'
import type { Finding, ScanJob } from '@/types'

const MAX_OUTPUT_LINES = 2000

interface ScannerState {
  findings: Finding[]
  scanJobs: ScanJob[]
  rawOutput: Record<string, string[]>   // tool -> lines
  activeScans: Set<string>              // tools currently running
  addFinding: (finding: Finding) => void
  setFindings: (findings: Finding[]) => void
  updateScanJob: (job: ScanJob) => void
  setScanJobs: (jobs: ScanJob[]) => void
  appendToolOutput: (tool: string, line: string) => void
  setScanRunning: (tool: string, running: boolean) => void
  clearFindings: () => void
}

export const useScannerStore = create<ScannerState>((set) => ({
  findings: [],
  scanJobs: [],
  rawOutput: {},
  activeScans: new Set<string>(),
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
  appendToolOutput: (tool, line) => set((state) => {
    const prev = state.rawOutput[tool] ?? []
    const next = [...prev, line]
    return { rawOutput: { ...state.rawOutput, [tool]: next.slice(-MAX_OUTPUT_LINES) } }
  }),
  setScanRunning: (tool, running) => set((state) => {
    const next = new Set(state.activeScans)
    running ? next.add(tool) : next.delete(tool)
    return { activeScans: next }
  }),
  clearFindings: () => set({ findings: [], scanJobs: [], rawOutput: {}, activeScans: new Set() })
}))
