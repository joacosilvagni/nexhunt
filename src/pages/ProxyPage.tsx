import { useState, useEffect, useRef, useCallback } from 'react'
import { WorkspaceShell } from '@/components/layout/WorkspaceShell'
import { useProxyStore } from '@/stores/proxy-store'
import { useAppStore } from '@/stores/app-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn, getMethodColor, getStatusColor, formatBytes, formatDuration } from '@/lib/utils'
import { api } from '@/api/http-client'
import { PAYLOAD_SETS, CATEGORY_ORDER, type PayloadSet } from '@/lib/intruder-payloads'
import type { HttpFlow } from '@/types'
import type { RepeaterTab, IntruderResult } from '@/stores/proxy-store'
import {
  Play, Square, Shield, ShieldOff, Trash2, Search, Send,
  Plus, X, Repeat2, Crosshair, Filter, ChevronDown, ChevronRight,
  AlertTriangle, CheckCircle, Loader2, RotateCcw,
} from 'lucide-react'

type Tab = 'history' | 'repeater' | 'intruder'

// ── helpers ────────────────────────────────────────────────────────────────────
function statusBg(code: number) {
  if (!code) return 'text-zinc-600'
  if (code < 300) return 'text-green-400'
  if (code < 400) return 'text-yellow-400'
  if (code < 500) return 'text-orange-400'
  return 'text-red-400'
}

// ── ProxyPage ─────────────────────────────────────────────────────────────────
export function ProxyPage() {
  const [activeTab, setActiveTab] = useState<Tab>('history')
  const {
    flows, selectedFlowId, selectFlow,
    interceptEnabled, setInterceptEnabled,
    proxyRunning, setProxyRunning,
    filter, setFilter, clearFlows,
    sendToRepeater, sendToIntruder,
  } = useProxyStore()
  const { activeProjectData } = useAppStore()

  const selectedFlow = flows.find(f => f.id === selectedFlowId)

  // Scope filter: check host against active project domains
  const scopeDomains: string[] = activeProjectData?.scope ?? []
  const inScope = useCallback((host: string) => {
    if (!filter.scopeOnly || scopeDomains.length === 0) return true
    return scopeDomains.some(d => host === d || host.endsWith(`.${d}`))
  }, [filter.scopeOnly, scopeDomains])

  const filteredFlows = flows.filter(f => {
    if (!inScope(f.request_host)) return false
    if (filter.host && !f.request_host.includes(filter.host)) return false
    if (filter.method && f.request_method !== filter.method) return false
    if (filter.statusCode && String(f.response_status) !== filter.statusCode) return false
    if (filter.search) {
      const s = filter.search.toLowerCase()
      return f.request_url.toLowerCase().includes(s) || f.request_host.toLowerCase().includes(s)
    }
    return true
  })

  // Ctrl+R → Repeater, Ctrl+I → Intruder
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.ctrlKey) return
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault()
        if (selectedFlow) { sendToRepeater(selectedFlow); setActiveTab('repeater') }
      }
      if (e.key === 'i' || e.key === 'I') {
        e.preventDefault()
        if (selectedFlow) { sendToIntruder(selectedFlow); setActiveTab('intruder') }
      }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [selectedFlow, sendToRepeater, sendToIntruder])

  const handleStartProxy = async () => {
    try { await api.post('/api/proxy/start'); setProxyRunning(true) } catch {}
  }
  const handleStopProxy = async () => {
    try { await api.post('/api/proxy/stop'); setProxyRunning(false) } catch {}
  }
  const handleToggleIntercept = async () => {
    try {
      await api.post('/api/proxy/intercept/toggle', { enabled: !interceptEnabled })
      setInterceptEnabled(!interceptEnabled)
    } catch {}
  }

  return (
    <WorkspaceShell title="Proxy" subtitle="HTTP/HTTPS interception — Repeater — Intruder">
      <div className="flex flex-col h-full gap-3">
        {/* Toolbar */}
        <div className="flex items-center gap-2 shrink-0">
          {proxyRunning ? (
            <Button variant="destructive" size="sm" onClick={handleStopProxy}>
              <Square size={13} className="mr-1" /> Stop
            </Button>
          ) : (
            <Button size="sm" onClick={handleStartProxy}>
              <Play size={13} className="mr-1" /> Start Proxy
            </Button>
          )}
          <Button variant={interceptEnabled ? 'default' : 'outline'} size="sm" onClick={handleToggleIntercept}>
            {interceptEnabled
              ? <><Shield size={13} className="mr-1" /> Intercept ON</>
              : <><ShieldOff size={13} className="mr-1" /> Intercept OFF</>}
          </Button>

          {proxyRunning && (
            <span className="text-[10px] text-green-500 font-mono">● 127.0.0.1:8080</span>
          )}

          <div className="flex-1" />

          <div className="flex gap-1 bg-zinc-900 rounded-lg p-1">
            {([
              { id: 'history', label: 'HTTP History', icon: Search },
              { id: 'repeater', label: 'Repeater', icon: Repeat2 },
              { id: 'intruder', label: 'Intruder', icon: Crosshair },
            ] as { id: Tab; label: string; icon: React.FC<any> }[]).map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id as Tab)}
                className={cn('flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                  activeTab === t.id ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200')}>
                <t.icon size={12} />
                {t.label}
              </button>
            ))}
          </div>

          <Button variant="ghost" size="icon" onClick={clearFlows} title="Clear history">
            <Trash2 size={13} />
          </Button>
        </div>

        {/* Content */}
        {activeTab === 'history' && (
          <HistoryTab
            filteredFlows={filteredFlows}
            selectedFlow={selectedFlow}
            filter={filter}
            setFilter={setFilter}
            selectFlow={selectFlow}
            selectedFlowId={selectedFlowId}
            proxyRunning={proxyRunning}
            scopeDomains={scopeDomains}
            sendToRepeater={(f) => { sendToRepeater(f); setActiveTab('repeater') }}
            sendToIntruder={(f) => { sendToIntruder(f); setActiveTab('intruder') }}
          />
        )}
        {activeTab === 'repeater' && <RepeaterTab />}
        {activeTab === 'intruder' && <IntruderTab />}
      </div>
    </WorkspaceShell>
  )
}

