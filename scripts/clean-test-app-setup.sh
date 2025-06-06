#!/bin/bash

# Script to clean and set up babayaga-test-app with unified branch

TEST_APP_DIR="/Users/firefly/Code/sandbox/babayaga-test-app"

echo "🧹 Cleaning up babayaga-test-app directory..."
echo "This will remove all files except .git (if it exists)"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 1
fi

# Save .git directory if it exists
if [ -d "$TEST_APP_DIR/.git" ]; then
    echo "📁 Preserving .git directory..."
    mv "$TEST_APP_DIR/.git" "$TEST_APP_DIR/../.git-backup-babayaga-test-app"
fi

# Remove everything else
echo "🗑️  Removing old files..."
rm -rf "$TEST_APP_DIR"/*
rm -rf "$TEST_APP_DIR"/.*[!.]*  # Hidden files except . and ..

# Restore .git if it existed
if [ -d "$TEST_APP_DIR/../.git-backup-babayaga-test-app" ]; then
    echo "📁 Restoring .git directory..."
    mv "$TEST_APP_DIR/../.git-backup-babayaga-test-app" "$TEST_APP_DIR/.git"
fi

# Copy new files
echo "📄 Copying new files..."
cp babayaga-test-app-package.json "$TEST_APP_DIR/package.json"
cp update-unified.sh "$TEST_APP_DIR/update-unified.sh"
cp babayaga-test-app-README.md "$TEST_APP_DIR/README.md"

# Create .gitignore
cat > "$TEST_APP_DIR/.gitignore" << 'EOF'
node_modules/
package-lock.json
babayaga-unified/
.DS_Store
*.log
EOF

# Make scripts executable
chmod +x "$TEST_APP_DIR/update-unified.sh"

echo ""
echo "✅ babayaga-test-app has been cleaned and set up!"
echo ""
echo "Next steps:"
echo "  cd $TEST_APP_DIR"
echo "  npm install    # Install unified BabaYaga"
echo "  npm start      # Start BabaYaga"
echo ""
echo "The app now uses the simplified unified architecture!"