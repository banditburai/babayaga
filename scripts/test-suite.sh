#!/bin/bash

# BabaYaga Comprehensive Test Suite
# Combines all tests with proper error handling and clear output

set -e  # Exit on error, but we'll handle the increment issue

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
PASSED=0
FAILED=0

# Helper functions
log_test() {
    echo -e "\n${YELLOW}Testing: $1${NC}"
}

log_pass() {
    echo -e "${GREEN}✅ $1${NC}"
    PASSED=$((PASSED + 1))
}

log_fail() {
    echo -e "${RED}❌ $1${NC}"
    FAILED=$((FAILED + 1))
}

check_command() {
    if command -v $1 &> /dev/null; then
        return 0
    else
        return 1
    fi
}

kill_chrome() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        pkill -f "chrome.*remote-debugging-port" 2>/dev/null || true
    elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
        taskkill //F //IM chrome.exe //T 2>nul || true
    else
        pkill -f "chrome.*remote-debugging-port" 2>/dev/null || true
    fi
}

wait_for_port() {
    local port=$1
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -s "http://localhost:$port" > /dev/null 2>&1; then
            return 0
        fi
        sleep 1
        ((attempt++))
    done
    return 1
}

# Start test suite
echo "🧪 BabaYaga Comprehensive Test Suite"
echo "===================================="
echo "Date: $(date)"
echo "Node Version: $(node --version)"
echo "OS: $OSTYPE"
echo "===================================="

# Test 1: Environment Setup
log_test "Environment Setup"
if check_command node; then
    log_pass "Node.js installed"
else
    log_fail "Node.js not found"
    exit 1
fi

if check_command npm; then
    log_pass "npm installed"
else
    log_fail "npm not found"
    exit 1
fi

# Test 2: Project Structure
log_test "Project Structure"
if [ -d "src/babayaga-server" ]; then
    log_pass "Source directory exists"
else
    log_fail "Source directory missing"
fi

if [ -f "src/babayaga-server/index.ts" ]; then
    log_pass "Main server file exists"
else
    log_fail "Main server file missing"
fi

if [ -f "package.json" ]; then
    log_pass "package.json exists"
else
    log_fail "package.json missing"
fi

# Test 3: TypeScript Compilation
log_test "TypeScript Compilation"
if npx tsc --noEmit; then
    log_pass "TypeScript compiles without errors"
else
    log_fail "TypeScript compilation failed"
fi

# Test 4: Chrome Auto-Start
log_test "Chrome Auto-Start Functionality"
kill_chrome
sleep 2

# Start BabaYaga in background
npm run start:babayaga > babayaga.log 2>&1 &
BABAYAGA_PID=$!
sleep 10

if wait_for_port 9222; then
    log_pass "Chrome started automatically"
    
    # Check Chrome version
    if curl -s http://localhost:9222/json/version | grep -q "Browser"; then
        log_pass "Chrome debugging protocol accessible"
    else
        log_fail "Chrome debugging protocol not responding correctly"
    fi
else
    log_fail "Chrome did not start automatically"
fi

# Test 5: Service Discovery
log_test "Service Discovery"
if grep -q "Connected to service: puppeteer" babayaga.log; then
    log_pass "Puppeteer service connected"
else
    log_fail "Puppeteer service not connected"
fi

if grep -q "Connected to service: cdp" babayaga.log; then
    log_pass "CDP service connected"
else
    log_fail "CDP service not connected"
fi

# Test 6: Tool Registration
log_test "Tool Registration"
if grep -q "Available tools:" babayaga.log; then
    log_pass "Tools registered successfully"
    
    # Check for specific tools
    if grep -q "puppeteer_navigate" babayaga.log; then
        log_pass "Puppeteer tools prefixed correctly"
    else
        log_fail "Puppeteer tool prefixing issue"
    fi
    
    if grep -q "cdp_command" babayaga.log; then
        log_pass "CDP command tool available"
    else
        log_fail "CDP command tool missing"
    fi
    
    if grep -q "visual-regression" babayaga.log; then
        log_pass "Built-in tools registered"
    else
        log_fail "Built-in tools missing"
    fi
    
    if grep -q "chain_full_page_analysis" babayaga.log; then
        log_pass "Chain tools registered"
    else
        log_fail "Chain tools missing"
    fi
else
    log_fail "Tool registration failed"
fi

# Test 7: Directory Creation
log_test "Directory Setup"
if [ -d "./cdp-output" ]; then
    log_pass "cdp-output directory created"
else
    log_fail "cdp-output directory missing"
fi

# Cleanup
kill $BABAYAGA_PID 2>/dev/null || true
kill_chrome

# Test 8: Chrome Already Running
log_test "Chrome Already Running Detection"
npm run chrome > chrome.log 2>&1 &
CHROME_PID=$!
sleep 5

npm run start:babayaga > babayaga2.log 2>&1 &
BABAYAGA_PID=$!
sleep 10

if grep -q "Chrome already running" babayaga2.log; then
    log_pass "Detects existing Chrome instance"
else
    log_fail "Did not detect existing Chrome"
fi

# Cleanup
kill $BABAYAGA_PID 2>/dev/null || true
kill $CHROME_PID 2>/dev/null || true
kill_chrome

# Test 9: Disable Auto-Start
log_test "Disable Chrome Auto-Start"
BABAYAGA_AUTO_START_CHROME=false npm run start:babayaga > babayaga3.log 2>&1 &
BABAYAGA_PID=$!
sleep 5

if ! wait_for_port 9222; then
    log_pass "Chrome auto-start disabled successfully"
else
    log_fail "Chrome started despite being disabled"
fi

# Cleanup
kill $BABAYAGA_PID 2>/dev/null || true

# Test Summary
echo -e "\n===================================="
echo "Test Summary"
echo "===================================="
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo -e "Total: $((PASSED + FAILED))"
echo "===================================="

# Cleanup log files
rm -f babayaga.log babayaga2.log babayaga3.log chrome.log

# Exit with appropriate code
if [ $FAILED -eq 0 ]; then
    echo -e "\n${GREEN}All tests passed! 🎉${NC}"
    exit 0
else
    echo -e "\n${RED}Some tests failed. Please review the output above.${NC}"
    exit 1
fi