FROM python:3.12-slim

WORKDIR /app

# System dependencies needed for asyncpg (C extension) and reportlab
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        curl \
        gcc \
        libpq-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Create virtual environment outside of /app to avoid being shadowed by volumes
RUN python -m venv /opt/venv

# Use venv's pip and python for all subsequent commands
ENV PATH="/opt/venv/bin:$PATH"
ENV VIRTUAL_ENV="/opt/venv"

# Upgrade pip inside venv
RUN pip install --no-cache-dir --upgrade pip

# Install dependencies inside venv
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy app source
COPY . .

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD curl -f http://localhost:8000/api/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