// ── History tab ───────────────────────────────────────────────────────────────
function HistoryTab({ filteredFlows, selectedFlow, filter, setFilter, selectFlow, selectedFlowId, proxyRunning, scopeDomains, sendToRepeater, sendToIntruder }: {
  filteredFlows: HttpFlow[]
  selectedFlow: HttpFlow | undefined
  filter: any
  setFilter: (f: any) => void
  selectFlow: (id: string | null) => void
  selectedFlowId: string | null
  proxyRunning: boolean
  scopeDomains: string[]
  sendToRepeater: (f: HttpFlow) => void
  sendToIntruder: (f: HttpFlow) => void
}) {
  return (
    <div className="flex-1 flex flex-col gap-2 min-h-0">
      {/* Filter bar */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <Input placeholder="Filter URL / host…" className="pl-8 h-7 text-xs bg-zinc-900"
            value={filter.search} onChange={e => setFilter({ search: e.target.value })} />
        </div>
        <Input placeholder="Host" className="w-28 h-7 text-xs bg-zinc-900"
          value={filter.host} onChange={e => setFilter({ host: e.target.value })} />
        <Input placeholder="Status" className="w-16 h-7 text-xs bg-zinc-900"
          value={filter.statusCode} onChange={e => setFilter({ statusCode: e.target.value })} />
        <select className="h-7 rounded-md border border-input bg-zinc-900 px-2 text-xs text-zinc-300"
          value={filter.method} onChange={e => setFilter({ method: e.target.value })}>
          <option value="">All Methods</option>
          {['GET','POST','PUT','DELETE','PATCH','OPTIONS','HEAD'].map(m => <option key={m}>{m}</option>)}
        </select>
        <button
          onClick={() => setFilter({ scopeOnly: !filter.scopeOnly })}
          className={cn('flex items-center gap-1 px-2 h-7 rounded-md border text-xs transition-colors',
            filter.scopeOnly
              ? 'border-blue-600 bg-blue-950/50 text-blue-400'
              : 'border-zinc-700 text-zinc-500 hover:text-zinc-300')}
          title={scopeDomains.length === 0 ? 'No scope set — configure in Projects' : `Scope: ${scopeDomains.join(', ')}`}
        >
          <Filter size={11} />
          Scope{scopeDomains.length > 0 && ` (${scopeDomains.length})`}
        </button>
      </div>

      {/* Table + detail */}
      <div className="flex-1 flex gap-3 min-h-0">
        <div className="flex-1 overflow-auto rounded-lg border border-zinc-800 min-h-0">
          <table className="w-full text-xs">
            <thead className="bg-zinc-900 sticky top-0 z-10">
              <tr className="text-zinc-500 text-left">
                <th className="px-2 py-2 w-8">#</th>
                <th className="px-2 py-2 w-14">Method</th>
                <th className="px-2 py-2 w-40">Host</th>
                <th className="px-2 py-2">Path</th>
                <th className="px-2 py-2 w-14">Status</th>
                <th className="px-2 py-2 w-16">Size</th>
                <th className="px-2 py-2 w-14">Time</th>
              </tr>
            </thead>
            <tbody>
              {filteredFlows.map((flow, idx) => (
                <tr key={flow.id} onClick={() => selectFlow(flow.id)}
                  className={cn('cursor-pointer border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors',
                    selectedFlowId === flow.id && 'bg-zinc-800/60')}>
                  <td className="px-2 py-1.5 text-zinc-600">{idx + 1}</td>
                  <td className={cn('px-2 py-1.5 font-mono font-bold text-[11px]', getMethodColor(flow.request_method))}>
                    {flow.request_method}
                  </td>
                  <td className="px-2 py-1.5 text-zinc-400 truncate max-w-[160px] font-mono text-[11px]">
                    {flow.request_host}
                  </td>
                  <td className="px-2 py-1.5 text-zinc-300 truncate max-w-[280px] font-mono text-[11px]">
                    {flow.request_path}
                  </td>
                  <td className={cn('px-2 py-1.5 font-mono font-semibold', getStatusColor(flow.response_status))}>
                    {flow.response_status || '—'}
                  </td>
                  <td className="px-2 py-1.5 text-zinc-500">{formatBytes(flow.response_length)}</td>
                  <td className="px-2 py-1.5 text-zinc-500">{formatDuration(flow.duration_ms)}</td>
                </tr>
              ))}
              {filteredFlows.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-10 text-center text-zinc-600">
                  {proxyRunning ? 'Waiting for traffic… browse through the proxy.' : 'Start the proxy to capture traffic.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Detail panel */}
        {selectedFlow && (
          <div className="w-[440px] shrink-0 flex flex-col gap-2 min-h-0 overflow-auto">
            {/* Actions */}
            <div className="flex gap-2 shrink-0">
              <Button size="sm" variant="outline" className="text-xs border-zinc-700 flex-1"
                onClick={() => sendToRepeater(selectedFlow)}>
                <Repeat2 size={12} className="mr-1" /> Repeater <span className="ml-1 text-zinc-600 text-[10px]">Ctrl+R</span>
              </Button>
              <Button size="sm" variant="outline" className="text-xs border-zinc-700 flex-1"
                onClick={() => sendToIntruder(selectedFlow)}>
                <Crosshair size={12} className="mr-1" /> Intruder <span className="ml-1 text-zinc-600 text-[10px]">Ctrl+I</span>
              </Button>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 flex-1 overflow-auto">
              <p className="text-[10px] text-zinc-500 font-semibold uppercase mb-2">Request</p>
              <pre className="text-[11px] text-zinc-300 font-mono whitespace-pre-wrap break-all">
                {`${selectedFlow.request_method} ${selectedFlow.request_path} HTTP/1.1\nHost: ${selectedFlow.request_host}\n`}
                {selectedFlow.request_headers && Object.entries(selectedFlow.request_headers)
                  .filter(([k]) => k.toLowerCase() !== 'host')
                  .map(([k, v]) => `${k}: ${v}\n`).join('')}
                {selectedFlow.request_body && `\n${selectedFlow.request_body}`}
              </pre>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 flex-1 overflow-auto">
              <p className="text-[10px] text-zinc-500 font-semibold uppercase mb-2">
                Response — <span className={statusBg(selectedFlow.response_status)}>{selectedFlow.response_status}</span>
              </p>
              <pre className="text-[11px] text-zinc-300 font-mono whitespace-pre-wrap break-all">
                {selectedFlow.response_headers && Object.entries(selectedFlow.response_headers)
                  .map(([k, v]) => `${k}: ${v}\n`).join('')}
                {selectedFlow.response_body && `\n${selectedFlow.response_body.slice(0, 8000)}`}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Repeater tab ──────────────────────────────────────────────────────────────
function RepeaterTab() {
  const { repeaterTabs, activeRepeaterTabId, addRepeaterTab, closeRepeaterTab,
    setActiveRepeaterTab, updateRepeaterTab } = useProxyStore()

  const activeTab = repeaterTabs.find(t => t.id === activeRepeaterTabId)

  const handleSend = async () => {
    if (!activeTab) return
    updateRepeaterTab(activeTab.id, { loading: true, response: null })
    try {
      const data = await api.post<any>('/api/proxy/repeat-raw', {
        raw_request: activeTab.rawRequest,
        host: activeTab.host,
        port: activeTab.port,
        use_https: activeTab.useHttps,
      })
      updateRepeaterTab(activeTab.id, { loading: false, response: data })
    } catch (e: any) {
      updateRepeaterTab(activeTab.id, { loading: false, response: { status: 0, headers: {}, body: '', duration_ms: 0, error: String(e) } })
    }
  }

  if (repeaterTabs.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-zinc-600">
        <Repeat2 size={40} className="text-zinc-700" />
        <p className="text-sm">No repeater tabs open.</p>
        <p className="text-xs">Select a request in History and press <kbd className="bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded text-[11px]">Ctrl+R</kbd></p>
        <Button size="sm" variant="outline" onClick={addRepeaterTab}><Plus size={12} className="mr-1" /> New tab</Button>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col gap-2 min-h-0">
      {/* Tab bar */}
      <div className="flex items-center gap-1 shrink-0 overflow-x-auto">
        {repeaterTabs.map(tab => (
          <div key={tab.id} onClick={() => setActiveRepeaterTab(tab.id)}
            className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs cursor-pointer border shrink-0 max-w-[160px] transition-colors',
              activeRepeaterTabId === tab.id
                ? 'bg-zinc-700 border-zinc-600 text-zinc-100'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200')}>
            <span className="truncate">{tab.label}</span>
            <button onClick={e => { e.stopPropagation(); closeRepeaterTab(tab.id) }}
              className="shrink-0 text-zinc-600 hover:text-zinc-300">
              <X size={10} />
            </button>
          </div>
        ))}
        <button onClick={addRepeaterTab}
          className="shrink-0 p-1.5 rounded-md border border-zinc-800 text-zinc-600 hover:text-zinc-400 hover:border-zinc-600">
          <Plus size={12} />
        </button>
      </div>

      {activeTab && (
        <div className="flex-1 flex flex-col gap-2 min-h-0">
          {/* Target bar */}
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => updateRepeaterTab(activeTab.id, { useHttps: !activeTab.useHttps })}
              className={cn('px-2 py-1 rounded border text-xs font-mono font-bold shrink-0',
                activeTab.useHttps ? 'border-green-700 text-green-400 bg-green-950/30' : 'border-zinc-700 text-zinc-400')}>
              {activeTab.useHttps ? 'HTTPS' : 'HTTP'}
            </button>
            <Input className="flex-1 h-7 text-xs bg-zinc-900 font-mono" placeholder="host"
              value={activeTab.host}
              onChange={e => updateRepeaterTab(activeTab.id, { host: e.target.value })} />
            <Input className="w-20 h-7 text-xs bg-zinc-900 font-mono" placeholder="port"
              value={String(activeTab.port)}
              onChange={e => updateRepeaterTab(activeTab.id, { port: parseInt(e.target.value) || 80 })} />
            <Button size="sm" onClick={handleSend} disabled={activeTab.loading} className="shrink-0">
              {activeTab.loading ? <Loader2 size={12} className="animate-spin mr-1" /> : <Send size={12} className="mr-1" />}
              Send
            </Button>
          </div>

          {/* Request | Response */}
          <div className="flex-1 flex gap-3 min-h-0">
            <div className="flex-1 flex flex-col min-h-0">
              <p className="text-[10px] text-zinc-500 font-semibold uppercase mb-1 shrink-0">Request</p>
              <textarea
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-[11px] font-mono text-zinc-200 resize-none focus:outline-none focus:border-zinc-600 min-h-0"
                value={activeTab.rawRequest}
                onChange={e => updateRepeaterTab(activeTab.id, { rawRequest: e.target.value })}
                spellCheck={false}
              />
            </div>
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center gap-2 mb-1 shrink-0">
                <p className="text-[10px] text-zinc-500 font-semibold uppercase">Response</p>
                {activeTab.response && (
                  <span className={cn('text-xs font-mono font-bold', statusBg(activeTab.response.status))}>
                    {activeTab.response.status || 'ERR'}
                  </span>
                )}
                {activeTab.response?.duration_ms ? (
                  <span className="text-[10px] text-zinc-600">{activeTab.response.duration_ms.toFixed(0)}ms</span>
                ) : null}
              </div>
              <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg p-3 overflow-auto min-h-0">
                {activeTab.loading && (
                  <div className="flex items-center gap-2 text-zinc-500 text-xs">
                    <Loader2 size={14} className="animate-spin" /> Sending…
                  </div>
                )}
                {!activeTab.loading && activeTab.response?.error && (
                  <p className="text-red-400 text-xs">{activeTab.response.error}</p>
                )}
                {!activeTab.loading && activeTab.response && !activeTab.response.error && (
                  <pre className="text-[11px] font-mono text-zinc-300 whitespace-pre-wrap break-all">
                    {Object.entries(activeTab.response.headers).map(([k, v]) => `${k}: ${v}\n`).join('')}
                    {'\n'}
                    {activeTab.response.body}
                  </pre>
                )}
                {!activeTab.loading && !activeTab.response && (
                  <p className="text-zinc-700 text-xs">Press Send to get a response.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Intruder tab ──────────────────────────────────────────────────────────────
function IntruderTab() {
  const {
    intruderRequest, intruderHost, intruderPort, intruderHttps,
    intruderResults, intruderRunning, intruderJobId, intruderTotal,
    setIntruderRequest, setIntruderTarget, clearIntruderResults,
  } = useProxyStore()

  const [subTab, setSubTab] = useState<'positions' | 'payloads' | 'results'>('positions')
  const [attackType, setAttackType] = useState<'sniper' | 'cluster_bomb' | 'pitchfork'>('sniper')
  const [payloadSets, setPayloadSets] = useState<{ type: 'builtin' | 'custom'; builtinId: string; custom: string }[]>([
    { type: 'builtin', builtinId: 'sqli-error', custom: '' }
  ])
  const [concurrency, setConcurrency] = useState(10)
  const [timeout, setTimeout2] = useState(10)
  const [filterStatus, setFilterStatus] = useState('')
  const textRef = useRef<HTMLTextAreaElement>(null)
  const resultsEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll results
  useEffect(() => {
    if (intruderRunning) resultsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [intruderResults.length, intruderRunning])

  // Count §markers§
  const markerCount = (intruderRequest.match(/§[^§\n]*§/g) || []).length

  const wrapSelection = () => {
    const ta = textRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const sel = intruderRequest.slice(start, end)
    const next = intruderRequest.slice(0, start) + '§' + sel + '§' + intruderRequest.slice(end)
    setIntruderRequest(next)
    setTimeout(() => {
      ta.focus()
      ta.setSelectionRange(start + 1, end + 1)
    }, 0)
  }

  const clearMarkers = () => setIntruderRequest(intruderRequest.replace(/§/g, ''))

  const getPayloads = (): string[][] => {
    return payloadSets.map(ps => {
      if (ps.type === 'builtin') {
        return PAYLOAD_SETS.find(p => p.id === ps.builtinId)?.payloads ?? []
      }
      return ps.custom.split('\n').map(l => l.trim()).filter(Boolean)
    })
  }

  const handleStart = async () => {
    clearIntruderResults()
    const payloads = getPayloads()
    await api.post('/api/proxy/intruder/start', {
      raw_request: intruderRequest,
      host: intruderHost,
      port: intruderPort,
      use_https: intruderHttps,
      attack_type: attackType,
      payloads,
      concurrency,
      timeout: timeout2,
    })
    setSubTab('results')
  }

  const handleStop = async () => {
    if (intruderJobId) await api.delete(`/api/proxy/intruder/${intruderJobId}`)
  }

  // Filtered results
  const visibleResults = filterStatus
    ? intruderResults.filter(r => String(r.status).startsWith(filterStatus))
    : intruderResults

  // Baseline: most common status in results
  const baselineStatus = intruderResults.length > 0
    ? Object.entries(intruderResults.reduce((acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1; return acc
      }, {} as Record<number, number>)).sort((a, b) => b[1] - a[1])[0]?.[0]
    : null
  const baselineLength = intruderResults.length > 0
    ? Math.round(intruderResults.reduce((s, r) => s + r.length, 0) / intruderResults.length)
    : 0

  const isInteresting = (r: IntruderResult) =>
    (baselineStatus !== null && String(r.status) !== baselineStatus) ||
    (baselineLength > 0 && Math.abs(r.length - baselineLength) > baselineLength * 0.1)

  const timeout2 = timeout

  return (
    <div className="flex-1 flex flex-col gap-2 min-h-0">
      {/* Target + controls */}
      <div className="flex items-center gap-2 shrink-0">
        <button onClick={() => setIntruderTarget(intruderHost, intruderPort, !intruderHttps)}
          className={cn('px-2 py-1 rounded border text-xs font-mono font-bold shrink-0',
            intruderHttps ? 'border-green-700 text-green-400 bg-green-950/30' : 'border-zinc-700 text-zinc-400')}>
          {intruderHttps ? 'HTTPS' : 'HTTP'}
        </button>
        <Input className="flex-1 h-7 text-xs bg-zinc-900 font-mono" placeholder="host"
          value={intruderHost}
          onChange={e => setIntruderTarget(e.target.value, intruderPort, intruderHttps)} />
        <Input className="w-16 h-7 text-xs bg-zinc-900 font-mono" placeholder="port"
          value={String(intruderPort)}
          onChange={e => setIntruderTarget(intruderHost, parseInt(e.target.value) || 80, intruderHttps)} />
        <select value={attackType} onChange={e => setAttackType(e.target.value as any)}
          className="h-7 rounded-md border border-zinc-700 bg-zinc-900 px-2 text-xs text-zinc-300">
          <option value="sniper">Sniper</option>
          <option value="pitchfork">Pitchfork</option>
          <option value="cluster_bomb">Cluster Bomb</option>
        </select>
        {intruderRunning ? (
          <Button size="sm" variant="destructive" onClick={handleStop} className="shrink-0">
            <Square size={12} className="mr-1" /> Stop
          </Button>
        ) : (
          <Button size="sm" onClick={handleStart}
            disabled={!intruderHost || markerCount === 0}
            className="shrink-0 bg-orange-600 hover:bg-orange-500 text-white">
            <Play size={12} className="mr-1" /> Attack
          </Button>
        )}
        {intruderRunning && (
          <span className="text-xs text-orange-400 font-mono shrink-0">
            {intruderResults.length}/{intruderTotal}
          </span>
        )}
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 bg-zinc-900 rounded-md p-0.5 w-fit shrink-0">
        {([
          { id: 'positions', label: `Positions${markerCount > 0 ? ` (${markerCount})` : ''}` },
          { id: 'payloads', label: 'Payloads' },
          { id: 'results', label: `Results${intruderResults.length > 0 ? ` (${intruderResults.length})` : ''}` },
        ] as { id: string; label: string }[]).map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id as any)}
            className={cn('px-3 py-1 text-xs font-medium rounded transition-colors',
              subTab === t.id ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Positions sub-tab */}
      {subTab === 'positions' && (
        <div className="flex-1 flex flex-col gap-2 min-h-0">
          <div className="flex gap-2 shrink-0">
            <Button size="sm" variant="outline" className="text-xs border-zinc-700" onClick={wrapSelection}>
              Add § § around selection
            </Button>
            <Button size="sm" variant="ghost" className="text-xs text-zinc-500" onClick={clearMarkers}>
              <RotateCcw size={11} className="mr-1" /> Clear markers
            </Button>
            {markerCount > 0 && (
              <span className="text-xs text-orange-400 self-center">{markerCount} position{markerCount !== 1 ? 's' : ''} marked</span>
            )}
          </div>
          <div className="text-[10px] text-zinc-600 shrink-0">
            Highlight text and click "Add § §" to mark a position, or type § manually. Each §value§ will be replaced by payloads.
          </div>
          <textarea
            ref={textRef}
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-[11px] font-mono text-zinc-200 resize-none focus:outline-none focus:border-orange-700 min-h-0"
            value={intruderRequest}
            onChange={e => setIntruderRequest(e.target.value)}
            placeholder={'GET /?q=§value§ HTTP/1.1\nHost: example.com\n\n'}
            spellCheck={false}
          />
        </div>
      )}

      {/* Payloads sub-tab */}
      {subTab === 'payloads' && (
        <div className="flex-1 overflow-auto space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-400">Concurrency</span>
            <input type="number" min={1} max={50} value={concurrency}
              onChange={e => setConcurrency(parseInt(e.target.value) || 1)}
              className="w-16 h-7 bg-zinc-900 border border-zinc-800 rounded px-2 text-xs text-zinc-300" />
            <span className="text-xs text-zinc-400">Timeout (s)</span>
            <input type="number" min={1} max={60} value={timeout}
              onChange={e => setTimeout2(parseInt(e.target.value) || 10)}
              className="w-16 h-7 bg-zinc-900 border border-zinc-800 rounded px-2 text-xs text-zinc-300" />
          </div>

          {payloadSets.map((ps, idx) => (
            <PayloadSetEditor
              key={idx}
              index={idx}
              ps={ps}
              attackType={attackType}
              onChange={updated => setPayloadSets(prev => prev.map((p, i) => i === idx ? updated : p))}
              onRemove={payloadSets.length > 1 ? () => setPayloadSets(prev => prev.filter((_, i) => i !== idx)) : undefined}
            />
          ))}

          {(attackType === 'cluster_bomb' || attackType === 'pitchfork') && payloadSets.length < markerCount && (
            <Button size="sm" variant="outline" className="text-xs border-zinc-700" onClick={() =>
              setPayloadSets(prev => [...prev, { type: 'builtin', builtinId: 'fuzzing', custom: '' }])}>
              <Plus size={11} className="mr-1" /> Add payload set (Position {payloadSets.length + 1})
            </Button>
          )}
        </div>
      )}

      {/* Results sub-tab */}
      {subTab === 'results' && (
        <div className="flex-1 flex flex-col gap-2 min-h-0">
          <div className="flex items-center gap-2 shrink-0">
            <Input placeholder="Filter status…" className="w-24 h-7 text-xs bg-zinc-900"
              value={filterStatus} onChange={e => setFilterStatus(e.target.value)} />
            {intruderResults.length > 0 && (
              <span className="text-xs text-zinc-500">
                {intruderResults.length} results
                {baselineStatus && <> · baseline: <span className={statusBg(parseInt(baselineStatus))}>{baselineStatus}</span></>}
                {baselineLength > 0 && <> · avg length: {baselineLength}b</>}
              </span>
            )}
            <Button size="sm" variant="ghost" className="text-xs text-zinc-600 ml-auto" onClick={clearIntruderResults}>
              <Trash2 size={11} className="mr-1" /> Clear
            </Button>
          </div>
          <div className="flex-1 overflow-auto rounded-lg border border-zinc-800 min-h-0">
            <table className="w-full text-xs">
              <thead className="bg-zinc-900 sticky top-0 z-10">
                <tr className="text-zinc-500 text-left">
                  <th className="px-2 py-2 w-10">#</th>
                  <th className="px-2 py-2">Payload</th>
                  <th className="px-2 py-2 w-16">Status</th>
                  <th className="px-2 py-2 w-16">Length</th>
                  <th className="px-2 py-2 w-16">Time</th>
                  <th className="px-2 py-2 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {visibleResults.map((r) => {
                  const interesting = isInteresting(r)
                  return (
                    <tr key={r.index}
                      className={cn('border-b border-zinc-800/50 hover:bg-zinc-800/30',
                        interesting && 'bg-yellow-950/20')}>
                      <td className="px-2 py-1.5 text-zinc-600">{r.index + 1}</td>
                      <td className="px-2 py-1.5 font-mono text-[11px] text-zinc-300 truncate max-w-[280px]">
                        {r.payload}
                      </td>
                      <td className={cn('px-2 py-1.5 font-mono font-semibold', statusBg(r.status))}>
                        {r.error ? <span className="text-red-500">ERR</span> : r.status || '—'}
                      </td>
                      <td className="px-2 py-1.5 text-zinc-400 font-mono">{r.error ? '—' : r.length}</td>
                      <td className="px-2 py-1.5 text-zinc-500">{r.error ? '—' : `${r.duration_ms.toFixed(0)}ms`}</td>
                      <td className="px-2 py-1.5">
                        {interesting && !r.error && (
                          <AlertTriangle size={11} className="text-yellow-500" title="Different from baseline" />
                        )}
                        {r.error && <span className="text-[10px] text-red-500" title={r.error}>!</span>}
                      </td>
                    </tr>
                  )
                })}
                {intruderResults.length === 0 && !intruderRunning && (
                  <tr><td colSpan={6} className="px-3 py-8 text-center text-zinc-600">
                    Mark positions, configure payloads, then click Attack.
                  </td></tr>
                )}
                {intruderRunning && intruderResults.length === 0 && (
                  <tr><td colSpan={6} className="px-3 py-4 text-center text-zinc-500">
                    <Loader2 size={14} className="animate-spin inline mr-2" />Attacking…
                  </td></tr>
                )}
              </tbody>
            </table>
            <div ref={resultsEndRef} />
          </div>
        </div>
      )}
    </div>
  )
}

// ── PayloadSetEditor ──────────────────────────────────────────────────────────
function PayloadSetEditor({ index, ps, attackType, onChange, onRemove }: {
  index: number
  ps: { type: 'builtin' | 'custom'; builtinId: string; custom: string }
  attackType: string
  onChange: (ps: typeof ps) => void
  onRemove?: () => void
}) {
  const [expanded, setExpanded] = useState(true)
  const selectedSet = PAYLOAD_SETS.find(p => p.id === ps.builtinId)
  const count = ps.type === 'builtin' ? (selectedSet?.payloads.length ?? 0)
    : ps.custom.split('\n').filter(l => l.trim()).length

  // Group by category
  const grouped = CATEGORY_ORDER.reduce((acc, cat) => {
    const sets = PAYLOAD_SETS.filter(p => p.category === cat)
    if (sets.length) acc[cat] = sets
    return acc
  }, {} as Record<string, PayloadSet[]>)

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40">
      <button onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-300 hover:text-zinc-100">
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span className="font-medium">
          Payload Set {index + 1}
          {attackType !== 'sniper' && ` — Position ${index + 1}`}
        </span>
        <Badge variant="secondary" className="h-4 px-1 text-[10px] ml-1">{count} payloads</Badge>
        {onRemove && (
          <button onClick={e => { e.stopPropagation(); onRemove() }}
            className="ml-auto text-zinc-700 hover:text-red-400"><X size={11} /></button>
        )}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-zinc-800">
          <div className="flex gap-2 mt-2">
            <button onClick={() => onChange({ ...ps, type: 'builtin' })}
              className={cn('px-2 py-1 rounded text-[11px] border', ps.type === 'builtin' ? 'border-orange-600 text-orange-400 bg-orange-950/30' : 'border-zinc-700 text-zinc-500')}>
              Built-in
            </button>
            <button onClick={() => onChange({ ...ps, type: 'custom' })}
              className={cn('px-2 py-1 rounded text-[11px] border', ps.type === 'custom' ? 'border-orange-600 text-orange-400 bg-orange-950/30' : 'border-zinc-700 text-zinc-500')}>
              Custom list
            </button>
          </div>

          {ps.type === 'builtin' && (
            <div className="space-y-1.5">
              <select value={ps.builtinId} onChange={e => onChange({ ...ps, builtinId: e.target.value })}
                className="w-full h-7 rounded-md border border-zinc-700 bg-zinc-900 px-2 text-xs text-zinc-300">
                {Object.entries(grouped).map(([cat, sets]) => (
                  <optgroup key={cat} label={`── ${cat} ──`}>
                    {sets.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.payloads.length})</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {selectedSet && (
                <p className="text-[10px] text-zinc-600">{selectedSet.description}</p>
              )}
              {selectedSet && (
                <div className="bg-zinc-900 border border-zinc-800 rounded p-2 max-h-32 overflow-auto">
                  {selectedSet.payloads.slice(0, 10).map((p, i) => (
                    <div key={i} className="text-[10px] font-mono text-zinc-500 truncate">{p}</div>
                  ))}
                  {selectedSet.payloads.length > 10 && (
                    <div className="text-[10px] text-zinc-700">…{selectedSet.payloads.length - 10} more</div>
                  )}
                </div>
              )}
            </div>
          )}

          {ps.type === 'custom' && (
            <textarea
              className="w-full h-40 bg-zinc-900 border border-zinc-800 rounded p-2 text-[11px] font-mono text-zinc-300 resize-none focus:outline-none focus:border-zinc-600"
              placeholder={"one payload per line\npayload1\npayload2\n..."}
              value={ps.custom}
              onChange={e => onChange({ ...ps, custom: e.target.value })}
              spellCheck={false}
            />
          )}
        </div>
      )}
    </div>
  )
}
