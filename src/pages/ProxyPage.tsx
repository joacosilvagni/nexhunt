import { useState } from 'react'
import { WorkspaceShell } from '@/components/layout/WorkspaceShell'
import { useProxyStore } from '@/stores/proxy-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn, getMethodColor, getStatusColor, formatBytes, formatDuration } from '@/lib/utils'
import { api } from '@/api/http-client'
import {
  Play,
  Square,
  Shield,
  ShieldOff,
  Trash2,
  Search,
  Send,
  ArrowUpDown
} from 'lucide-react'

type Tab = 'history' | 'intercept' | 'repeater'

export function ProxyPage() {
  const [activeTab, setActiveTab] = useState<Tab>('history')
  const {
    flows, selectedFlowId, selectFlow,
    interceptEnabled, setInterceptEnabled,
    proxyRunning, setProxyRunning,
    filter, setFilter, clearFlows
  } = useProxyStore()

  const selectedFlow = flows.find(f => f.id === selectedFlowId)

  // Filter flows
  const filteredFlows = flows.filter(f => {
    if (filter.host && !f.request_host.includes(filter.host)) return false
    if (filter.method && f.request_method !== filter.method) return false
    if (filter.statusCode && String(f.response_status) !== filter.statusCode) return false
    if (filter.search) {
      const search = filter.search.toLowerCase()
      return (
        f.request_url.toLowerCase().includes(search) ||
        f.request_host.toLowerCase().includes(search)
      )
    }
    return true
  })

  const handleStartProxy = async () => {
    try {
      await api.post('/api/proxy/start')
      setProxyRunning(true)
    } catch (err) {
      console.error('Failed to start proxy:', err)
    }
  }

  const handleStopProxy = async () => {
    try {
      await api.post('/api/proxy/stop')
      setProxyRunning(false)
    } catch (err) {
      console.error('Failed to stop proxy:', err)
    }
  }

  const handleToggleIntercept = async () => {
    try {
      await api.post('/api/proxy/intercept/toggle', { enabled: !interceptEnabled })
      setInterceptEnabled(!interceptEnabled)
    } catch (err) {
      console.error('Failed to toggle intercept:', err)
    }
  }

  return (
    <WorkspaceShell title="Proxy" subtitle="HTTP/HTTPS interception proxy">
      <div className="flex flex-col h-full gap-4">
        {/* Toolbar */}
        <div className="flex items-center gap-2">
          {proxyRunning ? (
            <Button variant="destructive" size="sm" onClick={handleStopProxy}>
              <Square size={14} className="mr-1" /> Stop Proxy
            </Button>
          ) : (
            <Button size="sm" onClick={handleStartProxy}>
              <Play size={14} className="mr-1" /> Start Proxy
            </Button>
          )}

          <Button
            variant={interceptEnabled ? 'default' : 'outline'}
            size="sm"
            onClick={handleToggleIntercept}
          >
            {interceptEnabled
              ? <><Shield size={14} className="mr-1" /> Intercept ON</>
              : <><ShieldOff size={14} className="mr-1" /> Intercept OFF</>
            }
          </Button>

          <div className="flex-1" />

          {/* Tabs */}
          <div className="flex gap-1 bg-zinc-900 rounded-lg p-1">
            {(['history', 'intercept', 'repeater'] as Tab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize',
                  activeTab === tab
                    ? 'bg-zinc-700 text-zinc-100'
                    : 'text-zinc-400 hover:text-zinc-200'
                )}
              >
                {tab}
              </button>
            ))}
          </div>

          <Button variant="ghost" size="icon" onClick={clearFlows}>
            <Trash2 size={14} />
          </Button>
        </div>

        {/* Filters */}
        {activeTab === 'history' && (
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <Input
                placeholder="Filter by URL or host..."
                className="pl-9 h-8 text-xs bg-zinc-900"
                value={filter.search}
                onChange={e => setFilter({ search: e.target.value })}
              />
            </div>
            <Input
              placeholder="Host"
              className="w-32 h-8 text-xs bg-zinc-900"
              value={filter.host}
              onChange={e => setFilter({ host: e.target.value })}
            />
            <select
              className="h-8 rounded-md border border-input bg-zinc-900 px-2 text-xs text-zinc-300"
              value={filter.method}
              onChange={e => setFilter({ method: e.target.value })}
            >
              <option value="">All Methods</option>
              {['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'].map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        )}

        {/* Content area */}
        <div className="flex-1 flex gap-4 min-h-0">
          {activeTab === 'history' && (
            <>
              {/* Flow table */}
              <div className="flex-1 overflow-auto rounded-lg border border-zinc-800">
                <table className="w-full text-xs">
                  <thead className="bg-zinc-900 sticky top-0">
                    <tr className="text-zinc-500 text-left">
                      <th className="px-3 py-2 w-8">#</th>
                      <th className="px-3 py-2 w-16">Method</th>
                      <th className="px-3 py-2 w-40">Host</th>
                      <th className="px-3 py-2">Path</th>
                      <th className="px-3 py-2 w-16">Status</th>
                      <th className="px-3 py-2 w-20">Size</th>
                      <th className="px-3 py-2 w-16">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFlows.map((flow, idx) => (
                      <tr
                        key={flow.id}
                        onClick={() => selectFlow(flow.id)}
                        className={cn(
                          'cursor-pointer border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors',
                          selectedFlowId === flow.id && 'bg-zinc-800/50'
                        )}
                      >
                        <td className="px-3 py-1.5 text-zinc-600">{idx + 1}</td>
                        <td className={cn('px-3 py-1.5 font-mono font-bold', getMethodColor(flow.request_method))}>
                          {flow.request_method}
                        </td>
                        <td className="px-3 py-1.5 text-zinc-400 truncate max-w-[160px]">
                          {flow.request_host}
                        </td>
                        <td className="px-3 py-1.5 text-zinc-300 truncate max-w-[300px]">
                          {flow.request_path}
                        </td>
                        <td className={cn('px-3 py-1.5 font-mono', getStatusColor(flow.response_status))}>
                          {flow.response_status}
                        </td>
                        <td className="px-3 py-1.5 text-zinc-500">
                          {formatBytes(flow.response_length)}
                        </td>
                        <td className="px-3 py-1.5 text-zinc-500">
                          {formatDuration(flow.duration_ms)}
                        </td>
                      </tr>
                    ))}
                    {filteredFlows.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-3 py-8 text-center text-zinc-600">
                          {proxyRunning
                            ? 'Waiting for traffic... Configure your browser to use the proxy.'
                            : 'Start the proxy to begin capturing traffic.'
                          }
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Request/Response viewer */}
              {selectedFlow && (
                <div className="w-[450px] flex flex-col gap-2 overflow-auto">
                  <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3 flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs font-semibold text-zinc-400 uppercase">Request</h3>
                      <Button variant="ghost" size="sm" className="h-6 text-xs">
                        <Send size={12} className="mr-1" /> Send to Repeater
                      </Button>
                    </div>
                    <pre className="text-xs text-zinc-300 font-mono whitespace-pre-wrap break-all overflow-auto max-h-[300px]">
                      {`${selectedFlow.request_method} ${selectedFlow.request_path} HTTP/1.1\nHost: ${selectedFlow.request_host}\n`}
                      {selectedFlow.request_headers && Object.entries(selectedFlow.request_headers).map(([k, v]) =>
                        `${k}: ${v}\n`
                      ).join('')}
                      {selectedFlow.request_body && `\n${selectedFlow.request_body}`}
                    </pre>
                  </div>
                  <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3 flex-1">
                    <h3 className="text-xs font-semibold text-zinc-400 uppercase mb-2">Response</h3>
                    <pre className="text-xs text-zinc-300 font-mono whitespace-pre-wrap break-all overflow-auto max-h-[300px]">
                      {`HTTP/1.1 ${selectedFlow.response_status}\n`}
                      {selectedFlow.response_headers && Object.entries(selectedFlow.response_headers).map(([k, v]) =>
                        `${k}: ${v}\n`
                      ).join('')}
                      {selectedFlow.response_body && `\n${selectedFlow.response_body?.slice(0, 5000)}`}
                    </pre>
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === 'intercept' && (
            <div className="flex-1 flex items-center justify-center text-zinc-500">
              <div className="text-center">
                <Shield size={48} className="mx-auto mb-4 text-zinc-600" />
                <p className="text-lg font-medium">
                  {interceptEnabled ? 'Intercept is enabled' : 'Intercept is disabled'}
                </p>
                <p className="text-sm text-zinc-600 mt-1">
                  {interceptEnabled
                    ? 'Incoming requests will be paused for inspection.'
                    : 'Enable intercept to pause and modify requests.'
                  }
                </p>
              </div>
            </div>
          )}

          {activeTab === 'repeater' && (
            <div className="flex-1 flex items-center justify-center text-zinc-500">
              <div className="text-center">
                <ArrowUpDown size={48} className="mx-auto mb-4 text-zinc-600" />
                <p className="text-lg font-medium">Repeater</p>
                <p className="text-sm text-zinc-600 mt-1">
                  Select a request from HTTP History and send it to the Repeater.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </WorkspaceShell>
  )
}
