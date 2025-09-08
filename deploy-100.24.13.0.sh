#!/bin/bash

# LMS Deployment Script for Ubuntu on AWS EC2
# Target IP: 100.24.13.0
set -e

echo "🚀 Starting LMS deployment for Ubuntu on AWS EC2 (100.24.13.0)..."

# Configuration
TARGET_IP="100.24.13.0"
APP_NAME="lms-backend"
APP_DIR="/var/www/leadsystem"
NGINX_SITE_CONFIG="/etc/nginx/sites-available/leadsystem"
NGINX_SITE_ENABLED="/etc/nginx/sites-enabled/leadsystem"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Check if running on Ubuntu
if ! grep -q "ubuntu" /etc/os-release; then
    print_warning "This script is optimized for Ubuntu. Proceeding anyway..."
fi

# Update system packages
print_status "Updating system packages..."
sudo apt update -y
sudo apt upgrade -y

# Install essential packages
print_status "Installing essential packages..."
sudo apt install -y curl wget software-properties-common apt-transport-https ca-certificates gnupg lsb-release

# Install Node.js 18.x LTS
if ! command -v node &> /dev/null; then
    print_status "Installing Node.js 18.x LTS..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
    
    # Verify installation
    print_info "Node.js version: $(node -v)"
    print_info "NPM version: $(npm -v)"
else
    print_status "Node.js is already installed: $(node -v)"
fi

# Install Nginx
if ! command -v nginx &> /dev/null; then
    print_status "Installing Nginx..."
    sudo apt-get install -y nginx
    
    # Start and enable nginx
    sudo systemctl start nginx
    sudo systemctl enable nginx
    print_info "Nginx version: $(nginx -v 2>&1)"
else
    print_status "Nginx is already installed: $(nginx -v 2>&1)"
fi

# Install PM2 globally
if ! command -v pm2 &> /dev/null; then
    print_status "Installing PM2 globally..."
    sudo npm install -g pm2@latest
    print_info "PM2 version: $(pm2 -v)"
else
    print_status "PM2 is already installed: $(pm2 -v)"
fi

# Create application directory with proper permissions
print_status "Setting up application directory..."
sudo mkdir -p $APP_DIR
sudo chown -R $USER:$USER $APP_DIR

# Copy application files
print_status "Copying application files..."
rsync -av --exclude 'node_modules' --exclude '.git' --exclude 'logs' ./ $APP_DIR/
cd $APP_DIR

# Set proper permissions
sudo chown -R $USER:$USER $APP_DIR
sudo chmod -R 755 $APP_DIR

# Install server dependencies
print_status "Installing server dependencies..."
cd server
npm install --production --silent
cd ..

# Install client dependencies and build
print_status "Installing client dependencies and building..."
cd client
npm install --silent

# Use production environment for build
cp .env.production .env
npm run build

# Verify build was successful
if [ ! -d "build" ] || [ ! -f "build/index.html" ]; then
    print_error "Client build failed! Build directory not found."
    exit 1
fi

print_status "Client build completed successfully"
cd ..

# Stop existing PM2 processes gracefully
print_status "Stopping existing PM2 processes..."
pm2 stop $APP_NAME 2>/dev/null || true
pm2 delete $APP_NAME 2>/dev/null || true

# Copy production environment file for server
print_status "Setting up production environment..."
cd server
cp .env.production .env

# Verify environment file
if [ ! -f ".env" ]; then
    print_error "Production environment file not found!"
    exit 1
fi

# Start application with PM2
print_status "Starting application with PM2..."
cd ..
pm2 start ecosystem.config.js --env production

# Save PM2 configuration and setup auto-start
pm2 save
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $(eval echo ~$USER)

# Configure Nginx for Ubuntu
print_status "Configuring Nginx for Ubuntu..."

# Backup existing default site if it exists
if [ -f "/etc/nginx/sites-enabled/default" ]; then
    sudo mv /etc/nginx/sites-enabled/default /etc/nginx/sites-enabled/default.backup
