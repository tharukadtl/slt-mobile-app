"""seed_demo_data.py -- REST-API-driven realistic demo/showcase data for a live fieldops deployment.

Unlike seed_admin.py / frontend-admin's seed_live_fixtures.py (both raw-SQL, minimal CI fixtures),
this script drives the real REST API end to end, authenticating as each seeded actor in turn, so
every business rule the service layer enforces (FK-consistent denormalized fields, status-transition
validation, BOD/session gating, etc.) is exercised exactly as a real client would. See the
conversation record / QA notes for the investigation that led here -- in short: direct SQL was
rejected because (a) it would have to hand-replicate a lot of service-layer logic and (b) production
MySQL is not port-published in docker-compose.yml (only the app's :8080 is) so raw SQL would require
SSHing into the VM and running inside its docker network anyway, and the REST API gives up nothing by
comparison since every seeded role can authenticate via plain POST /api/auth/login regardless of what
each frontend's login screen restricts to (confirmed: AuthService.passwordLogin has no role check).

One hard prerequisite this script does NOT handle: the very first SUPER_ADMIN. There is no
CommandLineRunner/bootstrap of any kind in fieldops (confirmed, see seed_live_fixtures.py's own
header) and creating a user requires already being authenticated as SUPER_ADMIN/ADMIN -- a genuine
chicken-and-egg problem only raw SQL can break. Run the existing bootstrap once, first:

    python seed_admin.py seed-admin

...against the same target database. Everything below builds on top of that one row exactly the way
the existing seed-job-assignment command already does, just far more extensively.

Every seeded user (regardless of role) is created via POST /api/users with the plaintext password
"Admin@2024" -- the server BCrypt-hashes it itself (CreateUserRequest.password is plaintext over the
wire, confirmed in UserService.createUser: passwordEncoder.encode(req.getPassword())). This is the
same password the existing seed-admin bootstrap already uses, so every seeded account -- Client,
Technician, Team Lead, Admin, Super Admin alike -- is immediately usable via POST /api/auth/login
without ever touching OTP/SMS (confirmed no role restriction on that endpoint). This deliberately
bypasses SLTMobileApp's login screen, which only exposes an OTP flow for every role including staff --
that is a frontend choice, not a backend one, and production has no real SMS integration behind OTP
in any case (app.sms.enabled is hardcoded false with no env override, and even the "enabled" branch in
AuthService.sendOtp is just a TODO-commented log line -- there is no gateway wired at all).

Usage:
    python seed_demo_data.py                    Dry run (default) -- prints every planned API call
                                                 and payload, makes ZERO network calls, creates nothing.
    python seed_demo_data.py --execute           Actually performs the seeding against --base-url.

    --base-url URL   Defaults to $FIELDOPS_API_BASE_URL or http://localhost:8080 (same env-var
                      convention as seed_admin.py's FIELDOPS_DB_HOST). Point this at the real
                      deployment's reachable :8080 to seed production -- never hardcoded here.

Idempotent throughout, mirroring seed_admin.py's "already exists" pattern: every entity is looked up
by its natural key (Opmc.code, WorkGroup.name, User.username, Fault by exact description text via the
reporting Client's own /api/faults/my-reports, Job by faultId via the admin's /api/jobs, Payment by
jobId via /api/payments/all) before creating it, and job/payment status is advanced only through
whatever transition steps haven't already happened -- rerunning this script is safe and will not
create duplicates or attempt invalid state transitions.
"""
import argparse
import os
import sys

import requests

DEFAULT_BASE_URL = os.environ.get("FIELDOPS_API_BASE_URL", "http://localhost:8080")

# Same convention as seed_admin.py / seed_live_fixtures.py's ADMIN_PASSWORD_HASH (Admin@2024) --
# here we send it as plaintext over POST /api/users, which BCrypt-hashes it server-side itself, so
# there's no hash to precompute. Every seeded user gets this same password, on purpose (see header).
DEMO_PASSWORD = "Admin@2024"
SUPERADMIN_USERNAME = "superadmin"


# ============================================================================
# Demo dataset -- edit only here to change what gets seeded.
# ============================================================================

