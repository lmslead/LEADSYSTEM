#!/bin/bash

# Final Deployment Verification for LMS on Ubuntu AWS EC2
# Run this after deployment to ensure everything is working correctly

set -e

TARGET_IP="100.24.13.0"
APP_NAME="lms-backend"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[i]${NC} $1"
}

echo "🔍 Final Deployment Verification for LMS"
echo "========================================"
echo ""

TOTAL_CHECKS=0
PASSED_CHECKS=0

# Function to run checks
run_check() {
    local description="$1"
    local command="$2"
    local critical="$3"
    
    echo -n "Checking $description... "
    ((TOTAL_CHECKS++))
    
    if eval "$command" >/dev/null 2>&1; then
        print_status "PASSED"
        ((PASSED_CHECKS++))
        return 0
    else
        if [[ "$critical" == "true" ]]; then
            print_error "FAILED (CRITICAL)"
        else
            print_warning "WARNING"
        fi
        return 1
    fi
}

echo "🖥️  System Health Checks:"
echo "-------------------------"

run_check "System disk space (>1GB free)" "df / | awk 'NR==2{print \$4}' | awk '{\$1=\$1/(1024^2); if(\$1>1) exit 0; else exit 1}'" true
run_check "System memory (>500MB free)" "free -m | awk 'NR==2{printf \"%.0f\", \$7}' | awk '{\$1=\$1; if(\$1>500) exit 0; else exit 1}'" false
run_check "Node.js is installed" "command -v node" true
run_check "NPM is installed" "command -v npm" true
run_check "PM2 is installed" "command -v pm2" true
run_check "Nginx is installed" "command -v nginx" true

echo ""
echo "🚀 Application Checks:"
echo "----------------------"

run_check "PM2 process '$APP_NAME' is running" "pm2 list | grep -q '$APP_NAME.*online'" true
run_check "Application directory exists" "test -d /var/www/leadsystem" true
run_check "Client build directory exists" "test -d /var/www/leadsystem/client/build" true
run_check "Server node_modules exists" "test -d /var/www/leadsystem/server/node_modules" true

echo ""
echo "🌐 Network & Service Checks:"
echo "----------------------------"

run_check "Port 5000 is listening (Backend)" "ss -tlnp | grep -q ':5000'" true
run_check "Port 80 is listening (Nginx)" "ss -tlnp | grep -q ':80'" true
run_check "Nginx is active" "systemctl is-active --quiet nginx" true

echo ""
echo "🔗 Connectivity Checks:"
echo "-----------------------"

run_check "Backend health endpoint responds" "curl -f -s -m 10 http://localhost:5000/api/health" true
run_check "Frontend loads via Nginx" "curl -f -s -m 10 http://localhost/ | grep -q '<title>'" true
run_check "API accessible via Nginx" "curl -f -s -m 10 http://localhost/api/health" true

if command -v dig >/dev/null 2>&1; then
    run_check "DNS resolution works" "dig google.com +short" false
fi

echo ""
echo "📁 File Permissions:"
echo "--------------------"

run_check "Application directory is readable" "test -r /var/www/leadsystem" true
run_check "Log directory is writable" "test -w /var/www/leadsystem/logs" false
run_check "Nginx config is valid" "nginx -t" true

echo ""
echo "🔒 Security Checks:"
echo "-------------------"

run_check "UFW firewall is active" "ufw status | grep -q 'Status: active'" false
run_check "SSH port is allowed in UFW" "ufw status | grep -q '22'" false
run_check "HTTP port is allowed in UFW" "ufw status | grep -q '80'" false

echo ""
echo "🌍 External Access Tests:"
echo "-------------------------"

# Only run external tests if we can reach the internet
if curl -f -s -m 5 http://google.com >/dev/null 2>&1; then
    print_info "Testing external access to your application..."
    
    # Test external access
    if curl -f -s -m 15 "http://$TARGET_IP" >/dev/null 2>&1; then
        print_status "External HTTP access working"
        ((PASSED_CHECKS++))
    else
        print_warning "External HTTP access failed - check AWS Security Group"
    fi
    ((TOTAL_CHECKS++))
    
    if curl -f -s -m 15 "http://$TARGET_IP/api/health" >/dev/null 2>&1; then
        print_status "External API access working"
        ((PASSED_CHECKS++))
    else
        print_warning "External API access failed"
    fi
    ((TOTAL_CHECKS++))
else
    print_warning "No internet access - skipping external tests"
fi

echo ""
echo "📊 Summary:"
echo "=========="
echo -e "Total Checks: $TOTAL_CHECKS"
echo -e "Passed: ${GREEN}$PASSED_CHECKS${NC}"
echo -e "Failed/Warnings: ${YELLOW}$((TOTAL_CHECKS - PASSED_CHECKS))${NC}"

# Calculate percentage
PERCENTAGE=$((PASSED_CHECKS * 100 / TOTAL_CHECKS))

echo ""
if [ $PERCENTAGE -ge 90 ]; then
    echo -e "${GREEN}🎉 Excellent! Your deployment is ready ($PERCENTAGE% checks passed)${NC}"
    echo ""
    echo "✅ Your LMS application is successfully deployed!"
    echo ""
    echo "🌐 Access URLs:"
    echo "   - Main Application: http://$TARGET_IP"
    echo "   - API Health Check: http://$TARGET_IP/api/health"
    echo ""
    echo "🔧 Management Commands:"
    echo "   - Check logs: pm2 logs $APP_NAME"
    echo "   - Restart app: pm2 restart $APP_NAME"
    echo "   - Nginx status: sudo systemctl status nginx"
    echo ""
    echo "📖 For SSL setup, run: ./ssl-setup.sh"
    
elif [ $PERCENTAGE -ge 70 ]; then
    echo -e "${YELLOW}⚠️  Good deployment with some warnings ($PERCENTAGE% checks passed)${NC}"
    echo ""
    echo "Your application should be working, but consider addressing the warnings above."
    echo ""
    echo "🌐 Try accessing: http://$TARGET_IP"
    
else
    echo -e "${RED}❌ Deployment has critical issues ($PERCENTAGE% checks passed)${NC}"
    echo ""
    echo "Please review and fix the failed checks above before using the application."
    echo ""
    echo "🔧 Common troubleshooting:"
    echo "   - Check PM2 logs: pm2 logs $APP_NAME"
    echo "   - Check Nginx logs: sudo tail -f /var/log/nginx/error.log"
    echo "   - Verify AWS Security Group allows port 80"
    echo "   - Ensure your EC2 instance has sufficient resources"
    exit 1
fi

echo ""
echo "📚 Additional Resources:"
echo "   - Deployment Guide: AWS-EC2-DEPLOYMENT-GUIDE.md"
echo "   - Troubleshooting: Check log files in /var/www/leadsystem/logs/"
echo "   - AWS Console: Verify Security Group and instance status"