fi

# Remove any existing configuration
sudo rm -f $NGINX_SITE_ENABLED

# Copy our Nginx configuration
sudo cp nginx-production.conf $NGINX_SITE_CONFIG

# Enable the site
sudo ln -sf $NGINX_SITE_CONFIG $NGINX_SITE_ENABLED

# Test Nginx configuration
print_status "Testing Nginx configuration..."
if sudo nginx -t; then
    print_status "✅ Nginx configuration test passed"
    sudo systemctl restart nginx
    sudo systemctl enable nginx
    print_status "Nginx restarted and enabled"
else
    print_error "❌ Nginx configuration test failed!"
    sudo nginx -t 2>&1
    exit 1
fi

# Create necessary directories
print_status "Creating log and cache directories..."
sudo mkdir -p /var/log/nginx
sudo mkdir -p $APP_DIR/logs
sudo mkdir -p /var/cache/nginx
sudo chown -R $USER:$USER $APP_DIR/logs

# Configure AWS EC2 security group (informational)
print_info "Ensure your AWS EC2 Security Group allows:"
print_info "  - Port 22 (SSH)"
print_info "  - Port 80 (HTTP)"
print_info "  - Port 443 (HTTPS - if using SSL)"

# Set up UFW firewall
if command -v ufw &> /dev/null; then
    print_status "Configuring UFW firewall..."
    sudo ufw --force reset
    sudo ufw default deny incoming
    sudo ufw default allow outgoing
    sudo ufw allow ssh
    sudo ufw allow 80/tcp
    sudo ufw allow 443/tcp
    sudo ufw --force enable
    print_status "UFW firewall configured and enabled"
else
    print_warning "UFW not available. Ensure AWS Security Group is properly configured."
fi

# Wait for services to be ready
print_status "Waiting for services to initialize..."
sleep 10

# Enhanced health checks
print_status "Performing comprehensive health checks..."

# Check PM2 process
if pm2 list | grep -q "$APP_NAME.*online"; then
    print_status "✅ Backend PM2 process is running"
    
    # Check if backend responds
    if curl -f -s -m 10 "http://localhost:5000/health" > /dev/null 2>&1; then
        print_status "✅ Backend health endpoint responding"
    else
        print_warning "⚠️  Backend health endpoint not responding"
    fi
else
    print_error "❌ Backend PM2 process failed to start"
    echo "PM2 Status:"
    pm2 status
    echo "PM2 Logs:"
    pm2 logs $APP_NAME --lines 20
    exit 1
fi

# Check Nginx
if sudo systemctl is-active --quiet nginx; then
    print_status "✅ Nginx service is active"
    
    # Check if Nginx serves the site
    if curl -f -s -m 10 "http://localhost" > /dev/null 2>&1; then
        print_status "✅ Nginx is serving the site successfully"
    else
        print_warning "⚠️  Nginx site check failed"
        print_info "Nginx error log:"
        sudo tail -n 10 /var/log/nginx/error.log 2>/dev/null || echo "No error log found"
    fi
else
    print_error "❌ Nginx service is not active"
    sudo systemctl status nginx
    exit 1
fi

# Display final information
echo ""
echo "🎉 Deployment completed successfully!"
echo ""
echo "📋 Deployment Summary:"
echo "   - Application URL: http://$TARGET_IP"
echo "   - Backend API: http://$TARGET_IP/api"
echo "   - Health Check: http://$TARGET_IP/health"
echo "   - Logs: pm2 logs $APP_NAME"
echo ""
echo "🔧 Useful Commands:"
echo "   - Check PM2 status: pm2 status"
echo "   - Restart application: pm2 restart $APP_NAME"
echo "   - View logs: pm2 logs $APP_NAME"
echo "   - Nginx status: sudo systemctl status nginx"
echo "   - Reload Nginx: sudo systemctl reload nginx"
echo ""
echo "🌐 Your LMS application is now live at: http://$TARGET_IP"
