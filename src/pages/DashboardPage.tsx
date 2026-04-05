import { WorkspaceShell } from '@/components/layout/WorkspaceShell'
import { useProxyStore } from '@/stores/proxy-store'
import { useScannerStore } from '@/stores/scanner-store'
import { useReconStore } from '@/stores/recon-store'
import { Badge } from '@/components/ui/badge'
import {
  Globe,
  Radar,
  ScanSearch,
  Swords,
  Bug,
  Shield,
  Activity
} from 'lucide-react'

function StatCard({ icon: Icon, label, value, color }: {
  icon: typeof Globe
  label: string
  value: string | number
  color: string
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
      <div className="flex items-center gap-3">
        <div className={`rounded-lg p-2 ${color}`}>
          <Icon size={20} />
        </div>
        <div>
          <p className="text-2xl font-bold text-zinc-100">{value}</p>
          <p className="text-xs text-zinc-500">{label}</p>
        </div>
      </div>
    </div>
  )
}

export function DashboardPage() {
  const { flows, proxyRunning } = useProxyStore()
  const { findings } = useScannerStore()
  const { subdomains } = useReconStore()

  const criticalCount = findings.filter(f => f.severity === 'critical').length
  const highCount = findings.filter(f => f.severity === 'high').length

  return (
    <WorkspaceShell title="Dashboard" subtitle="Overview of your bug bounty session">
      <div className="space-y-6">
        {/* Stats grid */}
        <div className="grid grid-cols-4 gap-4">
          <StatCard
            icon={Globe}
            label="HTTP Flows"
            value={flows.length}
            color="bg-blue-500/10 text-blue-500"
          />
          <StatCard
            icon={Radar}
            label="Subdomains"
            value={subdomains.length}
            color="bg-cyan-500/10 text-cyan-500"
          />
          <StatCard
            icon={Bug}
            label="Findings"
            value={findings.length}
            color="bg-amber-500/10 text-amber-500"
          />
          <StatCard
            icon={Shield}
            label="Critical/High"
            value={`${criticalCount}/${highCount}`}
            color="bg-red-500/10 text-red-500"
          />
        </div>

        {/* Quick status */}
        <div className="grid grid-cols-2 gap-4">
          {/* Proxy status */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Activity size={16} className="text-green-500" />
              <h3 className="font-semibold text-zinc-200">Proxy Status</h3>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-500">Status</span>
                <Badge variant={proxyRunning ? 'default' : 'secondary'}>
                  {proxyRunning ? 'Running' : 'Stopped'}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Total flows</span>
                <span className="text-zinc-300">{flows.length}</span>
              </div>
            </div>
          </div>

          {/* Recent findings */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <div className="flex items-center gap-2 mb-4">
              <ScanSearch size={16} className="text-amber-500" />
              <h3 className="font-semibold text-zinc-200">Recent Findings</h3>
            </div>
            {findings.length === 0 ? (
              <p className="text-sm text-zinc-500">No findings yet. Start scanning!</p>
            ) : (
              <div className="space-y-2">
                {findings.slice(0, 5).map((f) => (
                  <div key={f.id} className="flex items-center justify-between text-sm">
                    <span className="text-zinc-300 truncate max-w-[200px]">{f.title}</span>
                    <Badge variant={f.severity as 'critical' | 'high' | 'medium' | 'low' | 'info'}>
                      {f.severity}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Welcome message when empty */}
        {flows.length === 0 && findings.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-green-500/10 p-6 mb-4">
              <Swords size={48} className="text-green-500" />
            </div>
            <h2 className="text-2xl font-bold text-zinc-200 mb-2">Welcome to NexHunt</h2>
            <p className="text-zinc-500 max-w-md">
              Start by setting up a project, configuring the proxy, or launching a recon scan.
              All your bug bounty workflow in one place.
            </p>
          </div>
        )}
      </div>
    </WorkspaceShell>
  )
}
