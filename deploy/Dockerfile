FROM python:3.13-alpine

WORKDIR /app

# Copy application files
COPY server.py .
COPY public/ ./public/

# Environment defaults
ENV PORT=3000
ENV DB_PATH=/app/data/gym.db
ENV GYM_CAPACITY=4
ENV START_HOUR=6
ENV END_HOUR=21

# Expose web server port
EXPOSE 3000

# Persistent data directory for SQLite database
VOLUME ["/app/data"]

CMD ["python", "server.py"]
