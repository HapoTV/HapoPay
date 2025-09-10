# Send Money Functionality Setup Guide

This guide explains how to set up and use the send money functionality between the parent and student dashboards in the Hapo Technology application.

## Features Implemented

### 1. Parent Dashboard
- **Send Money Modal**: A modal dialog that appears when clicking "Send Money" on any child card
- **Dynamic Child Selection**: The modal title shows the selected child's name
- **Amount Input**: Numeric input field for the amount to send
- **Optional Note**: Text field for adding a description (e.g., "Lunch money", "Allowance")
- **Real-time Balance Update**: Child's balance is updated immediately after sending money

### 2. Student Dashboard
- **Recent Activity Section**: Shows the 5 most recent transactions
- **Transaction History**: Complete list of all transactions
- **Real-time Balance Display**: Shows current balance that updates when money is received
- **Transaction Details**: Shows transaction type, amount, description, and timestamp

### 3. Database Integration
- **Transactions Table**: Tracks all money transfers with proper relationships
- **Row Level Security**: Ensures data privacy between families
- **Audit Trail**: Complete history of all financial transactions

## Database Setup

### 1. Run the SQL Script
Execute the `database_setup.sql` file in your Supabase SQL editor to create the necessary tables and policies.

### 2. Required Tables
- `transactions` - Main table for tracking money transfers
- `children` - Child accounts (should already exist)
- `profiles` - User profiles (should already exist)
- `auth.users` - Supabase Auth users (automatically managed)

### 3. Row Level Security Policies
The system includes RLS policies that ensure:
- Parents can only see and manage their own children
- Children can only see their own transaction data
- Data is properly isolated between different families

## How It Works

### 1. Parent Sends Money
1. Parent clicks "Send Money" button on a child's card
2. Modal opens with the child's name in the title
3. Parent enters amount and optional note
4. System updates child's balance in real-time
5. Transaction record is created for audit purposes
6. Parent dashboard refreshes to show updated balance

### 2. Student Receives Money
1. Student's balance is automatically updated
2. Transaction appears in "Recent Activity" section
3. Transaction shows in full "Transaction History"
4. Balance card reflects the new amount immediately

### 3. Transaction Types
- `money_sent` - Standard money transfer from parent
- `wallet_topup` - Wallet top-up (existing functionality)
- `emergency_fund` - Emergency fund transfer (existing functionality)
- `qr_payment` - QR code payments (future functionality)

## File Changes Made

### 1. parentDashboard.html
- Added Send Money modal HTML
- Updated Send Money button functionality
- Added JavaScript functions for modal control
- Integrated with existing child management system

### 2. studentDashboard.html
- Added recent activity loading functionality
- Implemented transaction history display
- Added real-time balance updates
- Integrated with existing profile system

### 3. style.css
- Added styles for activity items
- Responsive design for transaction cards
- Color-coded transaction types (positive/negative)
- Hover effects and visual feedback

## Usage Instructions

### For Parents
1. **Login** to parent dashboard
2. **View Children** in the "Your Children" section
3. **Click "Send Money"** on any child's card
4. **Enter Amount** in the modal
5. **Add Note** (optional) for context
6. **Click "Send Money"** to complete the transfer

### For Students
1. **Login** to student dashboard
2. **View Balance** in the top card
3. **Check Recent Activity** for new transactions
4. **View Full History** in the transaction history section

## Security Features

### 1. Authentication Required
- Both parent and student must be authenticated
- Session validation on all requests

### 2. Data Isolation
- Row Level Security prevents cross-family data access
- Parent can only manage their own children
- Student can only see their own transactions

### 3. Input Validation
- Amount must be positive number
- All inputs are sanitized
- Database constraints prevent invalid data

## Troubleshooting

### Common Issues

1. **Modal Not Opening**
   - Check browser console for JavaScript errors
   - Ensure Supabase client is properly initialized

2. **Balance Not Updating**
   - Verify database connection
   - Check RLS policies are properly set
   - Ensure transaction record was created

3. **Activity Not Showing**
   - Verify transactions table exists
   - Check RLS policies for student access
   - Ensure proper foreign key relationships

### Debug Steps

1. **Check Browser Console** for JavaScript errors
2. **Verify Database Tables** exist and have correct structure
3. **Test RLS Policies** with direct database queries
4. **Check Network Tab** for failed API requests

## Future Enhancements

### Planned Features
- **Push Notifications** when money is received
- **Scheduled Transfers** for recurring payments
- **Transfer Limits** and approval workflows
- **Multi-currency Support** for international families
- **Export Functionality** for financial records

### Integration Opportunities
- **Banking APIs** for direct bank transfers
- **Payment Gateways** for credit card top-ups
- **Analytics Dashboard** for spending insights
- **Mobile App** for on-the-go management

## Support

If you encounter any issues or need assistance:
1. Check the browser console for error messages
2. Verify your Supabase configuration
3. Ensure all database tables and policies are created
4. Test with a simple transaction first

## Technical Notes

- **Real-time Updates**: Uses Supabase's real-time subscriptions for live updates
- **Responsive Design**: Works on all device sizes
- **Accessibility**: Includes proper ARIA labels and keyboard navigation
- **Performance**: Optimized queries with proper indexing
- **Scalability**: Designed to handle multiple families and transactions
