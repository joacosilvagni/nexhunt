import { useState } from 'react'
import { WorkspaceShell } from '@/components/layout/WorkspaceShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useReconStore } from '@/stores/recon-store'
import { api } from '@/api/http-client'
import { cn } from '@/lib/utils'
import {
  Radar,
  Play,
  Square,
  Globe,
  Network,
  Link,
  Loader2
} from 'lucide-react'

type ReconTab = 'subdomains' | 'urls' | 'ports'

const reconTools = [
  { id: 'subfinder', label: 'Subfinder', category: 'subdomains' },
  { id: 'amass', label: 'Amass', category: 'subdomains' },
  { id: 'httpx', label: 'Httpx', category: 'probing' },
  { id: 'nmap', label: 'Nmap', category: 'ports' },
  { id: 'waybackurls', label: 'Waybackurls', category: 'urls' },
  { id: 'gau', label: 'GAU', category: 'urls' },
  { id: 'katana', label: 'Katana', category: 'urls' },
  { id: 'paramspider', label: 'ParamSpider', category: 'params' },
  { id: 'arjun', label: 'Arjun', category: 'params' }
]

export function ReconPage() {
  const [activeTab, setActiveTab] = useState<ReconTab>('subdomains')
  const [target, setTarget] = useState('')
  const [runningTools, setRunningTools] = useState<Set<string>>(new Set())
  const { subdomains, urls, ports } = useReconStore()

  const handleRunTool = async (toolId: string) => {
    if (!target.trim()) return
    setRunningTools(prev => new Set(prev).add(toolId))
    try {
      await api.post(`/api/recon/${toolId}`, { target: target.trim() })
    } catch (err) {
      console.error(`Failed to run ${toolId}:`, err)
    } finally {
      setRunningTools(prev => {
        const next = new Set(prev)
        next.delete(toolId)
        return next
      })
    }
  }

  const handleFullRecon = async () => {
    if (!target.trim()) return
    try {
      await api.post('/api/recon/full', { target: target.trim() })
    } catch (err) {
      console.error('Failed to start full recon:', err)
    }
  }

  return (
    <WorkspaceShell title="Recon" subtitle="Subdomain enumeration, URL discovery, and port scanning">
      <div className="flex flex-col h-full gap-4">
        {/* Target input + actions */}
        <div className="flex items-center gap-2">
          <Input
            placeholder="Enter target domain (e.g., example.com)"
            className="flex-1 bg-zinc-900"
            value={target}
            onChange={e => setTarget(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleFullRecon()}
          />
          <Button onClick={handleFullRecon}>
            <Radar size={14} className="mr-1" /> Full Recon
          </Button>
        </div>

        {/* Tool grid */}
        <div className="flex flex-wrap gap-2">
          {reconTools.map(tool => (
            <Button
              key={tool.id}
              variant="outline"
              size="sm"
              disabled={!target.trim() || runningTools.has(tool.id)}
              onClick={() => handleRunTool(tool.id)}
              className="text-xs"
            >
              {runningTools.has(tool.id) ? (
                <Loader2 size={12} className="mr-1 animate-spin" />
              ) : (
                <Play size={12} className="mr-1" />
              )}
              {tool.label}
            </Button>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-zinc-900 rounded-lg p-1 w-fit">
          {([
            { id: 'subdomains', icon: Globe, count: subdomains.length },
            { id: 'urls', icon: Link, count: urls.length },
            { id: 'ports', icon: Network, count: ports.length }
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize',
                activeTab === tab.id
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'text-zinc-400 hover:text-zinc-200'
              )}
            >
              <tab.icon size={12} />
              {tab.id}
              {tab.count > 0 && (
                <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                  {tab.count}
                </Badge>
              )}
            </button>
          ))}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-auto rounded-lg border border-zinc-800">
          {activeTab === 'subdomains' && (
            <table className="w-full text-xs">
              <thead className="bg-zinc-900 sticky top-0">
                <tr className="text-zinc-500 text-left">
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Subdomain</th>
                  <th className="px-3 py-2">Source</th>
                  <th className="px-3 py-2">IP</th>
                </tr>
              </thead>
              <tbody>
                {subdomains.map((s, i) => (
                  <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                    <td className="px-3 py-1.5 text-zinc-600">{i + 1}</td>
                    <td className="px-3 py-1.5 text-zinc-300 font-mono">{s.subdomain}</td>
                    <td className="px-3 py-1.5 text-zinc-500">{s.source}</td>
                    <td className="px-3 py-1.5 text-zinc-500 font-mono">{s.ip || '-'}</td>
                  </tr>
                ))}
                {subdomains.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-zinc-600">
                      No subdomains found yet. Enter a target and run a recon tool.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'urls' && (
            <table className="w-full text-xs">
              <thead className="bg-zinc-900 sticky top-0">
                <tr className="text-zinc-500 text-left">
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">URL</th>
                  <th className="px-3 py-2">Source</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {urls.map((u, i) => (
                  <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                    <td className="px-3 py-1.5 text-zinc-600">{i + 1}</td>
                    <td className="px-3 py-1.5 text-zinc-300 font-mono truncate max-w-[500px]">{u.url}</td>
                    <td className="px-3 py-1.5 text-zinc-500">{u.source}</td>
                    <td className="px-3 py-1.5 text-zinc-500">{u.status_code || '-'}</td>
                  </tr>
                ))}
                {urls.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-zinc-600">
                      No URLs discovered yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'ports' && (
            <table className="w-full text-xs">
              <thead className="bg-zinc-900 sticky top-0">
                <tr className="text-zinc-500 text-left">
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">IP</th>
                  <th className="px-3 py-2">Port</th>
                  <th className="px-3 py-2">Service</th>
                  <th className="px-3 py-2">Version</th>
                </tr>
              </thead>
              <tbody>
                {ports.map((p, i) => (
                  <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                    <td className="px-3 py-1.5 text-zinc-600">{i + 1}</td>
                    <td className="px-3 py-1.5 text-zinc-300 font-mono">{p.ip}</td>
                    <td className="px-3 py-1.5 text-green-500 font-mono">{p.port}</td>
                    <td className="px-3 py-1.5 text-zinc-400">{p.service || '-'}</td>
                    <td className="px-3 py-1.5 text-zinc-500">{p.version || '-'}</td>
                  </tr>
                ))}
                {ports.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-zinc-600">
                      No port scan results yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </WorkspaceShell>
  )
}
