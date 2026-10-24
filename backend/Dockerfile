FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 8000

# Honour the host-provided PORT (Render's Docker runtime injects 10000);
# the compose stacks set no PORT, so ${PORT:-8000} keeps them on 8000.
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
