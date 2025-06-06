#!/bin/bash

# Update script for babayaga-test-app to use unified branch

echo "🔄 Updating BabaYaga Test App to use Unified branch..."
echo ""

# Option 1: Using as npm dependency
if [ "$1" == "--npm" ]; then
    echo "📦 Using NPM dependency approach..."
    
    # Clean old dependencies
    rm -rf node_modules/babayaga package-lock.json
    
    # Install from unified branch
    npm install github:banditburai/babayaga#unified-babayaga
    
    echo "✅ Done! Run 'npm start' to start BabaYaga"
    exit 0
fi

# Option 2: Using local clone (default)
echo "📂 Using local clone approach..."

# Check if babayaga-unified exists
if [ -d "babayaga-unified" ]; then
    echo "Found existing babayaga-unified directory"
    cd babayaga-unified
    
    # Update to latest
    git fetch origin unified-babayaga
    git checkout unified-babayaga
    git pull origin unified-babayaga
else
    # Clone fresh
    echo "Cloning unified-babayaga branch..."
    git clone -b unified-babayaga https://github.com/banditburai/babayaga.git babayaga-unified
    cd babayaga-unified
fi

# Install dependencies and build
echo "📦 Installing dependencies..."
rm -rf node_modules package-lock.json
npm install

echo "🔨 Building TypeScript..."
npm run build

echo ""
echo "✅ BabaYaga Unified ready!"
echo ""
echo "To start:"
echo "  cd babayaga-unified && npm start"
echo ""
echo "Or use the npm script:"
echo "  npm run start:local"