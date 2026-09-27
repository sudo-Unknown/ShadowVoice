# Production Dockerfile for Coolify Deployment
FROM node:24-alpine AS runner

WORKDIR /app

# Install dumb-init or curl/wget for signal handling & healthcheck
RUN apk add --no-cache curl wget

# Set production environment
ENV NODE_ENV=production
ENV PORT=3050

# Copy dependency definitions
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy application source code
COPY src/ ./src/

# Create persistent data directory and grant permissions to node user
RUN mkdir -p /app/data && chown -R node:node /app

# Switch to non-root node user for security
USER node

# Expose server port
EXPOSE 3050

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3050/api/status || exit 1

# Start the Voicemail Agent
CMD ["node", "src/server.js"]
