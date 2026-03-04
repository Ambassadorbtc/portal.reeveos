"""
Central account credentials — reads from environment variables ONLY.
No plaintext passwords in this file or anywhere in the codebase.

On VPS: passwords live in backend/.env (gitignored).
Required env vars:
    ACCOUNT_PW_JAMES
    ACCOUNT_PW_GRANT
    ACCOUNT_PW_IBBY
    ACCOUNT_PW_MO
    ACCOUNT_PW_SALON
"""
import os
from pathlib import Path

# Load .env if running standalone (outside FastAPI which loads its own)
try:
    from dotenv import load_dotenv
    _env_path = Path(__file__).parent / ".env"
    if _env_path.exists():
        load_dotenv(_env_path)
except ImportError:
    pass  # dotenv not installed — env vars must be set in shell

def _require(var: str) -> str:
    val = os.environ.get(var, "")
    if not val:
        raise RuntimeError(f"Missing required env var: {var}")
    return val


def get_system_accounts() -> list[tuple[str, str, str]]:
    """Returns [(email, password, role), ...] for all system accounts."""
    return [
        ("james111trader@gmail.com",   _require("ACCOUNT_PW_JAMES"), "business_owner"),
        ("grantwoods@live.com",        _require("ACCOUNT_PW_GRANT"), "platform_admin"),
        ("ibbyonline@gmail.com",       _require("ACCOUNT_PW_IBBY"),  "super_admin"),
        ("mo.jalloh@me.com",           _require("ACCOUNT_PW_MO"),    "super_admin"),
        ("levelambassador@gmail.com",  _require("ACCOUNT_PW_SALON"), "business_owner"),
    ]


def get_account_password(name: str) -> str:
    """Get a single account password by short name."""
    mapping = {
        "james": "ACCOUNT_PW_JAMES",
        "grant": "ACCOUNT_PW_GRANT",
        "ibby":  "ACCOUNT_PW_IBBY",
        "mo":    "ACCOUNT_PW_MO",
        "salon": "ACCOUNT_PW_SALON",
    }
    var = mapping.get(name)
    if not var:
        raise ValueError(f"Unknown account: {name}")
    return _require(var)
