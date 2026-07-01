# Resend Email Configuration

## Current Status

The backend uses **Resend** (https://resend.com) to send verification emails during registration and email verification flows.

## Recommended Setup

Keep Resend as the provider and verify your own domain. This is the supported path for production and for sending to Gmail, Hotmail, Outlook, and other providers.

Set:

```env
EMAIL_PROVIDER=resend
RESEND_FROM_EMAIL=Camino Places <noreply@your-verified-domain.com>
```

## Problem: Testing Mode Restrictions

The current Resend account is in **testing mode**, which restricts email sending:

- ✅ **Can send to**: The verified email address in your Resend account (`angelalopesantunes@gmail.com`)
- ❌ **Cannot send to**: Any other email addresses

### Error Message
```
You can only send testing emails to your own email address (angelalopesantunes@gmail.com). 
To send emails to other recipients, please verify a domain at resend.com/domains, 
and change the `from` address to an email using this domain.
```

## Solutions

### Option 1: Development Bypass - Test with ANY Email (QUICKEST FOR TESTING) ⚡

For development, auto-verify emails without Resend restrictions.

**Setup** (`.env`):
```
NODE_ENV=development
BYPASS_EMAIL_VERIFICATION=true
```

**Result**:
- ✅ Register with **any email** (test@example.com, user2@any.com, etc.)
- ✅ Emails auto-verified on registration
- ✅ Users login immediately (no email verification flow)
- ✅ No Resend API calls
- ✅ Perfect for QA/testing

**Logs** (you'll see):
```
🔧 DEVELOPMENT MODE: Email verification bypassed.
🔧 DEV BYPASS: Account email auto-verified (isEmailVerified=true)
```

### Option 2: Production Email - Use Verified Email (LIMITED)

Test with **`angelalopesantunes@gmail.com`** only:

1. Set `.env`:
  ```
  BYPASS_EMAIL_VERIFICATION=false
  ```
2. Register/login with `angelalopesantunes@gmail.com`
3. Resend will send the verification email

**Pros**: Real email sending  
**Cons**: Only one test email address

### Option 3: Add a Domain to Resend (RECOMMENDED FOR PRODUCTION)

To support multiple email addresses in any environment:

1. Go to https://resend.com/domains
2. Click **"Add Domain"** and follow the steps (DNS verification)
3. Once verified, you'll get a domain-based email like `noreply@yourdomain.com`
4. Update your `.env` with:
   ```
   RESEND_FROM_EMAIL=Camino Places <noreply@yourdomain.com>
  5. Set `.env`:
    ```
    BYPASS_EMAIL_VERIFICATION=false
    ```
  6. Restart the backend server

  ## What This Means for Recipients

  Once the domain is verified and `RESEND_FROM_EMAIL` uses that domain, you can send verification emails to:

  - Gmail addresses
  - Hotmail / Outlook addresses
  - Yahoo addresses
  - Custom company domains

  The recipient domain does not matter; what matters is that the **sender domain** is verified in Resend.

  ## Quick Start for Testing Multiple Users

  **Best for QA/Dev**: Use Option 1 (Development Bypass)

  ```bash
  # 1. Edit .env
  BYPASS_EMAIL_VERIFICATION=true

  # 2. Restart backend
  npm run start:dev

  # 3. Register with different emails:
  # - testuser1@example.com (auto-verified ✅)
  # - testuser2@company.com (auto-verified ✅)
  # - admin@test.co (auto-verified ✅)

  # 4. Login immediately without waiting for emails
  ```
   ```
5. Restart the backend server

**Pros**: Unlimited email recipients, professional setup  
**Cons**: Requires DNS configuration, small setup time

### Option 3: Upgrade Resend Plan (ALTERNATIVE)

Some Resend plans may have more testing allowances. Check your plan at https://resend.com/account/settings.

## Current Configuration

**File**: `.env`

```
RESEND_API_KEY=re_4RHHLZKR_4x1XnY1bC5vr6WgxZ5G8qkxK
RESEND_FROM_EMAIL=Camino Places <onboarding@resend.dev>
```

**Where emails are sent**:
- File: `src/auth/email.service.ts`
- Called by:
  - `accounts.register()` — sends verification email after sign-up
  - `accounts.resendVerificationEmail()` — resends verification email if the link expires
  - `accounts.resetPassword()` — sends password reset email

## Testing Workflow

### For Login with Verification

1. **Register** with email ✅ `angelalopesantunes@gmail.com`
2. Check email inbox for verification link (or resend from login dialog)
3. Click link to verify
4. Login should now work

### For Other Testing Emails

Only possible after completing **Option 2** (Domain verification).

## Production Checklist

Before deploying to production:

- [ ] Verify a production domain in Resend
- [ ] Update `RESEND_FROM_EMAIL` to use production domain email
- [ ] Ensure `RESEND_API_KEY` is set via environment variables (not hardcoded)
- [ ] Test email flow with multiple test accounts
- [ ] Monitor Resend dashboard for delivery reports

## Support

- Resend Docs: https://resend.com/docs
- Resend Support: https://resend.com/support
