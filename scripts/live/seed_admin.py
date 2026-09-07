"""seed_admin.py -- direct-SQL fixture seeding for SLTMobileApp's own live-backend integration
tests (__tests__/live/*.live.test.tsx).

Vendored from frontend-admin/cypress/support/seed_live_fixtures.py's cmd_seed_admin() rather than
checked out cross-repo: frontend-admin is a private repo, and this workflow's default GITHUB_TOKEN
only has implicit read access to public repos outside the one it runs in (fieldops/slt-backend is
public, which is why that repo's checkout works untokened in frontend-admin/e2e-live.yml -- a
private cross-repo checkout would need an explicit PAT secret this repo doesn't have configured).

Connects directly to fieldops's own datasource -- same connection convention as the original
script (see frontend-admin/cypress/support/seed_live_fixtures.py for the fuller rationale, which
still applies verbatim here).

Usage:
  python seed_admin.py seed-admin
      Idempotently ensures one SUPER_ADMIN user (username=superadmin, phone=0770000000) exists.
      Safe to call every run -- does nothing if the row is already there. Prints ADMIN_READY=1.

  python seed_admin.py seed-job-assignment
      Idempotently ensures one OPMC + Work Group + Team Lead (phone=0770000001) + Technician
      (phone=0770000002, a member of the same Work Group) + one unclaimed Fault already routed to
      that Work Group (fault_number='CIJA-TEST-001') all exist -- everything jobAssignment.live
      .test.tsx needs as a precondition for a real POST /api/jobs call, short of the Team Lead's
      own real BOD session (that part is a real dispatch from the test itself, not seeded, since
      proving performBOD's own real-backend wiring is part of what that test is for). Prints
      WORK_GROUP_ID=<id> and FAULT_ID=<id> for log visibility -- the test itself discovers both
      dynamically via real API calls (GET /api/faults/my-workgroup, GET /api/team/members) rather
      than needing either value passed through CI, matching the H1c circuit-picker Cypress specs'
      own "seed by deterministic marker, discover live" convention.
"""
import argparse
import os

import pymysql

DB_HOST = os.environ.get("FIELDOPS_DB_HOST", "localhost")
DB_PORT = int(os.environ.get("FIELDOPS_DB_PORT", "3306"))
DB_USER = os.environ.get("FIELDOPS_DB_USER", "root")
DB_PASSWORD = os.environ.get("FIELDOPS_DB_PASSWORD", "1234")
DB_NAME = os.environ.get("FIELDOPS_DB_NAME", "slt_fieldops_db")

# Precomputed via fieldops's own BCryptPasswordEncoder(12), matches Admin@2024 -- same hash
# frontend-admin's seed_live_fixtures.py uses, copied verbatim (BCrypt hashes are portable).
# Reused for every seeded user below: none of them ever password-logs-in (OTP-only), so the
# actual hash value never matters beyond satisfying the NOT NULL column.
PASSWORD_HASH = "$2a$12$fcJNSpxvKpd9N851.EQzg.KXYP0xnLXub12YIM8eg31fPLM.Yghgm"

TEAM_LEAD_PHONE = "0770000001"
TECHNICIAN_PHONE = "0770000002"
FAULT_NUMBER = "CIJA-TEST-001"


def connect():
    return pymysql.connect(host=DB_HOST, port=DB_PORT, user=DB_USER, password=DB_PASSWORD,
                            database=DB_NAME, autocommit=False)


def cmd_seed_admin():
    conn = connect()
    try:
        cur = conn.cursor()
        cur.execute("SELECT id FROM users WHERE username = %s", ("superadmin",))
        existing = cur.fetchone()
        if existing:
            print("ADMIN_READY=1")
            print(f"ADMIN_ID={existing[0]} (already existed)")
            return
        cur.execute(
            """
            INSERT INTO users (username, password_hash, first_name, last_name, full_name, phone,
                                role, status, is_active, failed_login_attempts, force_password_change,
                                preferred_language, notify_billing, notify_job_completed,
                                notify_promotions, notify_status_updates, notify_technician_assigned,
                                created_at, updated_at)
            VALUES (%s, %s, 'Super', 'Admin', 'Super Admin', '0770000000',
                    'SUPER_ADMIN', 'ACTIVE', 1, 0, 0, 'ENGLISH', 1, 1, 0, 1, 1, NOW(), NOW())
            """,
            ("superadmin", PASSWORD_HASH),
        )
        conn.commit()
        print("ADMIN_READY=1")
        print(f"ADMIN_ID={cur.lastrowid}")
    finally:
        conn.close()


