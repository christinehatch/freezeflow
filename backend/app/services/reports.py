from datetime import UTC, date, datetime, time, timedelta
from decimal import Decimal
from uuid import UUID

from sqlalchemy import Select, Subquery, case, func, select
from sqlalchemy.orm import Session

from app.models import (
    DryingRun,
    FreezeDryer,
    Package,
    ProductionBatch,
    Tray,
)
from app.models.enums import (
    DryingRunStatus,
    InventoryStatus,
    ProductionBatchStatus,
    TrayStatus,
)
from app.schemas import (
    DryingTimeRow,
    FreezeDryerPerformanceRow,
    InventorySummary,
    MostCommonProduct,
    PreparationHistoryRow,
    ProductHistoryRow,
    ProductionHistoryRow,
    ReportFilters,
)
from app.services._product_identity import product_identity_query

# Reports scope to completed production history (RP-003). A Tray is
# "completed production history" whether or not it has since been
# packaged - Packaged is simply "Completed, and later packaged," not a
# different production outcome.
QUALIFYING_TRAY_STATUSES = (TrayStatus.COMPLETED, TrayStatus.PACKAGED)


def freeze_dryer_performance(
    db: Session, filters: ReportFilters
) -> list[FreezeDryerPerformanceRow]:
    batches = _qualifying_batches_subquery(filters)
    batch_drying = _batch_drying_stats_subquery()
    completion_seconds = _seconds_between(batches.c.started_at, batches.c.completed_at)

    time_stmt = (
        select(
            batches.c.freeze_dryer_id,
            func.count(batches.c.id).label("completed_production_batch_count"),
            func.avg(batch_drying.c.total_drying_seconds).label(
                "average_dry_time_seconds"
            ),
            func.avg(completion_seconds).label("average_time_to_completion_seconds"),
        )
        .select_from(batches)
        .join(
            batch_drying,
            batch_drying.c.production_batch_id == batches.c.id,
            isouter=True,
        )
        .group_by(batches.c.freeze_dryer_id)
    )
    time_rows = {row.freeze_dryer_id: row for row in db.execute(time_stmt).all()}
    if not time_rows:
        return []

    weight_loss_percent = _percent(
        Tray.starting_weight_grams - Tray.final_dry_weight_grams,
        Tray.starting_weight_grams,
    )
    weight_loss_stmt = (
        select(
            batches.c.freeze_dryer_id,
            func.avg(weight_loss_percent).label("average_weight_loss_percent"),
        )
        .select_from(batches)
        .join(Tray, Tray.production_batch_id == batches.c.id)
        .where(Tray.status.in_(QUALIFYING_TRAY_STATUSES))
        .where(Tray.starting_weight_grams.isnot(None))
        .where(Tray.starting_weight_grams > 0)
        .group_by(batches.c.freeze_dryer_id)
    )
    weight_loss_by_dryer = {
        row.freeze_dryer_id: row.average_weight_loss_percent
        for row in db.execute(weight_loss_stmt).all()
    }

    freeze_dryer_names = {
        freeze_dryer.id: freeze_dryer.name
        for freeze_dryer in db.execute(
            select(FreezeDryer.id, FreezeDryer.name).where(
                FreezeDryer.id.in_(time_rows.keys())
            )
        ).all()
    }

    return [
        FreezeDryerPerformanceRow(
            freeze_dryer_id=freeze_dryer_id,
            freeze_dryer_name=freeze_dryer_names[freeze_dryer_id],
            completed_production_batch_count=row.completed_production_batch_count,
            average_dry_time_seconds=row.average_dry_time_seconds,
            average_weight_loss_percent=_as_decimal(
                weight_loss_by_dryer.get(freeze_dryer_id)
            ),
            average_time_to_completion_seconds=row.average_time_to_completion_seconds,
        )
        for freeze_dryer_id, row in sorted(
            time_rows.items(), key=lambda item: freeze_dryer_names[item[0]]
        )
    ]


