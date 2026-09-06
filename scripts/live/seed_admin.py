"""seed_admin.py -- direct-SQL bootstrap of the SUPER_ADMIN account for SLTMobileApp's own
live-backend integration test (__tests__/live/login.live.test.tsx).

Vendored from frontend-admin/cypress/support/seed_live_fixtures.py's cmd_seed_admin() rather than
checked out cross-repo: frontend-admin is a private repo, and this workflow's default GITHUB_TOKEN
only has implicit read access to public repos outside the one it runs in (fieldops/slt-backend is
public, which is why that repo's checkout works untokened in frontend-admin/e2e-live.yml -- a
private cross-repo checkout would need an explicit PAT secret this repo doesn't have configured).
Only the seed-admin command is needed here, so only that command is vendored, not the whole file.

Connects directly to fieldops's own datasource -- same connection convention as the original
script (see frontend-admin/cypress/support/seed_live_fixtures.py for the fuller rationale, which
still applies verbatim here).

Usage:
  python seed_admin.py
      Idempotently ensures one SUPER_ADMIN user (username=superadmin, phone=0770000000) exists.
      Safe to call every run -- does nothing if the row is already there. Prints ADMIN_READY=1.
"""
import os

import pymysql

DB_HOST = os.environ.get("FIELDOPS_DB_HOST", "localhost")
DB_PORT = int(os.environ.get("FIELDOPS_DB_PORT", "3306"))
DB_USER = os.environ.get("FIELDOPS_DB_USER", "root")
DB_PASSWORD = os.environ.get("FIELDOPS_DB_PASSWORD", "1234")
DB_NAME = os.environ.get("FIELDOPS_DB_NAME", "slt_fieldops_db")

# Precomputed via fieldops's own BCryptPasswordEncoder(12), matches Admin@2024 -- same hash
# frontend-admin's seed_live_fixtures.py uses, copied verbatim (BCrypt hashes are portable).
ADMIN_PASSWORD_HASH = "$2a$12$fcJNSpxvKpd9N851.EQzg.KXYP0xnLXub12YIM8eg31fPLM.Yghgm"


def main():
    conn = pymysql.connect(host=DB_HOST, port=DB_PORT, user=DB_USER, password=DB_PASSWORD,
                            database=DB_NAME, autocommit=False)
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
            ("superadmin", ADMIN_PASSWORD_HASH),
        )
        conn.commit()
        print("ADMIN_READY=1")
        print(f"ADMIN_ID={cur.lastrowid}")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
