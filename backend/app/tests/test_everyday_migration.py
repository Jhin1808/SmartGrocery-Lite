from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text
from app.models import Base


def test_upgrade_from_previous_schema_and_downgrade(tmp_path, monkeypatch):
    url = f'sqlite:///{tmp_path / "migration.db"}'
    engine = create_engine(url)
    added = {'staple', 'purchase_history', 'restock_run', 'demo_import'}
    Base.metadata.create_all(engine, tables=[table for table in Base.metadata.sorted_tables if table.name not in added])
    with engine.begin() as conn:
        conn.execute(text('INSERT INTO "user" (id,email) VALUES (1,\'existing@example.com\')'))
    monkeypatch.setenv('DATABASE_URL', url)
    config = Config('alembic.ini')
    command.stamp(config, '2026_06_02_security_lockdown')
    command.upgrade(config, 'head')
    assert added.issubset(inspect(engine).get_table_names())
    with engine.connect() as conn:
        assert conn.execute(text('SELECT email FROM "user" WHERE id=1')).scalar_one() == 'existing@example.com'
    command.downgrade(config, '2026_06_02_security_lockdown')
    assert not added.intersection(inspect(engine).get_table_names())
    engine.dispose()


def test_postgres_migration_generates_rls_and_service_role_sequence_grants(monkeypatch):
    from io import StringIO
    output = StringIO()
    monkeypatch.setenv('DATABASE_URL', 'postgresql://localhost/migration_check')
    config = Config('alembic.ini', output_buffer=output)
    command.upgrade(config, '2026_06_02_security_lockdown:2026_10_30_everyday', sql=True)
    sql = output.getvalue()
    assert 'CREATE TABLE staple' in sql
    assert 'ENABLE ROW LEVEL SECURITY' in sql
    assert 'GRANT ALL ON SEQUENCE "staple_id_seq" TO service_role' in sql
    assert 'REVOKE ALL ON TABLE "purchase_history" FROM authenticated' in sql