def _insert_user(cur, username, first_name, last_name, phone, role, opmc_id, workgroup_id):
    cur.execute(
        """
        INSERT INTO users (username, password_hash, first_name, last_name, full_name, phone,
                            role, status, is_active, failed_login_attempts, force_password_change,
                            preferred_language, notify_billing, notify_job_completed,
                            notify_promotions, notify_status_updates, notify_technician_assigned,
                            opmc_id, workgroup_id, created_at, updated_at)
        VALUES (%s, %s, %s, %s, %s, %s,
                %s, 'ACTIVE', 1, 0, 0, 'ENGLISH', 1, 1, 0, 1, 1,
                %s, %s, NOW(), NOW())
        """,
        (username, PASSWORD_HASH, first_name, last_name, f"{first_name} {last_name}", phone,
         role, opmc_id, workgroup_id),
    )
    return cur.lastrowid


def cmd_seed_job_assignment():
    conn = connect()
    try:
        cur = conn.cursor()

        cur.execute("SELECT id FROM users WHERE phone = %s", (TEAM_LEAD_PHONE,))
        existing = cur.fetchone()
        if existing:
            cur.execute("SELECT workgroup_id FROM users WHERE id = %s", (existing[0],))
            wg_id = cur.fetchone()[0]
            cur.execute(
                "SELECT id FROM faults WHERE fault_number = %s", (FAULT_NUMBER,),
            )
            fault_row = cur.fetchone()
            print("JOB_ASSIGNMENT_FIXTURES_READY=1")
            print(f"WORK_GROUP_ID={wg_id} (already existed)")
            if fault_row:
                print(f"FAULT_ID={fault_row[0]} (already existed)")
            return

        # Opmc -- name/code/opmc_type/address/working_days/status are all NOT NULL with no
        # DB-level default under ddl-auto=update, matching every other fixture helper this
        # project's own established convention supplies explicitly.
        cur.execute(
            """
            INSERT INTO opmcs (name, code, opmc_type, address, working_days, status,
                                created_at, updated_at)
            VALUES ('CI Job-Assignment OPMC', 'CIJA', 'LOCAL_BRANCH', 'CI Test Address',
                    'MON,TUE,WED,THU,FRI', 'ACTIVE', NOW(), NOW())
            """
        )
        opmc_id = cur.lastrowid

        # Work Group -- team_lead_id set afterward, once the Team Lead user (below) exists.
        # opmc_id IS a real @ManyToOne/@JoinColumn FK here (unlike Fault.opmcId, which is a
        # plain unmapped Long) -- confirmed directly against WorkGroup.java -- so this insert
        # must follow the Opmc insert above, not just resemble its shape.
        cur.execute(
            """
            INSERT INTO work_groups (name, opmc_id, is_active, created_at, updated_at)
            VALUES ('CI Job-Assignment Work Group', %s, 1, NOW(), NOW())
            """,
            (opmc_id,),
        )
        wg_id = cur.lastrowid

        team_lead_id = _insert_user(
            cur, "ci_teamlead_ja", "CI", "TeamLead", TEAM_LEAD_PHONE, "TEAM_LEAD", opmc_id, wg_id,
        )
        technician_id = _insert_user(
            cur, "ci_tech_ja", "CI", "Technician", TECHNICIAN_PHONE, "TECHNICIAN", opmc_id, wg_id,
        )

        cur.execute(
            "UPDATE work_groups SET team_lead_id = %s WHERE id = %s", (team_lead_id, wg_id),
        )

        # Fault -- work_group_id set directly (also a plain unmapped Long on Fault, confirmed no
        # FK constraint, same as opmc_id/customer_id/assigned_team_lead_id below) so the fault
        # already sits in this Work Group's queue without a separate POST /api/faults/{id}/assign
        # call. assigned_team_lead_id left NULL -- JobService.createJob auto-claims it the moment
        # a job is dispatched from it, exactly the real, un-self-assigned-yet path AssignJobsScreen
        # supports. opmc_id/customer_id are arbitrary (1/6) -- same precedent already established
        # in frontend-admin/cypress/support/seed_live_fixtures.py's _insert_fault for exactly this
        # reason (no FK constraint on either column).
        cur.execute(
            """
            INSERT INTO faults (fault_number, customer_id, category, description, opmc_id,
                                 work_group_id, priority, status, reopen_count, is_overdue,
                                 sla_breached, is_escalated, reported_at, created_at, updated_at)
            VALUES (%s, 6, 'INTERNET', 'CI live-backend job-assignment test fault', 1, %s,
                    'MEDIUM', 'REPORTED', 0, 0, 0, 0, NOW(6), NOW(6), NOW())
            """,
            (FAULT_NUMBER, wg_id),
        )
        fault_id = cur.lastrowid

        conn.commit()
        print("JOB_ASSIGNMENT_FIXTURES_READY=1")
        print(f"OPMC_ID={opmc_id}")
        print(f"WORK_GROUP_ID={wg_id}")
        print(f"TEAM_LEAD_ID={team_lead_id}")
        print(f"TECHNICIAN_ID={technician_id}")
        print(f"FAULT_ID={fault_id}")
    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("seed-admin")
    sub.add_parser("seed-job-assignment")
    args = parser.parse_args()

    if args.command == "seed-admin":
        cmd_seed_admin()
    elif args.command == "seed-job-assignment":
        cmd_seed_job_assignment()


if __name__ == "__main__":
    main()
