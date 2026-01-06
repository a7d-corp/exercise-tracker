FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install --production

# Copy application files
COPY server.js index.html ./

# Expose port
EXPOSE 3000

# Set default environment variables
ENV PORT=3000
ENV EXERCISES_FILE=/data/exercises.json

# Create data directory
RUN mkdir -p /data

# Run the application
CMD ["node", "server.js"]

