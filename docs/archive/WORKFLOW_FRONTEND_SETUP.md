# Workflow Frontend Setup

## ✅ What Was Added

### 1. Sidebar Navigation Item

**File**: [apps/web/src/app/(dashboard)/layout.tsx](apps/web/src/app/(dashboard)/layout.tsx#L85-L101)

Added new navigation item between "Meta" and "Settings":

```tsx
{
  href: '/workflows',
  label: 'Workflows',
  description: 'Automated data sync',
  icon: (
    <svg className={iconClasses} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 7h16M4 12h16M4 17h16"
      />
      <circle cx="7" cy="7" r="1.5" fill="currentColor" />
      <circle cx="7" cy="12" r="1.5" fill="currentColor" />
      <circle cx="7" cy="17" r="1.5" fill="currentColor" />
    </svg>
  ),
}
```

### 2. Workflows List Page

**File**: [apps/web/src/app/workflows/page.tsx](apps/web/src/app/workflows/page.tsx)

Created the main workflows page with:
- **Workflows list** with status badges (Enabled, Disabled, Manual)
- **Empty state** with "Create Workflow" prompt
- **View Details** button for each workflow
- **Run Now** button for manual triggers
- **Status indicators**: 🟢 Green (Enabled), 🔵 Blue (Manual), ⚫ Gray (Disabled)
- **Date range labels** showing configuration at a glance
- **Meta/POS enabled status** for quick reference

## 📍 Where to Find It

Once the frontend is running:

1. Navigate to: **http://localhost:3000/workflows**
2. Or click **"Workflows"** in the sidebar (below "Meta")

## 🎨 UI Features

### Status Badges
- **🟢 Enabled** (green) - Workflow is active and scheduled
- **🔵 Manual** (blue) - Workflow is enabled but manual-only
- **⚫ Disabled** (gray) - Workflow is not running

### Workflow Cards Display:
- Workflow name and description
- Status badge
- Schedule (cron expression or "Manual only")
- Meta Ads enabled/disabled status
- POS enabled/disabled status
- Date range type and configuration
- Action buttons (View Details, Run Now)

### Empty State
When no workflows exist, shows:
- Icon placeholder
- "No workflows yet" message
- "Create Workflow" call-to-action button

## 🔌 API Integration

The page connects to your backend API:
- **Endpoint**: `GET http://localhost:3001/api/workflows`
- **Auth**: Uses `access_token` from localStorage
- **Tenant**: Uses `current_tenant_id` from localStorage

## 📦 Next Steps

To complete the frontend workflow system, you'll need to create additional pages:

### Immediate Next Pages:
1. **Create Workflow** (`/workflows/new`) - Step-by-step form
2. **Workflow Detail** (`/workflows/[id]`) - View config and recent executions
3. **Trigger Modal** (`/workflows/[id]/trigger`) - Manual trigger with optional date override
4. **Execution History** (`/workflows/[id]/executions`) - List all runs
5. **Execution Detail** (`/workflows/[id]/executions/[executionId]`) - Real-time progress

### Components Needed:
- `WorkflowForm` - Multi-step workflow creation
- `DateRangePicker` - Date range configuration
- `CronEditor` - Cron expression builder with presets
- `ExecutionTimeline` - Show execution progress
- `StatusBadge` - Reusable status indicators
- `ProgressBar` - Visual progress for executions

## 🎯 Current Status

✅ **Completed**:
- Sidebar navigation item added
- Workflows list page created
- API integration set up
- Status badges implemented
- Empty state designed

⏳ **To Do**:
- Create workflow form (multi-step)
- Workflow detail page
- Execution monitoring pages
- Real-time updates (WebSocket/polling)
- Notification system

## 🚀 How to Test

1. Start the API backend:
   ```bash
   cd apps/api
   npm run start:dev
   ```

2. Start the web frontend:
   ```bash
   cd apps/web
   npm run dev
   ```

3. Navigate to http://localhost:3000/workflows

4. Login with your credentials

5. You should see:
   - "Workflows" in the sidebar
   - The workflows list page (empty or with existing workflows)

## 📝 Code Structure

```
apps/web/src/app/
├── (dashboard)/
│   └── layout.tsx          # ✅ Updated: Added Workflows nav item
└── workflows/
    └── page.tsx            # ✅ Created: Workflows list page
```

## 🎨 Design System

The page follows your existing design system:
- **Colors**: Indigo primary, Slate neutrals
- **Typography**: Consistent font sizes and weights
- **Spacing**: 4px grid system
- **Borders**: Rounded corners with subtle shadows
- **Buttons**: Primary (indigo) and secondary (white with border)
- **Cards**: White background with slate border

## 💡 Tips

1. **Testing without data**: The page shows an empty state when no workflows exist
2. **Creating workflows**: Click "Create Workflow" (will need to build the form page)
3. **API errors**: Displayed with red alert banner
4. **Loading state**: Shows spinner while fetching

---

**Status**: ✅ Workflows navigation and list page ready!
**Next Step**: Create the workflow form page (`/workflows/new`)
