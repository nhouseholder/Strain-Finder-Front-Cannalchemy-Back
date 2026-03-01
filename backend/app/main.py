"""Cannalchemy API — FastAPI application entry point."""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.config import CORS_ORIGINS, API_V1_PREFIX, DB_PATH
from backend.app.database import db
from backend.app.routers import quiz, ratings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database and graph on startup, close on shutdown."""
    logger.info("Starting Cannalchemy API...")
    db.initialize(DB_PATH)
    logger.info("Database and knowledge graph ready.")
    yield
    logger.info("Shutting down...")
    db.close()


app = FastAPI(
    title="Cannalchemy API",
    description="AI-powered cannabis effect prediction grounded in molecular pharmacology",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(quiz.router, prefix=API_V1_PREFIX)
app.include_router(ratings.router, prefix=API_V1_PREFIX)


@app.get("/api/health")
async def health():
    """Health check endpoint."""
    connected = db.conn is not None and db.graph is not None
    return {
        "status": "ok" if connected else "degraded",
        "database": "connected" if db.conn else "disconnected",
        "graph_nodes": db.graph.number_of_nodes() if db.graph else 0,
        "graph_edges": db.graph.number_of_edges() if db.graph else 0,
    }
