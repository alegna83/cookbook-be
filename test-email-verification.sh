#!/bin/bash

# Email Verification API Tests
# This script tests the email verification endpoints

API_URL="http://localhost:3000"
TEST_EMAIL="test.$(date +%s)@example.com"
TEST_NAME="Test User $(date +%s)"

echo "🧪 Starting Email Verification API Tests"
echo "========================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test 1: Registration
echo -e "${BLUE}[TEST 1] Register new account${NC}"
echo "Email: $TEST_EMAIL"
echo ""

REGISTER_RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"name\": \"$TEST_NAME\",
    \"password\": \"TestPass123!\",
    \"pilgrim_reason\": \"Spiritual and Religious\"
  }")

echo "Response:"
echo "$REGISTER_RESPONSE" | jq '.' 2>/dev/null || echo "$REGISTER_RESPONSE"
echo ""

# Extract account ID and token
ACCOUNT_ID=$(echo "$REGISTER_RESPONSE" | jq -r '.account.id' 2>/dev/null)
VERIFICATION_TOKEN=$(echo "$REGISTER_RESPONSE" | jq -r '.account.emailVerificationToken' 2>/dev/null)
IS_VERIFIED=$(echo "$REGISTER_RESPONSE" | jq -r '.account.isEmailVerified' 2>/dev/null)

if [ "$IS_VERIFIED" = "false" ]; then
  echo -e "${GREEN}✓ Account created with isEmailVerified = false${NC}"
else
  echo -e "${RED}✗ Account verification status is incorrect${NC}"
fi

if [ ! -z "$VERIFICATION_TOKEN" ] && [ "$VERIFICATION_TOKEN" != "null" ]; then
  echo -e "${GREEN}✓ Verification token generated${NC}"
else
  echo -e "${RED}✗ No verification token generated${NC}"
fi
echo ""

# Test 2: Try login before verification
echo -e "${BLUE}[TEST 2] Try login before email verification${NC}"
echo ""

LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"TestPass123!\"
  }")

echo "Response:"
echo "$LOGIN_RESPONSE" | jq '.' 2>/dev/null || echo "$LOGIN_RESPONSE"

if echo "$LOGIN_RESPONSE" | grep -q "verify your email"; then
  echo -e "${GREEN}✓ Login blocked until email verified${NC}"
else
  echo -e "${RED}✗ Login should be blocked before verification${NC}"
fi
echo ""

# Test 3: Verify email with token
if [ ! -z "$VERIFICATION_TOKEN" ] && [ "$VERIFICATION_TOKEN" != "null" ]; then
  echo -e "${BLUE}[TEST 3] Verify email with token${NC}"
  echo "Token: $VERIFICATION_TOKEN"
  echo ""

  VERIFY_RESPONSE=$(curl -s -X POST "$API_URL/auth/verify-email" \
    -H "Content-Type: application/json" \
    -d "{\"token\": \"$VERIFICATION_TOKEN\"}")

  echo "Response:"
  echo "$VERIFY_RESPONSE" | jq '.' 2>/dev/null || echo "$VERIFY_RESPONSE"

  IS_VERIFIED_AFTER=$(echo "$VERIFY_RESPONSE" | jq -r '.isEmailVerified' 2>/dev/null)
  if [ "$IS_VERIFIED_AFTER" = "true" ]; then
    echo -e "${GREEN}✓ Email verified successfully${NC}"
  else
    echo -e "${RED}✗ Email verification failed${NC}"
  fi
  echo ""

  # Test 4: Login after verification
  echo -e "${BLUE}[TEST 4] Try login after email verification${NC}"
  echo ""

  LOGIN_AFTER=$(curl -s -X POST "$API_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d "{
      \"email\": \"$TEST_EMAIL\",
      \"password\": \"TestPass123!\"
    }")

  echo "Response:"
  echo "$LOGIN_AFTER" | jq '.' 2>/dev/null || echo "$LOGIN_AFTER"

  if echo "$LOGIN_AFTER" | grep -q "access_token\|\.id"; then
    echo -e "${GREEN}✓ Login successful after verification${NC}"
  else
    echo -e "${RED}✗ Login failed after verification${NC}"
  fi
fi

echo ""
echo -e "${BLUE}========================================"
echo "🧪 Tests Complete${NC}"
