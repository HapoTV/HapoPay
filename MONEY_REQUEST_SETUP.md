# Money Request Functionality Setup Guide

## Overview
This feature allows students to request money from their parents through a modal form. Parents receive notifications and can approve or decline these requests. When approved, the money is automatically added to the student's wallet and recorded as a transaction.

## Features Implemented

### Student Dashboard
- ✅ **Request Money Button**: Green action card in Quick Actions section
- ✅ **Money Request Modal**: Form with amount and reason fields
- ✅ **Form Validation**: Ensures valid amount input
- ✅ **Database Integration**: Stores requests in `money_requests` table

### Parent Dashboard
- ✅ **Money Request Notifications**: New section showing pending requests
- ✅ **Approve/Decline Actions**: Buttons for each request
- ✅ **Automatic Balance Update**: When approved, money is added to child's wallet
- ✅ **Transaction Recording**: Creates transaction record when approved
- ✅ **Real-time Updates**: Refreshes both requests and children list

## Database Setup

### 1. Run the SQL Script
Execute the `money_requests_setup.sql` file in your Supabase SQL editor:

```sql
-- This will create:
-- 1. money_requests table
-- 2. Proper indexes for performance
-- 3. Row Level Security (RLS) policies
-- 4. Triggers for updated_at timestamps
-- 5. Necessary permissions
```

### 2. Table Structure
```sql
money_requests (
    id UUID PRIMARY KEY,
    child_id UUID REFERENCES children(id),
    amount DECIMAL(10,2) NOT NULL,
    reason TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    parent_response TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
)
```

### 3. RLS Policies
- **Parents**: Can view and update requests for their children
- **Children**: Can view and create their own requests
- **Security**: Ensures data isolation between families

## How It Works

### Student Request Flow
1. **Click Request Money**: Student clicks the green "Request Money" button
2. **Fill Form**: Enters amount and optional reason
3. **Submit**: Request is saved to database with 'pending' status
4. **Confirmation**: Student sees success message

### Parent Approval Flow
1. **Notification**: Request appears in "Money Request Notifications" section
2. **Review**: Parent sees child name, amount, reason, and date
3. **Action**: Parent clicks "Approve" or "Decline"
4. **Processing**: 
   - **Approve**: Money added to child's wallet, transaction recorded
   - **Decline**: Request marked as declined with parent response
5. **Update**: Both sections refresh to show current state

## File Changes Made

### studentDashboard.html
- ✅ Added money request modal HTML
- ✅ Updated `showRequestMoney()` function
- ✅ Added `closeMoneyRequestModal()` function
- ✅ Added `submitMoneyRequest()` function

### parentDashboard.html
- ✅ Added money request notifications section
- ✅ Added `loadMoneyRequests()` function
- ✅ Added `renderMoneyRequest()` function
- ✅ Added `approveMoneyRequest()` function
- ✅ Added `declineMoneyRequest()` function
- ✅ Integrated with dashboard initialization

### style.css
- ✅ Added modal styles (`.modal`, `.modal-content`, etc.)
- ✅ Added form field styles (`.field`, `.input`, etc.)
- ✅ Added money request styles (`.money-request-item`, etc.)
- ✅ Added button styles for approve/decline actions

### money_requests_setup.sql
- ✅ Complete database setup script
- ✅ Table creation with proper constraints
- ✅ RLS policies for security
- ✅ Indexes for performance

## Usage Instructions

### For Students
1. **Navigate to Quick Actions** section
2. **Click "Request Money"** (green button)
3. **Enter amount** (required, must be positive)
4. **Add reason** (optional but recommended)
5. **Click "Send Request"**
6. **Wait for parent response**

### For Parents
1. **Check "Money Request Notifications"** section
2. **Review request details**:
   - Child name
   - Amount requested
   - Reason provided
   - Date/time of request
3. **Take action**:
   - **Approve**: Money is added to child's wallet
   - **Decline**: Request is marked as declined
4. **Monitor updates**: Both sections refresh automatically

## Security Features

### Row Level Security (RLS)
- **Parent Isolation**: Parents only see requests from their children
- **Child Isolation**: Children only see their own requests
- **Authentication Required**: All operations require valid user session

### Data Validation
- **Amount Validation**: Must be positive decimal number
- **Status Constraints**: Only valid statuses allowed
- **Foreign Key Constraints**: Ensures data integrity

## Troubleshooting

### Common Issues

#### 1. "Error sending request"
- **Cause**: Database connection or permission issue
- **Solution**: Check Supabase connection and run SQL setup script

#### 2. "No pending money requests" shown
- **Cause**: No requests exist or RLS policy blocking access
- **Solution**: Verify RLS policies are correctly applied

#### 3. Modal not appearing
- **Cause**: CSS or JavaScript error
- **Solution**: Check browser console for errors

#### 4. Approve/Decline not working
- **Cause**: Database permission or constraint issue
- **Solution**: Verify user has proper permissions

### Debug Steps
1. **Check Browser Console** for JavaScript errors
2. **Verify Database Tables** exist and have correct structure
3. **Test RLS Policies** with direct database queries
4. **Check User Authentication** status

## Future Enhancements

### Planned Features
- **Email Notifications**: Alert parents via email
- **Push Notifications**: Real-time mobile alerts
- **Request History**: Track all requests (approved/declined)
- **Auto-approval**: Rules for automatic approval
- **Request Limits**: Daily/weekly request limits
- **Parent Comments**: Allow parents to add notes

### Technical Improvements
- **Real-time Updates**: WebSocket integration
- **Request Templates**: Pre-defined reason options
- **Bulk Actions**: Approve/decline multiple requests
- **Advanced Filtering**: Filter by date, amount, status

## Support

If you encounter issues:
1. **Check this guide** for common solutions
2. **Verify database setup** is complete
3. **Test with simple requests** first
4. **Check browser console** for error messages
5. **Verify user permissions** in Supabase

## Version History
- **v1.0**: Initial implementation with basic request/approval flow
- **Future**: Enhanced notifications, history tracking, and automation