OPMC = {
    "name": "SLT Nugegoda OPMC",
    "code": "NUG-DEMO",
    "opmcType": "LOCAL_BRANCH",
    "address": "No. 45, High Level Road, Nugegoda",
    "city": "Nugegoda",
    "district": "Colombo",
    "province": "WESTERN",
    "phone": "0112815678",
    "email": "nugegoda.demo@slt.lk",
    "latitude": 6.8649,
    "longitude": 79.8997,
    "workingDays": "MON,TUE,WED,THU,FRI",
}

WORK_GROUP_NAME = "Nugegoda Field Team A (Demo)"

# "key" is this script's own internal handle, not sent to the API.
USERS = [
    {"key": "admin", "role": "ADMIN", "username": "admin_nuwan",
     "fullName": "Nuwan Rajapaksha", "phone": "0771234501",
     "email": "nuwan.rajapaksha@slt-demo.lk", "needs_opmc": True, "needs_workgroup": False},
    {"key": "team_lead", "role": "TEAM_LEAD", "username": "tl_kasun",
     "fullName": "Kasun Wickramasinghe", "phone": "0771234502",
     "email": "kasun.wickramasinghe@slt-demo.lk", "needs_opmc": True, "needs_workgroup": True},
    {"key": "tech1", "role": "TECHNICIAN", "username": "tech_sunil",
     "fullName": "Sunil Fernando", "phone": "0771234503",
     "email": "sunil.fernando@slt-demo.lk", "needs_opmc": True, "needs_workgroup": True},
    {"key": "tech2", "role": "TECHNICIAN", "username": "tech_ruwan",
     "fullName": "Ruwan Jayasuriya", "phone": "0771234504",
     "email": "ruwan.jayasuriya@slt-demo.lk", "needs_opmc": True, "needs_workgroup": True},
    {"key": "client1", "role": "CLIENT", "username": "client_priyanka",
     "fullName": "Priyanka Silva", "phone": "0771234505",
     "email": "priyanka.silva@demo-mail.lk", "address": "No. 12, Temple Road, Nugegoda",
     "needs_opmc": False, "needs_workgroup": False},
    {"key": "client2", "role": "CLIENT", "username": "client_dilshan",
     "fullName": "Dilshan Perera", "phone": "0771234506",
     "email": "dilshan.perera@demo-mail.lk", "address": "No. 78, Stanley Thilakaratne Mawatha, Nugegoda",
     "needs_opmc": False, "needs_workgroup": False},
    {"key": "client3", "role": "CLIENT", "username": "client_ishara",
     "fullName": "Ishara Gunawardena", "phone": "0771234507",
     "email": "ishara.gunawardena@demo-mail.lk", "address": "No. 5, Pagoda Road, Nugegoda",
     "needs_opmc": False, "needs_workgroup": False},
]

