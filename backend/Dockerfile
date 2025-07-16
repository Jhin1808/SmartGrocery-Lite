# Use official Python image (slim variant for smaller size)
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install Python dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application code
COPY . .

# Default command (for production or simple runs)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
