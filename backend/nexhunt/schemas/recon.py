from pydantic import BaseModel


class ReconRequest(BaseModel):
    target: str
    options: dict = {}
