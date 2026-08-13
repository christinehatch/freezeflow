from __future__ import annotations

import random
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import func, select
from sqlalchemy.orm import Session

import app.models  # noqa: F401
from app.database.base import Base
from app.models import (
    DryingRun,
    DryingRunStatus,
    FreezeDryer,
    InventoryStatus,
    Package,
    PackageLabel,
    PackageLabelStatus,
    PackageStatusHistory,
    PackageType,
    PackagingAllocation,
    PackagingAllocationSourceTray,
    PackagingOperation,
    PackagingOperationStatus,
    PhysicalTray,
    PlannedPackageRow,
    PrintEvent,
    ProductionBatch,
    ProductionBatchStatus,
    Recipe,
    StorageLocation,
    StorageLocationHistory,
    Tray,
    TraySlot,
    TrayStatus,
    WeightCheck,
)


class DeveloperDataService:
    """Build coherent local datasets without bypassing relational constraints."""

    count_models = (
        FreezeDryer,
        TraySlot,
        PhysicalTray,
        Recipe,
        ProductionBatch,
        Tray,
        DryingRun,
        WeightCheck,
        PackagingOperation,
        PackagingAllocation,
        PackagingAllocationSourceTray,
        PlannedPackageRow,
        PackageType,
        Package,
        PackageStatusHistory,
        PackageLabel,
        PrintEvent,
        StorageLocation,
        StorageLocationHistory,
    )

    def __init__(self, db: Session) -> None:
        self.db = db
        self.now = datetime.now(UTC).replace(microsecond=0)

    def run(self, action: str) -> dict:
        actions = {
            "reset": self.reset,
            "empty": self.seed_empty,
            "basic": self.seed_basic,
            "busy-production-day": self.seed_busy_production_day,
            "inventory": self.seed_inventory,
            "packaging-fresh": self.seed_packaging_fresh,
            "packaging-resume": self.seed_packaging_resume,
            "weight-history": self.seed_weight_history,
            "edge-cases": self.seed_edge_cases,
            "randomize-dates": self.randomize_dates,
            "randomize-weights": self.randomize_weights,
        }
        return actions[action]()

    def reset(self) -> dict:
        self._clear_database()
        return self._result("reset", "Database reset. All application data removed.")

    def seed_empty(self) -> dict:
        self._clear_database()
        return self._result("empty", "Empty database scenario is ready.")

    def seed_basic(self, *, plan_packaging: bool = True) -> dict:
        self._clear_database()
        data = self._seed_reference_data()

        running_batch, _ = self._create_batch(
            dryer=data["dryers"][0],
            slots=data["slots"][0],
            physical_trays=data["physical_trays"][0:4],
            recipes=data["recipes"],
            batch_number="Batch 021",
            status=ProductionBatchStatus.RUNNING,
            products=("Taco Chicken", "Taco Chicken", "Strawberries", "Apples"),
            starting=(930, 912, 780, 840),
            latest=(371, 335, 214, 248),
            started_at=self.now - timedelta(hours=28),
            completed_runs=2,
            notes="Current production run with four loaded trays.",
        )

        ready_batch, ready_trays = self._create_batch(
            dryer=data["dryers"][1],
            slots=data["slots"][1],
            physical_trays=data["physical_trays"][4:7],
            recipes=data["recipes"],
            batch_number="Batch 020",
            status=ProductionBatchStatus.COMPLETED,
            products=("Pork Shoulder", "Pork Shoulder", "Apples"),
            starting=(1020, 980, 875),
            latest=(328, 311, 236),
            started_at=self.now - timedelta(days=2, hours=9),
            completed_runs=3,
            notes="Completed batch ready for packaging.",
        )
        if plan_packaging:
            self._plan_batch_packaging(
                ready_batch,
                ready_trays,
                data["package_types"],
                data["locations"],
            )

        packaged_batch, packaged_trays = self._create_batch(
            dryer=data["dryers"][0],
            slots=data["slots"][0],
            physical_trays=data["physical_trays"][7:10],
            recipes=data["recipes"],
            batch_number="Batch 019",
            status=ProductionBatchStatus.COMPLETED,
            products=("Taco Chicken", "Taco Chicken", "Taco Chicken"),
            starting=(925, 910, 940),
            latest=(302, 291, 307),
            started_at=self.now - timedelta(days=6),
            completed_runs=3,
            notes="Packaged taco chicken inventory example.",
        )
        self._package_batch(
            packaged_batch,
            packaged_trays,
            data["package_types"],
            data["locations"],
        )

        self._create_batch(
            dryer=data["dryers"][1],
            slots=data["slots"][1],
            physical_trays=data["physical_trays"][10:12],
            recipes=data["recipes"],
            batch_number="Batch 022",
            status=ProductionBatchStatus.DRAFT,
            products=("Strawberries", "Apples"),
            starting=(740, 810),
            latest=(740, 810),
            started_at=None,
            completed_runs=0,
            notes="Queued draft for tomorrow morning.",
        )

        self.db.commit()
        return self._result(
            "basic",
            "Basic demo seeded with running, packaging-ready, packaged, "
            "and draft work.",
        )

    def seed_busy_production_day(self) -> dict:
        self.seed_basic()
        dryers = list(self.db.scalars(select(FreezeDryer).order_by(FreezeDryer.name)))
        trays = list(
            self.db.scalars(
                select(PhysicalTray)
                .where(PhysicalTray.label.in_(("Tray 08", "Tray 09", "Tray 10")))
                .order_by(PhysicalTray.label)
            )
        )
        recipes = list(self.db.scalars(select(Recipe).order_by(Recipe.name)))
        slots = list(
            self.db.scalars(
                select(TraySlot)
                .where(TraySlot.freeze_dryer_id == dryers[1].id)
                .order_by(TraySlot.slot_number)
            )
        )
        self._create_batch(
            dryer=dryers[1],
            slots=slots,
            physical_trays=trays,
            recipes=recipes,
            batch_number="Batch 023",
            status=ProductionBatchStatus.RUNNING,
            products=("Strawberries", "Apples", "Pork Shoulder"),
            starting=(760, 825, 1010),
            latest=(520, 603, 711),
            started_at=self.now - timedelta(hours=8),
            completed_runs=1,
            notes="Second machine running during a busy production day.",
        )
        self.db.commit()
        return self._result(
            "busy-production-day",
            "Busy production day seeded with both Freeze Dryers in use.",
        )

    def seed_inventory(self) -> dict:
        result = self.seed_basic()
        result["action"] = "inventory"
        result["message"] = (
            "Inventory demo seeded with In Storage, Given Away, and Depleted Packages."
        )
        return result

    def seed_packaging_fresh(self) -> dict:
        result = self.seed_basic(plan_packaging=False)
        result["action"] = "packaging-fresh"
        result["message"] = (
            "Fresh Packaging Session seeded: completed eligible Trays with no "
            "Packaging Operation started yet."
        )
        return result

    def seed_packaging_resume(self) -> dict:
        result = self.seed_basic(plan_packaging=True)
        result["action"] = "packaging-resume"
        result["message"] = (
            "Resume Packaging Session seeded: an Open Packaging Operation with "
            "durable Planned Package rows already saved, no Bags recorded yet."
        )
        return result

    def seed_weight_history(self) -> dict:
        result = self.seed_basic()
        running = self.db.scalar(
            select(ProductionBatch).where(
                ProductionBatch.status == ProductionBatchStatus.RUNNING
            )
        )
        if running is not None:
            self._add_completed_run(running, 3, 6, (280, 262, 176, 201))
            self.db.commit()
        result = self._result(
            "weight-history",
            "Weight history demo seeded with several drying cycles and "
            "decreasing weights.",
        )
        return result

    def seed_edge_cases(self) -> dict:
        self.seed_basic()
        dryer = self.db.scalar(select(FreezeDryer).order_by(FreezeDryer.name))
        physical_tray = self.db.scalar(
            select(PhysicalTray).order_by(PhysicalTray.label.desc())
        )
        package_type = self.db.scalar(
            select(PackageType).order_by(PackageType.name.desc())
        )
        if dryer is not None:
            dryer.notes = "Includes archived setup records for edge-case testing."
        if physical_tray is not None:
            physical_tray.archived = True
        if package_type is not None:
            package_type.archived = True

        completed_batch = self.db.scalar(
            select(ProductionBatch).where(
                ProductionBatch.status == ProductionBatchStatus.COMPLETED
            )
        )
        if completed_batch is not None:
            self.db.add(
                DryingRun(
                    production_batch=completed_batch,
                    status=DryingRunStatus.VOIDED,
                    started_at=completed_batch.started_at,
                    ended_at=completed_batch.started_at + timedelta(minutes=10),
                    notes="Mistaken run preserved as voided history.",
                )
            )
        self.db.commit()
        return self._result(
            "edge-cases",
            "Edge cases seeded with archived setup data and a voided Drying Run.",
        )

    def seed_random_batches(self, count: int) -> dict:
        self._clear_database()
        data = self._seed_reference_data()
        rng = random.Random(8417)
        for index in range(count):
            dryer_index = index % len(data["dryers"])
            dryer = data["dryers"][dryer_index]
            slots = data["slots"][dryer_index]
            tray_count = rng.randint(1, len(slots))
            status = rng.choice(
                (
                    ProductionBatchStatus.DRAFT,
                    ProductionBatchStatus.COMPLETED,
                    ProductionBatchStatus.CANCELLED,
                )
            )
            starting = tuple(rng.randint(600, 1300) for _ in range(tray_count))
            latest = tuple(
                max(80, int(weight * rng.uniform(0.22, 0.48))) for weight in starting
            )
            products = tuple(
                rng.choice(("Taco Chicken", "Strawberries", "Apples", "Pork Shoulder"))
                for _ in range(tray_count)
            )
            physical_trays = [
                PhysicalTray(
                    label=f"Generated {index + 1:03d}-{slot_number}",
                    notes="Dedicated to this generated stress-test Batch.",
                )
                for slot_number in range(1, tray_count + 1)
            ]
            self.db.add_all(physical_trays)
            self.db.flush()
            self._create_batch(
                dryer=dryer,
                slots=slots,
                physical_trays=physical_trays,
                recipes=data["recipes"],
                batch_number=f"Demo {index + 1:03d}",
                status=status,
                products=products,
                starting=starting,
                latest=latest,
                started_at=(
                    None
                    if status == ProductionBatchStatus.DRAFT
                    else self.now - timedelta(days=index + 1)
                ),
                completed_runs=0 if status == ProductionBatchStatus.DRAFT else 2,
                notes="Generated stress-test batch.",
            )
        self.db.commit()
        return self._result(
            "random-batches",
            f"Created {count} deterministic random Production Batches.",
        )

    def randomize_dates(self) -> dict:
        rng = random.Random(20260716)
        batches = list(self.db.scalars(select(ProductionBatch)))
        for batch in batches:
            if batch.started_at is None:
                continue
            shift = timedelta(days=rng.randint(-120, 30), hours=rng.randint(-12, 12))
            batch.started_at += shift
            if batch.completed_at is not None:
                batch.completed_at += shift
            for run in batch.drying_runs:
                run.started_at += shift
                if run.ended_at is not None:
                    run.ended_at += shift
                run.created_at += shift
                run.updated_at += shift
                for check in run.weight_checks:
                    check.observed_at += shift
                    check.recorded_at += shift
            for tray in batch.trays:
                if tray.completed_at is not None:
                    tray.completed_at += shift
        self.db.commit()
        return self._result(
            "randomize-dates",
            "Dates randomized while preserving each Batch lifecycle order.",
        )

    def randomize_weights(self) -> dict:
        rng = random.Random(5163)
        for tray in self.db.scalars(select(Tray)):
            starting = Decimal(rng.randint(600, 1400))
            tray.starting_weight_grams = starting
            checks = sorted(tray.weight_checks, key=lambda check: check.observed_at)
            current = starting
            for check in checks:
                current = (current * Decimal(str(rng.uniform(0.55, 0.82)))).quantize(
                    Decimal("0.001")
                )
                check.weight_grams = current
            if tray.status in (TrayStatus.COMPLETED, TrayStatus.PACKAGED):
                tray.final_dry_weight_grams = current
        for allocation in self.db.scalars(select(PackagingAllocation)):
            source = sum(
                (
                    link.tray.final_dry_weight_grams or Decimal("0")
                    for link in allocation.source_tray_links
                ),
                Decimal("0"),
            )
            if allocation.packages:
                share = (source / len(allocation.packages)).quantize(Decimal("0.001"))
                remaining = source
                for index, package in enumerate(allocation.packages):
                    product_weight = (
                        remaining if index == len(allocation.packages) - 1 else share
                    )
                    package.finished_product_weight_grams = product_weight
                    package.package_weight_grams = product_weight + Decimal("12.000")
                    if package.planned_package_row is not None:
                        package.planned_package_row.finished_product_weight_grams = (
                            product_weight
                        )
                        package.planned_package_row.sealed_package_weight_grams = (
                            package.package_weight_grams
                        )
                    remaining -= product_weight
            else:
                planned_rows = allocation.planned_package_rows
                if not planned_rows:
                    continue
                planned_total = (source * Decimal("0.900")).quantize(Decimal("0.001"))
                share = (planned_total / len(planned_rows)).quantize(Decimal("0.001"))
                remaining = planned_total
                for index, row in enumerate(planned_rows):
                    product_weight = (
                        remaining if index == len(planned_rows) - 1 else share
                    )
                    row.finished_product_weight_grams = product_weight
                    row.sealed_package_weight_grams = product_weight + Decimal("12.000")
                    remaining -= product_weight
        self.db.commit()
        return self._result(
            "randomize-weights",
            "Weights randomized with decreasing history and balanced Package totals.",
        )

    def _clear_database(self) -> None:
        self.db.rollback()
        for table in reversed(Base.metadata.sorted_tables):
            self.db.execute(table.delete())
        self.db.commit()

    def _seed_reference_data(self) -> dict:
        dryers = [
            FreezeDryer(name="Black", notes="Primary four-slot machine."),
            FreezeDryer(name="White", notes="Secondary four-slot machine."),
        ]
        self.db.add_all(dryers)
        self.db.flush()
        slots = []
        for dryer in dryers:
            dryer_slots = [
                TraySlot(
                    freeze_dryer=dryer,
                    slot_number=number,
                    label=f"Slot {number}",
                )
                for number in range(1, 5)
            ]
            slots.append(dryer_slots)
            self.db.add_all(dryer_slots)

        physical_trays = [
            PhysicalTray(
                label=f"Tray {number:02d}",
                notes="Reusable stainless steel tray.",
            )
            for number in range(1, 13)
        ]
        recipes = [
            Recipe(
                name="Taco Chicken",
                product_name="Taco Chicken",
                preparation="Cooked, shredded, seasoned with taco spices",
                notes="Family batch recipe.",
            ),
            Recipe(
                name="Sliced Strawberries",
                product_name="Strawberries",
                preparation="Washed and sliced evenly",
            ),
            Recipe(
                name="Apple Slices",
                product_name="Apples",
                preparation="Peeled, cored, and sliced",
            ),
            Recipe(
                name="Shredded Pork Shoulder",
                product_name="Pork Shoulder",
                preparation="Cooked, shredded, salt and pepper",
            ),
        ]
        locations = [
            StorageLocation(name="Unassigned", notes="Implicit default location."),
            StorageLocation(name="Basement Bin A", notes="Long-term storage."),
            StorageLocation(name="Pantry Shelf", notes="Ready for near-term use."),
        ]
        package_types = [
            PackageType(
                name="Quart Mylar",
                default_oxygen_absorber="500cc",
                default_label_template="Avery 5163",
            ),
            PackageType(
                name="Pint Mylar",
                default_oxygen_absorber="300cc",
                default_label_template="Avery 5163",
            ),
            PackageType(
                name="2 Gallon Mylar",
                default_oxygen_absorber="2000cc",
                default_label_template="Avery 5163",
            ),
        ]
        self.db.add_all(physical_trays + recipes + locations + package_types)
        self.db.flush()
        return {
            "dryers": dryers,
            "slots": slots,
            "physical_trays": physical_trays,
            "recipes": recipes,
            "locations": locations,
            "package_types": package_types,
        }

    def _create_batch(
        self,
        *,
        dryer: FreezeDryer,
        slots: list[TraySlot],
        physical_trays: list[PhysicalTray],
        recipes: list[Recipe],
        batch_number: str,
        status: ProductionBatchStatus,
        products: tuple[str, ...],
        starting: tuple[int, ...],
        latest: tuple[int, ...],
        started_at: datetime | None,
        completed_runs: int,
        notes: str,
    ) -> tuple[ProductionBatch, list[Tray]]:
        completed_at = None
        if status == ProductionBatchStatus.COMPLETED and started_at is not None:
            completed_at = started_at + timedelta(hours=max(1, completed_runs * 8))
        batch = ProductionBatch(
            freeze_dryer=dryer,
            batch_number=batch_number,
            status=status,
            started_at=started_at,
            completed_at=completed_at,
            notes=notes,
        )
        self.db.add(batch)
        self.db.flush()

        recipe_by_product = {recipe.product_name: recipe for recipe in recipes}
        trays = []
        for index, product in enumerate(products):
            tray_status = {
                ProductionBatchStatus.DRAFT: TrayStatus.DRAFT,
                ProductionBatchStatus.RUNNING: TrayStatus.RUNNING,
                ProductionBatchStatus.COMPLETED: TrayStatus.COMPLETED,
                ProductionBatchStatus.CANCELLED: TrayStatus.CANCELLED,
            }[status]
            tray = Tray(
                production_batch=batch,
                tray_slot=slots[index],
                physical_tray=physical_trays[index],
                recipe=recipe_by_product.get(product),
                tray_number=index + 1,
                product_name=product,
                preparation=(
                    recipe_by_product[product].preparation
                    if product in recipe_by_product
                    else "Prepared for freeze drying"
                ),
                starting_weight_grams=Decimal(starting[index]),
                final_dry_weight_grams=(
                    Decimal(latest[index])
                    if status == ProductionBatchStatus.COMPLETED
                    else None
                ),
                status=tray_status,
                notes="Seeded production notebook entry.",
                completed_at=completed_at,
            )
            trays.append(tray)
            self.db.add(tray)
        self.db.flush()

        if started_at is not None:
            for run_number in range(1, completed_runs + 1):
                fraction = Decimal(run_number) / Decimal(max(1, completed_runs))
                run_weights = tuple(
                    int(
                        Decimal(start_value)
                        - (Decimal(start_value - latest[index]) * fraction)
                    )
                    for index, start_value in enumerate(starting)
                )
                self._add_completed_run(
                    batch,
                    run_number,
                    8 + run_number,
                    run_weights,
                )
            if status == ProductionBatchStatus.RUNNING:
                active_start = started_at + timedelta(
                    hours=sum(8 + number for number in range(1, completed_runs + 1))
                )
                self.db.add(
                    DryingRun(
                        production_batch=batch,
                        status=DryingRunStatus.ACTIVE,
                        started_at=active_start,
                        notes="Current machine cycle.",
                    )
                )
        return batch, trays

    def _add_completed_run(
        self,
        batch: ProductionBatch,
        run_number: int,
        duration_hours: int,
        weights: tuple[int, ...],
    ) -> DryingRun:
        previous_hours = sum(8 + number for number in range(1, run_number))
        started_at = (batch.started_at or self.now) + timedelta(hours=previous_hours)
        ended_at = started_at + timedelta(hours=duration_hours)
        run = DryingRun(
            production_batch=batch,
            status=DryingRunStatus.COMPLETE,
            started_at=started_at,
            ended_at=ended_at,
            notes=f"Drying cycle {run_number} completed.",
        )
        self.db.add(run)
        self.db.flush()
        for index, tray in enumerate(batch.trays):
            self.db.add(
                WeightCheck(
                    tray=tray,
                    drying_run=run,
                    observed_at=ended_at,
                    recorded_at=ended_at + timedelta(minutes=5),
                    weight_grams=Decimal(weights[index]),
                    notes="Post-cycle weight check.",
                )
            )
        return run

    def _package_batch(
        self,
        batch: ProductionBatch,
        trays: list[Tray],
        package_types: list[PackageType],
        locations: list[StorageLocation],
    ) -> None:
        packaged_at = (batch.completed_at or self.now) + timedelta(hours=4)
        operation = PackagingOperation(
            production_batch=batch,
            status=PackagingOperationStatus.COMPLETED,
            started_at=packaged_at,
            completed_at=packaged_at + timedelta(minutes=20),
            notes="Combined trays and divided finished product among packages.",
        )
        self.db.add(operation)
        self.db.flush()
        allocation = PackagingAllocation(
            packaging_operation=operation,
            notes="All completed trays allocated to demo Packages.",
        )
        self.db.add(allocation)
        self.db.flush()
        for tray in trays:
            tray.status = TrayStatus.PACKAGED
            self.db.add(
                PackagingAllocationSourceTray(
                    packaging_allocation=allocation,
                    tray=tray,
                )
            )

        source = sum(
            (tray.final_dry_weight_grams or Decimal("0") for tray in trays),
            Decimal("0"),
        )
        weights = (Decimal("300"), Decimal("300"), source - Decimal("600"))
        statuses = (
            InventoryStatus.IN_STORAGE,
            InventoryStatus.GIVEN_AWAY,
            InventoryStatus.DEPLETED,
        )
        location_choices = (locations[1], locations[0], locations[2])
        for index, product_weight in enumerate(weights):
            package = Package(
                packaging_allocation=allocation,
                package_type=package_types[index % 2],
                package_identifier=f"PKG-{packaged_at.year}-{index + 1:06d}",
                packaged_at=packaged_at + timedelta(minutes=index),
                package_weight_grams=product_weight + Decimal("12"),
                finished_product_weight_grams=product_weight,
                oxygen_absorber=package_types[index % 2].default_oxygen_absorber,
                storage_location=location_choices[index],
                status=statuses[index],
                notes="Demo package with full production traceability.",
            )
            self.db.add(package)
            self.db.flush()
            self.db.add(
                PlannedPackageRow(
                    packaging_allocation=allocation,
                    package_type=package.package_type,
                    finished_product_weight_grams=product_weight,
                    finished_product_weight_unit="g",
                    sealed_package_weight_grams=package.package_weight_grams,
                    sealed_package_weight_unit="g",
                    oxygen_absorber=package.oxygen_absorber,
                    storage_location=package.storage_location,
                    notes="Recorded package retained from the packaging plan.",
                    label_status=PackageLabelStatus.READY,
                    label_display_name=trays[0].product_name,
                    label_preparation_summary=trays[0].preparation,
                    label_net_weight_display=f"{product_weight} g freeze-dried",
                    recorded_package=package,
                )
            )
            self.db.add(
                PackageStatusHistory(
                    package=package,
                    previous_status=None,
                    current_status=InventoryStatus.IN_STORAGE,
                    effective_at=packaged_at,
                    recorded_at=packaged_at,
                    notes="Initial status recorded during Packaging.",
                )
            )
            if statuses[index] != InventoryStatus.IN_STORAGE:
                self.db.add(
                    PackageStatusHistory(
                        package=package,
                        previous_status=InventoryStatus.IN_STORAGE,
                        current_status=statuses[index],
                        effective_at=packaged_at + timedelta(days=index),
                        recorded_at=packaged_at + timedelta(days=index),
                        notes="Demo inventory lifecycle transition.",
                    )
                )
            self.db.add(
                StorageLocationHistory(
                    package=package,
                    previous_storage_location=None,
                    current_storage_location=location_choices[index],
                    moved_at=packaged_at,
                    notes="Initial location assigned during Packaging.",
                )
            )
            label = PackageLabel(
                package=package,
                status=PackageLabelStatus.READY,
                display_name=trays[0].product_name,
                preparation_summary=trays[0].preparation,
                net_weight_display=f"{product_weight} g freeze-dried",
            )
            self.db.add(label)
            self.db.flush()
            if index == 0:
                self.db.add(
                    PrintEvent(
                        package_label=label,
                        printed_at=packaged_at + timedelta(minutes=25),
                        recorded_at=packaged_at + timedelta(minutes=25),
                        template="Avery 5163",
                        print_job_id=uuid4(),
                        notes="Initial demo label print.",
                    )
                )

    def _plan_batch_packaging(
        self,
        batch: ProductionBatch,
        trays: list[Tray],
        package_types: list[PackageType],
        locations: list[StorageLocation],
    ) -> None:
        """Create resumable packaging work without prematurely creating inventory."""
        started_at = (batch.completed_at or self.now) + timedelta(hours=2)
        operation = PackagingOperation(
            production_batch=batch,
            status=PackagingOperationStatus.OPEN,
            started_at=started_at,
            notes="Packaging plan paused before the physical bags were recorded.",
        )
        allocation = PackagingAllocation(
            packaging_operation=operation,
            notes="Two pork trays selected; the apple tray remains packaging-ready.",
        )
        self.db.add_all((operation, allocation))
        self.db.flush()
        for tray in trays[:2]:
            self.db.add(
                PackagingAllocationSourceTray(
                    packaging_allocation=allocation,
                    tray=tray,
                )
            )

        for index, product_weight in enumerate((Decimal("300"), Decimal("300"))):
            self.db.add(
                PlannedPackageRow(
                    packaging_allocation=allocation,
                    package_type=package_types[index],
                    finished_product_weight_grams=product_weight,
                    finished_product_weight_unit="g",
                    sealed_package_weight_grams=product_weight + Decimal("12"),
                    sealed_package_weight_unit="g",
                    oxygen_absorber=package_types[index].default_oxygen_absorber,
                    storage_location=locations[index],
                    notes="Planned bag from the two selected pork Trays.",
                    label_status=PackageLabelStatus.DRAFT,
                    label_display_name="Pork Shoulder",
                    label_preparation_summary=trays[index].preparation,
                    label_net_weight_display=f"{product_weight} g freeze-dried",
                )
            )

    def _counts(self) -> dict[str, int]:
        return {
            model.__tablename__: self.db.scalar(select(func.count()).select_from(model))
            or 0
            for model in self.count_models
        }

    def _result(self, action: str, message: str) -> dict:
        return {"action": action, "message": message, "counts": self._counts()}
