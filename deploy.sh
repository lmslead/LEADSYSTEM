#!/bin/bash
echo "🚀 Starting LEADSYSTEM Deployment (Hostinger VPS)"

# 1. Go to project
cd ~/LEADSYSTEM || { echo "❌ Project folder not found"; exit 1; }

# 2. Pull latest code
echo "📥 Pulling latest code..."
git pull origin main || { echo "❌ Git pull failed"; exit 1; }

# 3. Backend
echo "🟡 Updating backend..."
cd server || exit
npm install || { echo "❌ Backend npm install failed"; exit 1; }

cd ..

echo "♻ Restarting backend (4 instances)..."
pm2 reload ecosystem.config.js || pm2 start ecosystem.config.js
pm2 save

# 4. Frontend
echo "🟡 Updating frontend..."
cd client || exit
npm install || { echo "❌ Frontend npm install failed"; exit 1; }

echo "⚙ Building frontend..."
npm run build || { echo "❌ Frontend build failed"; exit 1; }

# 5. Deploy frontend
echo "📂 Deploying frontend to /home/ubuntu/lms-build..."

sudo mkdir -p /home/ubuntu/lms-build
sudo rm -rf /home/ubuntu/lms-build/*

if [ -d "dist" ]; then
  sudo cp -r dist/* /home/ubuntu/lms-build/
elif [ -d "build" ]; then
  sudo cp -r build/* /home/ubuntu/lms-build/
else
  echo "❌ Build folder not found"
  exit 1
fi

sudo chown -R www-data:www-data /home/ubuntu/lms-build
sudo chmod -R 755 /home/ubuntu/lms-build

# 6. Reload nginx
echo "🔁 Reloading Nginx..."
sudo nginx -t || exit 1
sudo systemctl reload nginx

echo "✅ Deployment completed successfully!"