import { useState, useEffect } from 'react'
import { WorkspaceShell } from '@/components/layout/WorkspaceShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { api } from '@/api/http-client'
import type { ToolStatus } from '@/types'
import { TOOL_CATEGORIES } from '@/lib/constants'
import {
  Settings,
  Wrench,
  CheckCircle,
  XCircle,
  Download,
  Key,
  Globe
} from 'lucide-react'

export function SettingsPage() {
  const [tools, setTools] = useState<ToolStatus[]>([])
  const [proxyPort, setProxyPort] = useState('8080')
  const [aiApiKey, setAiApiKey] = useState('')
  const [aiProvider, setAiProvider] = useState('claude')

  const fetchTools = async () => {
    try {
      const data = await api.get<ToolStatus[]>('/api/tools/status')
      setTools(data)
    } catch (err) {
      console.error('Failed to fetch tool status:', err)
    }
  }

  useEffect(() => {
    fetchTools()
  }, [])

  const handleSaveSettings = async () => {
    try {
      await api.post('/api/settings', {
        proxy_port: parseInt(proxyPort),
        ai_api_key: aiApiKey,
        ai_provider: aiProvider
      })
    } catch (err) {
      console.error('Failed to save settings:', err)
    }
  }

  return (
    <WorkspaceShell title="Settings" subtitle="Configure NexHunt">
      <div className="space-y-6 max-w-3xl">
        {/* Proxy settings */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <h3 className="font-semibold text-zinc-200 mb-4 flex items-center gap-2">
            <Globe size={16} /> Proxy Settings
          </h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Proxy Port</label>
              <Input
                className="w-32 bg-zinc-900"
                value={proxyPort}
                onChange={e => setProxyPort(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">CA Certificate</label>
              <Button variant="outline" size="sm">
                <Download size={12} className="mr-1" /> Download CA Cert
              </Button>
            </div>
          </div>
        </div>

        {/* AI settings */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <h3 className="font-semibold text-zinc-200 mb-4 flex items-center gap-2">
            <Key size={16} /> AI Copilot Settings
          </h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">AI Provider</label>
              <select
                className="h-9 rounded-md border border-input bg-zinc-900 px-3 text-sm text-zinc-300 w-48"
                value={aiProvider}
                onChange={e => setAiProvider(e.target.value)}
              >
                <option value="claude">Claude (Anthropic)</option>
                <option value="openai">OpenAI</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">API Key</label>
              <Input
                type="password"
                className="bg-zinc-900"
                placeholder="sk-..."
                value={aiApiKey}
                onChange={e => setAiApiKey(e.target.value)}
              />
            </div>
            <Button onClick={handleSaveSettings} size="sm">
              Save Settings
            </Button>
          </div>
        </div>

        {/* Installed tools */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <h3 className="font-semibold text-zinc-200 mb-4 flex items-center gap-2">
            <Wrench size={16} /> External Tools
          </h3>
          <div className="space-y-4">
            {Object.entries(TOOL_CATEGORIES).map(([category, toolNames]) => (
              <div key={category}>
                <h4 className="text-xs font-medium text-zinc-500 uppercase mb-2">{category}</h4>
                <div className="grid grid-cols-2 gap-2">
                  {toolNames.map(name => {
                    const tool = tools.find(t => t.name === name)
                    const installed = tool?.installed ?? false
                    return (
                      <div
                        key={name}
                        className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2"
                      >
                        <div className="flex items-center gap-2">
                          {installed ? (
                            <CheckCircle size={14} className="text-green-500" />
                          ) : (
                            <XCircle size={14} className="text-red-500" />
                          )}
                          <span className="text-sm text-zinc-300">{name}</span>
                        </div>
                        {tool?.version && (
                          <Badge variant="secondary" className="text-[10px]">
                            {tool.version}
                          </Badge>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
          <Button variant="outline" size="sm" className="mt-4" onClick={fetchTools}>
            Refresh Status
          </Button>
        </div>
      </div>
    </WorkspaceShell>
  )
}
