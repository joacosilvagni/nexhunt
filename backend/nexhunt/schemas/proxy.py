from pydantic import BaseModel


class ProxySettings(BaseModel):
    port: int = 8080
    intercept_enabled: bool = False


class InterceptToggle(BaseModel):
    enabled: bool


class InterceptAction(BaseModel):
    flow_id: str
    action: str  # "forward" or "drop"
    modified_request: str | None = None


class RepeaterRequest(BaseModel):
    method: str
    url: str
    headers: dict[str, str] = {}
    body: str | None = None
