"""Persist workspace appearance and scope existing provider defaults without losing them."""

import sqlalchemy as sa
from alembic import op

revision = "0004_preferences"
down_revision = "0003_intelligence"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "workspace_preferences",
        sa.Column("org_id", sa.String(36), sa.ForeignKey("organizations.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("theme", sa.String(10), nullable=False),
    )
    with op.batch_alter_table("provider_preferences") as batch:
        batch.add_column(sa.Column("org_id", sa.String(36), nullable=True))
        batch.create_foreign_key(
            "fk_provider_preferences_org_id", "organizations", ["org_id"], ["id"], ondelete="CASCADE"
        )
        batch.create_index("ix_provider_preferences_org_id", ["org_id"])
    op.execute(
        "UPDATE provider_preferences SET org_id = (SELECT org_id FROM memberships WHERE memberships.user_id = provider_preferences.user_id ORDER BY memberships.id LIMIT 1)"
    )


def downgrade():
    with op.batch_alter_table("provider_preferences") as batch:
        batch.drop_index("ix_provider_preferences_org_id")
        batch.drop_constraint("fk_provider_preferences_org_id", type_="foreignkey")
        batch.drop_column("org_id")
    op.drop_table("workspace_preferences")
