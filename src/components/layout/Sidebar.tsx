import { NavLink, useNavigate } from 'react-router-dom'
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
  WifiOff,
  TerminalSquare,
  BookOpen,
} from 'lucide-react'

const navItems = [
  { path: '/proxy', icon: Globe, label: 'Proxy', requiresProject: true },
  { path: '/recon', icon: Radar, label: 'Recon', requiresProject: true },
  { path: '/scanner', icon: ScanSearch, label: 'Scanner', requiresProject: true },
  { path: '/exploit', icon: Swords, label: 'Exploit', requiresProject: true },
  { path: '/workspace', icon: BookOpen, label: 'Workspace', requiresProject: true },
  { path: '/copilot', icon: Bot, label: 'AI Copilot', requiresProject: false },
  { path: '/terminal', icon: TerminalSquare, label: 'Terminal', requiresProject: false },
]

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar, backendConnected, activeProject, activeProjectData } = useAppStore()
  const navigate = useNavigate()

  const hasProject = !!activeProject

  return (
    <aside
      className={cn(
        'flex flex-col border-r border-zinc-800 bg-zinc-950 transition-all duration-200',
        sidebarCollapsed ? 'w-16' : 'w-56'
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 border-b border-zinc-800 px-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-600 font-bold text-white text-sm">
          NH
        </div>
        {!sidebarCollapsed && (
          <span className="font-bold text-lg tracking-tight">
            Nex<span className="text-green-500">Hunt</span>
          </span>
        )}
      </div>

      {/* Active project banner */}
      <div
        className={cn(
          'border-b border-zinc-800 cursor-pointer transition-colors',
          hasProject
            ? 'hover:bg-zinc-900/60'
            : 'hover:bg-zinc-900/40',
          sidebarCollapsed ? 'px-2 py-2' : 'px-3 py-2.5'
        )}
        onClick={() => navigate('/projects')}
        title={hasProject ? `Project: ${activeProjectData?.name}` : 'Select a project'}
      >
        {sidebarCollapsed ? (
          <div className={cn(
            'flex items-center justify-center w-8 h-8 rounded-md',
            hasProject ? 'bg-green-900/40 text-green-400' : 'bg-zinc-900 text-zinc-600'
          )}>
            <FolderOpen size={14} />
          </div>
        ) : (
          <div className="flex items-center gap-2 min-w-0">
            <FolderOpen size={13} className={hasProject ? 'text-green-400 shrink-0' : 'text-zinc-600 shrink-0'} />
            <div className="flex-1 min-w-0">
              {hasProject ? (
                <>
                  <div className="text-[9px] text-zinc-600 uppercase tracking-wider">Active project</div>
                  <div className="text-xs font-medium text-green-400 truncate">{activeProjectData?.name ?? '...'}</div>
                </>
              ) : (
                <>
                  <div className="text-[9px] text-zinc-600 uppercase tracking-wider">No project</div>
                  <div className="text-xs text-zinc-500">Select a project →</div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Dashboard — always accessible */}
      <nav className="flex-1 space-y-1 p-2 overflow-y-auto">
        <NavLink
          to="/"
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
              isActive
                ? 'bg-zinc-800 text-green-500'
                : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
            )
          }
        >
          <LayoutDashboard size={18} />
          {!sidebarCollapsed && <span>Dashboard</span>}
        </NavLink>

        {/* Project-required tools */}
        {!sidebarCollapsed && (
          <div className="px-3 pt-3 pb-1">
            <span className="text-[9px] text-zinc-700 uppercase tracking-widest font-semibold">
              {hasProject ? 'Tools' : 'Tools — select project first'}
            </span>
          </div>
        )}

        {navItems.map(({ path, icon: Icon, label, requiresProject }) => {
          const locked = requiresProject && !hasProject
          return (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  locked
                    ? 'text-zinc-700 cursor-default'
                    : isActive
                      ? 'bg-zinc-800 text-green-500'
                      : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
                )
              }
              title={locked ? 'Select a project first' : label}
            >
              <Icon size={18} className={locked ? 'text-zinc-700' : undefined} />
              {!sidebarCollapsed && (
                <span className={locked ? 'text-zinc-700' : undefined}>{label}</span>
              )}
            </NavLink>
          )
        })}
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
            <span>{backendConnected ? 'Backend online' : 'Backend offline'}</span>
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

        {/* Projects */}
        <NavLink
          to="/projects"
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
              isActive
                ? 'bg-zinc-800 text-green-500'
                : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
            )
          }
        >
          <FolderOpen size={18} />
          {!sidebarCollapsed && <span>Projects</span>}
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
