#!/bin/bash

# Update BabaYaga to latest version from unified-babayaga branch

echo "🔄 Updating BabaYaga to latest unified version..."

# Check if babayaga-unified directory exists
if [ -d "babayaga-unified" ]; then
    echo "📂 Found existing babayaga-unified directory"
    cd babayaga-unified
    
    # Fetch and pull latest changes
    echo "📥 Pulling latest changes from unified-babayaga branch..."
    git fetch origin unified-babayaga
    git checkout unified-babayaga
    git pull origin unified-babayaga
else
    # Clone if doesn't exist
    echo "📥 Cloning unified-babayaga branch..."
    git clone -b unified-babayaga https://github.com/banditburai/babayaga.git babayaga-unified
    cd babayaga-unified
fi

# Remove node_modules and package-lock.json
echo "📦 Removing old dependencies..."
rm -rf node_modules package-lock.json

# Clear npm cache
echo "🧹 Clearing npm cache..."
npm cache clean --force 2>/dev/null || true

# Install dependencies
echo "⬇️  Installing dependencies..."
npm install

# Build TypeScript
echo "🔨 Building TypeScript..."
npm run build

echo "✅ BabaYaga Unified updated successfully!"
echo ""
echo "To start BabaYaga Unified:"
echo "  cd babayaga-unified && npm start"
echo ""
echo "Or use as MCP server in Claude Desktop config"