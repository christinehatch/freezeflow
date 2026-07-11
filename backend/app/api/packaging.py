from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.responses import raise_api_error, success
from app.api.serializers import (
    package_data,
    package_label_data,
    package_type_data,
    packaging_operation_data,
    packaging_worksheet_data,
    storage_location_data,
)
from app.database.session import get_db
from app.schemas import (
    PackageLabelRequest,
    PackageSelectedTrays,
    PackageTypeCreate,
    PackageTypeUpdate,
)
from app.services.errors import BusinessRuleError
from app.services.packaging import (
    create_package_type,
    get_package,
    get_packaging_worksheet,
    labels_for_packages,
    list_package_types,
    list_storage_locations,
    package_selected_trays,
    update_package_type,
)

router = APIRouter(tags=["packaging"])
DBSession = Annotated[Session, Depends(get_db)]


@router.get("/packaging/worksheet")
def get_packaging_worksheet_endpoint(db: DBSession) -> dict[str, object]:
    batches = get_packaging_worksheet(db)
    return success(packaging_worksheet_data(batches))


@router.get("/package-types")
def list_package_types_endpoint(
    db: DBSession,
    include_archived: bool = False,
) -> dict[str, object]:
    return success(
        [
            package_type_data(package_type)
            for package_type in list_package_types(
                db,
                include_archived=include_archived,
            )
        ]
    )


@router.post("/package-types", status_code=201)
def create_package_type_endpoint(
    data: PackageTypeCreate,
    db: DBSession,
) -> dict[str, object]:
    try:
        package_type = create_package_type(db, data)
    except BusinessRuleError as error:
        raise_api_error(error)
    return success(package_type_data(package_type))


@router.patch("/package-types/{package_type_id}")
def update_package_type_endpoint(
    package_type_id: UUID,
    data: PackageTypeUpdate,
    db: DBSession,
) -> dict[str, object]:
    try:
        package_type = update_package_type(db, package_type_id, data)
    except BusinessRuleError as error:
        raise_api_error(error)
    return success(package_type_data(package_type))


@router.get("/storage-locations")
def list_storage_locations_endpoint(db: DBSession) -> dict[str, object]:
    locations = list_storage_locations(db)
    return success([storage_location_data(location) for location in locations])


@router.post("/packages", status_code=201)
def package_selected_trays_endpoint(
    data: PackageSelectedTrays,
    db: DBSession,
) -> dict[str, object]:
    try:
        result = package_selected_trays(db, data)
    except BusinessRuleError as error:
        raise_api_error(error)
    return success(
        {
            "packaging_operation": packaging_operation_data(
                result["packaging_operation"]
            ),
            "packages": [package_data(package) for package in result["packages"]],
            "warnings": result["warnings"],
            "source_weight_grams": result["source_weight_grams"],
            "package_weight_grams": result["package_weight_grams"],
            "labels": [package_label_data(label) for label in result["labels"]],
        }
    )


@router.post("/packages/labels")
def package_labels_endpoint(
    data: PackageLabelRequest,
    db: DBSession,
) -> dict[str, object]:
    try:
        labels = labels_for_packages(db, data)
    except BusinessRuleError as error:
        raise_api_error(error)
    return success([package_label_data(label) for label in labels])


@router.get("/packages/{package_id}")
def get_package_endpoint(
    package_id: UUID,
    db: DBSession,
) -> dict[str, object]:
    try:
        package = get_package(db, package_id)
    except BusinessRuleError as error:
        raise_api_error(error)
    return success(package_data(package))
