#!/usr/bin/env python3
"""
REEVEOS PLATFORM TEST SUITE
=========================
Run before EVERY deploy. Tests every login, endpoint, role gate, and business type.

Usage:
  python3 backend/scripts/test_platform.py                    # test production
  python3 backend/scripts/test_platform.py http://localhost:8000  # test local
  
Exit codes:
  0 = all pass
  1 = failures found
"""
import asyncio
import json
import sys
import time
import urllib.request
import urllib.error
import ssl
from datetime import datetime

API = sys.argv[1] if len(sys.argv) > 1 else "https://portal.rezvo.app/api"
ctx = ssl.create_default_context()

# ─── Config ───────────────────────────────────────
ACCOUNTS = {
    "peter": {
        "email": "peter.griffin8222@gmail.com",
        "password": "Rezvo2024!",
        "expected_role": "business_owner",
        "expected_biz": "699bdb20a2ccbc6589c1d0f8",
        "expected_biz_name": "Micho Turkish Bar & Grill",
        "expected_biz_type": "restaurant",
        "login_endpoint": "/auth/login",
    },
    "grant": {
        "email": "grantwoods@live.com",
        "password": "Reeve@Grant2026",
        "expected_role": "platform_admin",
        "expected_biz": None,
        "login_endpoint": "/auth/admin-login",
    },
    "ibby": {
        "email": "ibbyonline@gmail.com",
        "password": "Reeve@Micho2026",
        "expected_role": "super_admin",
        "expected_biz": None,
        "login_endpoint": "/auth/admin-login",
    },
    "mo": {
        "email": "mo.jalloh@me.com",
        "password": "Reeve@Mo2026",
        "expected_role": "super_admin",
        "expected_biz": None,
        "login_endpoint": "/auth/admin-login",
    },
}

# ─── Test infrastructure ──────────────────────────
passed = 0
failed = 0
errors = []
tokens = {}
section_results = {}
current_section = ""

def section(name):
    global current_section
    current_section = name
    section_results[name] = {"pass": 0, "fail": 0}
    print(f"\n{'═'*60}")
    print(f"  {name}")
    print(f"{'═'*60}")

def ok(test_name, detail=""):
    global passed
    passed += 1
    section_results[current_section]["pass"] += 1
    d = f" — {detail}" if detail else ""
    print(f"  ✅ {test_name}{d}")

def fail(test_name, detail=""):
    global failed
    failed += 1
    section_results[current_section]["fail"] += 1
    d = f" — {detail}" if detail else ""
    msg = f"  ❌ {test_name}{d}"
    print(msg)
    errors.append(f"[{current_section}] {test_name}: {detail}")

def api_call(path, method="GET", data=None, token=None, expect_status=None):
    """Make API call, return (status_code, parsed_json_or_None)"""
    url = f"{API}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    
    try:
        resp = urllib.request.urlopen(req, timeout=15, context=ctx)
        d = json.loads(resp.read())
        return resp.status, d
    except urllib.error.HTTPError as e:
        try:
            body = json.loads(e.read())
        except:
            body = None
        return e.code, body
    except Exception as e:
        return 0, {"error": str(e)}


# ═══════════════════════════════════════════════════
# TEST 1: AUTH — Every account can log in
# ═══════════════════════════════════════════════════
section("1. AUTHENTICATION")

for name, acct in ACCOUNTS.items():
    status, resp = api_call(
        acct["login_endpoint"],
        method="POST",
        data={"email": acct["email"], "password": acct["password"]}
    )
    
    if status == 200 and resp and resp.get("access_token"):
        tokens[name] = resp["access_token"]
        user = resp.get("user", {})
        role = user.get("role", "?")
        biz_ids = user.get("business_ids", [])
        
        # Check role matches
        if role == acct["expected_role"]:
            ok(f"{name} login", f"role={role}")
        else:
            fail(f"{name} login", f"role={role}, expected {acct['expected_role']}")
        
        # Check business link
        if acct.get("expected_biz"):
            if acct["expected_biz"] in biz_ids:
                ok(f"{name} business link", f"biz={acct['expected_biz'][:12]}...")
            else:
                fail(f"{name} business link", f"got {biz_ids}, expected {acct['expected_biz']}")
    else:
        fail(f"{name} login", f"HTTP {status}")
        tokens[name] = None


# ═══════════════════════════════════════════════════
# TEST 2: ADMIN AUTH LOCKDOWN
# ═══════════════════════════════════════════════════
section("2. ADMIN AUTH LOCKDOWN")

