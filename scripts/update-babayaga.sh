#!/bin/bash

# Update or install BabaYaga from GitHub

echo "🔄 Updating BabaYaga..."

# Check if we're in a directory with package.json that has babayaga as dependency
if [ -f "package.json" ] && grep -q '"babayaga"' package.json; then
    echo "📦 Found BabaYaga as npm dependency"
    
    # Remove and reinstall to get latest
    echo "🔄 Updating npm dependency..."
    npm uninstall babayaga
    npm install github:banditburai/babayaga
    
    echo "✅ BabaYaga updated via npm"
    echo "Run 'npm start' to use BabaYaga"
    
elif [ -d ".git" ] && git remote -v | grep -q "babayaga"; then
    echo "📂 Found BabaYaga git repository"
    
    # Update git repository
    echo "📥 Pulling latest changes..."
    git fetch origin main
    git pull origin main
    
    # Reinstall dependencies
    echo "📦 Installing dependencies..."
    rm -rf node_modules package-lock.json
    npm install
    
    # Build TypeScript
    echo "🔨 Building TypeScript..."
    npm run build
    
    echo "✅ BabaYaga repository updated"
    echo "Run 'npm start' to use BabaYaga"
    
else
    echo "❓ Not sure how to update BabaYaga in this directory"
    echo ""
    echo "Options:"
    echo "1. If using as npm dependency:"
    echo "   npm install github:banditburai/babayaga"
    echo ""
    echo "2. To clone fresh:"
    echo "   git clone https://github.com/banditburai/babayaga.git"
    echo "   cd babayaga && npm install && npm run build"
fi