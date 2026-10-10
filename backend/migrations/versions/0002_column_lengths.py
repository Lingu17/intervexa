"""Constrain strings to application field lengths, preserving existing data."""

import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

TABLES = [
    "users",
    "organizations",
    "memberships",
    "sessions",
    "installations",
    "repositories",
    "pull_requests",
    "analyses",
    "code_entities",
    "dependencies",
    "hypotheses",
    "findings",
    "test_runs",
    "provider_preferences",
    "audit_events",
    "webhook_deliveries",
]
LENGTHS = {
    "email": 254,
    "password": 300,
    "name": 100,
    "role": 20,
    "account": 100,
    "full_name": 201,
    "default_branch": 100,
    "title": 300,
    "base_sha": 40,
    "head_sha": 40,
    "state": 20,
    "error": 500,
    "source": 200,
    "target": 200,
    "kind": 30,
    "status": 30,
    "provider": 30,
    "model": 100,
    "actor": 100,
    "action": 100,
    "csrf": 64,
}


def resize(narrow):
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    for table in TABLES:
        columns = inspector.get_columns(table)
        changes = []
        for column in columns:
            if not isinstance(column["type"], sa.String):
                continue
            field = column["name"]
            length = (
                64
                if table == "sessions" and field == "id"
                else 100
                if table == "webhook_deliveries" and field == "id"
                else LENGTHS.get(field, 36)
            )
            target = length if narrow else 500
            if column["type"].length != target:
                changes.append((column, target))
        if changes:
            with op.batch_alter_table(table) as batch:
                for column, target in changes:
                    batch.alter_column(
                        column["name"],
                        existing_type=column["type"],
                        type_=sa.String(target),
                        existing_nullable=column["nullable"],
                    )


def upgrade():
    resize(True)


def downgrade():
    resize(False)
