# Fix 403 Forbidden Error - RIGHT NOW

## The Problem
You're getting `403 Forbidden` when updating roles because your user lacks the `permission.assign` permission.

## The Solution (3 Steps)

### Step 1: Open Your Database Tool
- Open Prisma Studio: `cd apps/api && npx prisma studio`
- OR connect to PostgreSQL directly

### Step 2: Find Your User Email
Look in the browser console or check who you're logged in as.

### Step 3: Run This SQL Query

**Replace `your@email.com` with your actual email:**

```sql
UPDATE users
SET role = 'SUPER_ADMIN'
WHERE email = 'your@email.com';
```

**Example:**
```sql
-- If your email is admin@example.com
UPDATE users
SET role = 'SUPER_ADMIN'
WHERE email = 'admin@example.com';
```

### Step 4: Logout and Login Again

1. **Logout** from the web app
2. **Login** again with the same credentials
3. **Try updating the role** - should work now!

---

## Why This Works

The `SUPER_ADMIN` role bypasses all permission checks. Once you login again, your JWT token will include this role and allow you to update roles.

## Alternative: Check What Email You're Using

If you're not sure what email you're logged in with:

1. Open browser DevTools (F12)
2. Go to Application tab → Local Storage
3. Look for your auth token
4. Or check Network tab → look at API requests → Headers → Authorization

OR run this SQL to see all users:

```sql
SELECT id, email, role, "tenantId", "createdAt"
FROM users
ORDER BY "createdAt" DESC;
```

Then pick your email and run the UPDATE query above.

---

## Still Not Working?

### Check 1: Did you logout/login?
The old JWT token is still cached. You MUST logout and login to get a new token with SUPER_ADMIN role.

### Check 2: Clear browser cache
Sometimes the old token is stuck:
1. Clear browser cache
2. Close all tabs
3. Open new tab and login

### Check 3: Verify the update worked
```sql
SELECT email, role FROM users WHERE email = 'your@email.com';
```
Should show `role: SUPER_ADMIN`

### Check 4: Check your JWT token
After login, copy your access token and paste it here: https://jwt.io

Look for:
```json
{
  "userId": "...",
  "tenantId": "...",
  "role": "SUPER_ADMIN"  // Should be SUPER_ADMIN now
}
```

---

## Quick Video Guide

**If you have Prisma Studio:**

1. Run: `cd apps/api && npx prisma studio`
2. Wait for browser to open (http://localhost:5555)
3. Click on `users` table
4. Find your user row
5. Click on the `role` field
6. Change from `ADMIN` to `SUPER_ADMIN`
7. Click Save (green checkmark)
8. Logout from web app and login again

**Done!**

---

## TL;DR

```bash
# 1. Open database
cd apps/api && npx prisma studio

# 2. In SQL or Prisma Studio, run:
# UPDATE users SET role = 'SUPER_ADMIN' WHERE email = 'YOUR_EMAIL';

# 3. Logout from web app

# 4. Login again

# 5. Try updating role - should work now!
```
