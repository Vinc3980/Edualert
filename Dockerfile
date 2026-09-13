FROM python:3.12-slim

WORKDIR /app

COPY edualert-backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY edualert-backend/ .

EXPOSE 8000

CMD uvicorn fastapi_main:app --host 0.0.0.0 --port ${PORT:-8000}
