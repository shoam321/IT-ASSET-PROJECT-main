#!/bin/bash
set -e

echo "Installing dependencies..."
cd itam-saas/Client
npm install

echo "Building React app..."
npm run build

echo "Build complete!"