# job_path, when present, is the full Job.JobStatus sequence from PENDING to this fault's intended
# resting state; advance_job_along_path() only issues whatever PATCH calls haven't happened yet.
# Faults with no "technician" key are never dispatched to a Job at all (they demo the Admin queue).
FAULTS = [
    {
        "key": "f1", "client": "client1", "category": "INTERNET", "priority": "HIGH",
        "description": ("No internet connection since this morning around 7 AM. Router power light "
                         "is on but the internet light stays red no matter how many times I restart it."),
        "locationCity": "Nugegoda", "locationDistrict": "Colombo",
        "latitude": 6.8656, "longitude": 79.8985,
        # No admin action at all -- stays REPORTED, demonstrates the unassigned Admin queue.
    },
    {
        "key": "f2", "client": "client2", "category": "FIBER", "priority": "MEDIUM",
        "description": ("Fiber connection has been dropping every 10-15 minutes for the past two "
                         "days, especially when it rains. Speed test shows almost nothing during the drops."),
        "locationCity": "Nugegoda", "locationDistrict": "Colombo",
        "latitude": 6.8631, "longitude": 79.9012,
        "assign": True,  # Admin assigns to the Work Group -- ASSIGNED, no Job dispatched yet.
    },
    {
        "key": "f3", "client": "client3", "category": "PHONE", "priority": "LOW",
        "description": ("Landline has had no dial tone since yesterday evening. Checked the phone on "
                         "a neighbour's line and it works fine there, so the issue seems to be on our end."),
        "locationCity": "Nugegoda", "locationDistrict": "Colombo",
        "latitude": 6.8664, "longitude": 79.8956,
        "assign": True, "technician": "tech1",
        "job_path": ["PENDING", "ACCEPTED"],  # dispatched and accepted, not yet travelling.
    },
    {
        "key": "f4", "client": "client1", "category": "TV", "priority": "MEDIUM",
        "description": ("Set-top box shows a 'No Signal' error on every channel since last night. "
                         "Tried unplugging and replugging the box twice with no change."),
        "locationCity": "Nugegoda", "locationDistrict": "Colombo",
        "latitude": 6.8656, "longitude": 79.8985,
        "assign": True, "technician": "tech2",
        "job_path": ["PENDING", "ACCEPTED", "TRAVELLING", "IN_PROGRESS", "HOLD"],
        "hold_reason": "Replacement set-top box not in van stock -- technician returning tomorrow with a spare unit.",
    },
    {
        "key": "f5", "client": "client2", "category": "INTERNET", "priority": "HIGH",
        "description": ("WiFi disconnects on all devices every evening between 7 and 10 PM, speed "
                         "drops to almost zero even though the connection stays listed as active."),
        "locationCity": "Nugegoda", "locationDistrict": "Colombo",
        "latitude": 6.8631, "longitude": 79.9012,
        "assign": True, "technician": "tech1",
        "job_path": ["PENDING", "ACCEPTED", "TRAVELLING", "IN_PROGRESS", "COMPLETED"],
        "completion": {
            "causeOfFault": "Degraded ONT unit",
            "completionRemarks": ("Replaced ONT and re-terminated fiber patch cord. Speed test "
                                   "confirmed 100 Mbps stable after replacement."),
            "completionPhotoUrls": ("https://storage.slt.lk/demo/photos/f5-after1.jpg,"
                                     "https://storage.slt.lk/demo/photos/f5-after2.jpg"),
        },
        "payment": {
            "materialsFocTotal": "500.00",
            "materialsChargeableTotal": "1200.00",
            "labourCharge": "1800.00",   # total = 3000.00, under the LKR 5000 justification threshold
            "customerSignatureUrl": "https://storage.slt.lk/demo/signatures/f5-sig.png",
            "jobPhotosUrls": ("https://storage.slt.lk/demo/photos/f5-after1.jpg,"
                               "https://storage.slt.lk/demo/photos/f5-after2.jpg"),
            "workSummary": "Replaced degraded ONT and re-terminated fiber patch cord. Customer confirmed stable connection.",
        },
    },
]


# ============================================================================
# Thin REST client with a true dry-run mode (zero network calls when not --execute)
# ============================================================================

class ApiError(RuntimeError):
    def __init__(self, status, message, body=None):
        super().__init__(f"HTTP {status}: {message}")
        self.status = status
        self.message = message
        self.body = body


class Api:
    def __init__(self, base_url, dry_run=True):
        self.base_url = base_url.rstrip("/")
        self.dry_run = dry_run
        self.session = requests.Session()
        self._fake_id = 900000  # dry-run only: fabricated IDs so downstream steps have something to print

    def _next_fake_id(self):
        self._fake_id += 1
        return self._fake_id

    def _headers(self, token):
        return {"Authorization": f"Bearer {token}"} if token else {}

    def _real_call(self, method, path, token=None, json=None):
        url = f"{self.base_url}{path}"
        resp = self.session.request(method, url, headers=self._headers(token), json=json, timeout=30)
        try:
            body = resp.json() if resp.content else {}
        except ValueError:
            body = {}
        if not resp.ok:
            raise ApiError(resp.status_code, body.get("message", resp.text), body)
        return body

    def get(self, path, token=None):
        if self.dry_run:
            print(f"  [DRY RUN] GET  {path}")
            return None  # dry run can't know live state -- callers treat None as "not found yet"
        return self._real_call("GET", path, token=token)

    def post(self, path, token=None, json=None, fabricate=None):
        if self.dry_run:
            print(f"  [DRY RUN] POST {path}")
            print(f"            body: {json}")
            fake = dict(fabricate or {})
            fake.setdefault("id", self._next_fake_id())
            return fake
        return self._real_call("POST", path, token=token, json=json)

    def patch(self, path, token=None, json=None, fabricate=None):
        if self.dry_run:
            print(f"  [DRY RUN] PATCH {path}")
            print(f"             body: {json}")
            return dict(fabricate or {})
        return self._real_call("PATCH", path, token=token, json=json)

    def put(self, path, token=None, json=None, fabricate=None):
        if self.dry_run:
            print(f"  [DRY RUN] PUT  {path}")
            print(f"            body: {json}")
            return dict(fabricate or {})
        return self._real_call("PUT", path, token=token, json=json)


