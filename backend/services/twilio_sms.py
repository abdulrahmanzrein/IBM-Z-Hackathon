import os
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from base64 import b64encode

_acknowledgments: dict[str, str] = {}


def _agency_phones() -> dict[str, str]:
    return {
        k: v for k, v in {
            "fire_incident_command": os.getenv("TWILIO_FIRE_PHONE"),
            "utility_operator": os.getenv("TWILIO_UTILITY_PHONE"),
            "traffic_management": os.getenv("TWILIO_TRAFFIC_PHONE"),
        }.items() if v
    }


def send_dispatch_sms(actions: dict[str, str]) -> None:
    sid = os.getenv("TWILIO_ACCOUNT_SID")
    token = os.getenv("TWILIO_AUTH_TOKEN")
    from_number = os.getenv("TWILIO_FROM_NUMBER")
    if not all([sid, token, from_number]):
        return

    phones = _agency_phones()
    if not phones:
        return

    reset_acknowledgments()
    url = f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json"
    credentials = b64encode(f"{sid}:{token}".encode()).decode()

    for agency, action in actions.items():
        phone = phones.get(agency)
        if not phone:
            continue
        label = agency.replace("_", " ").title()
        body = urlencode({
            "To": phone,
            "From": from_number,
            "Body": f"StormOS [{label}]: {action} Reply ACCEPT or DENY.",
        }).encode()
        request = Request(url, data=body, headers={
            "Authorization": f"Basic {credentials}",
            "Content-Type": "application/x-www-form-urlencoded",
        }, method="POST")
        try:
            with urlopen(request, timeout=8) as r:
                r.read()
            _acknowledgments[agency] = "PENDING"
        except Exception as exc:
            print(f"[twilio] failed to send to {agency}: {exc}")


def process_reply(from_number: str, body: str) -> None:
    phone_to_agency = {v: k for k, v in _agency_phones().items()}
    agency = phone_to_agency.get(from_number)
    if not agency:
        return
    reply = body.strip().upper()
    if reply in ("ACCEPT", "ACCEPTED", "YES"):
        _acknowledgments[agency] = "ACCEPTED"
    elif reply in ("DENY", "DENIED", "NO"):
        _acknowledgments[agency] = "DENIED"


def reset_acknowledgments() -> None:
    _acknowledgments.clear()


def get_acknowledgments() -> dict:
    return dict(_acknowledgments)
