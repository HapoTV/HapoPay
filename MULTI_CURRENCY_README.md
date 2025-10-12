# HapoPay Multi-Currency Implementation

## Overview

This document provides a comprehensive guide to the multi-currency functionality implemented in the HapoPay parent-child money transfer system. The implementation includes automatic currency assignment based on phone number prefixes, currency override options for child accounts, and a complete multi-currency wallet system.

## Features Implemented

### 🌍 Automatic Currency Detection
- **Phone-based Currency Assignment**: Parents are automatically assigned a default currency based on their phone number country code
- **Supported Countries**: South Africa (ZAR) and United States (USD)
- **Fallback Currency**: USD is used as the default when no mapping exists

### 💰 Multi-Currency Wallets
- **Separate Currency Wallets**: Each child can have multiple currency wallets
- **Primary Wallet**: One wallet per child is designated as primary for the main currency
- **Currency Override**: Parents can set a different currency for child accounts (useful for children studying abroad)
- **Balance Tracking**: Accurate balance management per currency with 4 decimal precision

### 🔄 Currency-Aware Transactions
- **Multi-Currency Transfers**: Support for money transfers in different currencies
- **Transaction History**: All transactions include currency information
- **Emergency Requests**: Emergency fund requests support multiple currencies
- **Recurring Payments**: Scheduled payments can be set in specific currencies

## Database Schema

### New Tables

#### `currencies`
```sql
- code VARCHAR(3) PRIMARY KEY          -- Currency code (USD, ZAR, etc.)
- name VARCHAR(100)                    -- Full currency name
- symbol VARCHAR(10)                   -- Currency symbol ($, R, £, etc.)
- decimal_places INTEGER DEFAULT 2     -- Number of decimal places
- is_active BOOLEAN DEFAULT true       -- Whether currency is active
```

#### `country_currency_mapping`
```sql
- country_code VARCHAR(2) PRIMARY KEY  -- ISO country code (ZA, US, etc.)
- country_name VARCHAR(100)            -- Full country name
- phone_prefix VARCHAR(10)             -- Phone prefix (+27, +1, etc.)
- currency_code VARCHAR(3)             -- Default currency for country
- is_default BOOLEAN                   -- Primary mapping flag
```

#### `multi_currency_wallets`
```sql
- id UUID PRIMARY KEY                  -- Wallet ID
- child_id UUID                        -- Reference to child
- currency_code VARCHAR(3)             -- Wallet currency
- balance DECIMAL(15,4)                -- Wallet balance (4 decimal precision)
- is_primary BOOLEAN                   -- Primary wallet flag
- created_at TIMESTAMP                 -- Creation timestamp
- updated_at TIMESTAMP                 -- Last update timestamp
```

### Modified Tables

#### `profiles` (Enhanced)
- `default_currency VARCHAR(3)` - Parent's default currency
- `phone_country_code VARCHAR(2)` - Phone number country code
- `phone_number VARCHAR(20)` - Phone number

#### `children` (Enhanced)
- `currency_code VARCHAR(3)` - Child's primary currency
- `currency_override BOOLEAN` - Whether currency differs from parent

#### Transaction Tables (Enhanced)
All transaction-related tables now include:
- `currency_code VARCHAR(3)` - Transaction currency

## Database Functions

### `get_currency_from_phone(country_code)`
Returns the default currency for a given country code.

```sql
SELECT get_currency_from_phone('ZA'); -- Returns 'ZAR'
```

### `create_default_wallet(child_id, currency_code)`
Creates a primary wallet for a child in the specified currency.

### `update_wallet_balance(child_id, currency_code, amount, operation)`
Updates wallet balance with add/subtract operations. Returns false if insufficient funds.

## Frontend Implementation

### Parent Signup Form (`signup.html`)
- **Currency Selection Dropdown**: Auto-populated with supported currencies
- **Auto-Selection Logic**: Currency automatically selected based on phone country code
- **Manual Override**: Parents can manually change the selected currency
- **Visual Feedback**: Currency note explains the auto-selection

### Parent Dashboard (`parentDashboard.html`)
- **Child Currency Selection**: Currency dropdown in "Add Child" modal (limited to ZAR and USD)
- **Currency Symbols**: Display appropriate currency symbols (R and $)
- **Override Indication**: Visual badge when child uses different currency than parent
- **Multi-Currency Balance Display**: Show balances with correct currency symbols

### JavaScript Enhancements

#### `script.js`
- Enhanced signup form handling with currency metadata
- `updateCurrencyFromPhone()` function for auto-selection
- User profile handling with currency information

#### `multi-currency-dashboard.js`
- Currency symbol mapping and display logic
- Enhanced child account creation with currency support
- Multi-currency money transfer functions
- Wallet balance management with currency awareness

### CSS Styling (`style.css`)
- Currency selection styling
- Currency symbol positioning
- Phone number and country code layout
- Currency note styling with icons

## Setup Instructions

### 1. Database Setup

Run the consolidated database setup script:

```bash
# Execute the main database setup
psql -d your_database -f consolidated_database_setup.sql
```

The script includes:
- All existing HapoPay tables and functions
- Multi-currency tables and relationships
- Currency data population
- RLS policies for security
- Migration of existing data

### 2. Frontend Files

Ensure these files are properly linked:

```html
<!-- In parentDashboard.html -->
<script src="multi-currency-dashboard.js"></script>
```

### 3. Configuration

