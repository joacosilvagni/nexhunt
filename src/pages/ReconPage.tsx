import { useState } from 'react'
import { WorkspaceShell } from '@/components/layout/WorkspaceShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScopeSelector } from '@/components/ui/scope-selector'
import { useReconStore } from '@/stores/recon-store'
import { useAppStore } from '@/stores/app-store'
import { api } from '@/api/http-client'
import { API_BASE } from '@/lib/constants'
import { cn } from '@/lib/utils'
import {
  Radar,
  Play,
  Globe,
  Network,
  Link,
  Loader2,
  Wifi,
  Settings2,
  Trash2,
  Zap,
  Camera,
  ExternalLink,
} from 'lucide-react'

type ReconTab = 'subdomains' | 'live_hosts' | 'urls' | 'ports' | 'screenshots'

// Bug Bounty stages with their tools
const BB_STAGES = [
  {
    id: 'asset-discovery',
    label: 'Stage 1 — Asset Discovery',
    description: 'Subdomain enumeration via passive/active DNS',
    color: 'text-blue-400',
    borderColor: 'border-blue-500/30',
    bgColor: 'bg-blue-950/20',
    tools: [
      { id: 'subfinder', label: 'Subfinder', desc: 'Passive enumeration via APIs (fast)', installed: true },
      { id: 'amass', label: 'Amass', desc: 'Deep passive + active OSINT enumeration', installed: true },
    ],
  },
  {
    id: 'live-probing',
    label: 'Stage 2 — Live Host Probing',
    description: 'Verify which subdomains are alive, get status codes, titles & tech stack',
    color: 'text-green-400',
    borderColor: 'border-green-500/30',
    bgColor: 'bg-green-950/20',
    tools: [
      { id: 'httpx', label: 'HTTPX (single)', desc: 'Probe one target URL/domain', installed: true },
      { id: 'httpx-probe-all', label: 'HTTPX (probe all)', desc: 'Probe all subdomains found in Stage 1', installed: true, special: true },
    ],
  },
  {
    id: 'url-discovery',
    label: 'Stage 3 — URL & Endpoint Discovery',
    description: 'Find historical and current endpoints, JS links, parameters',
    color: 'text-purple-400',
    borderColor: 'border-purple-500/30',
    bgColor: 'bg-purple-950/20',
    tools: [
      { id: 'waybackurls', label: 'Waybackurls', desc: 'Historical URLs from Wayback Machine', installed: true },
      { id: 'gau', label: 'GAU', desc: 'Get All URLs — Wayback + Common Crawl + OTX', installed: true },
      { id: 'katana', label: 'Katana', desc: 'Active web crawler', installed: true },
    ],
  },
  {
    id: 'port-scanning',
    label: 'Stage 4 — Port & Service Scanning',
    description: 'Identify open ports and running services',
    color: 'text-orange-400',
    borderColor: 'border-orange-500/30',
    bgColor: 'bg-orange-950/20',
    tools: [
      { id: 'nmap', label: 'Nmap', desc: 'Port scan + service/version detection', installed: true },
    ],
  },
  {
    id: 'param-discovery',
    label: 'Stage 5 — Parameter Discovery',
    description: 'Find URL parameters for fuzzing and injection testing',
    color: 'text-yellow-400',
    borderColor: 'border-yellow-500/30',
    bgColor: 'bg-yellow-950/20',
    tools: [
      { id: 'paramspider', label: 'ParamSpider', desc: 'Parameters from Wayback Machine', installed: false },
      { id: 'arjun', label: 'Arjun', desc: 'HTTP parameter discovery brute-force', installed: true },
    ],
  },
]

interface ToolOptions {
  [toolId: string]: Record<string, string>
}