def product_history(db: Session, filters: ReportFilters) -> list[ProductHistoryRow]:
    trays = _qualifying_trays_query(filters).subquery()
    yield_percent = _percent(
        trays.c.final_dry_weight_grams, trays.c.starting_weight_grams
    )

    stmt = (
        select(
            trays.c.product_name,
            func.count(trays.c.id).label("times_produced"),
            func.max(trays.c.completed_at).label("last_batch_completed_at"),
        )
        .select_from(trays)
        .group_by(trays.c.product_name)
        .order_by(trays.c.product_name)
    )
    # Yield is a separate query so a Tray with no/zero starting weight can be
    # excluded from the average (via the CASE guard) without also affecting
    # times_produced or last_batch_completed_at above.
    yield_stmt = (
        select(
            trays.c.product_name,
            func.avg(
                case(
                    (
                        trays.c.starting_weight_grams.isnot(None)
                        & (trays.c.starting_weight_grams > 0),
                        yield_percent,
                    ),
                    else_=None,
                )
            ).label("average_yield_percent"),
        )
        .select_from(trays)
        .group_by(trays.c.product_name)
    )
    yield_by_product = {
        row.product_name: row.average_yield_percent
        for row in db.execute(yield_stmt).all()
    }

    product_rows = list(db.execute(stmt).all())
    drying_by_product = _average_drying_seconds_by_key(
        db, trays, key_columns=(trays.c.product_name,)
    )

    return [
        ProductHistoryRow(
            product_name=row.product_name,
            times_produced=row.times_produced,
            average_drying_time_seconds=drying_by_product.get((row.product_name,)),
            average_yield_percent=_as_decimal(yield_by_product.get(row.product_name)),
            last_batch_completed_at=row.last_batch_completed_at,
        )
        for row in product_rows
    ]


def preparation_history(
    db: Session, filters: ReportFilters
) -> list[PreparationHistoryRow]:
    trays = _qualifying_trays_query(filters).subquery()
    preset_label = func.coalesce(trays.c.preparation_preset_name_at_use, "No Preset")
    used_preset_expr = trays.c.preparation_preset_name_at_use.isnot(None)
    yield_percent = _percent(
        trays.c.final_dry_weight_grams, trays.c.starting_weight_grams
    )

    stmt = (
        select(
            preset_label.label("preparation_preset_name"),
            used_preset_expr.label("used_preset"),
            func.count(trays.c.id).label("times_used"),
            func.avg(
                case(
                    (
                        trays.c.starting_weight_grams.isnot(None)
                        & (trays.c.starting_weight_grams > 0),
                        yield_percent,
                    ),
                    else_=None,
                )
            ).label("average_yield_percent"),
            func.max(trays.c.completed_at).label("last_used_completed_at"),
        )
        .select_from(trays)
        # Grouped by (label, used_preset), not label alone: a real
        # Preparation Preset could be named "No Preset", and used_preset is
        # what actually distinguishes that row from the synthetic
        # no-preset-used bucket that happens to share the same label.
        .group_by(preset_label, used_preset_expr)
        .order_by(preset_label)
    )
    preset_rows = list(db.execute(stmt).all())

    trays_with_label = select(
        trays.c.id,
        trays.c.production_batch_id,
        preset_label.label("preparation_preset_name"),
        used_preset_expr.label("used_preset"),
    ).select_from(trays)
    drying_by_preset = _average_drying_seconds_by_key(
        db,
        trays_with_label.subquery(),
        key_columns=("preparation_preset_name", "used_preset"),
    )

    return [
        PreparationHistoryRow(
            preparation_preset_name=row.preparation_preset_name,
            used_preset=bool(row.used_preset),
            times_used=row.times_used,
            average_drying_time_seconds=drying_by_preset.get(
                (row.preparation_preset_name, bool(row.used_preset))
            ),
            average_yield_percent=_as_decimal(row.average_yield_percent),
            last_used_completed_at=row.last_used_completed_at,
        )
        for row in preset_rows
    ]


