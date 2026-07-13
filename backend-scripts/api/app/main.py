from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import dashboard, cycles, trees, exports, imports, well_water, beetle_trap, motor_runtime, inventory


settings = get_settings()

app = FastAPI(title="Muthu Farms Harvest API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


app.include_router(dashboard.router, prefix="/api", tags=["dashboard"])
app.include_router(cycles.router, prefix="/api/cycles", tags=["cycles"])
app.include_router(trees.router, prefix="/api/trees", tags=["trees"])
app.include_router(exports.router, prefix="/api/export", tags=["export"])
app.include_router(imports.router, prefix="/api/import", tags=["import"])
app.include_router(well_water.router, prefix="/api/well-water", tags=["well-water"])
app.include_router(beetle_trap.router, prefix="/api/beetle-trap", tags=["beetle-trap"])
app.include_router(motor_runtime.router, prefix="/api/motor-runtime", tags=["motor-runtime"])
app.include_router(inventory.router, prefix="/api/inventory", tags=["inventory"])