Update your `config.js` with any additional currency-related settings if needed.

### 4. Testing

Test the multi-currency functionality by:
- Creating new parent accounts with different currencies
- Verifying currency symbols display correctly in the dashboard
- Testing child account creation with currency inheritance
- Confirming money transfers work in the selected currencies

## Usage Examples

### Parent Signup with Auto-Currency
1. Parent selects country code (+27 for South Africa)
2. Currency automatically changes to ZAR
3. Parent can override to different currency if needed
4. Profile created with selected currency as default

### Child Account with Currency Override
1. Parent creates child account
2. Child currency defaults to parent's currency (ZAR)
3. Parent can override to USD for child studying abroad
4. Multi-currency wallet created automatically
5. Currency override flag set to true

### Multi-Currency Money Transfer
1. Parent sends money to child
2. Amount transferred in child's primary currency
3. Transaction recorded with currency information
4. Child's wallet balance updated in correct currency
5. Parent activity logged with currency details

## Currency Support

### Supported Currencies

HapoPay now supports only the following currencies:

| Code | Name | Symbol | Country/Region |
|------|------|--------|----------------|
| ZAR | South African Rand | R | South Africa |
| USD | United States Dollar | $ | United States |

### Adding New Currencies

To add support for new currencies:

1. **Add Currency Definition**:
```sql
INSERT INTO currencies (code, name, symbol, decimal_places, is_active) 
VALUES ('JPY', 'Japanese Yen', '¥', 0, true);
```

2. **Add Country Mapping**:
```sql
INSERT INTO country_currency_mapping (country_code, country_name, phone_prefix, currency_code, is_default) 
VALUES ('JP', 'Japan', '+81', 'JPY', true);
```

3. **Update Frontend**:
Currently, the frontend is intentionally limited to ZAR and USD. Extending support requires updating the currency maps and UI dropdowns accordingly.

4. **Update Signup Form**:
```html
<!-- Add option to currency dropdown in signup.html -->
<option value="JPY" data-currency="JPY">🇯🇵 Japan (+81)</option>
```

## Security Considerations

### Row Level Security (RLS)
- **Currency Tables**: Public read access for currency information
- **Wallets**: Parents can only access their children's wallets
- **Students**: Can only view their own wallet information
- **Transactions**: Currency information follows existing RLS policies

### Data Validation
- Currency codes validated against supported currencies table
- Wallet operations include balance validation
- Phone number to currency mapping prevents invalid assignments

## Performance Optimizations

### Database Indexes
- `idx_multi_currency_wallets_child_id`: Fast wallet lookups by child
- `idx_multi_currency_wallets_currency`: Currency-based queries
- `idx_multi_currency_wallets_primary`: Primary wallet identification

### Caching Considerations
- Currency symbols cached in frontend JavaScript
- Country-currency mappings loaded once on page load
- Wallet balances refreshed on transaction completion

## Migration Notes

### Existing Data
- All existing profiles default to USD currency
- Existing children inherit USD currency
- Primary wallets created for all existing children
- Transaction history maintains backward compatibility

### Rollback Plan
If needed, the multi-currency features can be rolled back:
1. Remove currency columns from existing tables
2. Drop multi-currency specific tables
3. Remove currency-related functions
4. Revert frontend changes

## Troubleshooting

### Common Issues

#### Currency Not Auto-Selecting
- Check if country code exists in `country_currency_mapping`
- Verify JavaScript function `updateCurrencyFromPhone()` is loaded
- Ensure currency dropdown has correct `data-currency` attributes

#### Wallet Creation Failures
- Verify child has valid currency_code
- Check if `create_default_wallet` function exists
- Ensure RLS policies allow wallet creation

#### Balance Update Issues
- Confirm `update_wallet_balance` function is accessible
- Check for sufficient balance in subtract operations
- Verify currency_code matches existing wallet

### Debug Queries

```sql
-- Check currency setup
SELECT * FROM currencies WHERE is_active = true;

-- Verify country mappings
SELECT * FROM country_currency_mapping;

-- Check child wallets
SELECT c.first_name, c.surname, c.currency_code, w.balance, w.is_primary
FROM children c
JOIN multi_currency_wallets w ON c.id = w.child_id;

-- Transaction currency distribution
SELECT currency_code, COUNT(*) as transaction_count
FROM transactions
GROUP BY currency_code;
```

## Future Enhancements

### Planned Features
- **Currency Conversion**: Real-time exchange rate integration
- **Multi-Currency Reports**: Enhanced reporting with currency breakdown
- **Currency Limits**: Set spending limits per currency
- **Exchange Rate History**: Track historical exchange rates for transactions

### API Integration Opportunities
- **Exchange Rate APIs**: Integrate with services like Fixer.io or CurrencyAPI
- **Bank Integration**: Connect with multi-currency bank accounts
- **Payment Processors**: Support for multi-currency payment gateways

## Support

For issues related to multi-currency functionality:
1. Review database logs for constraint violations
2. Verify frontend console for JavaScript errors
3. Ensure all required files are properly linked
4. Test currency display by creating new parent accounts with different currencies

## Conclusion

The multi-currency implementation provides a robust foundation for international money transfers within the HapoPay system. The automatic currency detection, combined with manual override capabilities, offers flexibility for families with diverse geographic needs while maintaining data integrity and security.

The system is designed to be easily extensible for additional currencies and can integrate with external exchange rate services for future currency conversion features.