def drying_time(db: Session, filters: ReportFilters) -> list[DryingTimeRow]:
    batches = _qualifying_batches_subquery(filters)
    batch_drying = _batch_drying_stats_subquery()

    stmt = (
        select(
            batches.c.id.label("production_batch_id"),
            batches.c.batch_number,
            FreezeDryer.name.label("freeze_dryer_name"),
            batches.c.completed_at,
            func.coalesce(batch_drying.c.total_drying_seconds, 0.0).label(
                "total_drying_time_seconds"
            ),
            func.coalesce(batch_drying.c.drying_run_count, 0).label("drying_run_count"),
            func.coalesce(batch_drying.c.voided_drying_run_count, 0).label(
                "voided_drying_run_count"
            ),
        )
        .select_from(batches)
        .join(FreezeDryer, FreezeDryer.id == batches.c.freeze_dryer_id)
        .join(
            batch_drying,
            batch_drying.c.production_batch_id == batches.c.id,
            isouter=True,
        )
        .order_by(batches.c.completed_at.desc())
    )
    return [
        DryingTimeRow(
            production_batch_id=row.production_batch_id,
            batch_number=row.batch_number,
            freeze_dryer_name=row.freeze_dryer_name,
            completed_at=row.completed_at,
            total_drying_time_seconds=row.total_drying_time_seconds,
            drying_run_count=row.drying_run_count,
            voided_drying_run_count=row.voided_drying_run_count,
        )
        for row in db.execute(stmt).all()
    ]


def production_history(
    db: Session, filters: ReportFilters
) -> list[ProductionHistoryRow]:
    batches = _qualifying_batches_subquery(filters)
    batch_drying = _batch_drying_stats_subquery()

    # Every qualifying Tray of each Batch, unfiltered by Product/Preset - a
    # row always reports everything the Batch actually contained, even when
    # a Product or Preparation Preset filter is used only to narrow which
    # Batches appear at all (see the filtered-batch-id subquery below).
    all_trays = (
        select(Tray.production_batch_id, Tray.product_name)
        .where(Tray.status.in_(QUALIFYING_TRAY_STATUSES))
        .subquery()
    )

    stmt = (
        select(
            batches.c.id.label("production_batch_id"),
            batches.c.batch_number,
            FreezeDryer.name.label("freeze_dryer_name"),
            batches.c.completed_at,
            func.count(all_trays.c.product_name).label("tray_count"),
            func.coalesce(batch_drying.c.total_drying_seconds, 0.0).label(
                "total_drying_time_seconds"
            ),
        )
        .select_from(batches)
        .join(FreezeDryer, FreezeDryer.id == batches.c.freeze_dryer_id)
        .join(all_trays, all_trays.c.production_batch_id == batches.c.id, isouter=True)
        .join(
            batch_drying,
            batch_drying.c.production_batch_id == batches.c.id,
            isouter=True,
        )
        .group_by(
            batches.c.id,
            batches.c.batch_number,
            FreezeDryer.name,
            batches.c.completed_at,
            batch_drying.c.total_drying_seconds,
        )
    )

    if (
        filters.product_name is not None
        or filters.preparation_preset_id is not None
        or filters.preparation_preset_name is not None
    ):
        matching_batches = select(Tray.production_batch_id).where(
            Tray.status.in_(QUALIFYING_TRAY_STATUSES)
        )
        if filters.product_name is not None:
            matching_batches = matching_batches.where(
                Tray.product_name == filters.product_name
            )
        if filters.preparation_preset_id is not None:
            matching_batches = matching_batches.where(
                Tray.preparation_preset_id == filters.preparation_preset_id
            )
        if filters.preparation_preset_name is not None:
            # Matches the same immutable snapshot column Preparation History
            # groups by (Tray.preparation_preset_name_at_use), not a live
            # join to the current Preparation Preset - see ADR-0019/RP-005.
            matching_batches = matching_batches.where(
                Tray.preparation_preset_name_at_use == filters.preparation_preset_name
            )
        stmt = stmt.where(batches.c.id.in_(matching_batches))

    rows = list(db.execute(stmt).all())
    batch_ids = [row.production_batch_id for row in rows]

    products_by_batch: dict[UUID, list[str]] = {}
    if batch_ids:
        product_rows = db.execute(
            select(Tray.production_batch_id, Tray.product_name)
            .where(Tray.production_batch_id.in_(batch_ids))
            .where(Tray.status.in_(QUALIFYING_TRAY_STATUSES))
            .distinct()
            .order_by(Tray.product_name)
        ).all()
        for batch_id, product_name in product_rows:
            products_by_batch.setdefault(batch_id, []).append(product_name)

    return [
        ProductionHistoryRow(
            production_batch_id=row.production_batch_id,
            batch_number=row.batch_number,
            freeze_dryer_name=row.freeze_dryer_name,
            completed_at=row.completed_at,
            tray_count=row.tray_count,
            products=products_by_batch.get(row.production_batch_id, []),
            total_drying_time_seconds=row.total_drying_time_seconds,
        )
        for row in sorted(rows, key=lambda item: item.completed_at, reverse=True)
    ]


