import json
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from nexhunt.database import get_session
from nexhunt.models.project import Project
from nexhunt.schemas.project import ProjectCreate, ProjectUpdate

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.get("")
async def list_projects(session: AsyncSession = Depends(get_session)):
    """List all projects."""
    result = await session.execute(select(Project).order_by(Project.created_at.desc()))
    projects = result.scalars().all()
    return [
        {
            "id": p.id,
            "name": p.name,
            "scope": json.loads(p.scope) if p.scope else [],
            "notes": p.notes,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "updated_at": p.updated_at.isoformat() if p.updated_at else None,
        }
        for p in projects
    ]


@router.post("")
async def create_project(data: ProjectCreate, session: AsyncSession = Depends(get_session)):
    """Create a new project."""
    project = Project(
        name=data.name,
        scope=json.dumps(data.scope),
        notes=data.notes,
    )
    session.add(project)
    await session.commit()
    return {"id": project.id, "name": project.name}


@router.get("/{project_id}")
async def get_project(project_id: str, session: AsyncSession = Depends(get_session)):
    """Get a specific project."""
    result = await session.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        return {"error": "Project not found"}
    return {
        "id": project.id,
        "name": project.name,
        "scope": json.loads(project.scope) if project.scope else [],
        "notes": project.notes,
        "created_at": project.created_at.isoformat() if project.created_at else None,
    }


@router.put("/{project_id}")
async def update_project(
    project_id: str, data: ProjectUpdate, session: AsyncSession = Depends(get_session)
):
    """Update a project."""
    result = await session.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        return {"error": "Project not found"}

    if data.name is not None:
        project.name = data.name
    if data.scope is not None:
        project.scope = json.dumps(data.scope)
    if data.notes is not None:
        project.notes = data.notes

    await session.commit()
    return {"status": "updated"}


@router.delete("/{project_id}")
async def delete_project(project_id: str, session: AsyncSession = Depends(get_session)):
    """Delete a project."""
    result = await session.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        return {"error": "Project not found"}

    await session.delete(project)
    await session.commit()
    return {"status": "deleted"}
