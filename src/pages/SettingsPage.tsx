import { useState, useEffect } from 'react'
import { WorkspaceShell } from '@/components/layout/WorkspaceShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { api } from '@/api/http-client'
import type { ToolStatus } from '@/types'
import { TOOL_CATEGORIES } from '@/lib/constants'
import {
  Wrench,
  CheckCircle,
  XCircle,
  Download,
  Key,
  Globe,
  Check,
} from 'lucide-react'

const GROQ_MODELS = [
  { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B Versatile (recommended)' },
  { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant (fastest)' },
  { id: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B (32k context)' },
  { id: 'gemma2-9b-it', label: 'Gemma 2 9B (Google)' },
]

export function SettingsPage() {
  const [tools, setTools] = useState<ToolStatus[]>([])
  const [proxyPort, setProxyPort] = useState('8080')
  const [aiProvider, setAiProvider] = useState('groq')
  const [aiModel, setAiModel] = useState('llama-3.3-70b-versatile')
  const [groqKey, setGroqKey] = useState('')
  const [aiApiKey, setAiApiKey] = useState('')
  const [saved, setSaved] = useState(false)

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
    // Load current settings
    api.get<any>('/api/settings').then(s => {
      if (s.proxy_port) setProxyPort(String(s.proxy_port))
      if (s.ai_provider) setAiProvider(s.ai_provider)
      if (s.ai_model) setAiModel(s.ai_model)
      if (s.ai_groq_key) setGroqKey(s.ai_groq_key)
    }).catch(() => {})
  }, [])

  const handleSaveSettings = async () => {
    try {
      await api.post('/api/settings', {
        proxy_port: parseInt(proxyPort),
        ai_provider: aiProvider,
        ai_model: aiModel,
        ai_groq_key: groqKey,
        ai_api_key: aiApiKey || undefined,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
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
          <div className="space-y-4">
            <div className="flex gap-4 flex-wrap">
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(`http://127.0.0.1:17707/api/proxy/cert`, '_blank')}
                >
                  <Download size={12} className="mr-1" /> Download CA Cert
                </Button>
              </div>
            </div>

            {/* Setup guide */}
            <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4 space-y-3">
              <div className="text-xs font-semibold text-zinc-300">FoxyProxy Setup — step by step</div>
              <ol className="space-y-2">
                {[
                  { n: 1, title: 'Start the proxy', desc: 'Go to the Proxy tab and click Start. The proxy listens on port 8080.' },
                  { n: 2, title: 'Configure FoxyProxy', desc: 'Add a new proxy: Type = HTTP, Host = 127.0.0.1, Port = 8080. Enable it.' },
                  { n: 3, title: 'HTTP sites', desc: 'Already works. Browse any http:// site — traffic appears in the Proxy tab.' },
                  { n: 4, title: 'HTTPS sites (CA cert required)', desc: 'Download the cert above. In Firefox: Settings → Privacy & Security → View Certificates → AUTHORITIES tab → Import. Tick "Trust this CA to identify websites". Do NOT use the "Your Certificates" tab — that gives a private key error.' },
                  { n: 5, title: 'Verify', desc: 'Browse any https:// site. It should load normally and flows appear in NexHunt.' },
                ].map(step => (
                  <li key={step.n} className="flex gap-3 text-xs">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-zinc-700 text-zinc-300 flex items-center justify-center text-[10px] font-bold mt-0.5">
                      {step.n}
                    </span>
                    <div>
                      <span className="font-medium text-zinc-300">{step.title} — </span>
                      <span className="text-zinc-500">{step.desc}</span>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="text-[11px] text-zinc-600 border-t border-zinc-800 pt-2">
                Chrome/Chromium: import the cert via chrome://settings/certificates → Authorities → Import
              </div>
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
                <option value="groq">Groq (fast + free tier)</option>
                <option value="openai">OpenAI</option>
                <option value="claude">Claude (Anthropic)</option>
              </select>
            </div>

            {aiProvider === 'groq' && (
              <>
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Groq API Key</label>
                  <Input
                    type="password"
                    className="bg-zinc-900 font-mono text-sm"
                    placeholder="gsk_..."
                    value={groqKey}
                    onChange={e => setGroqKey(e.target.value)}
                  />
                  <p className="text-[11px] text-zinc-600 mt-1">Get a free key at console.groq.com</p>
                </div>
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Model</label>
                  <select
                    className="h-9 rounded-md border border-input bg-zinc-900 px-3 text-sm text-zinc-300 w-full max-w-sm"
                    value={aiModel}
                    onChange={e => setAiModel(e.target.value)}
                  >
                    {GROQ_MODELS.map(m => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {(aiProvider === 'openai' || aiProvider === 'claude') && (
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
            )}

            <Button onClick={handleSaveSettings} size="sm" className="flex items-center gap-2">
              {saved ? <><Check size={13} /> Saved!</> : 'Save Settings'}
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
