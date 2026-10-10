"""One-time administrator bootstrap for CareerLens AI (Phase A).

Run from the backend/ directory:

    python -m app.cli.create_admin

Behavior:
- Asks for the admin login email and full name (sensible defaults provided).
- Reads the password from the terminal with getpass — never echoed, never
  logged, never written to source code or Git. Only a bcrypt hash is stored.
- Creates a NEW account with role="admin". It never promotes an existing
  student account and never resets an existing administrator's password.
- Safe to rerun: if the admin already exists it exits without changes.

Options:
    python -m app.cli.create_admin --email you@example.com --name "Full Name"
    python -m app.cli.create_admin --check      # report status only, no changes
"""
import argparse
import sys
from typing import Optional, Tuple

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.user import User

DEFAULT_EMAIL = "goditisandeep@gmail.com"
DEFAULT_NAME = "Godithi Sandeep"
MIN_PASSWORD_LEN = 8  # matches RegisterRequest policy

EXIT_OK = 0
EXIT_ERROR = 1
EXIT_CONFLICT = 2

CONFLICT_HELP = """\
CONFLICT: {email} already exists as a {role} account.
This script will NOT silently promote it and will NOT reset any password.
Safe recovery options:
  1) Run again with a different email, e.g.:
       python -m app.cli.create_admin --email admin@example.com
  2) If you are certain this student account is yours and should be admin,
     verify ownership, then promote it manually in your DB client:
       UPDATE users SET role = 'admin' WHERE email = '{email}';
  3) If you forgot the admin password, do NOT edit the hash. Delete the
     admin row in a database client after backing up, then rerun this script
     with that email to create it fresh."""


def bootstrap_admin(db: Session, *, email: str, full_name: str,
                    password: str) -> Tuple[int, str]:
    """Create an admin account. Returns (exit_code, message).

    This is the only code path that ever assigns role="admin", and it is
    reachable only from this offline terminal script (no HTTP endpoint).
    Never prints the password or the hash.
    """
    email = email.strip().lower()
    full_name = full_name.strip()
    if not email or "@" not in email:
        return EXIT_ERROR, "A valid email address is required."
    if len(full_name) < 2:
        return EXIT_ERROR, "Full name must be at least 2 characters."

    existing: Optional[User] = db.query(User).filter(
        func.lower(User.email) == email).first()
    if existing is not None:
        if existing.role == "admin":
            return EXIT_OK, (
                f"Administrator already exists for {email} (id={existing.id}). "
                "No changes were made — this script never resets passwords."
            )
        return EXIT_CONFLICT, CONFLICT_HELP.format(
            email=email, role=existing.role or "student")

    if len(password) < MIN_PASSWORD_LEN:
        return EXIT_ERROR, (
            f"Password must be at least {MIN_PASSWORD_LEN} characters. "
            "No account was created."
        )
    local_part = email.split("@")[0]
    pw_lower = password.lower()
    if (pw_lower in (email.lower(), local_part)
            or email.lower() in pw_lower):
        return EXIT_ERROR, (
            "Password must not be your email address (or its local part). "
            "No account was created."
        )

    user = User(full_name=full_name, email=email,
                hashed_password=hash_password(password), role="admin")
    db.add(user)
    db.commit()
    db.refresh(user)
    return EXIT_OK, (
        f"Administrator created: {full_name} <{email}> "
        f"(id={user.id}, role={user.role})."
    )


def _read_password() -> Optional[str]:
    """Hidden terminal prompt with confirmation. None if invalid/mismatch."""
    import getpass

    pw = getpass.getpass("Admin password (hidden): ")
    confirm = getpass.getpass("Confirm password: ")
    if pw != confirm:
        print("Passwords do not match.", file=sys.stderr)
        return None
    if len(pw) < MIN_PASSWORD_LEN:
        print(f"Password must be at least {MIN_PASSWORD_LEN} characters.",
              file=sys.stderr)
        return None
    return pw


def main(argv: Optional[list[str]] = None) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m app.cli.create_admin",
        description="Securely create the first CareerLens AI administrator.",
    )
    parser.add_argument("--email", help="Administrator login email")
    parser.add_argument("--name", dest="full_name",
                        help='Administrator full name (e.g. "Godithi Sandeep")')
    parser.add_argument("--check", action="store_true",
                        help="Report admin status without making changes")
    args = parser.parse_args(argv)

    # Defer DB import so --help works without touching the database.
    from app.database.db import SessionLocal, init_db

    init_db()
    db = SessionLocal()
    try:
        if args.check:
            admins = db.query(User).filter(User.role == "admin").all()
            if not admins:
                print("No administrator exists yet. Run without --check to "
                      "create one.")
                return EXIT_ERROR
            for a in admins:
                print(f"Administrator: {a.full_name} <{a.email}> "
                      f"(id={a.id}, active={a.is_active})")
            return EXIT_OK

        email = args.email or input(
            f"Admin login email [{DEFAULT_EMAIL}]: ").strip() or DEFAULT_EMAIL
        name = args.full_name or input(
            f"Admin full name [{DEFAULT_NAME}]: ").strip() or DEFAULT_NAME

        # Quick pre-check so we don't ask for a password on a doomed run.
        from sqlalchemy import func as _func
        existing = db.query(User).filter(
            _func.lower(User.email) == email.strip().lower()).first()
        if existing is not None and existing.role != "admin":
            # Reuse the conflict formatter without a password prompt.
            code, msg = bootstrap_admin(
                db, email=email, full_name=name, password="")
            print(msg)
            return code

        password = _read_password()
        if password is None:
            return EXIT_ERROR
        code, msg = bootstrap_admin(
            db, email=email, full_name=name, password=password)
        del password  # explicit: never retained
        print(msg)
        return code
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
