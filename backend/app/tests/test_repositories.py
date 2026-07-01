from app.repositories import freeze_dryer_repository
from app.schemas import FreezeDryerCreate, FreezeDryerUpdate


def test_repository_create_get_list_and_update(db_session) -> None:
    freeze_dryer = freeze_dryer_repository.create(
        db_session,
        FreezeDryerCreate(
            name="Freeze Dryer #1",
        ),
    )
    db_session.commit()

    found = freeze_dryer_repository.get(db_session, freeze_dryer.id)
    assert found is not None
    assert found.name == "Freeze Dryer #1"
    assert freeze_dryer_repository.list(db_session) == [found]

    updated = freeze_dryer_repository.update(
        db_session,
        found,
        FreezeDryerUpdate(notes="Primary freeze dryer"),
    )
    db_session.commit()

    assert updated.notes == "Primary freeze dryer"
