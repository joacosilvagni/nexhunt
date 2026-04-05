from pydantic import BaseModel


class ScanRequest(BaseModel):
    target: str
    options: dict = {}


class FindingUpdate(BaseModel):
    status: str | None = None
    notes: str | None = None
