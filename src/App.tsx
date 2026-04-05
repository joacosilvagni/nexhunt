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
import { wsClient } from '@/api/ws-client'
import { API_BASE } from '@/lib/constants'
import type { HttpFlow, Finding, SubdomainResult } from '@/types'

function App() {
  const { setBackendConnected, setWsConnected } = useAppStore()
  const { addFlow, setProxyRunning } = useProxyStore()
  const { addFinding } = useScannerStore()
  const { addSubdomains } = useReconStore()

  useEffect(() => {
    // Check backend health
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

    // Connect WebSocket
    wsClient.connect()

    // Subscribe to channels
    const unsubProxy = wsClient.subscribe('proxy_feed', (data) => {
      addFlow(data as HttpFlow)
    })

    const unsubFindings = wsClient.subscribe('findings', (data) => {
      addFinding(data as Finding)
    })

    const unsubRecon = wsClient.subscribe('recon_results', (data) => {
      const result = data as { type: string; results: SubdomainResult[] }
      if (result.type === 'subdomain') {
        addSubdomains(result.results)
      }
    })

    const unsubStatus = wsClient.subscribe('tool_status', (data) => {
      const status = data as { tool: string; event: string }
      if (status.tool === 'proxy') {
        setProxyRunning(status.event === 'started')
      }
    })

    return () => {
      clearInterval(healthInterval)
      unsubProxy()
      unsubFindings()
      unsubRecon()
      unsubStatus()
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
