import { useState, useEffect, useRef } from 'react'
import { WorkspaceShell } from '@/components/layout/WorkspaceShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScopeSelector } from '@/components/ui/scope-selector'
import { useScannerStore } from '@/stores/scanner-store'
import { useAppStore } from '@/stores/app-store'
import { api } from '@/api/http-client'
import { cn } from '@/lib/utils'
import {
  Play,
  Loader2,
  Settings2,
  Trash2,
  Bug,
  FolderSearch,
  Shield,
  Server,
  Terminal,
} from 'lucide-react'
import type { Finding } from '@/types'

// Scanner tool categories by BB purpose
const SCANNER_STAGES = [
  {
    id: 'vuln-scan',
    label: 'Vulnerability Detection',
    color: 'text-red-400',
    borderColor: 'border-red-500/30',
    bgColor: 'bg-red-950/20',
    tools: [
      {
        id: 'nuclei',
        label: 'Nuclei',
        desc: 'Template-based vulnerability scanner',
        installed: true,
        options: [
          { key: 'severity', label: 'Severity', placeholder: 'info,low,medium,high,critical' },
          { key: 'tags', label: 'Tags', placeholder: 'cves,xss,sqli,misconfig' },
          { key: 'templates', label: 'Custom template path', placeholder: '/root/nuclei-templates/http/...' },
          { key: 'rate_limit', label: 'Rate limit', placeholder: '100' },
          { key: 'exclude_tags', label: 'Exclude tags', placeholder: 'dos,fuzz' },
        ],
        scanTypes: [
          { id: '', label: 'Default', desc: 'Tech + Exposures + Misconfigs', speed: 'fast' },
          { id: 'cves', label: 'CVEs', desc: 'Known CVE templates', speed: 'slow' },
          { id: 'misconfig', label: 'Misconfigs', desc: 'Server misconfigurations', speed: 'medium' },
          { id: 'exposure', label: 'Exposures', desc: 'Sensitive files & data', speed: 'medium' },
          { id: 'takeover', label: 'Takeover', desc: 'Subdomain takeover', speed: 'fast' },
          { id: 'default-logins', label: 'Default Logins', desc: 'Default credentials', speed: 'medium' },
          { id: 'ssrf', label: 'SSRF', desc: 'SSRF + open redirect', speed: 'fast' },
        ],
      },
    ],
  },
  {
    id: 'web-analysis',
    label: 'Web Server Analysis',
    color: 'text-yellow-400',
    borderColor: 'border-yellow-500/30',
    bgColor: 'bg-yellow-950/20',
    tools: [
      {
        id: 'nikto',
        label: 'Nikto',
        desc: 'Web server scanner — misconfigs, outdated software, headers',
        installed: true,
        options: [
          { key: 'extra', label: 'Extra flags', placeholder: '-Tuning 123456' },
        ],
        scanTypes: [],
      },
    ],
  },
  {
    id: 'dir-discovery',
    label: 'Directory & File Discovery',
    color: 'text-blue-400',
    borderColor: 'border-blue-500/30',
    bgColor: 'bg-blue-950/20',
    tools: [
      {
        id: 'gobuster',
        label: 'Gobuster',
        desc: 'Fast directory brute-force (Go)',
        installed: true,
        options: [
          { key: 'wordlist', label: 'Wordlist', placeholder: '/usr/share/wordlists/dirb/common.txt', default: '/usr/share/wordlists/dirb/common.txt' },
          { key: 'extensions', label: 'Extensions', placeholder: 'php,html,js,txt,bak' },
          { key: 'threads', label: 'Threads', placeholder: '10' },
        ],
        scanTypes: [],
      },
      {
        id: 'ffuf',
        label: 'FFUF',
        desc: 'Web fuzzer — add FUZZ keyword to URL or auto-appended',
        installed: true,
        options: [
          { key: 'wordlist', label: 'Wordlist', placeholder: '/usr/share/wordlists/dirb/common.txt', default: '/usr/share/wordlists/dirb/common.txt' },
          { key: 'extensions', label: 'Extensions', placeholder: '.php,.html,.txt' },
          { key: 'match_codes', label: 'Match codes', placeholder: '200,301,302,403' },
          { key: 'filter_size', label: 'Filter size', placeholder: '0' },
        ],
        scanTypes: [],
      },
      {
        id: 'dirsearch',
        label: 'Dirsearch',
        desc: 'Directory scanner with built-in wordlists',
        installed: true,
        options: [
          { key: 'extensions', label: 'Extensions', placeholder: 'php,html,js,txt' },
          { key: 'threads', label: 'Threads', placeholder: '20' },
          { key: 'wordlist', label: 'Wordlist', placeholder: '/usr/share/wordlists/dirb/common.txt' },
        ],
        scanTypes: [],
      },
    ],
  },
]

