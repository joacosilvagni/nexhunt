import { useState } from 'react'
import { WorkspaceShell } from '@/components/layout/WorkspaceShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useScannerStore } from '@/stores/scanner-store'
import { api } from '@/api/http-client'
import { cn } from '@/lib/utils'
import {
  ScanSearch,
  Play,
  Loader2,
  Bug,
  FolderSearch,
  Shield
} from 'lucide-react'

type ScanTab = 'findings' | 'nuclei' | 'fuzzing'

const scanTools = [
  { id: 'nuclei', label: 'Nuclei', desc: 'Vulnerability scanner with templates' },
  { id: 'ffuf', label: 'FFUF', desc: 'Web fuzzer for directories and files' },
  { id: 'nikto', label: 'Nikto', desc: 'Web server scanner' },
  { id: 'gobuster', label: 'Gobuster', desc: 'Directory/file brute-forcer' },
  { id: 'dirsearch', label: 'Dirsearch', desc: 'Directory scanner' }
]

export function ScannerPage() {
  const [activeTab, setActiveTab] = useState<ScanTab>('findings')
  const [target, setTarget] = useState('')
  const [runningTools, setRunningTools] = useState<Set<string>>(new Set())
  const { findings, scanJobs } = useScannerStore()

  const handleRunTool = async (toolId: string) => {
    if (!target.trim()) return
    setRunningTools(prev => new Set(prev).add(toolId))
    try {
      await api.post(`/api/scanner/${toolId}`, { target: target.trim() })
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

  return (
    <WorkspaceShell title="Scanner" subtitle="Vulnerability scanning and directory fuzzing">
      <div className="flex flex-col h-full gap-4">
        {/* Target + tools */}
        <div className="flex items-center gap-2">
          <Input
            placeholder="Enter target URL (e.g., https://example.com)"
            className="flex-1 bg-zinc-900"
            value={target}
            onChange={e => setTarget(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {scanTools.map(tool => (
            <Button
              key={tool.id}
              variant="outline"
              size="sm"
              disabled={!target.trim() || runningTools.has(tool.id)}
              onClick={() => handleRunTool(tool.id)}
              className="text-xs"
              title={tool.desc}
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
            { id: 'findings', icon: Bug, count: findings.length },
            { id: 'nuclei', icon: Shield, count: 0 },
            { id: 'fuzzing', icon: FolderSearch, count: 0 }
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as ScanTab)}
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

        {/* Findings table */}
        <div className="flex-1 overflow-auto rounded-lg border border-zinc-800">
          <table className="w-full text-xs">
            <thead className="bg-zinc-900 sticky top-0">
              <tr className="text-zinc-500 text-left">
                <th className="px-3 py-2 w-8">#</th>
                <th className="px-3 py-2 w-20">Severity</th>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">URL</th>
                <th className="px-3 py-2 w-24">Tool</th>
                <th className="px-3 py-2 w-24">Status</th>
              </tr>
            </thead>
            <tbody>
              {findings.map((f, i) => (
                <tr key={f.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 cursor-pointer">
                  <td className="px-3 py-1.5 text-zinc-600">{i + 1}</td>
                  <td className="px-3 py-1.5">
                    <Badge variant={f.severity as 'critical' | 'high' | 'medium' | 'low' | 'info'}>
                      {f.severity}
                    </Badge>
                  </td>
                  <td className="px-3 py-1.5 text-zinc-300">{f.title}</td>
                  <td className="px-3 py-1.5 text-zinc-500 font-mono truncate max-w-[300px]">{f.url}</td>
                  <td className="px-3 py-1.5 text-zinc-500">{f.tool}</td>
                  <td className="px-3 py-1.5">
                    <Badge variant="outline" className="text-xs">{f.status}</Badge>
                  </td>
                </tr>
              ))}
              {findings.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-zinc-600">
                    No findings yet. Run a scan to discover vulnerabilities.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </WorkspaceShell>
  )
}
