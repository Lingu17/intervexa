"""Add scoped repository indexes, social identities, OAuth states and contact storage."""

import sqlalchemy as sa
from alembic import op

revision = "0003_intelligence"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "social_identities",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("provider", sa.String(20), nullable=False),
        sa.Column("subject", sa.String(254), nullable=False),
        sa.UniqueConstraint("provider", "subject"),
    )
    op.create_index("ix_social_identities_user_id", "social_identities", ["user_id"])
    op.create_table(
        "oauth_states",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("provider", sa.String(20), nullable=False),
        sa.Column("nonce", sa.String(64), nullable=False),
        sa.Column("origin", sa.String(300), nullable=False),
        sa.Column("link_user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=True),
        sa.Column("expires", sa.Float(), nullable=False),
    )
    op.create_index("ix_oauth_states_expires", "oauth_states", ["expires"])
    op.create_table(
        "contact_submissions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("email", sa.String(254), nullable=False),
        sa.Column("topic", sa.String(30), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("created_at", sa.Float(), nullable=False),
    )
    op.create_index("ix_contact_submissions_created_at", "contact_submissions", ["created_at"])
    op.create_table(
        "repository_indexes",
        sa.Column("repo_id", sa.String(36), sa.ForeignKey("repositories.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("sha", sa.String(40), nullable=False),
        sa.Column("branch", sa.String(100), nullable=False),
        sa.Column("files", sa.JSON(), nullable=False),
        sa.Column("coverage", sa.JSON(), nullable=False),
        sa.Column("vectors", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.Float(), nullable=False),
    )
    op.create_index("ix_repository_indexes_created_at", "repository_indexes", ["created_at"])


def downgrade():
    for table in ("repository_indexes", "contact_submissions", "oauth_states", "social_identities"):
        op.drop_table(table)