def login(api, username, password):
    """Returns (token, user_id). In dry-run mode, fabricates a plausible-looking token/id."""
    if api.dry_run:
        print(f"  [DRY RUN] POST /api/auth/login  {{username: {username!r}}}")
        return f"<dry-run-token:{username}>", api._next_fake_id()
    body = api.post("/api/auth/login", json={"username": username, "password": password})
    return body["accessToken"], body["userId"]


# ============================================================================
# Idempotent entity creation
# ============================================================================

def get_or_create_opmc(api, sa_token):
    print("\n== Opmc ==")
    if not api.dry_run:
        existing = api.get("/api/opmcs", token=sa_token) or []
        match = next((o for o in existing if o.get("code") == OPMC["code"]), None)
        if match:
            print(f"  already exists: id={match['id']} code={OPMC['code']}")
            return match["id"]
    created = api.post("/api/opmcs", token=sa_token, json=OPMC, fabricate={"code": OPMC["code"]})
    print(f"  created: id={created['id']} code={OPMC['code']}")
    return created["id"]


def get_or_create_workgroup(api, sa_token, opmc_id):
    print("\n== WorkGroup ==")
    if not api.dry_run:
        existing = api.get(f"/api/workgroups?opmcId={opmc_id}", token=sa_token) or []
        match = next((w for w in existing if w.get("name") == WORK_GROUP_NAME), None)
        if match:
            print(f"  already exists: id={match['id']} name={WORK_GROUP_NAME!r}")
            return match["id"]
    body = {"name": WORK_GROUP_NAME, "opmcId": opmc_id}
    created = api.post("/api/workgroups", token=sa_token, json=body, fabricate={"name": WORK_GROUP_NAME})
    print(f"  created: id={created['id']} name={WORK_GROUP_NAME!r}")
    return created["id"]


def get_or_create_user(api, sa_token, spec, opmc_id, workgroup_id):
    print(f"\n== User: {spec['username']} ({spec['role']}) ==")
    if not api.dry_run:
        existing = api.get("/api/users", token=sa_token) or []
        match = next((u for u in existing if u.get("username") == spec["username"]), None)
        if match:
            print(f"  already exists: id={match['id']}")
            return match["id"]
    body = {
        "username": spec["username"],
        "password": DEMO_PASSWORD,
        "fullName": spec["fullName"],
        "email": spec.get("email"),
        "phone": spec["phone"],
        "address": spec.get("address"),
        "role": spec["role"],
        "opmcId": opmc_id if spec["needs_opmc"] else None,
        "workgroupId": workgroup_id if spec["needs_workgroup"] else None,
    }
    created = api.post("/api/users", token=sa_token, json=body, fabricate={"username": spec["username"]})
    print(f"  created: id={created['id']}")
    return created["id"]


def set_workgroup_team_lead(api, sa_token, wg_id, opmc_id, team_lead_id):
    print("\n== WorkGroup -> Team Lead link ==")
    if not api.dry_run:
        current = api.get(f"/api/workgroups/{wg_id}", token=sa_token)
        if current and current.get("teamLeadId") == team_lead_id:
            print(f"  already linked: workgroup {wg_id} -> team lead {team_lead_id}")
            return
    body = {"name": WORK_GROUP_NAME, "opmcId": opmc_id, "teamLeadId": team_lead_id}
    api.put(f"/api/workgroups/{wg_id}", token=sa_token, json=body)
    print(f"  linked: workgroup {wg_id} -> team lead {team_lead_id}")


