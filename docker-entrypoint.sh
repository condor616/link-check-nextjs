#!/bin/sh
set -e

# Run migrations
echo "Running database migrations..."
npx prisma migrate deploy

# Start worker in background
echo "Starting worker..."
node worker.js &

# Start Next.js server
echo "Starting Next.js server..."
exec node server.js
