import { useAppStore } from '@/stores/app-store'
import { useProxyStore } from '@/stores/proxy-store'
import { Badge } from '@/components/ui/badge'

interface TopBarProps {
  title: string
  subtitle?: string
}

export function TopBar({ title, subtitle }: TopBarProps) {
  const { backendConnected } = useAppStore()
  const { proxyRunning, flows } = useProxyStore()

  return (
    <header className="flex h-14 items-center justify-between border-b border-zinc-800 bg-zinc-950/50 px-6">
      <div>
        <h1 className="text-lg font-semibold text-zinc-100">{title}</h1>
        {subtitle && <p className="text-xs text-zinc-500">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        {proxyRunning && (
          <Badge variant="outline" className="text-green-500 border-green-500/30">
            Proxy ON : {flows.length} flows
          </Badge>
        )}
        <Badge variant={backendConnected ? 'default' : 'destructive'}>
          {backendConnected ? 'Online' : 'Offline'}
        </Badge>
      </div>
    </header>
  )
}
