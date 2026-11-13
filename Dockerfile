# EPIC Overview server for Fly.io: server.py + the web app, Python standard library only.
FROM python:3.12-slim
WORKDIR /app
COPY server.py ./
COPY web ./web
ENV PYTHONUNBUFFERED=1
EXPOSE 8080
# The game is saved on the Fly volume mounted at /data (see fly.toml).
CMD ["python", "server.py", "--port", "8080", "--data", "/data/save"]
