import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/stores/app-store'
import {
  LayoutDashboard,
  Globe,
  Radar,
  ScanSearch,
  Swords,
  Bot,
  FolderOpen,
  Settings,
  ChevronLeft,
  ChevronRight,
  Wifi,
  WifiOff
} from 'lucide-react'

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/proxy', icon: Globe, label: 'Proxy' },
  { path: '/recon', icon: Radar, label: 'Recon' },
  { path: '/scanner', icon: ScanSearch, label: 'Scanner' },
  { path: '/exploit', icon: Swords, label: 'Exploit' },
  { path: '/copilot', icon: Bot, label: 'AI Copilot' },
  { path: '/projects', icon: FolderOpen, label: 'Projects' }
]

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar, backendConnected } = useAppStore()

  return (
    <aside
      className={cn(
        'flex flex-col border-r border-zinc-800 bg-zinc-950 transition-all duration-200',
        sidebarCollapsed ? 'w-16' : 'w-56'
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 border-b border-zinc-800 px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-600 font-bold text-white text-sm">
          NH
        </div>
        {!sidebarCollapsed && (
          <span className="font-bold text-lg tracking-tight">
            Nex<span className="text-green-500">Hunt</span>
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-2">
        {navItems.map(({ path, icon: Icon, label }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-zinc-800 text-green-500'
                  : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
              )
            }
          >
            <Icon size={18} />
            {!sidebarCollapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-zinc-800 p-2 space-y-1">
        {/* Connection status */}
        <div className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-xs',
          backendConnected ? 'text-green-500' : 'text-red-500'
        )}>
          {backendConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
          {!sidebarCollapsed && (
            <span>{backendConnected ? 'Backend connected' : 'Backend offline'}</span>
          )}
        </div>

        {/* Settings */}
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
              isActive
                ? 'bg-zinc-800 text-green-500'
                : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
            )
          }
        >
          <Settings size={18} />
          {!sidebarCollapsed && <span>Settings</span>}
        </NavLink>

        {/* Collapse toggle */}
        <button
          onClick={toggleSidebar}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200 transition-colors"
        >
          {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          {!sidebarCollapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  )
}
