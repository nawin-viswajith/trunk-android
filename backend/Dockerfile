FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 8000

# Render (and most PaaS hosts) inject $PORT at runtime; default to 8000 for
# plain `docker run` locally. Shell form is required for the ${PORT} expansion.
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
