"""Operational CLI for HireFlow.

Usage (from the project root, with the virtualenv active):

    python -m app.cli create-admin --email ops@example.com

Prompts for the password on the terminal (never accepts it as an argument, so it
does not land in shell history or process listings). Admin accounts cannot be
created through the public registration endpoint by design.
"""

from __future__ import annotations

import argparse
import getpass
import sys

from sqlalchemy import select

from app.config import get_settings
from app.db.session import SessionLocal
from app.models.user import User
from app.services import auth as auth_service


def _prompt_password() -> str:
    password = getpass.getpass("Admin password: ")
    confirm = getpass.getpass("Confirm password: ")
    if password != confirm:
        raise SystemExit("Passwords do not match")
    if len(password) < 12:
        raise SystemExit("Admin passwords must be at least 12 characters")
    if not any(c.isalpha() for c in password) or not any(c.isdigit() for c in password):
        raise SystemExit("Admin passwords must contain letters and numbers")
    return password


def create_admin(email: str, password: str | None) -> None:
    email_normalized = email.strip().lower()
    if not email_normalized or "@" not in email_normalized:
        raise SystemExit("A valid email is required")

    secret = password or _prompt_password()

    with SessionLocal() as db:
        existing = db.execute(select(User).where(User.email == email_normalized)).scalar_one_or_none()
        if existing is not None:
            if existing.role == "admin":
                existing.hashed_password = auth_service.get_password_hash(secret)
                existing.is_active = True
                db.commit()
                print(f"Admin {email_normalized} already existed; password reset.")
                return
            raise SystemExit(
                f"{email_normalized} already belongs to a {existing.role} account; "
                "use a different email for the administrator."
            )

        user = User(
            email=email_normalized,
            hashed_password=auth_service.get_password_hash(secret),
            role="admin",
            is_active=True,
            is_verified=True,
        )
        db.add(user)
        db.commit()
        print(f"Created administrator {email_normalized} (id={user.id})")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.cli", description="HireFlow operations")
    sub = parser.add_subparsers(dest="command", required=True)

    admin_parser = sub.add_parser("create-admin", help="Create or reset an administrator account")
    admin_parser.add_argument("--email", default=None, help="Admin email (defaults to ADMIN_EMAIL)")
    admin_parser.add_argument(
        "--password",
        default=None,
        help="Password (omit to be prompted; preferred so it is not logged)",
    )

    args = parser.parse_args(argv)

    if args.command == "create-admin":
        email = args.email or get_settings().ADMIN_EMAIL
        create_admin(email, args.password)
        return 0

    parser.print_help()
    return 1


if __name__ == "__main__":
    sys.exit(main())
