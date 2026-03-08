from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.web.routes import router as web_router


def create_app() -> FastAPI:
    app = FastAPI(
        title="Scientific Article Editor",
        description="AI assistant for spelling and style editing of scientific texts.",
        version="0.1.0",
    )
    app.include_router(web_router)
    app.mount("/static", StaticFiles(directory="app/static"), name="static")
    return app


app = create_app()
