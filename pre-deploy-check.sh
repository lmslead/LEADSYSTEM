#!/bin/bash

# Pre-deployment checklist for LMS on 100.24.13.0
set -e

echo "🔍 LMS Pre-Deployment Checklist for IP 100.24.13.0"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0
WARNINGS=0

# Function to check and report
check_item() {
    local description="$1"
    local command="$2"
    local is_critical="$3"
    
    echo -n "Checking $description... "
    
    if eval "$command" >/dev/null 2>&1; then
        echo -e "${GREEN}✓ PASSED${NC}"
        ((PASSED++))
        return 0
    else
        if [[ "$is_critical" == "true" ]]; then
            echo -e "${RED}✗ FAILED (CRITICAL)${NC}"
            ((FAILED++))
            return 1
        else
            echo -e "${YELLOW}⚠ WARNING${NC}"
            ((WARNINGS++))
            return 0
        fi
    fi
}

echo ""
echo "📁 Project Structure Checks:"
echo "----------------------------"

check_item "package.json exists" "test -f package.json" true
check_item "server/package.json exists" "test -f server/package.json" true
check_item "client/package.json exists" "test -f client/package.json" true
check_item "server/server.js exists" "test -f server/server.js" true
check_item "ecosystem.config.js exists" "test -f ecosystem.config.js" true

echo ""
echo "🔧 Environment Configuration:"
echo "-----------------------------"

check_item "server/.env.production exists" "test -f server/.env.production" true
check_item "client/.env.production exists" "test -f client/.env.production" true
check_item "nginx-production.conf exists" "test -f nginx-production.conf" true

# Check environment variables
if [ -f "server/.env.production" ]; then
    check_item "MongoDB URI configured" "grep -q 'MONGODB_URI=' server/.env.production" true
    check_item "JWT Secret configured" "grep -q 'JWT_SECRET=' server/.env.production" true
    check_item "Correct IP in server env" "grep -q '100.24.13.0' server/.env.production" true
fi

if [ -f "client/.env.production" ]; then
    check_item "Correct API URL in client env" "grep -q '100.24.13.0' client/.env.production" true
fi

echo ""
echo "📦 Dependencies Check:"
echo "---------------------"

# Check if package.json has required scripts
check_item "Server has start script" "grep -q '\"start\"' server/package.json" true
check_item "Client has build script" "grep -q '\"build\"' client/package.json" true

echo ""
echo "🔍 Code Quality Checks:"
echo "-----------------------"

# Check for common issues
check_item "No hardcoded localhost in server" "! grep -r 'localhost' server/ --exclude-dir=node_modules || true" false
check_item "No hardcoded 127.0.0.1 in server" "! grep -r '127.0.0.1' server/ --exclude-dir=node_modules || true" false

echo ""
echo "🛡️  Security Checks:"
echo "--------------------"

check_item "JWT_SECRET is not default" "! grep -q 'your-secret-key' server/.env.production || true" true
check_item "No .env files in git" "! git ls-files | grep -E '\\.env$' || true" false
check_item "NODE_ENV set to production" "grep -q 'NODE_ENV=production' server/.env.production" true

echo ""
echo "🌐 Network Configuration:"
echo "-------------------------"

check_item "CORS origins configured" "grep -q 'ALLOWED_ORIGINS' server/.env.production" true
check_item "Host set to 0.0.0.0" "grep -q 'HOST=0.0.0.0' server/.env.production" true

echo ""
echo "📋 Deployment Files:"
echo "--------------------"

check_item "Deployment script exists" "test -f deploy-100.24.13.0.sh" true
check_item "Deployment script is executable" "test -x deploy-100.24.13.0.sh || chmod +x deploy-100.24.13.0.sh" false

echo ""
echo "==============================================="
echo "📊 SUMMARY:"
echo "==============================================="
echo -e "✅ Passed: ${GREEN}$PASSED${NC}"
echo -e "⚠️  Warnings: ${YELLOW}$WARNINGS${NC}"
echo -e "❌ Failed: ${RED}$FAILED${NC}"

echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 Pre-deployment checks PASSED! Ready to deploy.${NC}"
    echo ""
    echo "🚀 To deploy, run:"
    echo "   chmod +x deploy-100.24.13.0.sh"
    echo "   ./deploy-100.24.13.0.sh"
    echo ""
    echo "🔗 After deployment, your app will be available at:"
    echo "   http://100.24.13.0"
    exit 0
else
    echo -e "${RED}❌ Pre-deployment checks FAILED! Please fix critical issues before deploying.${NC}"
    echo ""
    echo "🔧 Common fixes:"
    echo "   - Ensure all required files exist"
    echo "   - Check environment variable configuration"
    echo "   - Verify IP addresses in configuration files"
    exit 1
fi
