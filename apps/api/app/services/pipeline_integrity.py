"""Migration wrapper for pipeline integrity service."""

from backend.app.services.pipeline_integrity import run_pipeline_integrity_pass

__all__ = ["run_pipeline_integrity_pass"]

