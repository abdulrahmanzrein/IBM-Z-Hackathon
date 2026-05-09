import asyncio
import json

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

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


@app.get("/dispatch/wildfire/1/events")
async def stream_dispatch_events(
    timestep: int = Query(15, description="PRD replay timestep: 0, 15, or 30"),
    delay_seconds: float = Query(0.5, ge=0, le=5, description="Delay between streamed demo events"),
) -> StreamingResponse:
    if timestep not in supported_timesteps():
        raise HTTPException(status_code=400, detail="timestep must be one of: 0, 15, 30")

    dispatch = execute_wildfire_dispatch(timestep)

    async def event_stream():
        for event in dispatch["events"]:
            yield f"event: {event['type']}\ndata: {json.dumps(event)}\n\n"
            if delay_seconds:
                await asyncio.sleep(delay_seconds)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )
