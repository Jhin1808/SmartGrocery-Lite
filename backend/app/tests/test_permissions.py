from sqlalchemy.orm import Session

from app.permissions import can_read, can_write
from app.models import User, GroceryList, ListShare, ShareRole
from app.database import get_db


def _db_from_client(client) -> Session:
    # Reuse the test DB session override installed by conftest.py
    override = client.app.dependency_overrides.get(get_db)
    assert override, "get_db override not set in tests"
    gen = override()
    db = next(gen)
    # caller is responsible for closing via db.close()
    return db


def test_permissions_read_write_matrix(client):
    db = _db_from_client(client)
    try:
        # Users
        owner = User(email="owner@example.com")
        viewer = User(email="viewer@example.com")
        editor = User(email="editor@example.com")
        stranger = User(email="stranger@example.com")
        db.add_all([owner, viewer, editor, stranger])
        db.commit()
        db.refresh(owner); db.refresh(viewer); db.refresh(editor); db.refresh(stranger)

        # List owned by owner
        gl = GroceryList(name="Perms List", owner_id=owner.id)
        db.add(gl)
        db.commit()
        db.refresh(gl)

        # Shares
        db.add_all([
            ListShare(list_id=gl.id, user_id=viewer.id, role=ShareRole.viewer, hidden=False),
            ListShare(list_id=gl.id, user_id=editor.id, role=ShareRole.editor, hidden=False),
        ])
        db.commit()

        # Owner
        assert can_read(db, owner.id, gl.id) is True
        assert can_write(db, owner.id, gl.id) is True

        # Viewer
        assert can_read(db, viewer.id, gl.id) is True
        assert can_write(db, viewer.id, gl.id) is False

        # Editor
        assert can_read(db, editor.id, gl.id) is True
        assert can_write(db, editor.id, gl.id) is True

        # Stranger
        assert can_read(db, stranger.id, gl.id) is False
        assert can_write(db, stranger.id, gl.id) is False
    finally:
        db.close()