def inventory_summary(db: Session, filters: ReportFilters) -> InventorySummary:
    product_identity = product_identity_query()

    package_stmt = select(
        Package, product_identity.c.product_name.label("product_name")
    ).join(
        product_identity,
        product_identity.c.packaging_allocation_id == Package.packaging_allocation_id,
    )
    package_stmt = _apply_date_range(
        package_stmt, Package.packaged_at, filters.date_from, filters.date_to
    )
    if filters.product_name is not None:
        package_stmt = package_stmt.where(
            product_identity.c.product_name == filters.product_name
        )
    packages = package_stmt.subquery()

    status_counts = dict(
        db.execute(
            select(packages.c.status, func.count(packages.c.id)).group_by(
                packages.c.status
            )
        ).all()
    )

    total_packaged_weight = db.scalar(
        select(func.coalesce(func.sum(packages.c.finished_product_weight_grams), 0))
    )

    dried_weight_stmt = select(
        func.coalesce(func.sum(Tray.final_dry_weight_grams), 0)
    ).where(Tray.status.in_(QUALIFYING_TRAY_STATUSES))
    dried_weight_stmt = _apply_date_range(
        dried_weight_stmt, Tray.completed_at, filters.date_from, filters.date_to
    )
    if filters.product_name is not None:
        dried_weight_stmt = dried_weight_stmt.where(
            Tray.product_name == filters.product_name
        )
    total_dried_weight = db.scalar(dried_weight_stmt)

    most_common_stmt = (
        select(
            packages.c.product_name, func.count(packages.c.id).label("package_count")
        )
        .group_by(packages.c.product_name)
        .order_by(func.count(packages.c.id).desc())
        .limit(10)
    )
    most_common_products = [
        MostCommonProduct(
            product_name=row.product_name, package_count=row.package_count
        )
        for row in db.execute(most_common_stmt).all()
    ]

    return InventorySummary(
        packages_in_storage=status_counts.get(InventoryStatus.IN_STORAGE, 0),
        packages_given_away=status_counts.get(InventoryStatus.GIVEN_AWAY, 0),
        packages_depleted=status_counts.get(InventoryStatus.DEPLETED, 0),
        total_packaged_weight_grams=_as_decimal(total_packaged_weight) or Decimal("0"),
        total_dried_weight_grams=_as_decimal(total_dried_weight) or Decimal("0"),
        most_common_products=most_common_products,
    )


def list_report_product_names(db: Session) -> list[str]:
    stmt = (
        select(Tray.product_name)
        .where(Tray.status.in_(QUALIFYING_TRAY_STATUSES))
        .distinct()
        .order_by(Tray.product_name)
    )
    return [row[0] for row in db.execute(stmt).all()]


def _qualifying_batches_subquery(filters: ReportFilters) -> Subquery:
    stmt: Select = select(ProductionBatch).where(
        ProductionBatch.status == ProductionBatchStatus.COMPLETED
    )
    stmt = _apply_date_range(
        stmt, ProductionBatch.completed_at, filters.date_from, filters.date_to
    )
    if filters.freeze_dryer_id is not None:
        stmt = stmt.where(ProductionBatch.freeze_dryer_id == filters.freeze_dryer_id)
    if filters.production_batch_id is not None:
        stmt = stmt.where(ProductionBatch.id == filters.production_batch_id)
    return stmt.subquery()