def get_or_create_fault(api, client_token, opmc_id, spec):
    key = spec["key"]
    print(f"\n== Fault {key}: {spec['category']} ({spec['description'][:50]}...) ==")
    if not api.dry_run:
        existing = api.get("/api/faults/my-reports", token=client_token) or []
        match = next((f for f in existing if f.get("description") == spec["description"]), None)
        if match:
            print(f"  already exists: id={match['id']} number={match.get('faultNumber')}")
            return match
    body = {
        "category": spec["category"],
        "description": spec["description"],
        "locationAddress": f"{spec['locationCity']}, {spec['locationDistrict']}",
        "locationCity": spec["locationCity"],
        "locationDistrict": spec["locationDistrict"],
        "latitude": spec["latitude"],
        "longitude": spec["longitude"],
        "opmcId": opmc_id,
        "priority": spec["priority"],
    }
    created = api.post("/api/faults", token=client_token, json=body,
                        fabricate={"faultNumber": f"<dry-run-{key}>", "status": "REPORTED", "workGroupId": None})
    print(f"  created: id={created['id']} number={created.get('faultNumber')}")
    return created


def assign_fault_to_workgroup(api, sa_token, fault, wg_id):
    fault_id = fault["id"]
    print(f"\n== Assign fault {fault_id} -> WorkGroup {wg_id} ==")
    if not api.dry_run:
        current = api.get(f"/api/faults/{fault_id}", token=sa_token)
        if current and current.get("workGroupId"):
            print(f"  already assigned: workGroupId={current['workGroupId']}")
            return current
    api.post(f"/api/faults/{fault_id}/assign", token=sa_token, json={"workGroupId": wg_id})
    print("  assigned")
    return fault


# ============================================================================
# BOD + Job lifecycle
# ============================================================================

def perform_bod_if_needed(api, tl_token, technician_ids):
    print("\n== Team Lead BOD (Beginning of Day) ==")
    if not api.dry_run:
        try:
            session = api.get("/api/jobs/session", token=tl_token)
            if session and session.get("status") == "ACTIVE":
                print(f"  active session already exists: id={session['id']}")
                return session
        except ApiError:
            pass  # no session yet for today -- fall through and create one
    body = {
        "latitude": OPMC["latitude"], "longitude": OPMC["longitude"],
        "locationAddress": OPMC["address"], "odometerStart": 45000,
        "technicianIds": technician_ids,
    }
    created = api.post("/api/jobs/bod", token=tl_token, json=body, fabricate={"status": "ACTIVE"})
    print(f"  BOD complete: session id={created.get('id')}")
    return created


def get_or_create_job(api, sa_token, tl_token, fault_id, technician_id, priority=None):
    print(f"\n== Job for fault {fault_id} -> technician {technician_id} ==")
    if not api.dry_run:
        all_jobs = api.get("/api/jobs", token=sa_token) or []
        match = next((j for j in all_jobs if j.get("faultId") == fault_id), None)
        if match:
            print(f"  already exists: id={match['id']} number={match.get('jobNumber')} status={match.get('status')}")
            return match
    body = {"faultId": fault_id, "technicianId": technician_id}
    if priority:
        body["priority"] = priority
    created = api.post("/api/jobs", token=tl_token, json=body,
                        fabricate={"jobNumber": "<dry-run-job>", "status": "PENDING", "faultId": fault_id})
    print(f"  created: id={created['id']} number={created.get('jobNumber')}")
    return created


def advance_job_along_path(api, tech_token, job, full_path, hold_reason=None, completion=None):
    current = job.get("status", "PENDING")
    if current not in full_path:
        print(f"  ! job {job.get('id')} status {current!r} is not on the expected path {full_path} -- leaving as-is")
        return job
    remaining = full_path[full_path.index(current) + 1:]
    for status in remaining:
        body = {"newStatus": status}
        if status == "HOLD":
            body["reason"] = hold_reason
        if status == "COMPLETED":
            body.update(completion or {})
        job = api.patch(f"/api/jobs/{job['id']}/status", token=tech_token, json=body,
                         fabricate={**job, "status": status})
        print(f"  -> job {job.get('id')} status now {status}")
    return job