export function ReconPage() {
  const [activeTab, setActiveTab] = useState<ReconTab>('subdomains')
  const { globalTarget, setGlobalTarget } = useAppStore()
  const [target, setTargetLocal] = useState(globalTarget)
  const [runningTools, setRunningTools] = useState<Set<string>>(new Set())
  const [expandedOptions, setExpandedOptions] = useState<Set<string>>(new Set())
  const [toolOptions, setToolOptions] = useState<ToolOptions>({})

  const setTarget = (v: string) => { setTargetLocal(v); setGlobalTarget(v) }
  const [probingAll, setProbingAll] = useState(false)  // used in handleProbeAll
  const [nucleiRunning, setNucleiRunning] = useState(false)
  const { subdomains, urls, ports, liveHosts, clearRecon } = useReconStore()

  const handleNucleiBulkScan = async () => {
    if (liveHosts.length === 0) return
    setNucleiRunning(true)
    try {
      const targets = liveHosts.map(h => h.url).filter(Boolean)
      await api.post('/api/scanner/nuclei-bulk', { targets })
    } catch (err) {
      console.error('Failed to start nuclei bulk scan:', err)
    } finally {
      setNucleiRunning(false)
    }
  }

  const handleRunTool = async (toolId: string) => {
    if (!target.trim()) return
    setRunningTools(prev => new Set(prev).add(toolId))
    try {
      const opts = toolOptions[toolId] || {}
      await api.post(`/api/recon/${toolId}`, { target: target.trim(), options: opts })
    } catch (err) {
      console.error(`Failed to run ${toolId}:`, err)
    } finally {
      setRunningTools(prev => { const n = new Set(prev); n.delete(toolId); return n })
    }
  }

  const handleProbeAll = async () => {
    if (subdomains.length === 0) return
    setProbingAll(true)
    try {
      const targets = subdomains.map(s => s.subdomain)
      await api.post('/api/recon/httpx-probe', { targets })
    } catch (err) {
      console.error('Failed to probe all subdomains:', err)
    } finally {
      setProbingAll(false)
    }
  }

  const handleFullRecon = async () => {
    if (!target.trim()) return
    setRunningTools(new Set(['subfinder', 'amass', 'waybackurls', 'gau', 'full_recon']))
    try {
      await api.post('/api/recon/full', { target: target.trim() })
    } catch (err) {
      console.error('Failed to start full recon:', err)
    } finally {
      setRunningTools(new Set())
    }
  }

  const toggleOptions = (toolId: string) => {
    setExpandedOptions(prev => {
      const n = new Set(prev)
      n.has(toolId) ? n.delete(toolId) : n.add(toolId)
      return n
    })
  }

  const setOption = (toolId: string, key: string, value: string) => {
    setToolOptions(prev => ({ ...prev, [toolId]: { ...(prev[toolId] || {}), [key]: value } }))
  }

  const [expandedPort, setExpandedPort] = useState<string | null>(null)
  const [screenshotLoading, setScreenshotLoading] = useState(false)
  const { screenshots, screenshotRunning, screenshotProgress } = useReconStore()

  const handleScreenshotAll = async () => {
    if (liveHosts.length === 0) return
    setScreenshotLoading(true)
    try {
      const urls = liveHosts.map(h => h.url).filter(Boolean)
      await api.post('/api/recon/screenshots-bulk', { urls })
    } catch (err) {
      console.error('Failed to start bulk screenshots:', err)
    } finally {
      setScreenshotLoading(false)
    }
  }

  const tabs = [
    { id: 'subdomains' as ReconTab, icon: Globe, label: 'Subdomains', count: subdomains.length, color: 'text-blue-400' },
    { id: 'live_hosts' as ReconTab, icon: Wifi, label: 'Live Hosts', count: liveHosts.length, color: 'text-green-400' },
    { id: 'urls' as ReconTab, icon: Link, label: 'URLs', count: urls.length, color: 'text-purple-400' },
    { id: 'ports' as ReconTab, icon: Network, label: 'Ports', count: ports.length, color: 'text-orange-400' },
    { id: 'screenshots' as ReconTab, icon: Camera, label: 'Screenshots', count: screenshots.length, color: 'text-pink-400' },
  ]

  return (
    <WorkspaceShell title="Recon" subtitle="Bug Bounty reconnaissance pipeline — stages 1 to 5">
      <div className="flex gap-4 h-full min-h-0">

        {/* LEFT PANEL — Stages & Tools */}
        <div className="w-72 shrink-0 flex flex-col gap-3 overflow-y-auto pr-1">

          {/* Target input */}
          <div className="space-y-2">
            <ScopeSelector onSelect={setTarget} selectedTarget={target} />
            <div className="flex gap-2">
              <Input
                placeholder="domain.com"
                className="flex-1 bg-zinc-900 text-sm"
                value={target}
                onChange={e => setTarget(e.target.value)}
              />
              <Button
                size="sm"
                onClick={handleFullRecon}
                disabled={!target.trim() || runningTools.size > 0}
                title="Full automated recon pipeline"
              >
                {runningTools.has('full_recon') ? <Loader2 size={14} className="animate-spin" /> : <Radar size={14} />}
              </Button>
            </div>
            {target && (
              <div className="text-[10px] text-zinc-600 font-mono truncate">Target: {target}</div>
            )}
          </div>

          {/* Stages */}
          {BB_STAGES.map(stage => (
            <div key={stage.id} className={cn("rounded-lg border p-3 space-y-2", stage.borderColor, stage.bgColor)}>
              <div>
                <div className={cn("text-xs font-semibold", stage.color)}>{stage.label}</div>
                <div className="text-[10px] text-zinc-500 mt-0.5">{stage.description}</div>
              </div>

              <div className="space-y-1.5">
                {stage.tools.map(tool => {
                  const isRunning = runningTools.has(tool.id)
                  const hasOpts = expandedOptions.has(tool.id)
                  const opts = toolOptions[tool.id] || {}
                  const isSpecial = (tool as any).special

                  return (
                    <div key={tool.id} className="space-y-1">
                      <div className="flex items-center gap-1">
                        {/* Run button */}
                        <button
                          disabled={
                            isRunning ||
                            (isSpecial && probingAll) ||
                            (!isSpecial && !target.trim()) ||
                            (isSpecial && subdomains.length === 0) ||
                            !tool.installed
                          }
                          onClick={() => isSpecial ? handleProbeAll() : handleRunTool(tool.id)}
                          className={cn(
                            "flex items-center gap-1.5 flex-1 px-2 py-1 rounded text-xs font-medium transition-colors",
                            "border text-left",
                            !tool.installed
                              ? "border-zinc-800 text-zinc-700 cursor-not-allowed"
                              : isRunning
                                ? "border-zinc-600 bg-zinc-800 text-zinc-300"
                                : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-800"
                          )}
                        >
                          {(isRunning || (isSpecial && probingAll)) ? (
                            <Loader2 size={11} className="animate-spin shrink-0" />
                          ) : (
                            <Play size={11} className="shrink-0" />
                          )}
                          <span className="truncate">{tool.label}</span>
                          {!tool.installed && (
                            <span className="ml-auto text-[9px] text-zinc-700 shrink-0">not installed</span>
                          )}
                          {isSpecial && subdomains.length > 0 && (
                            <span className="ml-auto text-[9px] text-zinc-500 shrink-0">{subdomains.length}</span>
                          )}
                        </button>

                        {/* Options toggle (only for tools that have options) */}
                        {tool.installed && !isSpecial && (
                          <button
                            onClick={() => toggleOptions(tool.id)}
                            className="p-1 rounded border border-zinc-800 text-zinc-600 hover:text-zinc-400 hover:border-zinc-600 transition-colors"
                          >
                            <Settings2 size={10} />
                          </button>
                        )}
                      </div>

                      {/* Tool description */}
                      <div className="text-[10px] text-zinc-600 pl-1">{tool.desc}</div>

                      {/* Options panel */}
                      {hasOpts && tool.installed && (
                        <div className="pl-1 space-y-1 border-l border-zinc-800 ml-1">
                          {tool.id === 'nmap' && (
                            <>
                              <OptionInput label="Ports" placeholder="-p 80,443,8080 or -p-" value={opts.ports || ''} onChange={v => setOption(tool.id, 'ports', v)} />
                              <OptionInput label="Flags" placeholder="-sV -sC -A" value={opts.flags || ''} onChange={v => setOption(tool.id, 'flags', v)} />
                            </>
                          )}
                          {tool.id === 'subfinder' && (
                            <OptionInput label="Sources" placeholder="shodan,virustotal" value={opts.sources || ''} onChange={v => setOption(tool.id, 'sources', v)} />
                          )}
                          {tool.id === 'httpx' && (
                            <OptionInput label="Threads" placeholder="50" value={opts.threads || ''} onChange={v => setOption(tool.id, 'threads', v)} />
                          )}
                          {(tool.id === 'paramspider' || tool.id === 'arjun') && (
                            <OptionInput label="Method" placeholder="GET" value={opts.method || ''} onChange={v => setOption(tool.id, 'method', v)} />
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Clear results */}
          <Button
            variant="ghost"
            size="sm"
            className="text-zinc-600 hover:text-red-400 text-xs"
            onClick={async () => {
              clearRecon()
              try { await api.delete('/api/recon/results') } catch {}
            }}
          >
            <Trash2 size={12} className="mr-1" /> Borrar todo
          </Button>
        </div>

        {/* RIGHT PANEL — Results */}
        <div className="flex-1 flex flex-col gap-3 min-h-0 min-w-0">

          {/* Tabs */}
          <div className="flex gap-1 bg-zinc-900 rounded-lg p-1 w-fit">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                  activeTab === tab.id
                    ? 'bg-zinc-700 text-zinc-100'
                    : 'text-zinc-400 hover:text-zinc-200'
                )}
              >
                <tab.icon size={12} className={activeTab === tab.id ? tab.color : ''} />
                {tab.label}
                {tab.count > 0 && (
                  <Badge variant="secondary" className="h-4 px-1 text-[10px]">{tab.count}</Badge>
                )}
              </button>
            ))}
          </div>

          {/* Live Hosts — action bar */}
          {activeTab === 'live_hosts' && liveHosts.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                className="border-yellow-700 text-yellow-400 hover:bg-yellow-950/40 text-xs"
                onClick={handleNucleiBulkScan}
                disabled={nucleiRunning}
              >
                {nucleiRunning
                  ? <Loader2 size={12} className="animate-spin mr-1.5" />
                  : <Zap size={12} className="mr-1.5" />}
                Scan all with Nuclei ({liveHosts.length} hosts)
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-pink-700 text-pink-400 hover:bg-pink-950/40 text-xs"
                onClick={handleScreenshotAll}
                disabled={screenshotLoading || screenshotRunning}
              >
                {(screenshotLoading || screenshotRunning)
                  ? <><Loader2 size={12} className="animate-spin mr-1.5" />
                    {screenshotRunning && screenshotProgress.total > 0
                      ? `${screenshotProgress.done}/${screenshotProgress.total}`
                      : 'Starting...'}</>
                  : <><Camera size={12} className="mr-1.5" />Screenshot all ({liveHosts.length})</>}
              </Button>
              <span className="text-[10px] text-zinc-600">Results in Screenshots tab</span>
            </div>
          )}

          {/* Table area */}
          <div className="flex-1 overflow-auto rounded-lg border border-zinc-800 min-h-0">

            {/* Subdomains tab */}
            {activeTab === 'subdomains' && (
              <table className="w-full text-xs">
                <thead className="bg-zinc-900 sticky top-0 z-10">
                  <tr className="text-zinc-500 text-left">
                    <th className="px-3 py-2 w-8">#</th>
                    <th className="px-3 py-2">Subdomain</th>
                    <th className="px-3 py-2 w-24">Source</th>
                    <th className="px-3 py-2 w-32">IP</th>
                    <th className="px-3 py-2 w-20">Live?</th>
                  </tr>
                </thead>
                <tbody>
                  {subdomains.map((s, i) => {
                    const liveEntry = liveHosts.find(h => h.url?.includes(s.subdomain) || h.host === s.subdomain)
                    return (
                      <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                        <td className="px-3 py-1.5 text-zinc-600">{i + 1}</td>
                        <td className="px-3 py-1.5 text-zinc-300 font-mono">{s.subdomain}</td>
                        <td className="px-3 py-1.5 text-zinc-500">{s.source}</td>
                        <td className="px-3 py-1.5 text-zinc-500 font-mono">{s.ip || '-'}</td>
                        <td className="px-3 py-1.5">
                          {liveEntry ? (
                            <Badge variant="default" className="text-[10px] bg-green-900/50 text-green-400 border-green-700">
                              {liveEntry.status_code}
                            </Badge>
                          ) : (
                            <span className="text-zinc-700">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {subdomains.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-12 text-center text-zinc-600">
                        No subdomains found yet. Enter a target and run Stage 1.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {/* Live Hosts tab */}
            {activeTab === 'live_hosts' && (
              <table className="w-full text-xs">
                <thead className="bg-zinc-900 sticky top-0 z-10">
                  <tr className="text-zinc-500 text-left">
                    <th className="px-3 py-2 w-8">#</th>
                    <th className="px-3 py-2">URL</th>
                    <th className="px-3 py-2 w-16">Status</th>
                    <th className="px-3 py-2">Title</th>
                    <th className="px-3 py-2">Technologies</th>
                  </tr>
                </thead>
                <tbody>
                  {liveHosts.map((h, i) => (
                    <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                      <td className="px-3 py-1.5 text-zinc-600">{i + 1}</td>
                      <td className="px-3 py-1.5 text-green-400 font-mono truncate max-w-[240px]">{h.url}</td>
                      <td className="px-3 py-1.5">
                        <span className={cn(
                          "font-mono font-semibold",
                          h.status_code && h.status_code < 300 ? "text-green-500" :
                          h.status_code && h.status_code < 400 ? "text-yellow-500" :
                          h.status_code && h.status_code < 500 ? "text-orange-500" : "text-red-500"
                        )}>
                          {h.status_code ?? '?'}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-zinc-300 truncate max-w-[200px]">{h.title || '—'}</td>
                      <td className="px-3 py-1.5">
                        <div className="flex flex-wrap gap-1">
                          {h.technologies?.slice(0, 4).map((t, ti) => (
                            <span key={ti} className="text-[9px] px-1 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">{t}</span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {liveHosts.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-12 text-center text-zinc-600">
                        No live hosts yet. Run Stage 1 first, then &quot;HTTPX (probe all)&quot; in Stage 2.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {/* URLs tab */}
            {activeTab === 'urls' && (
              <table className="w-full text-xs">
                <thead className="bg-zinc-900 sticky top-0 z-10">
                  <tr className="text-zinc-500 text-left">
                    <th className="px-3 py-2 w-8">#</th>
                    <th className="px-3 py-2">URL</th>
                    <th className="px-3 py-2 w-28">Source</th>
                    <th className="px-3 py-2 w-16">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {urls.map((u, i) => (
                    <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                      <td className="px-3 py-1.5 text-zinc-600">{i + 1}</td>
                      <td className="px-3 py-1.5 text-zinc-300 font-mono truncate max-w-[500px]">{u.url}</td>
                      <td className="px-3 py-1.5 text-zinc-500">{u.source}</td>
                      <td className="px-3 py-1.5 text-zinc-500">{u.status_code ?? '—'}</td>
                    </tr>
                  ))}
                  {urls.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-12 text-center text-zinc-600">
                        No URLs discovered yet. Run Stage 3.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {/* Screenshots tab */}
            {activeTab === 'screenshots' && (
              <div className="p-3">
                {screenshots.length === 0 ? (
                  <div className="py-12 text-center text-zinc-600 text-xs">
                    No screenshots yet. Go to Live Hosts tab and click &quot;Screenshot all&quot;.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {screenshots.map((s, i) => (
                      <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden group">
                        <div className="relative aspect-video bg-zinc-950">
                          <img
                            src={`${API_BASE}${s.screenshot_url}`}
                            alt={s.url}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                          <a
                            href={s.url}
                            target="_blank"
                            rel="noreferrer"
                            className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <ExternalLink size={20} className="text-white" />
                          </a>
                        </div>
                        <div className="px-2 py-1.5">
                          <div className="text-[10px] text-zinc-400 font-mono truncate" title={s.url}>{s.url}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Ports tab */}
            {activeTab === 'ports' && (
              <table className="w-full text-xs">
                <thead className="bg-zinc-900 sticky top-0 z-10">
                  <tr className="text-zinc-500 text-left">
                    <th className="px-3 py-2 w-8">#</th>
                    <th className="px-3 py-2 w-32">IP/Host</th>
                    <th className="px-3 py-2 w-20">Port</th>
                    <th className="px-3 py-2 w-24">Service</th>
                    <th className="px-3 py-2">Version / Scripts</th>
                  </tr>
                </thead>
                <tbody>
                  {ports.map((p, i) => {
                    const portKey = `${p.ip}:${p.port}`
                    const isExpanded = expandedPort === portKey
                    return (
                      <>
                        <tr
                          key={i}
                          onClick={() => setExpandedPort(isExpanded ? null : portKey)}
                          className="border-b border-zinc-800/50 hover:bg-zinc-800/30 cursor-pointer"
                        >
                          <td className="px-3 py-1.5 text-zinc-600">{i + 1}</td>
                          <td className="px-3 py-1.5 text-zinc-300 font-mono">{p.ip}</td>
                          <td className="px-3 py-1.5">
                            <span className="text-green-500 font-mono font-bold">{p.port}</span>
                            {p.proto && <span className="text-zinc-600 font-mono text-[9px] ml-1">/{p.proto}</span>}
                          </td>
                          <td className="px-3 py-1.5 text-zinc-400">{p.service ?? '—'}</td>
                          <td className="px-3 py-1.5 text-zinc-500 truncate max-w-[260px]">
                            {p.version ?? '—'}
                            {p.scripts && <span className="ml-2 text-[9px] text-blue-400">▶ scripts</span>}
                          </td>
                        </tr>
                        {isExpanded && p.scripts && (
                          <tr key={`${i}-detail`} className="border-b border-zinc-800/50 bg-zinc-900/60">
                            <td colSpan={5} className="px-4 py-2">
                              <pre className="text-[10px] font-mono text-blue-300 whitespace-pre-wrap break-words leading-relaxed">
                                {p.scripts}
                              </pre>
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
                  {ports.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-12 text-center text-zinc-600">
                        No port scan results yet. Run Nmap in Stage 4.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </WorkspaceShell>
  )
}

// Small helper component for option inputs
function OptionInput({
  label, placeholder, value, onChange
}: { label: string; placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-zinc-600 w-14 shrink-0">{label}:</span>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="flex-1 text-[10px] bg-zinc-900 border border-zinc-800 rounded px-2 py-0.5 text-zinc-400 placeholder:text-zinc-700 focus:outline-none focus:border-zinc-600"
      />
    </div>
  )
}
