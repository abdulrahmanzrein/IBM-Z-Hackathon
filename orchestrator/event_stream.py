import time

_listeners = []
_event_log = []

def subscribe(fn):
    """Register a listener — P1's frontend connection calls this to receive events."""
    _listeners.append(fn)

def emit(event_type: str, agent: str, output: dict, violation: str = None):
    """
    Emit a pipeline event to all listeners.

    event_type: physics_computed | agent_rejected | agent_validated | coordinator_done
    agent:      hazard | cascade | secondary | coordinator | router
    output:     the agent's JSON output
    violation:  rejection message from the physics validator (only on agent_rejected)
    """
    event = {
        "type": event_type,
        "agent": agent,
        "timestamp": time.time(),
        "output": output,
        "violation": violation
    }
    _event_log.append(event)
    for fn in _listeners:
        fn(event)

def get_log():
    """Return all events emitted so far — used to populate events[] in output contract."""
    return list(_event_log)

def clear():
    """Reset between dispatch calls."""
    _event_log.clear()
