from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from backend.agents.orchestrator import execute_wildfire_dispatch, supported_timesteps
from backend.schemas import DispatchResponse


app = FastAPI(title="StormOS Backend")

# Allow local frontend dev servers to call this API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root() -> dict:
    return {"service": "StormOS Backend", "status": "online"}


@app.get("/health")
async def health() -> dict:
    return {"status": "healthy"}


@app.post("/dispatch/wildfire/1", response_model=DispatchResponse)
async def dispatch_wildfire(timestep: int = Query(15, description="PRD replay timestep: 0, 15, or 30")) -> dict:
    if timestep not in supported_timesteps():
        raise HTTPException(status_code=400, detail="timestep must be one of: 0, 15, 30")

    return execute_wildfire_dispatch(timestep)
