from pydantic import BaseModel


class ProjectCreate(BaseModel):
    name: str
    scope: list[str] = []
    notes: str = ""


class ProjectUpdate(BaseModel):
    name: str | None = None
    scope: list[str] | None = None
    notes: str | None = None


class TargetCreate(BaseModel):
    value: str
    type: str = "domain"
