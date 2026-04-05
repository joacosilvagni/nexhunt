import { useState, useRef, useEffect } from 'react'
import { WorkspaceShell } from '@/components/layout/WorkspaceShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api } from '@/api/http-client'
import { cn } from '@/lib/utils'
import {
  Bot,
  Send,
  User,
  Loader2,
  Lightbulb,
  FileText,
  Target,
  Sparkles
} from 'lucide-react'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

const quickActions = [
  { icon: Target, label: 'Analyze findings', prompt: 'Analyze my current findings and prioritize them by bounty potential.' },
  { icon: Lightbulb, label: 'Suggest next steps', prompt: 'Based on the recon data, what should I test next?' },
  { icon: FileText, label: 'Generate report', prompt: 'Generate a bug bounty report for the most critical finding.' },
  { icon: Sparkles, label: 'Explain vulnerability', prompt: 'Explain the most recent vulnerability found and how to exploit it further.' }
]

export function CopilotPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (content: string) => {
    if (!content.trim() || loading) return

    const userMsg: ChatMessage = { role: 'user', content, timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const result = await api.post<{ response: string }>('/api/copilot/chat', {
        message: content
      })
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: result.response || 'No response received.',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, assistantMsg])
    } catch (err) {
      const errorMsg: ChatMessage = {
        role: 'assistant',
        content: `Error: Could not reach the AI backend. Make sure your API key is configured in Settings.\n\n${err}`,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMsg])
    } finally {
      setLoading(false)
    }
  }

  return (
    <WorkspaceShell title="AI Copilot" subtitle="AI-powered analysis and suggestions">
      <div className="flex flex-col h-full">
        {/* Messages area */}
        <div className="flex-1 overflow-auto space-y-4 pb-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="rounded-full bg-green-500/10 p-6 mb-4">
                <Bot size={48} className="text-green-500" />
              </div>
              <h2 className="text-xl font-bold text-zinc-200 mb-2">AI Copilot</h2>
              <p className="text-zinc-500 max-w-md mb-8">
                I can analyze your findings, suggest next steps, generate reports, and help you
                understand vulnerabilities. Ask me anything about your targets.
              </p>

              {/* Quick actions */}
              <div className="grid grid-cols-2 gap-2 max-w-lg">
                {quickActions.map(action => (
                  <button
                    key={action.label}
                    onClick={() => sendMessage(action.prompt)}
                    className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-left text-sm text-zinc-300 hover:bg-zinc-800/50 transition-colors"
                  >
                    <action.icon size={16} className="text-green-500 shrink-0" />
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                'flex gap-3 max-w-3xl',
                msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''
              )}
            >
              <div className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                msg.role === 'user' ? 'bg-blue-500/10 text-blue-500' : 'bg-green-500/10 text-green-500'
              )}>
                {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
              </div>
              <div className={cn(
                'rounded-xl px-4 py-3 text-sm',
                msg.role === 'user'
                  ? 'bg-blue-600/20 text-zinc-200'
                  : 'bg-zinc-800 text-zinc-300'
              )}>
                <pre className="whitespace-pre-wrap font-sans">{msg.content}</pre>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-500/10 text-green-500">
                <Bot size={16} />
              </div>
              <div className="rounded-xl bg-zinc-800 px-4 py-3">
                <Loader2 size={16} className="animate-spin text-zinc-400" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="flex items-center gap-2 pt-4 border-t border-zinc-800">
          <Input
            placeholder="Ask the AI copilot anything..."
            className="flex-1 bg-zinc-900"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
            disabled={loading}
          />
          <Button onClick={() => sendMessage(input)} disabled={loading || !input.trim()}>
            <Send size={14} />
          </Button>
        </div>
      </div>
    </WorkspaceShell>
  )
}
