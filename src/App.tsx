import { HashRouter, Routes, Route } from 'react-router-dom'
import { useEffect } from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
import { DashboardPage } from '@/pages/DashboardPage'
import { ProxyPage } from '@/pages/ProxyPage'
import { ReconPage } from '@/pages/ReconPage'
import { ScannerPage } from '@/pages/ScannerPage'
import { ExploitPage } from '@/pages/ExploitPage'
import { CopilotPage } from '@/pages/CopilotPage'
import { ProjectsPage } from '@/pages/ProjectsPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { useAppStore } from '@/stores/app-store'
import { useProxyStore } from '@/stores/proxy-store'
import { useScannerStore } from '@/stores/scanner-store'
import { useReconStore } from '@/stores/recon-store'
import type { LiveHostResult } from '@/stores/recon-store'
import { usePipelineStore } from '@/stores/pipeline-store'
import { wsClient } from '@/api/ws-client'
import { api } from '@/api/http-client'
import { API_BASE } from '@/lib/constants'
import type { HttpFlow, Finding, SubdomainResult, Project, PipelineEvent } from '@/types'

function App() {
  const { setBackendConnected, activeProject, setActiveProjectData } = useAppStore()
  const { addFlow, setProxyRunning, addIntruderResult, setIntruderRunning } = useProxyStore()
  const { addFinding, appendToolOutput, setScanRunning } = useScannerStore()
  const { addSubdomains, addUrls, addLiveHosts, addPorts, addScreenshots, setScreenshotRunning } = useReconStore()
  const { handleEvent: handlePipelineEvent } = usePipelineStore()

  // Fetch active project data whenever activeProject changes
  useEffect(() => {
    if (!activeProject) {
      setActiveProjectData(null)
      return
    }
    api.get<Project>(`/api/projects/${activeProject}`)
      .then(data => setActiveProjectData(data))
      .catch(() => setActiveProjectData(null))
  }, [activeProject])

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/health`)
        setBackendConnected(res.ok)
      } catch {
        setBackendConnected(false)
      }
    }

    checkHealth()
    const healthInterval = setInterval(checkHealth, 5000)

    wsClient.connect()

    const unsubProxy = wsClient.subscribe('proxy_feed', (data) => {
      addFlow(data as HttpFlow)
    })

    const unsubFindings = wsClient.subscribe('findings', (data) => {
      addFinding(data as Finding)
    })

    const unsubRecon = wsClient.subscribe('recon_results', (data) => {
      const result = data as { tool: string; type: string; results: any[] }

      if (result.type === 'subdomain') {
        addSubdomains(result.results as SubdomainResult[])
      } else if (result.type === 'live_host') {
        addLiveHosts(result.results as LiveHostResult[])
      } else if (result.type === 'url') {
        addUrls(result.results)
      } else if (result.type === 'port') {
        addPorts(result.results)
      } else if (result.type === 'screenshot') {
        addScreenshots(result.results)
      }
    })

    const unsubStatus = wsClient.subscribe('tool_status', (data) => {
      const status = data as { tool: string; event: string; done?: number; total?: number }
      if (status.tool === 'proxy') {
        setProxyRunning(status.event === 'started')
      }
      if (status.tool === 'gowitness') {
        if (status.event === 'started') setScreenshotRunning(true, { done: 0, total: status.total ?? 0 })
        else if (status.event === 'progress') setScreenshotRunning(true, { done: status.done ?? 0, total: status.total ?? 0 })
        else if (status.event === 'completed' || status.event === 'failed') setScreenshotRunning(false)
      }
      // Track scanner tool running state via WS (HTTP response returns immediately)
      const scannerTools = ['nuclei', 'ffuf', 'nikto', 'gobuster', 'dirsearch']
      if (scannerTools.includes(status.tool)) {
        setScanRunning(status.tool, status.event === 'started')
      }
    })

    const unsubPipeline = wsClient.subscribe('pipeline', (data) => {
      handlePipelineEvent(data as PipelineEvent)
    })

    const unsubToolOutput = wsClient.subscribe('tool_output', (data) => {
      const d = data as { tool: string; line: string }
      if (d.tool && d.line) appendToolOutput(d.tool, d.line)
    })

    const unsubIntruder = wsClient.subscribe('intruder', (data) => {
      const d = data as { event: string; job_id: string; total?: number; index?: number; payload?: string; status?: number; length?: number; duration_ms?: number; error?: string | null }
      if (d.event === 'started') {
        setIntruderRunning(true, d.job_id, d.total)
      } else if (d.event === 'result') {
        addIntruderResult({ index: d.index!, payload: d.payload!, status: d.status!, length: d.length!, duration_ms: d.duration_ms!, error: d.error ?? null })
      } else if (d.event === 'completed' || d.event === 'cancelled' || d.event === 'error') {
        setIntruderRunning(false, null)
      }
    })

    return () => {
      clearInterval(healthInterval)
      unsubProxy()
      unsubFindings()
      unsubRecon()
      unsubStatus()
      unsubPipeline()
      unsubToolOutput()
      unsubIntruder()
      wsClient.disconnect()
    }
  }, [])

  return (
    <HashRouter>
      <div className="flex h-screen w-screen overflow-hidden bg-zinc-950">
        <Sidebar />
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/proxy" element={<ProxyPage />} />
          <Route path="/recon" element={<ReconPage />} />
          <Route path="/scanner" element={<ScannerPage />} />
          <Route path="/exploit" element={<ExploitPage />} />
          <Route path="/copilot" element={<CopilotPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </div>
    </HashRouter>
  )
}

export default App