interface ToolOpts { [key: string]: string }
type ToolOptionsMap = Record<string, ToolOpts>

// View modes: all findings or per-tool view
type ViewMode = 'all' | string  // string = specific tool id

export function ScannerPage() {
  const { globalTarget, setGlobalTarget } = useAppStore()
  const [target, setTargetLocal] = useState(globalTarget)
  useEffect(() => { if (globalTarget && !target) setTargetLocal(globalTarget) }, [globalTarget])
  const setTarget = (v: string) => { setTargetLocal(v); setGlobalTarget(v) }
  const [expandedOpts, setExpandedOpts] = useState<Set<string>>(new Set())
  const [nucleiPreset, setNucleiPreset] = useState<string>('')
  const [toolOptions, setToolOptions] = useState<ToolOptionsMap>({})
  const [viewMode, setViewMode] = useState<ViewMode>('all')
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null)
  const [terminalTool, setTerminalTool] = useState<string>('')
  const terminalRef = useRef<HTMLPreElement>(null)
  const { findings, rawOutput, activeScans, clearFindings } = useScannerStore()

  // Auto-scroll terminal
  useEffect(() => {
    if (viewMode === 'terminal' && terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [rawOutput, viewMode])

  const handleRunTool = async (toolId: string, extraOpts?: Record<string, any>) => {
    if (!target.trim()) return
    try {
      const opts = { ...(toolOptions[toolId] || {}), ...extraOpts }
      await api.post(`/api/scanner/${toolId}`, { target: target.trim(), options: opts })
    } catch (err) {
      console.error(`Failed to run ${toolId}:`, err)
    }
  }

  const toggleOpts = (toolId: string) => {
    setExpandedOpts(prev => { const n = new Set(prev); n.has(toolId) ? n.delete(toolId) : n.add(toolId); return n })
  }

  const setOption = (toolId: string, key: string, value: string) => {
    setToolOptions(prev => ({ ...prev, [toolId]: { ...(prev[toolId] || {}), [key]: value } }))
  }

  // Findings filtered by tool when in per-tool view
  const displayedFindings = viewMode === 'all'
    ? findings
    : findings.filter(f => f.tool === viewMode)

  // Count per tool for the view tabs
  const toolCounts = findings.reduce<Record<string, number>>((acc, f) => {
    if (f.tool) acc[f.tool] = (acc[f.tool] || 0) + 1
    return acc
  }, {})

  // All unique tools that produced results
  const activeTools = [...new Set(findings.map(f => f.tool).filter(Boolean))] as string[]

  return (
    <WorkspaceShell title="Scanner" subtitle="Vulnerability scanning and directory discovery — per-tool output">
      <div className="flex gap-4 h-full min-h-0">

        {/* LEFT PANEL — Tool launcher */}
        <div className="w-72 shrink-0 flex flex-col gap-3 overflow-y-auto pr-1">

          {/* Target */}
          <div className="space-y-2">
            <ScopeSelector onSelect={setTarget} selectedTarget={target} />
            <Input
              placeholder="https://target.com"
              className="bg-zinc-900 text-sm"
              value={target}
              onChange={e => setTarget(e.target.value)}
            />
          </div>

          {/* Stages */}
          {SCANNER_STAGES.map(stage => (
            <div key={stage.id} className={cn("rounded-lg border p-3 space-y-2", stage.borderColor, stage.bgColor)}>
              <div className={cn("text-xs font-semibold", stage.color)}>{stage.label}</div>

              {stage.tools.map(tool => {
                const isRunning = activeScans.has(tool.id)
                const hasOpts = expandedOpts.has(tool.id)
                const opts = toolOptions[tool.id] || {}

                return (
                  <div key={tool.id} className="space-y-1">
                    {/* Nuclei uses its own run button inside the preset selector — hide generic one */}
                    <div className={cn("flex items-center gap-1", tool.id === 'nuclei' && "hidden")}>
                      <button
                        disabled={isRunning || !target.trim() || !tool.installed}
                        onClick={() => handleRunTool(tool.id)}
                        className={cn(
                          "flex items-center gap-1.5 flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors border text-left",
                          !tool.installed
                            ? "border-zinc-800 text-zinc-700 cursor-not-allowed"
                            : isRunning
                              ? "border-zinc-600 bg-zinc-800 text-zinc-300"
                              : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-800"
                        )}
                      >
                        {isRunning
                          ? <Loader2 size={11} className="animate-spin shrink-0" />
                          : <Play size={11} className="shrink-0" />}
                        <span className="flex-1">{tool.label}</span>
                        {toolCounts[tool.id] ? (
                          <Badge variant="secondary" className="h-3.5 px-1 text-[9px]">{toolCounts[tool.id]}</Badge>
                        ) : null}
                      </button>
                      <button
                        onClick={() => toggleOpts(tool.id)}
                        className={cn(
                          "p-1 rounded border transition-colors",
                          hasOpts ? "border-zinc-600 text-zinc-400" : "border-zinc-800 text-zinc-600 hover:text-zinc-400 hover:border-zinc-600"
                        )}
                        title="Options"
                      >
                        <Settings2 size={10} />
                      </button>
                    </div>

                    <div className="text-[10px] text-zinc-600 pl-1">{tool.desc}</div>

                    {/* Nuclei preset selector */}
                    {tool.id === 'nuclei' && (
                      <div className="space-y-1.5 pl-1">
                        <div className="text-[10px] text-zinc-600">Scan type:</div>
                        <div className="grid grid-cols-2 gap-1">
                          {tool.scanTypes.map(st => (
                            <button
                              key={st.id}
                              onClick={() => setNucleiPreset(st.id)}
                              className={cn(
                                "text-left px-2 py-1.5 rounded border text-[10px] transition-colors",
                                nucleiPreset === st.id
                                  ? "border-red-500/60 bg-red-950/30 text-red-300"
                                  : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                              )}
                            >
                              <div className="font-medium">{st.label}</div>
                              <div className={cn("text-[9px] mt-0.5", nucleiPreset === st.id ? "text-red-400/70" : "text-zinc-600")}>
                                {(st as any).desc} · {(st as any).speed}
                              </div>
                            </button>
                          ))}
                        </div>
                        <button
                          disabled={isRunning || !target.trim()}
                          onClick={() => handleRunTool('nuclei', nucleiPreset ? { scan_type: nucleiPreset } : {})}
                          className={cn(
                            "w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-xs font-medium transition-colors border",
                            isRunning
                              ? "border-zinc-600 bg-zinc-800 text-zinc-300"
                              : "border-red-600/50 bg-red-950/20 text-red-300 hover:bg-red-950/40 hover:border-red-500"
                          )}
                        >
                          {isRunning ? <><Loader2 size={11} className="animate-spin" />Running nuclei...</> : <><Play size={11} />Run Nuclei</>}
                        </button>
                        {isRunning && (
                          <div className="text-[10px] text-zinc-500 text-center animate-pulse">
                            Loading templates (~25s) — output visible in Raw Output tab
                          </div>
                        )}
                      </div>
                    )}

                    {/* Options panel */}
                    {hasOpts && (
                      <div className="pl-1 space-y-1 border-l border-zinc-800 ml-1 pt-1">
                        {tool.options.map(opt => (
                          <OptionInput
                            key={opt.key}
                            label={opt.label}
                            placeholder={opt.placeholder}
                            value={opts[opt.key] || ''}
                            onChange={v => setOption(tool.id, opt.key, v)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}

          <Button
            variant="ghost"
            size="sm"
            className="text-zinc-600 hover:text-red-400 text-xs"
            onClick={() => { clearFindings(); setSelectedFinding(null) }}
          >
            <Trash2 size={12} className="mr-1" /> Limpiar findings
          </Button>
        </div>

        {/* RIGHT PANEL — Results */}
        <div className="flex-1 flex flex-col gap-3 min-h-0 min-w-0">

          {/* View mode tabs — All + per-tool */}
          <div className="flex gap-1 bg-zinc-900 rounded-lg p-1 flex-wrap">
            <button
              onClick={() => setViewMode('all')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                viewMode === 'all' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'
              )}
            >
              <Bug size={11} />
              All findings
              {findings.length > 0 && (
                <Badge variant="secondary" className="h-4 px-1 text-[10px]">{findings.length}</Badge>
              )}
            </button>

            {activeTools.map(toolId => (
              <button
                key={toolId}
                onClick={() => setViewMode(toolId)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize',
                  viewMode === toolId ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'
                )}
              >
                {toolId === 'nuclei' && <Shield size={11} />}
                {toolId === 'nikto' && <Server size={11} />}
                {(toolId === 'gobuster' || toolId === 'ffuf' || toolId === 'dirsearch') && <FolderSearch size={11} />}
                {toolId}
                <Badge variant="secondary" className="h-4 px-1 text-[10px]">{toolCounts[toolId]}</Badge>
              </button>
            ))}

            {/* Terminal tab — always shown when there's raw output */}
            <button
              onClick={() => {
                setViewMode('terminal')
                // default to first tool with output
                if (!terminalTool || !rawOutput[terminalTool]) {
                  const first = Object.keys(rawOutput)[0]
                  if (first) setTerminalTool(first)
                }
              }}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ml-auto',
                viewMode === 'terminal' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'
              )}
            >
              <Terminal size={11} />
              Raw Output
              {Object.values(rawOutput).some(l => l.length > 0) && (
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              )}
            </button>
          </div>

          {/* Terminal view */}
          {viewMode === 'terminal' && (
            <div className="flex-1 flex flex-col gap-2 min-h-0">
              {/* Tool selector */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-zinc-600">Tool:</span>
                <div className="flex gap-1 flex-wrap">
                  {Object.keys(rawOutput).map(tool => (
                    <button
                      key={tool}
                      onClick={() => setTerminalTool(tool)}
                      className={cn(
                        "text-[10px] px-2 py-0.5 rounded border transition-colors font-mono",
                        terminalTool === tool
                          ? "border-green-600 text-green-400 bg-green-950/30"
                          : "border-zinc-700 text-zinc-500 hover:border-zinc-500"
                      )}
                    >
                      {tool} ({rawOutput[tool]?.length ?? 0})
                    </button>
                  ))}
                  {Object.keys(rawOutput).length === 0 && (
                    <span className="text-[10px] text-zinc-700">No output yet — run nuclei or nmap</span>
                  )}
                </div>
              </div>
              {/* Terminal */}
              <pre
                ref={terminalRef}
                className="flex-1 rounded-lg border border-zinc-800 bg-black p-4 overflow-auto text-[11px] font-mono leading-relaxed"
              >
                {terminalTool && rawOutput[terminalTool]
                  ? rawOutput[terminalTool].map((line, i) => (
                      <span key={i} className={cn(
                        "block",
                        line.includes('[ERR]') || line.includes('error') ? 'text-red-400' :
                        line.includes('[WRN]') || line.includes('WARNING') || line.includes('Failed') ? 'text-yellow-400' :
                        line.includes('[INF]') ? 'text-zinc-400' :
                        line.match(/\d+\/tcp\s+open/) ? 'text-green-400 font-semibold' :
                        line.includes('Nmap scan report') ? 'text-blue-400 font-semibold' :
                        line.startsWith('{') ? 'text-cyan-400' :
                        'text-zinc-300'
                      )}>{line}</span>
                    ))
                  : <span className="text-zinc-700">Select a tool above to see its raw output here.</span>
                }
              </pre>
            </div>
          )}

          {/* Finding detail panel + table split */}
          {viewMode !== 'terminal' && <div className="flex-1 flex gap-3 min-h-0">
            {/* Findings table */}
            <div className={cn("overflow-auto rounded-lg border border-zinc-800", selectedFinding ? "flex-1" : "flex-1")}>
              <table className="w-full text-xs">
                <thead className="bg-zinc-900 sticky top-0 z-10">
                  <tr className="text-zinc-500 text-left">
                    <th className="px-3 py-2 w-8">#</th>
                    <th className="px-3 py-2 w-20">Severity</th>
                    <th className="px-3 py-2">Title</th>
                    <th className="px-3 py-2 w-24">Tool</th>
                    <th className="px-3 py-2 w-24">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedFindings.map((f, i) => (
                    <tr
                      key={f.id ?? i}
                      onClick={() => setSelectedFinding(selectedFinding?.id === f.id ? null : f)}
                      className={cn(
                        "border-b border-zinc-800/50 cursor-pointer transition-colors",
                        selectedFinding?.id === f.id ? "bg-zinc-800" : "hover:bg-zinc-800/40"
                      )}
                    >
                      <td className="px-3 py-1.5 text-zinc-600">{i + 1}</td>
                      <td className="px-3 py-1.5">
                        <SeverityBadge severity={f.severity} />
                      </td>
                      <td className="px-3 py-1.5 text-zinc-300 truncate max-w-[280px]">{f.title}</td>
                      <td className="px-3 py-1.5">
                        <span className="text-[10px] text-zinc-500 font-mono bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">
                          {f.tool}
                        </span>
                      </td>
                      <td className="px-3 py-1.5">
                        <Badge variant="outline" className="text-[10px]">{f.status}</Badge>
                      </td>
                    </tr>
                  ))}
                  {displayedFindings.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-12 text-center text-zinc-600">
                        {viewMode === 'all'
                          ? 'No findings yet. Select a target and run a scan.'
                          : `No findings from ${viewMode} yet.`}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Finding detail side panel */}
            {selectedFinding && (
              <div className="w-72 shrink-0 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 overflow-y-auto text-xs space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-zinc-200 leading-tight">{selectedFinding.title}</h3>
                  <button onClick={() => setSelectedFinding(null)} className="text-zinc-600 hover:text-zinc-400 shrink-0">✕</button>
                </div>

                <div className="space-y-2">
                  <DetailRow label="Severity"><SeverityBadge severity={selectedFinding.severity} /></DetailRow>
                  <DetailRow label="Tool"><span className="font-mono text-zinc-400">{selectedFinding.tool}</span></DetailRow>
                  {selectedFinding.url && (
                    <DetailRow label="URL">
                      <span className="font-mono text-blue-400 break-all">{selectedFinding.url}</span>
                    </DetailRow>
                  )}
                  {selectedFinding.parameter && (
                    <DetailRow label="Param"><span className="font-mono text-yellow-400">{selectedFinding.parameter}</span></DetailRow>
                  )}
                  {selectedFinding.template_id && (
                    <DetailRow label="Template"><span className="font-mono text-zinc-400">{selectedFinding.template_id}</span></DetailRow>
                  )}
                  {selectedFinding.description && (
                    <div>
                      <div className="text-zinc-600 mb-1">Description</div>
                      <div className="text-zinc-400 leading-relaxed">{selectedFinding.description}</div>
                    </div>
                  )}
                  {selectedFinding.evidence && (
                    <div>
                      <div className="text-zinc-600 mb-1">Evidence</div>
                      <pre className="text-zinc-400 bg-zinc-950 rounded p-2 overflow-auto text-[10px] leading-relaxed whitespace-pre-wrap break-all">
                        {selectedFinding.evidence}
                      </pre>
                    </div>
                  )}
                  <DetailRow label="Status">
                    <Badge variant="outline" className="text-[10px]">{selectedFinding.status}</Badge>
                  </DetailRow>
                </div>
              </div>
            )}
          </div>}
        </div>
      </div>
    </WorkspaceShell>
  )
}

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    critical: 'bg-red-950/60 text-red-400 border-red-800',
    high: 'bg-orange-950/60 text-orange-400 border-orange-800',
    medium: 'bg-yellow-950/60 text-yellow-400 border-yellow-800',
    low: 'bg-blue-950/60 text-blue-400 border-blue-800',
    info: 'bg-zinc-800 text-zinc-400 border-zinc-700',
  }
  return (
    <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium capitalize", colors[severity] ?? colors.info)}>
      {severity}
    </span>
  )
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-zinc-600 w-16 shrink-0">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  )
}

function OptionInput({ label, placeholder, value, onChange }: {
  label: string; placeholder: string; value: string; onChange: (v: string) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-zinc-600 w-14 shrink-0 text-right">{label}:</span>
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
