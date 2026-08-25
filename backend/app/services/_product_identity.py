from sqlalchemy import Subquery, func, select

from app.models import PackagingAllocationSourceTray, Tray


def product_identity_query() -> Subquery:
    """Package -> Allocation -> source Tray -> immutable Product name.

    Every Packaging Allocation is required to have at least one source Tray
    (see production/packaging services), and a Tray belongs to exactly one
    Allocation (`uq_packaging_allocation_source_tray_id`), so this resolves
    one Product name per Allocation - the historical, immutable name from
    the Tray's own Preparation Metadata snapshot, never a Package Label's
    editable Display Name. Shared by Inventory (Product Groups, search) and
    Reporting (Most Common Products) rather than duplicated per module.
    """
    return (
        select(
            PackagingAllocationSourceTray.packaging_allocation_id.label(
                "packaging_allocation_id"
            ),
            func.min(Tray.product_name).label("product_name"),
        )
        .join(Tray, Tray.id == PackagingAllocationSourceTray.tray_id)
        .group_by(PackagingAllocationSourceTray.packaging_allocation_id)
        .subquery()
    )