def _qualifying_trays_query(filters: ReportFilters) -> Select:
    stmt: Select = select(Tray).where(Tray.status.in_(QUALIFYING_TRAY_STATUSES))
    stmt = _apply_date_range(
        stmt, Tray.completed_at, filters.date_from, filters.date_to
    )
    if filters.product_name is not None:
        stmt = stmt.where(Tray.product_name == filters.product_name)
    if filters.preparation_preset_id is not None:
        stmt = stmt.where(Tray.preparation_preset_id == filters.preparation_preset_id)
    if filters.production_batch_id is not None:
        stmt = stmt.where(Tray.production_batch_id == filters.production_batch_id)
    if filters.freeze_dryer_id is not None:
        stmt = stmt.join(
            ProductionBatch, ProductionBatch.id == Tray.production_batch_id
        ).where(ProductionBatch.freeze_dryer_id == filters.freeze_dryer_id)
    return stmt


def _batch_drying_stats_subquery() -> Subquery:
    """Per-Batch drying seconds and run counts, from non-voided Drying Runs.

    SQLite has no native interval arithmetic; duration is computed via
    julianday() differences (fractional days) scaled to seconds.
    """
    duration_seconds = _seconds_between(DryingRun.started_at, DryingRun.ended_at)
    return (
        select(
            DryingRun.production_batch_id.label("production_batch_id"),
            func.sum(
                case(
                    (DryingRun.status != DryingRunStatus.VOIDED, duration_seconds),
                    else_=0.0,
                )
            ).label("total_drying_seconds"),
            func.sum(
                case((DryingRun.status != DryingRunStatus.VOIDED, 1), else_=0)
            ).label("drying_run_count"),
            func.sum(
                case((DryingRun.status == DryingRunStatus.VOIDED, 1), else_=0)
            ).label("voided_drying_run_count"),
        )
        .group_by(DryingRun.production_batch_id)
        .subquery()
    )


def _average_drying_seconds_by_key(
    db: Session, trays: Subquery, *, key_columns: tuple
) -> dict[tuple, float | None]:
    """Average a Batch's total drying time, attributed once per distinct key per Batch.

    A Batch that dried two different Products (or used two different
    Presets) at once has one shared drying duration - it must contribute
    that duration once per distinct key it represents, not once per Tray,
    or a Batch with several Trays of the same key would over-weight the
    average. Deduplicating to (key..., production_batch_id) before
    averaging is what enforces that.
    """
    batch_drying = _batch_drying_stats_subquery()
    key_labels = [f"key_{index}" for index in range(len(key_columns))]
    resolved_columns = tuple(
        (trays.c[column] if isinstance(column, str) else column).label(label)
        for column, label in zip(key_columns, key_labels, strict=True)
    )
    distinct_key_batches = (
        select(*resolved_columns, trays.c.production_batch_id).distinct().subquery()
    )
    stmt = (
        select(
            *(distinct_key_batches.c[label] for label in key_labels),
            func.avg(batch_drying.c.total_drying_seconds).label(
                "average_drying_time_seconds"
            ),
        )
        .select_from(distinct_key_batches)
        .join(
            batch_drying,
            batch_drying.c.production_batch_id
            == distinct_key_batches.c.production_batch_id,
            isouter=True,
        )
        .group_by(*(distinct_key_batches.c[label] for label in key_labels))
    )
    return {
        tuple(row[: len(resolved_columns)]): row.average_drying_time_seconds
        for row in db.execute(stmt).all()
    }


def _apply_date_range(
    stmt: Select, column, date_from: date | None, date_to: date | None
) -> Select:
    if date_from is not None:
        start = datetime.combine(date_from, time.min, tzinfo=UTC)
        stmt = stmt.where(column >= start)
    if date_to is not None:
        end = datetime.combine(date_to + timedelta(days=1), time.min, tzinfo=UTC)
        stmt = stmt.where(column < end)
    return stmt


def _seconds_between(start_column, end_column):
    return (func.julianday(end_column) - func.julianday(start_column)) * 86400.0


def _percent(numerator, denominator):
    return numerator / denominator * 100


def _as_decimal(value: float | Decimal | None) -> Decimal | None:
    if value is None:
        return None
    return Decimal(str(value))
