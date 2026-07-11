from fastapi import APIRouter

from app.api.freeze_dryers import (
    physical_trays_router,
)
from app.api.freeze_dryers import (
    router as freeze_dryers_router,
)
from app.api.health import router as health_router
from app.api.packaging import router as packaging_router
from app.api.production import router as production_router

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(health_router)
api_router.include_router(freeze_dryers_router)
api_router.include_router(physical_trays_router)
api_router.include_router(production_router)
api_router.include_router(packaging_router)
