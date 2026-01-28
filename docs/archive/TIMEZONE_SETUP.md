# Timezone Configuration - Asia/Manila (Philippine Time)

## Overview
The ERP system is configured to use **Asia/Manila** timezone (Philippine Time, UTC+8) across all applications.

## Configuration Files

### 1. Environment Variables
**File:** `apps/web/.env.local`
```env
TZ=Asia/Manila
NEXT_PUBLIC_TIMEZONE=Asia/Manila
```

### 2. Next.js Configuration
**File:** `apps/web/next.config.js`
- Sets `TZ` and `NEXT_PUBLIC_TIMEZONE` environment variables
- Ensures server-side rendering uses Manila timezone

### 3. Package Scripts
**File:** `apps/web/package.json`
- All npm scripts (`dev`, `build`, `start`) now run with `TZ=Asia/Manila`

### 4. Timezone Utility Library
**File:** `apps/web/src/lib/timezone.ts`

Provides helper functions:
- `getNow()` - Get current date/time in Manila timezone
- `getToday()` - Get today's date at midnight (Manila time)
- `toManilaTime(date)` - Convert any date to Manila timezone
- `formatManilaDate(date, options)` - Format dates in Manila timezone
- `isFuture(date)` - Check if date is in the future (Manila time)
- `isToday(date)` - Check if date is today (Manila time)

## Usage Examples

### In React Components
```typescript
import { getToday, getNow, formatManilaDate } from '@/lib/timezone';

// Get today at midnight (Manila time)
const today = getToday();

// Get current time (Manila)
const now = getNow();

// Format a date
const formatted = formatManilaDate(new Date(), {
  dateStyle: 'full',
  timeStyle: 'short'
});
```

### Date Validation
The COGS entry form now validates dates using Manila timezone:
- Future date checks use `getToday()` instead of `new Date()`
- All date comparisons are timezone-aware

## Docker Configuration (Production)

For Docker deployments, add to your Dockerfile:
```dockerfile
ENV TZ=Asia/Manila
RUN ln -snf /usr/share/zoneinfo/Asia/Manila /etc/localtime
```

## API Server Configuration

For the API server (`apps/api`), ensure timezone is set:
```javascript
// Set at the top of your main server file
process.env.TZ = 'Asia/Manila';
```

## Database Considerations

- Store all timestamps in UTC in the database
- Convert to Manila time only for display/validation
- Use the timezone utilities for client-side operations

## Testing

To verify timezone is working:
```bash
# In the terminal
node -e "console.log(new Date().toString())"
# Should show: ... (Philippine Standard Time)

# Or check in Node.js/browser console
console.log(Intl.DateTimeFormat().resolvedOptions().timeZone);
```

## Important Notes

1. **Server vs Client**: Server renders in Manila time, ensure client hydration matches
2. **Date Inputs**: The datepicker component works with local dates
3. **API Calls**: Format dates as ISO strings when sending to API
4. **Validation**: All date validations now use Manila timezone helpers

## Restart Required

After changing timezone configuration, restart your development server:
```bash
npm run dev
```
