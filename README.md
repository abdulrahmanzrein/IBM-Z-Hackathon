# StormOS

Wildfire Cascade Incident Commander for the IBM Z x UNSA Sheridan Hackathon 2026.

## P2 Backend

The backend currently implements the PRD baseline for the Palisades wildfire cascade:

- `POST /dispatch/wildfire/1`
- Rothermel-inspired fire threat physics
- deterministic infrastructure cascade propagation
- USGS M1-style debris-flow probability
- validator rejection/retry event sequence
- three-agency coordinator output

### Run Locally

```bash
cd backend
python3 -m pip install -r requirements.txt
cd ..
python3 -m uvicorn backend.main:app --reload
```

Then test:

```bash
curl -X POST http://localhost:8000/dispatch/wildfire/1
```

### Run Tests

```bash
PYTHONPYCACHEPREFIX=/private/tmp/stormos_pycache python3 -m pytest backend/tests
```
