# Build stage
FROM node:22-alpine AS builder

# Install build dependencies for Prisma
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build the app
RUN npm run build

# Production stage
FROM node:22-alpine

# Install production dependencies for Prisma
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Copy built assets and dependencies from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/tsconfig*.json ./
COPY --from=builder /app/prisma ./prisma

# Environment variables
ENV NODE_ENV=production

# Expose port
EXPOSE 3000

# Script to push schema, seed and start the app
CMD npx prisma db push && npx prisma db seed && node dist/src/main