# ============================================================================
# Payment
# ============================================================================

def get_or_create_payment(api, sa_token, tl_token, job_id, payment_spec):
    print(f"\n== Payment for job {job_id} ==")
    if not api.dry_run:
        all_payments = api.get("/api/payments/all", token=sa_token) or []
        match = next((p for p in all_payments if p.get("jobId") == job_id), None)
        if match:
            print(f"  already exists: id={match['id']} number={match.get('paymentNumber')} status={match.get('status')}")
            return match
    body = {"jobId": job_id, **payment_spec}
    created = api.post("/api/payments", token=tl_token, json=body,
                        fabricate={"paymentNumber": "<dry-run-pay>", "status": "DRAFT", "jobId": job_id})
    print(f"  submitted: id={created['id']} number={created.get('paymentNumber')}")
    return created


def ensure_payment_final(api, sa_token, payment):
    status = payment.get("status")
    if status == "FINAL":
        print(f"  payment {payment.get('id')} already FINAL (bill {payment.get('billReference')})")
        return payment
    if status != "DRAFT":
        print(f"  ! payment {payment.get('id')} is {status}, not DRAFT -- not auto-approving, leaving as-is")
        return payment
    reviewed = api.patch(f"/api/payments/{payment['id']}/review", token=sa_token,
                          json={"decision": "APPROVED"}, fabricate={**payment, "status": "FINAL"})
    print(f"  approved -> FINAL: id={reviewed.get('id')} bill={reviewed.get('billReference')}")
    return reviewed


# ============================================================================
# Main
# ============================================================================

