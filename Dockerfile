# Palmistra AI - Hugging Face Spaces & Production Docker Container
FROM python:3.11-slim

# Prevent Python from writing .pyc and buffer stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=7860 \
    HOME=/home/user

# Install minimal OS dependencies for healthchecks and runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set up a new user named "user" with UID 1000 (standard for Hugging Face Spaces)
RUN useradd -m -u 1000 user

WORKDIR $HOME/app

# Install Python dependencies
COPY --chown=user:user requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source code
COPY --chown=user:user . .

# Ensure samples and output directories exist with correct permissions
RUN mkdir -p samples output && chown -R user:user $HOME/app

# Switch to non-root user
USER user

# Generate sample palms ahead of time
RUN python -c "from backend.generate_samples import generate_all_samples; generate_all_samples()"

# Expose ports (7860 for Hugging Face Spaces, 8000 for standard Docker)
EXPOSE 7860
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT:-7860}/api/health || exit 1

# Launch production server binding to dynamic PORT (default 7860)
CMD ["sh", "-c", "uvicorn backend.app:app --host 0.0.0.0 --port ${PORT:-7860}"]
