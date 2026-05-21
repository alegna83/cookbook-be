# Email Verification Feature - Test Plan

## Backend Implementation Summary
✅ Complete email verification flow has been implemented with the following features:

### 1. **Database Schema**
- Migration: `2026051700000-AddEmailVerificationColumns.ts`
- New columns in `account` table:
  - `isEmailVerified` (boolean, default: false)
  - `emailVerificationToken` (varchar 255, nullable)
  - `emailVerificationTokenExpiry` (timestamp, nullable)

### 2. **API Endpoints**

#### Registration
```
POST /auth/register
Headers: Content-Type: application/json
Body: {
  "email": "user@example.com",
  "name": "User Name",
  "password": "SecurePass123!",
  "pilgrim_reason": "Spiritual and Religious",
  "pilgrim_reason_other": null
}
Response (201 Created): {
  "account": {
    "id": 1,
    "email": "user@example.com",
    "isEmailVerified": false,
    "emailVerificationToken": "hex_token_here",
    ...
  },
  "message": "Registration successful! Please check your email to verify your account."
}
```
- Account is created with `isEmailVerified = false`
- Verification email is sent via Resend API
- Token expires in 24 hours

#### Email Verification
```
POST /auth/verify-email
Headers: Content-Type: application/json
Body: {"token": "hex_token_from_email"}
Response (200 OK): { ...account with isEmailVerified: true... }
```
- Validates token hasn't expired
- Sets `isEmailVerified = true`
- Clears verification token fields
- Sends welcome email

#### Resend Verification Email
```
POST /auth/resend-verification
Headers: Content-Type: application/json
Body: {"email": "user@example.com"}
Response (200 OK): { "message": "Verification email sent! Please check your email." }
```
- Generates new token (24h expiry)
- Sends verification email again
- Only works if email not already verified

### 3. **Login Validation**
- Login endpoint checks `account.isEmailVerified`
- Returns error if email not verified yet
- Message: "Please verify your email before logging in."

### 4. **Email Service**
- Provider: **Resend** (https://resend.com)
- API Key: Configured in `.env` as `RESEND_API_KEY`
- Email From: `noreply@caminoplaces.com`
- Includes HTML templates with:
  - Verification link with token
  - 24-hour expiry warning
  - Welcome email after verification

### 5. **Frontend Implementation**

#### VerifyEmailScreen
- Route: `/verify-email?token={token}`
- Accepts token from URL query params or widget parameter
- Auto-verifies when mounted
- Shows success/error message
- Button to return to login

#### SignInScreen
- Updated registration to use `/auth/register`
- Shows server message after registration
- Added "Resend verification email" button
- Prompts user to check email

#### CreateAccountPage
- Updated registration to use `/auth/register`
- Handles new response format with `account` and `message`

## Testing Checklist

### Local Testing (without DB connection issues)
- [x] Code compiles without errors (backend & frontend)
- [x] All DTOs created correctly
- [x] Email service instantiated with API key
- [x] Routes configured in AuthController

### Integration Testing (requires DB + Resend API)
- [ ] Register new account → token generated & email sent
- [ ] Verify email with valid token → account marked verified
- [ ] Verify email with expired token → error returned
- [ ] Try login before verification → error: "Please verify your email"
- [ ] Login after verification → success
- [ ] Resend verification → new token generated & email sent

### Frontend Testing
- [ ] Register flow → navigate to login screen
- [ ] Click "Resend verification email" → button works, email sent
- [ ] Click email link → VerifyEmailScreen loads
- [ ] Verification success → message shown

## How to Run Tests

### 1. Run Migrations
```bash
cd cookbook-be
npm run migration:run
# If connection issues, ensure DB is accessible:
# - Check DATABASE_URL in .env
# - Verify Supabase credentials
```

### 2. Start Backend
```bash
npm run start:dev
```

### 3. Test Registration (with curl or Postman)
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "name": "Test User",
    "password": "TestPass123!",
    "pilgrim_reason": "Spiritual and Religious"
  }'
```

### 4. Check Email
- Email should be received from Resend within seconds
- Copy verification link with token

### 5. Test Verification
```bash
curl -X POST http://localhost:3000/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{"token": "token_from_email"}'
```

## Known Issues & Notes
- Resend emails may take 1-5 seconds to be delivered
- In development, ensure `FRONTEND_URL` is set correctly in `.env` for verification links
- Current local dev: `FRONTEND_URL=http://localhost:8000`
- Production: `FRONTEND_URL=https://camino-places-app.web.app/`
- Token is revoked after verification (fields set to null)

## Next Steps
1. Merge `feature/email-verification` branches after testing
2. Implement "Forgot Password" feature (separate branch: `feature/forgot-password`)
3. Add email rate limiting to prevent abuse
4. Consider SMS backup for critical verifications
