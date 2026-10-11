"""Durable contact notification queue; existing submissions are not emailed retroactively."""

import sqlalchemy as sa
from alembic import op

revision = "0005_contact_email"
down_revision = "0004_preferences"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("contact_submissions") as batch:
        batch.add_column(sa.Column("email_state", sa.String(20), nullable=False, server_default="disabled"))
        batch.add_column(sa.Column("email_attempts", sa.Integer(), nullable=False, server_default="0"))
        batch.add_column(sa.Column("email_available_at", sa.Float(), nullable=False, server_default="0"))
        batch.add_column(sa.Column("email_provider_id", sa.String(100), nullable=True))


def downgrade():
    with op.batch_alter_table("contact_submissions") as batch:
        for column in ("email_provider_id", "email_available_at", "email_attempts", "email_state"):
            batch.drop_column(column)
