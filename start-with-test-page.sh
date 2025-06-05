#!/bin/bash

# Start unified BabaYaga with test page

# Check if test-app exists
if [ -d "test-app" ] && [ -f "test-app/index.html" ]; then
    echo "🌐 Starting local test app server..."
    # Start a simple HTTP server in background
    npx http-server test-app -p 8888 &
    SERVER_PID=$!
    
    # Wait for server to start
    sleep 2
    
    # Start BabaYaga with test page URL
    echo "🚀 Starting BabaYaga with test page..."
    START_URL=http://localhost:8888 npm start
    
    # Kill the server when done
    kill $SERVER_PID
else
    echo "⚠️  No test-app directory found"
    echo "Starting BabaYaga without test page..."
    npm start
fi