from alembic import context

from app import models  # noqa: F401
from app.db import Base, engine


def run():
    with engine.connect() as connection:
        if engine.dialect.name == "sqlite":
            # Batch rebuilds preserve rows, and must not cascade-delete children
            # while the old parent table is replaced. Validate all FKs afterward.
            connection.exec_driver_sql("PRAGMA foreign_keys=OFF")
            connection.commit()
        context.configure(
            connection=connection, target_metadata=Base.metadata, render_as_batch=engine.dialect.name == "sqlite"
        )
        with context.begin_transaction():
            context.run_migrations()
        if engine.dialect.name == "sqlite":
            connection.commit()
            if connection.exec_driver_sql("PRAGMA foreign_key_check").fetchall():
                raise RuntimeError("Foreign key validation failed after migration")
            connection.exec_driver_sql("PRAGMA foreign_keys=ON")


run()
