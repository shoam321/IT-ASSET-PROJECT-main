#!/bin/bash
set -e

# Navigate to client directory
cd itam-saas/Client

# Install dependencies
npm install

# Build the React app
npm run build

# Output completion
echo "Build completed successfully!"
echo "Build output: itam-saas/Client/build"
