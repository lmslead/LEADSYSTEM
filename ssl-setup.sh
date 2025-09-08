#!/bin/bash

# SSL Setup Script for LMS on Ubuntu AWS EC2
# Run this AFTER successful deployment to add HTTPS support

set -e

# Configuration
DOMAIN="100.24.13.0"  # Change this to your domain name if you have one
EMAIL="admin@yourdomain.com"  # Change this to your email

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

echo "🔒 Setting up SSL/HTTPS for LMS application..."

# Check if this is an IP address
if [[ $DOMAIN =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    print_warning "You're using an IP address ($DOMAIN). SSL certificates require a domain name."
    print_warning "Consider:"
    print_warning "1. Getting a domain name and pointing it to your EC2 instance"
    print_warning "2. Using self-signed certificates (not recommended for production)"
    print_warning "3. Using AWS CloudFront with SSL certificate"
    echo ""
    read -p "Do you want to create a self-signed certificate for testing? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Create self-signed certificate
        print_status "Creating self-signed SSL certificate..."
        
        sudo mkdir -p /etc/ssl/private
        sudo mkdir -p /etc/ssl/certs
        
        # Generate private key
        sudo openssl genrsa -out /etc/ssl/private/lms-selfsigned.key 2048
        
        # Generate certificate
        sudo openssl req -new -x509 -key /etc/ssl/private/lms-selfsigned.key -out /etc/ssl/certs/lms-selfsigned.crt -days 365 -subj "/C=US/ST=State/L=City/O=Organization/OU=OrgUnit/CN=$DOMAIN"
        
        # Create Diffie-Hellman group
        sudo openssl dhparam -out /etc/ssl/certs/dhparam.pem 2048
        
        # Create Nginx SSL configuration
        cat << 'EOF' | sudo tee /etc/nginx/sites-available/leadsystem-ssl
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name 100.24.13.0;

    ssl_certificate /etc/ssl/certs/lms-selfsigned.crt;
    ssl_certificate_key /etc/ssl/private/lms-selfsigned.key;
    ssl_dhparam /etc/ssl/certs/dhparam.pem;

    # SSL Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-SHA384;
    ssl_ecdh_curve secp384r1;
    ssl_session_timeout 10m;
    ssl_session_cache shared:SSL:10m;
    ssl_session_tickets off;

    # Security headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";
    add_header X-Frame-Options SAMEORIGIN;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";

    # Same configuration as HTTP version
    root /var/www/leadsystem/client/build;
    index index.html;

    # API routes
    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $http_host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Socket.IO
    location /socket.io/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $http_host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static files
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Static asset caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name 100.24.13.0;
    return 301 https://$server_name$request_uri;
}
EOF

        # Enable SSL site
        sudo ln -sf /etc/nginx/sites-available/leadsystem-ssl /etc/nginx/sites-enabled/
        
        # Test and reload Nginx
        if sudo nginx -t; then
            sudo systemctl reload nginx
            print_status "✅ Self-signed SSL certificate installed successfully!"
            print_warning "⚠️  Browsers will show a security warning for self-signed certificates."
            print_status "Access your app at: https://100.24.13.0"
        else
            print_error "❌ Nginx configuration test failed!"
            exit 1
        fi
    else
        print_status "SSL setup cancelled."
        exit 0
    fi
else
    # Domain name provided - use Let's Encrypt
    print_status "Domain detected: $DOMAIN"
    print_status "Installing Let's Encrypt SSL certificate..."
    
    # Install Certbot
    sudo apt update
    sudo apt install -y certbot python3-certbot-nginx
    
    # Get certificate
    sudo certbot --nginx -d $DOMAIN --email $EMAIL --agree-tos --non-interactive
    
    # Test auto-renewal
    sudo certbot renew --dry-run
    
    print_status "✅ Let's Encrypt SSL certificate installed successfully!"
    print_status "Your app is now available at: https://$DOMAIN"
fi

# Update firewall for HTTPS
if command -v ufw &> /dev/null; then
    print_status "Updating firewall for HTTPS..."
    sudo ufw allow 443/tcp
    print_status "✅ Firewall updated for HTTPS traffic"
fi

echo ""
echo "🎉 SSL setup completed!"
echo ""
echo "📋 Summary:"
echo "   - HTTP (redirects to HTTPS): http://$DOMAIN"
echo "   - HTTPS: https://$DOMAIN"
echo "   - SSL certificate will auto-renew (if using Let's Encrypt)"
echo ""
echo "🔧 SSL Management Commands:"
echo "   - Check certificate: sudo certbot certificates"
echo "   - Renew manually: sudo certbot renew"
echo "   - Test renewal: sudo certbot renew --dry-run"