def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--execute", action="store_true",
                         help="Actually perform the API calls. Default is a dry run: prints every "
                              "planned call and payload, makes zero network requests.")
    parser.add_argument("--base-url", default=None,
                         help="fieldops API base URL. Required with --execute -- no default, no "
                              "localhost fallback: a real run only ever targets exactly what you "
                              "pass here. For a dry run only, falls back to $FIELDOPS_API_BASE_URL "
                              f"or {DEFAULT_BASE_URL} if omitted (irrelevant -- a dry run makes no "
                              "network calls regardless).")
    args = parser.parse_args()

    if args.execute and not args.base_url:
        print("ERROR: --execute requires --base-url to be given explicitly.")
        print("       There is no default and no localhost fallback for a real run --")
        print("       pass the live deployment's reachable address, e.g.:")
        print("         python seed_demo_data.py --execute --base-url https://<vm-host-or-ip>:8080")
        sys.exit(1)

    base_url = args.base_url if args.base_url else DEFAULT_BASE_URL
    api = Api(base_url, dry_run=not args.execute)
    mode = "EXECUTE (real API calls against " + base_url + ")" if args.execute else "DRY RUN (no network calls)"
    print(f"=== seed_demo_data.py -- {mode} ===")

    # --- bootstrap check -----------------------------------------------------
    print("\n== Super Admin login ==")
    if api.dry_run:
        sa_token, sa_id = login(api, SUPERADMIN_USERNAME, DEMO_PASSWORD)
    else:
        try:
            sa_token, sa_id = login(api, SUPERADMIN_USERNAME, DEMO_PASSWORD)
        except ApiError as e:
            print(f"  FAILED to log in as '{SUPERADMIN_USERNAME}': {e}")
            print("  Run `python seed_admin.py seed-admin` against this same database first --")
            print("  this script cannot bootstrap the very first Super Admin (see module docstring).")
            sys.exit(1)
    print(f"  logged in: user id={sa_id}")

    # --- Opmc -> WorkGroup -----------------------------------------------------
    opmc_id = get_or_create_opmc(api, sa_token)
    wg_id = get_or_create_workgroup(api, sa_token, opmc_id)

    # --- Users (all 5 roles) ----------------------------------------------------
    user_ids = {}
    for spec in USERS:
        user_ids[spec["key"]] = get_or_create_user(api, sa_token, spec, opmc_id, wg_id)

    set_workgroup_team_lead(api, sa_token, wg_id, opmc_id, user_ids["team_lead"])

    # --- per-user tokens (every seeded account password-logs-in, incl. Client/Tech/TL) --
    print("\n== Logging in as each seeded user ==")
    tokens = {}
    for spec in USERS:
        tokens[spec["key"]], _ = login(api, spec["username"], DEMO_PASSWORD)
        print(f"  {spec['username']} ({spec['role']}): logged in")

    # --- Faults ------------------------------------------------------------------
    faults = {}
    for spec in FAULTS:
        faults[spec["key"]] = get_or_create_fault(api, tokens[spec["client"]], opmc_id, spec)

    for spec in FAULTS:
        if spec.get("assign"):
            faults[spec["key"]] = assign_fault_to_workgroup(api, sa_token, faults[spec["key"]], wg_id)

    # --- BOD (once, covers every technician used below) ---------------------------
    technician_ids = [user_ids["tech1"], user_ids["tech2"]]
    perform_bod_if_needed(api, tokens["team_lead"], technician_ids)

    # --- Jobs, advanced to each fault's intended resting state ---------------------
    jobs = {}
    for spec in FAULTS:
        if "technician" not in spec:
            continue
        job = get_or_create_job(api, sa_token, tokens["team_lead"],
                                 faults[spec["key"]]["id"], user_ids[spec["technician"]],
                                 priority=spec.get("priority"))
        job = advance_job_along_path(api, tokens[spec["technician"]], job, spec["job_path"],
                                      hold_reason=spec.get("hold_reason"),
                                      completion=spec.get("completion"))
        jobs[spec["key"]] = job

    # --- Payment, taken to FINAL ----------------------------------------------------
    payments = {}
    for spec in FAULTS:
        if "payment" in spec:
            p = get_or_create_payment(api, sa_token, tokens["team_lead"],
                                       jobs[spec["key"]]["id"], spec["payment"])
            p = ensure_payment_final(api, sa_token, p)
            payments[spec["key"]] = p

    # --- Verify every seeded account actually logs in via password ------------------
    print("\n== Verifying password login for every seeded account ==")
    for spec in USERS:
        try:
            login(api, spec["username"], DEMO_PASSWORD)
            print(f"  OK   {spec['username']} ({spec['role']})")
        except ApiError as e:
            print(f"  FAIL {spec['username']} ({spec['role']}): {e}")

    # --- Summary ----------------------------------------------------------------
    print("\n" + "=" * 78)
    print("SUMMARY" + ("  (DRY RUN -- nothing above was actually created)" if api.dry_run else ""))
    print("=" * 78)
    print(f"Opmc:      id={opmc_id}  code={OPMC['code']}  name={OPMC['name']!r}")
    print(f"WorkGroup: id={wg_id}  name={WORK_GROUP_NAME!r}")
    print("\nUsers (all password-loginable via POST /api/auth/login, password: "
          f"{DEMO_PASSWORD}):")
    for spec in USERS:
        print(f"  {spec['role']:<12} username={spec['username']:<20} phone={spec['phone']}  "
              f"id={user_ids[spec['key']]}")
    print("\nFaults:")
    for spec in FAULTS:
        f = faults[spec["key"]]
        print(f"  {spec['key']}: id={f.get('id')} number={f.get('faultNumber')} "
              f"category={spec['category']} priority={spec['priority']}")
    print("\nJobs:")
    for key, job in jobs.items():
        print(f"  {key}: id={job.get('id')} number={job.get('jobNumber')} status={job.get('status')}")
    print("\nPayments:")
    for key, p in payments.items():
        print(f"  {key}: id={p.get('id')} number={p.get('paymentNumber')} status={p.get('status')} "
              f"bill={p.get('billReference')}")
    print("=" * 78)
    if api.dry_run:
        print("\nRe-run with --execute (and --base-url pointing at the live deployment) to actually seed it.")


if __name__ == "__main__":
    main()