admin_paths = [
    "/admin/overview", "/admin/users", "/admin/businesses",
    "/admin/health/check", "/admin/analytics/platform",
    "/admin/audit/logs", "/admin/security/report",
]

for path in admin_paths:
    # Without auth — must be 401 or 403
    status, _ = api_call(path)
    if status in (401, 403):
        ok(f"NO AUTH {path}", f"HTTP {status}")
    else:
        fail(f"NO AUTH {path}", f"HTTP {status} — ENDPOINT IS OPEN!")

    # With admin auth — must be 200
    if tokens.get("grant"):
        status, _ = api_call(path, token=tokens["grant"])
        if status == 200:
            ok(f"ADMIN AUTH {path}")
        else:
            fail(f"ADMIN AUTH {path}", f"HTTP {status}")

# Business owner should NOT access admin
if tokens.get("peter"):
    status, _ = api_call("/admin/users", token=tokens["peter"])
    if status in (401, 403):
        ok("peter BLOCKED from /admin/users", f"HTTP {status}")
    else:
        fail("peter BLOCKED from /admin/users", f"HTTP {status} — OWNER CAN ACCESS ADMIN!")


# ═══════════════════════════════════════════════════
# TEST 3: BUSINESS TYPE ISOLATION (restaurant vs salon)
# ═══════════════════════════════════════════════════
section("3. BUSINESS TYPE ISOLATION")

if tokens.get("peter"):
    peter_acct = ACCOUNTS["peter"]
    biz_id = peter_acct["expected_biz"]
    tok = tokens["peter"]
    
    # Check /users/me works
    status, me = api_call("/users/me", token=tok)
    if status == 200:
        ok("/users/me returns data", f"name={me.get('name')}")
    else:
        fail("/users/me", f"HTTP {status} — {me}")
    
    # Check business type
    status, biz = api_call(f"/businesses/{biz_id}", token=tok)
    if status == 200:
        biz_type = biz.get("type", "NOT SET")
        biz_cat = biz.get("category", "NOT SET")
        biz_name = biz.get("name", "?")
        
        if biz_type == "restaurant" or biz_cat == "restaurant":
            ok(f"Micho is restaurant", f"type={biz_type} category={biz_cat}")
        else:
            fail(f"Micho business type", f"type={biz_type} category={biz_cat} — WILL LOAD AS SALON!")
        
        if biz_name == peter_acct["expected_biz_name"]:
            ok(f"Business name correct", biz_name)
        else:
            fail(f"Business name", f"got '{biz_name}', expected '{peter_acct['expected_biz_name']}'")
    else:
        fail(f"GET /businesses/{biz_id}", f"HTTP {status}")

    # Check calendar returns restaurant data (staff, not services)
    status, cal = api_call(f"/calendar/business/{biz_id}?date=2026-03-03", token=tok)
    if status == 200:
        staff = cal.get("staff", [])
        ok(f"Calendar loads", f"{len(staff)} staff members")
    else:
        fail(f"Calendar", f"HTTP {status}")

    # Check bookings exist
    status, bk = api_call(f"/bookings/business/{biz_id}", token=tok)
    if status == 200:
        total = bk.get("pagination", {}).get("total", 0) if isinstance(bk, dict) else len(bk)
        if total > 0:
            ok(f"Bookings exist", f"{total} bookings")
        else:
            fail(f"Bookings", "0 bookings — data not linked!")
    else:
        fail(f"Bookings", f"HTTP {status}")


# ═══════════════════════════════════════════════════
# TEST 4: PUBLIC ENDPOINTS (directory, booking)
# ═══════════════════════════════════════════════════
section("4. PUBLIC ENDPOINTS")

public_tests = [
    ("/directory/home", "directory home"),
    ("/directory/search?query=micho", "directory search"),
    ("/directory/locations", "directory locations"),
    ("/directory/featured", "directory featured"),
]

for path, name in public_tests:
    status, resp = api_call(path)
    if status == 200:
        ok(name, f"HTTP 200")
    else:
        fail(name, f"HTTP {status}")


# ═══════════════════════════════════════════════════
# TEST 5: ADMIN DASHBOARD DATA
# ═══════════════════════════════════════════════════
section("5. ADMIN DASHBOARD DATA")

