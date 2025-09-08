#!/bin/bash

# LEADSYSTEM Cleanup Script
# Removes unnecessary files and folders for production deployment

echo "🧹 Starting cleanup process..."

# Remove development files and folders
echo "🗑️ Removing development files..."

# Remove node_modules from client (keep only build)
if [ -d "client/node_modules" ]; then
    echo "Removing client/node_modules..."
    rm -rf client/node_modules
fi

# Remove source files from client (keep only build)
if [ -d "client/src" ] && [ -d "client/build" ]; then
    echo "Removing client source files (keeping build)..."
    rm -rf client/src
    rm -rf client/public
    rm -f client/package*.json
    rm -f client/tailwind.config.js
    rm -f client/postcss.config.js
fi

# Remove unnecessary files from root
echo "🗑️ Removing unnecessary root files..."
rm -f test-agent-edit.js
rm -f README.md
rm -f README-DEPLOYMENT.md
rm -f DEPLOYMENT-GUIDE.md
rm -f DEPLOYMENT-QUICKSTART.md
rm -f EXPORT_*.md
rm -f COMPLETE_EXPORT_ROUTE.js
rm -f setup-env.sh

# Remove git folder to reduce size (optional)
# rm -rf .git

# Remove development dependencies traces
find . -name "*.log" -delete
find . -name ".DS_Store" -delete
find . -name "Thumbs.db" -delete

# Set proper permissions
echo "🔐 Setting proper permissions..."
sudo chown -R ubuntu:ubuntu /var/www/leadsystem
find /var/www/leadsystem -type d -exec chmod 755 {} \;
find /var/www/leadsystem -type f -exec chmod 644 {} \;
chmod +x /var/www/leadsystem/LEADSYSTEM/*.sh

echo "✅ Cleanup completed!"
echo "📊 Disk usage after cleanup:"
du -sh /var/www/leadsystem/LEADSYSTEM
