# syntax=docker/dockerfile:1
FROM python:3.12-slim

WORKDIR /app

# Create a non-root user
RUN groupadd --system --gid 10001 appuser && \
    useradd --system --create-home --uid 10001 --gid 10001 appuser

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app ./app

# Copy .env only at runtime (not baked into image)
# Copy root Alembic INI configuration and alembic directory
COPY alembic.ini .
COPY alembic ./alembic

# Set ownership
RUN chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose the default FastAPI port
EXPOSE 8000

# Use a single Uvicorn worker - rate limiting is process-local
# ASGI module: app.main:app (FastAPI instance created by create_app())
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]