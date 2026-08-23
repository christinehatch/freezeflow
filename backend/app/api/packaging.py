from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.responses import raise_api_error, success
from app.api.serializers import (
    package_data,
    package_eligible_for_print_data,
    package_label_data,
    package_type_data,
    packaging_allocation_data,
    packaging_loss_data,
    packaging_operation_data,
    packaging_worksheet_data,
)
from app.database.session import get_db
from app.schemas import (
    PackageLabelSelection,
    PackageLabelUpdate,
    PackageTypeCreate,
    PackageTypeUpdate,
    PackagingAllocationCreateRequest,
    PackagingAllocationUpdateRequest,
    PackagingOperationComplete,
    PackagingOperationStart,
    RecordAllocationPackages,
    RecordPackagingLoss,
)
from app.services.errors import BusinessRuleError
from app.services.packaging import (
    complete_packaging_operation,
    create_package_type,
    create_packaging_allocation,
    get_batch_packaging_operation,
    get_package,
    get_package_label,
    get_packaging_operation,
    get_packaging_worksheet,
    list_package_types,
    list_packages_eligible_for_todays_print,
    preview_package_labels,
    print_package_labels,
    record_allocation_packages,
    record_packaging_loss,
    start_or_resume_packaging_operation,
    update_package_label,
    update_package_type,
    update_packaging_allocation,
)

router = APIRouter(tags=["packaging"])
DBSession = Annotated[Session, Depends(get_db)]


@router.get("/packaging/worksheet")
def get_packaging_worksheet_endpoint(db: DBSession) -> dict[str, object]:
    batches = get_packaging_worksheet(db)
    return success(packaging_worksheet_data(batches))


@router.get("/package-labels/eligible-today")
def get_packages_eligible_for_todays_print_endpoint(
    db: DBSession,
) -> dict[str, object]:
    packages = list_packages_eligible_for_todays_print(db)
    return success([package_eligible_for_print_data(package) for package in packages])


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


@router.post(
    "/production-batches/{batch_id}/packaging-operation",
    status_code=201,
)
def start_or_resume_packaging_operation_endpoint(
    batch_id: UUID,
    data: PackagingOperationStart,
    db: DBSession,
) -> dict[str, object]:
    try:
        operation = start_or_resume_packaging_operation(db, batch_id, data)
    except BusinessRuleError as error:
        raise_api_error(error)
    return success(packaging_operation_data(operation))


@router.get("/production-batches/{batch_id}/packaging-operation")
def get_batch_packaging_operation_endpoint(
    batch_id: UUID,
    db: DBSession,
) -> dict[str, object]:
    try:
        operation = get_batch_packaging_operation(db, batch_id)
    except BusinessRuleError as error:
        raise_api_error(error)
    return success(packaging_operation_data(operation))


@router.get("/packaging-operations/{operation_id}")
def get_packaging_operation_endpoint(
    operation_id: UUID,
    db: DBSession,
) -> dict[str, object]:
    try:
        operation = get_packaging_operation(db, operation_id)
    except BusinessRuleError as error:
        raise_api_error(error)
    return success(packaging_operation_data(operation))


@router.post(
    "/packaging-operations/{operation_id}/allocate-trays",
    status_code=201,
)
def create_packaging_allocation_endpoint(
    operation_id: UUID,
    data: PackagingAllocationCreateRequest,
    db: DBSession,
) -> dict[str, object]:
    try:
        allocation = create_packaging_allocation(db, operation_id, data)
    except BusinessRuleError as error:
        raise_api_error(error)
    return success(packaging_allocation_data(allocation))


@router.patch(
    "/packaging-operations/{operation_id}/allocations/{allocation_id}",
)
def update_packaging_allocation_endpoint(
    operation_id: UUID,
    allocation_id: UUID,
    data: PackagingAllocationUpdateRequest,
    db: DBSession,
) -> dict[str, object]:
    try:
        allocation = update_packaging_allocation(
            db,
            operation_id,
            allocation_id,
            data,
        )
    except BusinessRuleError as error:
        raise_api_error(error)
    return success(packaging_allocation_data(allocation))


@router.post(
    "/packaging-operations/{operation_id}/allocations/{allocation_id}/packages",
    status_code=201,
)
def record_allocation_packages_endpoint(
    operation_id: UUID,
    allocation_id: UUID,
    data: RecordAllocationPackages,
    db: DBSession,
) -> dict[str, object]:
    try:
        packages = record_allocation_packages(
            db,
            operation_id,
            allocation_id,
            data,
        )
        operation = get_packaging_operation(db, operation_id)
    except BusinessRuleError as error:
        raise_api_error(error)
    return success(
        {
            "packages": [package_data(package) for package in packages],
            "packaging_operation": packaging_operation_data(operation),
        }
    )


@router.post(
    "/packaging-operations/{operation_id}/allocations/{allocation_id}/losses",
    status_code=201,
)
def record_packaging_loss_endpoint(
    operation_id: UUID,
    allocation_id: UUID,
    data: RecordPackagingLoss,
    db: DBSession,
) -> dict[str, object]:
    try:
        loss = record_packaging_loss(
            db,
            operation_id,
            allocation_id,
            data,
        )
        operation = get_packaging_operation(db, operation_id)
    except BusinessRuleError as error:
        raise_api_error(error)
    return success(
        {
            "packaging_loss": packaging_loss_data(loss),
            "packaging_operation": packaging_operation_data(operation),
        }
    )


@router.post("/packaging-operations/{operation_id}/complete")
def complete_packaging_operation_endpoint(
    operation_id: UUID,
    data: PackagingOperationComplete,
    db: DBSession,
) -> dict[str, object]:
    try:
        operation = complete_packaging_operation(
            db,
            operation_id,
            completed_at=data.completed_at,
        )
    except BusinessRuleError as error:
        raise_api_error(error)
    return success(packaging_operation_data(operation))


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


@router.get("/packages/{package_id}/label")
def get_package_label_endpoint(
    package_id: UUID,
    db: DBSession,
) -> dict[str, object]:
    try:
        label = get_package_label(db, package_id)
    except BusinessRuleError as error:
        raise_api_error(error)
    return success(package_label_data(label))


@router.patch("/packages/{package_id}/label")
def update_package_label_endpoint(
    package_id: UUID,
    data: PackageLabelUpdate,
    db: DBSession,
) -> dict[str, object]:
    try:
        label = update_package_label(db, package_id, data)
    except BusinessRuleError as error:
        raise_api_error(error)
    return success(package_label_data(label))


@router.post("/package-labels/preview")
def preview_package_labels_endpoint(
    data: PackageLabelSelection,
    db: DBSession,
) -> dict[str, object]:
    try:
        labels = preview_package_labels(db, data)
    except BusinessRuleError as error:
        raise_api_error(error)
    return success([package_label_data(label) for label in labels])


@router.post("/package-labels/print")
def print_package_labels_endpoint(
    data: PackageLabelSelection,
    db: DBSession,
) -> dict[str, object]:
    try:
        result = print_package_labels(db, data)
    except BusinessRuleError as error:
        raise_api_error(error)
    return success(
        {
            "print_job_id": result["print_job_id"],
            "labels": [package_label_data(label) for label in result["labels"]],
        }
    )
