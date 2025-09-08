# LMS Deployment Guide for AWS EC2 Ubuntu (IP: 100.24.13.0)

## Prerequisites

### AWS EC2 Instance Requirements
- **OS**: Ubuntu 20.04 LTS or 22.04 LTS
- **Instance Type**: t3.medium or higher (minimum 4GB RAM recommended)
- **Storage**: 20GB+ EBS volume
- **Security Group**: Allow ports 22 (SSH), 80 (HTTP), 443 (HTTPS)

### AWS Security Group Configuration
```
Inbound Rules:
- SSH (22) - Your IP or 0.0.0.0/0 (less secure)
- HTTP (80) - 0.0.0.0/0
- HTTPS (443) - 0.0.0.0/0
- Custom TCP (5000) - 0.0.0.0/0 (for direct API access, optional)

Outbound Rules:
- All traffic - 0.0.0.0/0
```

## Deployment Steps

### 1. Connect to Your EC2 Instance
```bash
ssh -i your-key.pem ubuntu@100.24.13.0
```

### 2. Update System
```bash
sudo apt update && sudo apt upgrade -y
```

### 3. Transfer Project Files
From your local machine:
```bash
# Option 1: Using SCP
scp -r -i your-key.pem LEADSYSTEM/ ubuntu@100.24.13.0:~/

# Option 2: Using rsync
rsync -avz -e "ssh -i your-key.pem" LEADSYSTEM/ ubuntu@100.24.13.0:~/LEADSYSTEM/

# Option 3: Using Git (if repository is public)
ssh -i your-key.pem ubuntu@100.24.13.0
git clone https://github.com/yourusername/LEADSYSTEM.git
```

### 4. Run Pre-deployment Check
```bash
cd LEADSYSTEM
chmod +x pre-deploy-check.sh
./pre-deploy-check.sh
```

### 5. Execute Deployment
```bash
chmod +x deploy-100.24.13.0.sh
./deploy-100.24.13.0.sh
```

## Post-Deployment Verification

### 1. Check Application Status
```bash
# PM2 Status
pm2 status
pm2 logs lms-backend

# Nginx Status
sudo systemctl status nginx
sudo nginx -t

# Check if ports are listening
sudo netstat -tlnp | grep :80
sudo netstat -tlnp | grep :5000
```

### 2. Test Application
```bash
# Test backend health
curl http://100.24.13.0/api/health

# Test frontend
curl http://100.24.13.0

# Test from external network
# Open browser and navigate to: http://100.24.13.0
```

## Monitoring and Maintenance

### PM2 Commands
```bash
# View logs
pm2 logs lms-backend
pm2 logs lms-backend --lines 100

# Restart application
pm2 restart lms-backend

# Stop application
pm2 stop lms-backend

# Monitor real-time
pm2 monit
```

### Nginx Commands
```bash
# Restart Nginx
sudo systemctl restart nginx

# Reload configuration
sudo systemctl reload nginx

# Check error logs
sudo tail -f /var/log/nginx/error.log

# Check access logs
sudo tail -f /var/log/nginx/access.log
```

### System Monitoring
```bash
# Check disk usage
df -h

# Check memory usage
free -h

# Check CPU usage
top

# Check system logs
sudo journalctl -u nginx -f
sudo journalctl -u pm2-ubuntu -f
```

## Troubleshooting

### Common Issues

#### 1. Application Not Starting
```bash
# Check PM2 logs
pm2 logs lms-backend --err

# Check environment variables
cd /var/www/leadsystem/server
cat .env

# Restart PM2
pm2 restart lms-backend
```

#### 2. Nginx 502 Bad Gateway
```bash
# Check if backend is running
curl http://localhost:5000/api/health

# Check Nginx error logs
sudo tail -f /var/log/nginx/error.log

# Test Nginx configuration
sudo nginx -t
```

#### 3. Database Connection Issues
```bash
# Check MongoDB URI in environment
grep MONGODB_URI /var/www/leadsystem/server/.env

# Test connectivity (if using external MongoDB)
ping your-mongodb-host
```

#### 4. Port Issues
```bash
# Check what's using port 80
sudo lsof -i :80

# Check what's using port 5000
sudo lsof -i :5000

# Kill process if needed
sudo kill -9 <PID>
```

### Log Files Locations
- Application logs: `/var/www/leadsystem/logs/`
- PM2 logs: `~/.pm2/logs/`
- Nginx logs: `/var/log/nginx/`
- System logs: `/var/log/syslog`

## Security Considerations

### 1. Update Firewall Rules
```bash
# Check UFW status
sudo ufw status

# Allow specific IPs only (more secure)
sudo ufw delete allow 80
sudo ufw allow from YOUR_IP to any port 80
```

### 2. SSL Certificate (Recommended)
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com
```

### 3. Regular Updates
```bash
# Set up automatic security updates
sudo apt install unattended-upgrades
sudo dpkg-reconfigure unattended-upgrades
```

## Backup Strategy

### 1. Application Backup
```bash
# Create backup script
tar -czf lms-backup-$(date +%Y%m%d).tar.gz /var/www/leadsystem
```

### 2. Database Backup
```bash
# For MongoDB (if self-hosted)
mongodump --uri="your-mongodb-uri" --out /backup/mongodb/$(date +%Y%m%d)
```

## Performance Optimization

### 1. Enable Nginx Caching
```bash
# Add to nginx configuration
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m max_size=10g inactive=60m;
```

### 2. PM2 Cluster Mode
```bash
# Update ecosystem.config.js for cluster mode
instances: "max" # or specify number of cores
```

## Contact Information
- Application URL: http://100.24.13.0
- API Base URL: http://100.24.13.0/api
- Health Check: http://100.24.13.0/api/health

For issues, check logs and follow troubleshooting steps above.
