FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# The API only ever writes the SQLite file, so it has no reason to run as root.
# /data is where docker-compose mounts the database volume; creating it here,
# owned by the service user, is what makes a fresh named volume writable by it.
RUN useradd --create-home --uid 10001 financert \
    && mkdir /data \
    && chown financert:financert /data

# Application files stay root-owned and read-only to the service user.
COPY . .

USER financert

# FINANCERT_ENV=production makes the app refuse to start without
# FINANCERT_API_TOKEN, unless FINANCERT_ALLOW_OPEN_PORTFOLIO=true says the open
# portfolio routes are intended. The database default points at the volume.
ENV FINANCERT_ENV=production \
    FINANCERT_DATABASE_URL=sqlite:////data/financert.db \
    PYTHONUNBUFFERED=1

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