if tokens.get("grant"):
    tok = tokens["grant"]
    
    admin_data_tests = [
        ("/admin/overview", "Overview", ["active_businesses", "total_bookings"]),
        ("/admin/health/check", "System Health", ["status", "cpu", "memory", "disk"]),
        ("/admin/businesses", "Businesses", ["total", "businesses"]),
        ("/admin/users", "Users", ["total", "users"]),
        ("/admin/bookings", "All Bookings", ["total"]),
    ]
    
    for path, name, expected_keys in admin_data_tests:
        status, resp = api_call(path, token=tok)
        if status == 200 and resp:
            missing = [k for k in expected_keys if k not in resp]
            if not missing:
                # Check for real data vs hardcoded
                if name == "System Health":
                    cpu = resp.get("cpu", "?")
                    mem = resp.get("memory", "?")
                    if cpu == "—" or mem == "—":
                        fail(name, "showing dashes instead of real data")
                    else:
                        ok(name, f"cpu={cpu} mem={mem}")
                elif name == "Overview":
                    biz = resp.get("active_businesses", 0)
                    ok(name, f"{biz} businesses")
                else:
                    ok(name)
            else:
                fail(name, f"missing keys: {missing}")
        else:
            fail(name, f"HTTP {status}")


# ═══════════════════════════════════════════════════
# TEST 6: SUPER ADMIN vs PLATFORM ADMIN
# ═══════════════════════════════════════════════════
section("6. SUPER ADMIN ISOLATION")

# Both ibby (super_admin) and grant (platform_admin) can access admin
if tokens.get("ibby") and tokens.get("grant"):
    for name, tok in [("ibby/super", tokens["ibby"]), ("grant/admin", tokens["grant"])]:
        status, _ = api_call("/admin/overview", token=tok)
        if status == 200:
            ok(f"{name} can access admin panel")
        else:
            fail(f"{name} admin access", f"HTTP {status}")

# Verify ibby is super_admin
if tokens.get("ibby"):
    status, resp = api_call("/admin/users", token=tokens["ibby"])
    if status == 200:
        ibby_user = next((u for u in resp.get("users", []) if u.get("email") == "ibbyonline@gmail.com"), None)
        if ibby_user and ibby_user.get("role") == "super_admin":
            ok("ibby role is super_admin")
        elif ibby_user:
            fail("ibby role", f"expected super_admin, got {ibby_user.get('role')}")
        else:
            fail("ibby not found in users list")


# ═══════════════════════════════════════════════════
# TEST 7: FIELD & ROLE CONSISTENCY
# ═══════════════════════════════════════════════════
section("7. FIELD & ROLE CONSISTENCY")

# Check all users have valid roles
if tokens.get("grant"):
    status, resp = api_call("/admin/users", token=tokens["grant"])
    if status == 200:
        valid_roles = {"diner", "business_owner", "staff", "platform_admin", "super_admin"}
        invalid_found = False
        for u in resp.get("users", []):
            role = u.get("role", "MISSING")
            if role not in valid_roles:
                fail(f"User {u.get('email')} role", f"'{role}' not valid (use business_owner not owner)")
                invalid_found = True
        if not invalid_found:
            ok("All user roles valid (no legacy 'owner' or 'admin')")
    
    # Check all businesses have type field
    status, resp = api_call("/admin/businesses", token=tokens["grant"])
    if status == 200:
        type_ok = True
        for b in resp.get("businesses", []):
            btype = b.get("type", "NOT SET")
            bcat = b.get("category", "NOT SET")
            if btype == "NOT SET":
                fail(f"Business '{b.get('name')}' type", f"type missing (category={bcat})")
                type_ok = False
        if type_ok:
            ok(f"All {len(resp.get('businesses', []))} businesses have type set")


# ═══════════════════════════════════════════════════
# RESULTS
# ═══════════════════════════════════════════════════
print(f"\n{'═'*60}")
print(f"  RESULTS")
print(f"{'═'*60}")
print(f"  Total: {passed + failed} tests")
print(f"  ✅ Passed: {passed}")
print(f"  ❌ Failed: {failed}")

if errors:
    print(f"\n  FAILURES:")
    for e in errors:
        print(f"    • {e}")

print(f"\n  Per section:")
for name, counts in section_results.items():
    status = "✅" if counts["fail"] == 0 else "❌"
    print(f"    {status} {name}: {counts['pass']} pass, {counts['fail']} fail")

print(f"\n{'═'*60}")
if failed == 0:
    print(f"  🟢 ALL TESTS PASSED — SAFE TO DEPLOY")
else:
    print(f"  🔴 {failed} FAILURES — DO NOT DEPLOY")
print(f"{'═'*60}\n")

sys.exit(1 if failed else 0)
