import { useState, useEffect } from 'react'
import { WorkspaceShell } from '@/components/layout/WorkspaceShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useAppStore } from '@/stores/app-store'
import { api } from '@/api/http-client'
import type { Project } from '@/types'
import {
  FolderOpen,
  Plus,
  Check,
  Trash2,
  X,
  Globe,
  StickyNote,
  Target,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [newName, setNewName] = useState('')
  const [newScopeInput, setNewScopeInput] = useState('')
  const [newScopeList, setNewScopeList] = useState<string[]>([])
  const [newNotes, setNewNotes] = useState('')
  const [creating, setCreating] = useState(false)
  const [editingScope, setEditingScope] = useState<string | null>(null)  // project id being edited
  const [scopeInput, setScopeInput] = useState('')
  const { activeProject, setActiveProject, setActiveProjectData } = useAppStore()

  const fetchProjects = async () => {
    try {
      const data = await api.get<Project[]>('/api/projects')
      setProjects(data)
      // Update active project data in store
      if (activeProject) {
        const active = data.find(p => p.id === activeProject)
        if (active) setActiveProjectData(active)
      }
    } catch (err) {
      console.error('Failed to fetch projects:', err)
    }
  }

  useEffect(() => { fetchProjects() }, [])

  // Add domain to new project scope list
  const addToNewScope = () => {
    const val = newScopeInput.trim()
    if (!val || newScopeList.includes(val)) return
    setNewScopeList(prev => [...prev, val])
    setNewScopeInput('')
  }

  const removeFromNewScope = (domain: string) => {
    setNewScopeList(prev => prev.filter(d => d !== domain))
  }

  const handleCreate = async () => {
    if (!newName.trim()) return
    setCreating(true)
    try {
      await api.post('/api/projects', {
        name: newName.trim(),
        scope: newScopeList,
        notes: newNotes.trim() || undefined,
      })
      setNewName('')
      setNewScopeList([])
      setNewScopeInput('')
      setNewNotes('')
      await fetchProjects()
    } catch (err) {
      console.error('Failed to create project:', err)
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/projects/${id}`)
      if (activeProject === id) {
        setActiveProject(null)
        setActiveProjectData(null)
      }
      await fetchProjects()
    } catch (err) {
      console.error('Failed to delete project:', err)
    }
  }

  const handleSetActive = (project: Project) => {
    setActiveProject(project.id)
    setActiveProjectData(project)
  }

  // Add scope domain to existing project
  const handleAddScopeDomain = async (project: Project, domain: string) => {
    const newScope = [...project.scope, domain]
    try {
      await api.put(`/api/projects/${project.id}`, { scope: newScope })
      await fetchProjects()
      setScopeInput('')
      setEditingScope(null)
    } catch (err) {
      console.error('Failed to update scope:', err)
    }
  }

  const handleRemoveScopeDomain = async (project: Project, domain: string) => {
    const newScope = project.scope.filter(d => d !== domain)
    try {
      await api.put(`/api/projects/${project.id}`, { scope: newScope })
      await fetchProjects()
    } catch (err) {
      console.error('Failed to update scope:', err)
    }
  }

  return (
    <WorkspaceShell title="Projects" subtitle="Manage bug bounty targets and scope">
      <div className="space-y-6 max-w-3xl">

        {/* Create new project */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <h3 className="font-semibold text-zinc-200 mb-4 flex items-center gap-2 text-sm">
            <Plus size={15} /> New Project
          </h3>
          <div className="space-y-3">
            <Input
              placeholder="Project name (e.g., HackerOne — Example Corp)"
              className="bg-zinc-900"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
            />

            {/* Scope builder */}
            <div className="space-y-2">
              <label className="text-xs text-zinc-500 flex items-center gap-1.5">
                <Globe size={11} /> Scope domains
              </label>
              <div className="flex gap-2">
                <Input
                  placeholder="*.example.com or api.example.com"
                  className="bg-zinc-900 text-sm flex-1"
                  value={newScopeInput}
                  onChange={e => setNewScopeInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addToNewScope()}
                />
                <Button variant="outline" size="sm" onClick={addToNewScope} disabled={!newScopeInput.trim()}>
                  <Plus size={12} />
                </Button>
              </div>
              {newScopeList.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {newScopeList.map((d, i) => (
                    <span key={i} className="flex items-center gap-1 text-xs bg-zinc-800 text-zinc-300 font-mono px-2 py-0.5 rounded border border-zinc-700">
                      {d}
                      <button onClick={() => removeFromNewScope(d)} className="text-zinc-600 hover:text-red-400">
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <Input
              placeholder="Notes (platform, program URL, rules...)"
              className="bg-zinc-900 text-sm"
              value={newNotes}
              onChange={e => setNewNotes(e.target.value)}
            />

            <Button onClick={handleCreate} disabled={!newName.trim() || creating} size="sm">
              <Plus size={13} className="mr-1" /> Create Project
            </Button>
          </div>
        </div>

        {/* Project list */}
        <div className="space-y-3">
          {projects.map(project => (
            <div
              key={project.id}
              className={cn(
                "rounded-xl border bg-zinc-900/50 p-5 transition-colors",
                activeProject === project.id
                  ? 'border-green-500/40 bg-green-950/10'
                  : 'border-zinc-800 hover:border-zinc-700'
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0 space-y-2">
                  {/* Project name */}
                  <h3 className="font-semibold text-zinc-200 flex items-center gap-2 text-sm">
                    <FolderOpen size={14} className={activeProject === project.id ? 'text-green-500' : 'text-zinc-500'} />
                    {project.name}
                    {activeProject === project.id && (
                      <Badge className="text-[10px] bg-green-900/50 text-green-400 border-green-700">Active</Badge>
                    )}
                  </h3>

                  {/* Scope list */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1 text-[11px] text-zinc-600">
                      <Target size={10} />
                      Scope
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {project.scope.map((domain, i) => (
                        <span key={i} className="flex items-center gap-1 text-[11px] bg-zinc-800/80 text-zinc-300 font-mono px-2 py-0.5 rounded border border-zinc-700">
                          {domain}
                          <button
                            onClick={() => handleRemoveScopeDomain(project, domain)}
                            className="text-zinc-700 hover:text-red-400 transition-colors"
                          >
                            <X size={9} />
                          </button>
                        </span>
                      ))}

                      {/* Add scope inline */}
                      {editingScope === project.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            autoFocus
                            type="text"
                            placeholder="*.new-domain.com"
                            value={scopeInput}
                            onChange={e => setScopeInput(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter' && scopeInput.trim()) handleAddScopeDomain(project, scopeInput.trim())
                              if (e.key === 'Escape') setEditingScope(null)
                            }}
                            className="text-[11px] bg-zinc-900 border border-zinc-700 rounded px-2 py-0.5 text-zinc-300 font-mono focus:outline-none focus:border-zinc-500 w-44"
                          />
                          <button
                            onClick={() => scopeInput.trim() && handleAddScopeDomain(project, scopeInput.trim())}
                            className="text-green-500 hover:text-green-400"
                          >
                            <Check size={12} />
                          </button>
                          <button onClick={() => setEditingScope(null)} className="text-zinc-600 hover:text-zinc-400">
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setEditingScope(project.id); setScopeInput('') }}
                          className="flex items-center gap-1 text-[11px] text-zinc-700 hover:text-zinc-400 border border-dashed border-zinc-800 hover:border-zinc-600 rounded px-2 py-0.5 transition-colors"
                        >
                          <Plus size={9} /> add domain
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Notes */}
                  {project.notes && (
                    <div className="flex items-start gap-1.5 text-[11px] text-zinc-500">
                      <StickyNote size={10} className="mt-0.5 shrink-0" />
                      <span className="line-clamp-2">{project.notes}</span>
                    </div>
                  )}

                  <div className="text-[10px] text-zinc-700">
                    Creado {new Date(project.created_at).toLocaleDateString('es-AR')}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 shrink-0">
                  {activeProject !== project.id && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSetActive(project)}
                      className="text-xs"
                    >
                      <Check size={11} className="mr-1" /> Activar
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-zinc-600 hover:text-red-500 h-8 w-8"
                    onClick={() => handleDelete(project.id)}
                  >
                    <Trash2 size={13} />
                  </Button>
                </div>
              </div>
            </div>
          ))}

          {projects.length === 0 && (
            <div className="text-center py-16 text-zinc-600">
              <FolderOpen size={40} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">No hay proyectos. Crea uno para empezar.</p>
              <p className="text-xs mt-1 text-zinc-700">Cada proyecto tiene su propio scope de dominios.</p>
            </div>
          )}
        </div>
      </div>
    </WorkspaceShell>
  )
}
