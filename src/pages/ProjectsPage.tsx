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
  ExternalLink
} from 'lucide-react'

export function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [newName, setNewName] = useState('')
  const [newScope, setNewScope] = useState('')
  const [creating, setCreating] = useState(false)
  const { activeProject, setActiveProject } = useAppStore()

  const fetchProjects = async () => {
    try {
      const data = await api.get<Project[]>('/api/projects')
      setProjects(data)
    } catch (err) {
      console.error('Failed to fetch projects:', err)
    }
  }

  useEffect(() => {
    fetchProjects()
  }, [])

  const handleCreate = async () => {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const scope = newScope.split(',').map(s => s.trim()).filter(Boolean)
      await api.post('/api/projects', { name: newName.trim(), scope })
      setNewName('')
      setNewScope('')
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
      if (activeProject === id) setActiveProject(null)
      await fetchProjects()
    } catch (err) {
      console.error('Failed to delete project:', err)
    }
  }

  return (
    <WorkspaceShell title="Projects" subtitle="Manage your bug bounty targets">
      <div className="space-y-6 max-w-3xl">
        {/* Create new project */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <h3 className="font-semibold text-zinc-200 mb-4 flex items-center gap-2">
            <Plus size={16} /> New Project
          </h3>
          <div className="space-y-3">
            <Input
              placeholder="Project name (e.g., HackerOne - Example Corp)"
              className="bg-zinc-900"
              value={newName}
              onChange={e => setNewName(e.target.value)}
            />
            <Input
              placeholder="Scope - comma separated domains (e.g., *.example.com, api.example.com)"
              className="bg-zinc-900"
              value={newScope}
              onChange={e => setNewScope(e.target.value)}
            />
            <Button onClick={handleCreate} disabled={!newName.trim() || creating}>
              <Plus size={14} className="mr-1" /> Create Project
            </Button>
          </div>
        </div>

        {/* Project list */}
        <div className="space-y-3">
          {projects.map(project => (
            <div
              key={project.id}
              className={`rounded-xl border bg-zinc-900/50 p-5 transition-colors ${
                activeProject === project.id
                  ? 'border-green-500/50'
                  : 'border-zinc-800 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-zinc-200 flex items-center gap-2">
                    <FolderOpen size={16} className="text-green-500" />
                    {project.name}
                    {activeProject === project.id && (
                      <Badge variant="default" className="text-[10px]">Active</Badge>
                    )}
                  </h3>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {project.scope.map((s, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px] font-mono">
                        {s}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-zinc-600 mt-2">
                    Created {new Date(project.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  {activeProject !== project.id && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveProject(project.id)}
                    >
                      <Check size={12} className="mr-1" /> Set Active
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-zinc-500 hover:text-red-500"
                    onClick={() => handleDelete(project.id)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            </div>
          ))}

          {projects.length === 0 && (
            <div className="text-center py-12 text-zinc-600">
              <FolderOpen size={48} className="mx-auto mb-4" />
              <p>No projects yet. Create one to get started.</p>
            </div>
          )}
        </div>
      </div>
    </WorkspaceShell>
  )
}
