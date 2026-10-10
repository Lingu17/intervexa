"""Initial relational schema. This migration is frozen; later changes use new revisions."""

import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Explicit schema generated from the initial model metadata, frozen below.
    tables = [
        ("users", [("id", "pk"), ("email", "unique"), ("name", "str"), ("password", "str"), ("created_at", "float")]),
        ("organizations", [("id", "pk"), ("name", "str")]),
        ("memberships", [("id", "pk"), ("user_id", "fk:users"), ("org_id", "fk:organizations"), ("role", "str")]),
        ("sessions", [("id", "pk"), ("user_id", "fk:users"), ("csrf", "str"), ("expires", "float")]),
        ("installations", [("id", "intpk"), ("org_id", "fk:organizations"), ("account", "str")]),
        (
            "repositories",
            [
                ("id", "pk"),
                ("org_id", "fk:organizations"),
                ("installation_id", "intfk:installations"),
                ("full_name", "str"),
                ("default_branch", "str"),
                ("policy", "json"),
            ],
        ),
        (
            "pull_requests",
            [
                ("id", "pk"),
                ("repo_id", "fk:repositories"),
                ("number", "int"),
                ("title", "str"),
                ("base_sha", "str"),
                ("head_sha", "str"),
                ("files", "json"),
            ],
        ),
        (
            "analyses",
            [
                ("id", "pk"),
                ("org_id", "fk:organizations"),
                ("repo_id", "fk:repositories"),
                ("state", "str"),
                ("snapshot", "json"),
                ("coverage", "json"),
                ("error", "nullable"),
                ("created_at", "float"),
                ("updated_at", "float"),
                ("attempts", "int"),
                ("available_at", "float"),
            ],
        ),
        ("code_entities", [("id", "pk"), ("analysis_id", "fk:analyses"), ("evidence", "json")]),
        (
            "dependencies",
            [("id", "pk"), ("analysis_id", "fk:analyses"), ("source", "str"), ("target", "str"), ("kind", "str")],
        ),
        ("hypotheses", [("id", "pk"), ("analysis_id", "fk:analyses"), ("payload", "json")]),
        ("findings", [("id", "pk"), ("analysis_id", "fk:analyses"), ("status", "str"), ("payload", "json")]),
        ("test_runs", [("id", "pk"), ("analysis_id", "fk:analyses"), ("result", "json")]),
        (
            "provider_preferences",
            [("user_id", "pkfk:users"), ("provider", "str"), ("model", "str"), ("max_tokens", "int")],
        ),
        (
            "audit_events",
            [
                ("id", "pk"),
                ("org_id", "fk:organizations"),
                ("actor", "str"),
                ("action", "str"),
                ("created_at", "float"),
            ],
        ),
        ("webhook_deliveries", [("id", "pk"), ("created_at", "float")]),
    ]
    unique = {
        "memberships": ("user_id", "org_id"),
        "repositories": ("org_id", "full_name"),
        "pull_requests": ("repo_id", "number"),
    }
    for name, fields in tables:
        columns = []
        for field, kind in fields:
            datatype = (
                sa.JSON()
                if kind == "json"
                else sa.Float()
                if kind == "float"
                else sa.Integer()
                if kind.startswith("int")
                else sa.String(500)
            )
            args = [sa.ForeignKey(kind.split(":")[1] + ".id", ondelete="CASCADE")] if ":" in kind else []
            columns.append(
                sa.Column(
                    field,
                    datatype,
                    *args,
                    primary_key=kind in ("pk", "intpk") or kind.startswith("pkfk"),
                    nullable=kind == "nullable",
                    unique=kind == "unique",
                )
            )
        if name in unique:
            columns.append(sa.UniqueConstraint(*unique[name]))
        op.create_table(name, *columns)
        for field, kind in fields:
            if kind.startswith("fk:") or kind.startswith("intfk:") or (name == "analyses" and field == "state"):
                op.create_index(f"ix_{name}_{field}", name, [field])


def downgrade():
    for table in [
        "webhook_deliveries",
        "audit_events",
        "provider_preferences",
        "test_runs",
        "findings",
        "hypotheses",
        "dependencies",
        "code_entities",
        "analyses",
        "pull_requests",
        "repositories",
        "installations",
        "sessions",
        "memberships",
        "organizations",
        "users",
    ]:
        op.drop_table(table)
