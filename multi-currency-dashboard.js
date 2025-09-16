// Multi-Currency Dashboard Functions
// This file contains JavaScript functions for handling multi-currency functionality in the parent dashboard

// Currency symbol mapping
const CURRENCY_SYMBOLS = {
  'USD': '$',
  'ZAR': 'R',
  'GBP': '£',
  'EUR': '€',
  'NGN': '₦',
  'KES': 'KSh',
  'INR': '₹',
  'CAD': 'C$',
  'AUD': 'A$',
  'JPY': '¥',
  'CNY': '¥',
  'BRL': 'R$',
  'MXN': '$',
  'ARS': '$',
  'CLP': '$',
  'COP': '$',
  'PEN': 'S/'
};

// Initialize multi-currency functionality when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  // Load currency settings first before initializing
  await loadParentCurrencySettings();
  initializeMultiCurrency();
  
  // Apply currency immediately after loading
  if (parentDefaultCurrency) {
    const symbol = CURRENCY_SYMBOLS[parentDefaultCurrency] || '$';
    updateDashboardCurrency(parentDefaultCurrency);
    updateAllCurrencyDisplays(parentDefaultCurrency, symbol);
  }
});

// Initialize multi-currency features
function initializeMultiCurrency() {
  // Set up currency change listeners
  const childCurrencySelect = document.getElementById('childCurrency');
  if (childCurrencySelect) {
    childCurrencySelect.addEventListener('change', updateChildCurrencySymbols);
    // Set default currency to parent's currency
    setDefaultChildCurrency();
  }
}

// Set default child currency to parent's currency
async function setDefaultChildCurrency() {
  try {
    const supabase = createClient();
    if (!supabase) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get parent's profile to get default currency
    const { data: profile } = await supabase
      .from('profiles')
      .select('default_currency')
      .eq('id', user.id)
      .single();

    if (profile?.default_currency) {
      const childCurrencySelect = document.getElementById('childCurrency');
      if (childCurrencySelect) {
        childCurrencySelect.value = profile.default_currency;
        updateChildCurrencySymbols();
      }
    }
  } catch (error) {
    console.error('Error setting default child currency:', error);
  }
}

// Update currency symbols when child currency changes
function updateChildCurrencySymbols() {
  const childCurrencySelect = document.getElementById('childCurrency');
  const weeklyLimitSymbol = document.getElementById('weeklyLimitSymbol');
  const dailyLimitSymbol = document.getElementById('dailyLimitSymbol');
  const childCurrencyNote = document.getElementById('childCurrencyNote');

  if (!childCurrencySelect) return;

  const selectedCurrency = childCurrencySelect.value;
  const symbol = CURRENCY_SYMBOLS[selectedCurrency] || '$';

  if (weeklyLimitSymbol) weeklyLimitSymbol.textContent = symbol;
  if (dailyLimitSymbol) dailyLimitSymbol.textContent = symbol;

  // Update note based on whether currency is different from parent's
  if (childCurrencyNote) {
    if (selectedCurrency && selectedCurrency !== getParentDefaultCurrency()) {
      childCurrencyNote.innerHTML = `<i class="fas fa-globe"></i> Different currency selected. Useful for children studying abroad or traveling.`;
    } else {
      childCurrencyNote.innerHTML = `<i class="fas fa-info-circle"></i> Using same currency as parent account.`;
    }
  }
}

// Global variable to store parent's default currency
let parentDefaultCurrency = 'ZAR';

// Load parent's currency settings and update dashboard
async function loadParentCurrencySettings() {
  try {
    const supabase = createClient();
    if (!supabase) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Try to get parent's profile with default currency
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('default_currency')
      .eq('id', user.id)
      .single();

    if (error) {
      console.log('Profiles table not available or missing default_currency column. Using fallback currency detection.');
      
      // Fallback: Try to get currency from user metadata
      const userMetadata = user.user_metadata;
      console.log('User metadata:', userMetadata);
      
      if (userMetadata?.default_currency) {
        console.log('Found currency in metadata:', userMetadata.default_currency);
        parentDefaultCurrency = userMetadata.default_currency;
        updateDashboardCurrency(parentDefaultCurrency);
        return;
      }
      
      // Fallback: Try to detect from phone country code
      if (userMetadata?.phone_country_code) {
        const detectedCurrency = detectCurrencyFromCountryCode(userMetadata.phone_country_code);
        console.log('Detected currency from country code:', userMetadata.phone_country_code, '->', detectedCurrency);
        parentDefaultCurrency = detectedCurrency;
        updateDashboardCurrency(parentDefaultCurrency);
        return;
      }
      
      // Check if user signed up with South African number (common case)
      if (userMetadata?.phone_number && userMetadata.phone_number.startsWith('+27')) {
        console.log('Detected South African phone number, using ZAR');
        parentDefaultCurrency = 'ZAR';
        updateDashboardCurrency(parentDefaultCurrency);
        return;
      }
      
      // Final fallback: Use USD as default for new users
      console.log('No currency information found, defaulting to USD');
      parentDefaultCurrency = 'USD';
      updateDashboardCurrency(parentDefaultCurrency);
      
      // Force update all currency displays immediately
      setTimeout(() => {
        updateDashboardCurrency('USD');
      }, 500);
      
      // Also try to create the profile entry
      try {
        await supabase
          .from('profiles')
          .insert({
            id: user.id,
            default_currency: 'USD',
            phone_country_code: 'US'
          });
        console.log('Created profile entry with ZAR currency');
      } catch (profileError) {
        // Fallback logic for currency detection - default to ZAR for this user
        let detectedCurrency = 'ZAR';
        
        // Try to detect from phone number (South African numbers start with +27)
        if (user.phone && user.phone.startsWith('+27')) {
          detectedCurrency = 'ZAR';
        }
        
        // Try to detect from user metadata
        if (user.user_metadata?.country_code) {
          detectedCurrency = detectCurrencyFromCountryCode(user.user_metadata.country_code);
        }
        
        parentDefaultCurrency = detectedCurrency;
        updateDashboardCurrency(parentDefaultCurrency);
        
        // Try to create/update profile with detected currency
        try {
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ default_currency: detectedCurrency })
            .eq('id', user.id);
          console.log('Updated profile with detected currency:', detectedCurrency);
        } catch (updateError) {
          console.log('Could not update profile currency:', updateError);
        }
        return;
      }
      return;
    }

    if (profile?.default_currency) {
      parentDefaultCurrency = profile.default_currency;
      updateDashboardCurrency(parentDefaultCurrency);
    } else {
      // Profile exists but no currency set, use ZAR as default
      parentDefaultCurrency = 'ZAR';
      updateDashboardCurrency(parentDefaultCurrency);
      
      // Update profile with ZAR currency
      try {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ default_currency: 'ZAR' })
          .eq('id', user.id);
        console.log('Updated profile with ZAR currency');
      } catch (updateError) {
        console.log('Could not update profile currency:', updateError);
      }
    }
  } catch (error) {
    console.error('Error loading parent currency settings:', error);
    // Use ZAR as fallback
    parentDefaultCurrency = 'ZAR';
    updateDashboardCurrency(parentDefaultCurrency);
  }
}

// Detect currency from country code (fallback function)
function detectCurrencyFromCountryCode(countryCode) {
  const countryToCurrency = {
    'ZA': 'ZAR',
    'US': 'USD', 
    'GB': 'GBP',
    'NG': 'NGN',
    'KE': 'KES',
    'IN': 'INR',
    'CA': 'CAD',
    'AU': 'AUD',
    'DE': 'EUR',
    'FR': 'EUR',
    'IT': 'EUR',
    'ES': 'EUR',
    'NL': 'EUR',
    'BE': 'EUR',
    'AT': 'EUR',
    'IE': 'EUR',
    'PT': 'EUR',
    'FI': 'EUR',
    'GR': 'EUR',
    'JP': 'JPY',
    'CN': 'CNY',
    'BR': 'BRL',
    'MX': 'MXN',
    'AR': 'ARS',
    'CL': 'CLP',
    'CO': 'COP',
    'PE': 'PEN'
  };
  
  return countryToCurrency[countryCode] || 'USD';
}

// Update dashboard currency symbols
function updateDashboardCurrency(currency) {
  const symbol = CURRENCY_SYMBOLS[currency] || '$';
  
  console.log(`Updating dashboard currency to ${currency} (${symbol})`);
  
  // Update family balance symbol
  const familyBalanceSymbol = document.getElementById('familyBalanceSymbol');
  if (familyBalanceSymbol) {
    // Clear any existing content first to prevent overlap
    familyBalanceSymbol.innerHTML = '';
    familyBalanceSymbol.textContent = symbol;
    // Ensure proper styling
    familyBalanceSymbol.style.fontWeight = '600';
    familyBalanceSymbol.style.marginRight = '2px';
    familyBalanceSymbol.style.position = 'relative';
    familyBalanceSymbol.style.zIndex = '2';
    console.log(`Updated family balance symbol to: ${symbol}`);
  } else {
    console.log('familyBalanceSymbol element not found');
  }
  
  // Update monthly spending symbol
  const monthlySpendingSymbol = document.getElementById('monthlySpendingSymbol');
  if (monthlySpendingSymbol) {
    // Clear any existing content first to prevent overlap
    monthlySpendingSymbol.innerHTML = '';
    monthlySpendingSymbol.textContent = symbol;
    // Ensure proper styling
    monthlySpendingSymbol.style.fontWeight = '600';
    monthlySpendingSymbol.style.marginRight = '2px';
    monthlySpendingSymbol.style.position = 'relative';
    monthlySpendingSymbol.style.zIndex = '2';
    console.log(`Updated monthly spending symbol to: ${symbol}`);
  } else {
    console.log('monthlySpendingSymbol element not found');
  }
  
  // Force update child limits display in parent dashboard
  const childCards = document.querySelectorAll('.child-card');
  childCards.forEach(card => {
    const limitsElement = card.querySelector('.child-limits small');
    if (limitsElement) {
      const text = limitsElement.textContent;
      // Replace any existing currency symbols with the correct one
      const updatedText = text.replace(/[\$£€₦₹]/g, symbol);
      limitsElement.textContent = updatedText;
    }
  });
  
  // Update any other currency displays on the dashboard
  updateAllCurrencyDisplays(currency, symbol);
}

// Update all currency displays throughout the dashboard
function updateAllCurrencyDisplays(currency, symbol) {
  // Update any hardcoded currency symbols in the dashboard
  const currencyElements = document.querySelectorAll('.currency-symbol, .balance-symbol');
  currencyElements.forEach(element => {
    // Clear existing content to prevent overlap
    element.innerHTML = '';
    element.textContent = symbol;
    // Apply consistent styling
    element.style.fontWeight = '600';
    element.style.position = 'relative';
    element.style.zIndex = '2';
    element.style.background = 'transparent';
  });
  
  // Update Activity & Reports section
  updateActivityReportsSection(symbol);
  
  // Update all stat values with currency
  updateStatValues(symbol);
  
  // Update currency in forms and modals
  updateModalCurrencyDisplays(currency, symbol);
}

// Update Activity & Reports section currency displays
function updateActivityReportsSection(symbol) {
  const monthlyTransactions = document.getElementById('monthlyTransactions');
  if (monthlyTransactions) {
    const currentText = monthlyTransactions.textContent;
    const amount = currentText.replace(/[^\d.]/g, '') || '0.00';
    monthlyTransactions.textContent = `${symbol}${amount}`;
  }
  
  const weeklyTransactions = document.getElementById('weeklyTransactions');
  if (weeklyTransactions) {
    const currentText = weeklyTransactions.textContent;
    const amount = currentText.replace(/[^\d.]/g, '') || '0.00';
    weeklyTransactions.textContent = `${symbol}${amount}`;
  }
  
  const totalSpending = document.getElementById('totalSpending');
  if (totalSpending) {
    const currentText = totalSpending.textContent;
    const amount = currentText.replace(/[^\d.]/g, '') || '0.00';
    totalSpending.textContent = `${symbol}${amount}`;
  }
  
  const averageTransaction = document.getElementById('averageTransaction');
  if (averageTransaction) {
    const currentText = averageTransaction.textContent;
    const amount = currentText.replace(/[^\d.]/g, '') || '0.00';
    averageTransaction.textContent = `${symbol}${amount}`;
  }
}

// Update all stat values with correct currency
function updateStatValues(symbol) {
  // Find all elements that might contain currency values
  const statValues = document.querySelectorAll('.stat-value, .card-value');
  statValues.forEach(element => {
    const text = element.textContent;
    // Only update if it contains a dollar sign or looks like a currency amount
    if (text.includes('$') || /^\$?\d+\.\d{2}$/.test(text.trim())) {
      const amount = text.replace(/[^\d.]/g, '') || '0.00';
      element.textContent = `${symbol}${amount}`;
    }
  });
  
  // Update payment amount displays
  const paymentAmounts = document.querySelectorAll('#parentPaymentAmount, #paymentAmount');
  paymentAmounts.forEach(element => {
    const text = element.textContent;
    const amount = text.replace(/[^\d.]/g, '') || '0.00';
    element.textContent = `${symbol}${amount}`;
  });
}

// Update currency displays in modals
function updateModalCurrencyDisplays(currency, symbol) {
  // Update weekly and daily limit symbols specifically
  const weeklyLimitSymbol = document.getElementById('weeklyLimitSymbol');
  if (weeklyLimitSymbol) {
    weeklyLimitSymbol.innerHTML = '';
    weeklyLimitSymbol.textContent = symbol;
  }
  
  const dailyLimitSymbol = document.getElementById('dailyLimitSymbol');
  if (dailyLimitSymbol) {
    dailyLimitSymbol.innerHTML = '';
    dailyLimitSymbol.textContent = symbol;
  }
  
  // Update spending limits modal labels
  const dailyLimitLabel = document.getElementById('dailyLimitLabel');
  if (dailyLimitLabel) {
    dailyLimitLabel.textContent = `Daily Limit (${symbol})`;
  }
  
  const weeklyLimitLabel = document.getElementById('weeklyLimitLabel');
  if (weeklyLimitLabel) {
    weeklyLimitLabel.textContent = `Weekly Limit (${symbol})`;
  }
  
  // Update send money modal
  const sendMoneySymbols = document.querySelectorAll('#sendMoneyModal .currency-symbol');
  sendMoneySymbols.forEach(element => {
    element.innerHTML = '';
    element.textContent = symbol;
  });
  
  // Update wallet top-up modal
  const topupSymbols = document.querySelectorAll('#walletTopUpModal .currency-symbol');
  topupSymbols.forEach(element => {
    element.innerHTML = '';
    element.textContent = symbol;
  });
  
  // Update emergency fund modal
  const emergencySymbols = document.querySelectorAll('#emergencyFundModal .currency-symbol');
  emergencySymbols.forEach(element => {
    element.innerHTML = '';
    element.textContent = symbol;
  });
}

// Get parent's default currency
function getParentDefaultCurrency() {
  return parentDefaultCurrency;
}

// Enhanced createChildAccount function with multi-currency support
async function createChildAccount() {
  const firstName = document.getElementById('childFirstName').value.trim();
  const lastName = document.getElementById('childLastName').value.trim();
  const email = document.getElementById('childEmail').value.trim();
  const password = document.getElementById('childPassword').value;
  const weeklyLimit = parseFloat(document.getElementById('childWeeklyLimit').value) || 0;
  const dailyLimit = parseFloat(document.getElementById('childDailyLimit').value) || 0;
  const currency = document.getElementById('childCurrency').value;

  if (!firstName || !lastName || !email || !password || !currency) {
    alert('Please fill in all required fields including currency selection.');
    return;
  }

  const supabase = createClient();
  if (!supabase) {
    alert('Supabase client not available. Please refresh the page.');
    return;
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('You must be logged in to create a child account.');
      return;
    }

    // Get parent's default currency to check if override is needed
    const { data: parentProfile } = await supabase
      .from('profiles')
      .select('default_currency')
      .eq('id', user.id)
      .single();

    const parentCurrency = parentProfile?.default_currency || 'USD';
    const currencyOverride = currency !== parentCurrency;

    // Create child account
    const { data: childData, error: childError } = await supabase
      .from('children')
      .insert({
        parent_id: user.id,
        first_name: firstName,
        surname: lastName,
        email: email,
        password_hash: password, // In production, this should be properly hashed
        weekly_limit: weeklyLimit,
        daily_limit: dailyLimit,
        currency_code: currency,
        currency_override: currencyOverride,
        balance: 0.00
      })
      .select()
      .single();

    if (childError) throw childError;

    // Create multi-currency wallet for the child
    const { error: walletError } = await supabase
      .from('multi_currency_wallets')
      .insert({
        child_id: childData.id,
        currency_code: currency,
        balance: 0.0000,
        is_primary: true
      });

    if (walletError) {
      console.error('Error creating wallet:', walletError);
      // Don't fail the entire operation for wallet creation error
    }

    // Log parent activity
    await logParentActivity(user.id, childData.id, 'child_account_created', 0, 
      `Created account for ${firstName} ${lastName} with ${currency} currency`, 'account_management', `${firstName} ${lastName}`);

    alert(`Child account created successfully for ${firstName} ${lastName} with ${currency} currency!`);
    closeAddChildModal();
    loadChildren(); // Refresh the children list
  } catch (error) {
    console.error('Error creating child account:', error);
    alert('Failed to create child account. Please try again.');
  }
}

// Enhanced money transfer functions with currency support
async function sendMoneyToChild() {
  const amount = parseFloat(document.getElementById('sendMoneyAmount').value);
  const note = document.getElementById('sendMoneyNote').value.trim();
  
  if (!amount || amount <= 0) {
    alert('Please enter a valid amount.');
    return;
  }

  if (!window.selectedChildForMoney) {
    alert('No child selected.');
    return;
  }

  const supabase = createClient();
  if (!supabase) {
    alert('Supabase client not available. Please refresh the page.');
    return;
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('You must be logged in to send money.');
      return;
    }

    // Get child's currency information
    const { data: childData } = await supabase
      .from('children')
      .select('currency_code, first_name, surname')
      .eq('id', window.selectedChildForMoney)
      .single();

    if (!childData) {
      alert('Child not found.');
      return;
    }

    const childCurrency = childData.currency_code || 'USD';
    const childName = `${childData.first_name} ${childData.surname}`;

    // Update child's balance in their currency wallet
    const { error: walletError } = await supabase.rpc('update_wallet_balance', {
      p_child_id: window.selectedChildForMoney,
      p_currency_code: childCurrency,
      p_amount: amount,
      p_operation: 'add'
    });

    if (walletError) throw walletError;

    // Record transaction
    const { error: transactionError } = await supabase
      .from('transactions')
      .insert({
        parent_id: user.id,
        child_id: window.selectedChildForMoney,
        amount: amount,
        currency_code: childCurrency,
        type: 'money_sent',
        description: note || 'Money transfer from parent',
        status: 'completed'
      });

    if (transactionError) throw transactionError;

    // Log parent activity
    await logParentActivity(user.id, window.selectedChildForMoney, 'money_sent', amount, 
      note || 'Direct money transfer', 'direct_transfer', childName);

    alert(`Successfully sent ${CURRENCY_SYMBOLS[childCurrency] || ''}${amount.toFixed(2)} to ${childName}!`);
    closeSendMoneyModal();
    loadChildren(); // Refresh to show updated balances
  } catch (error) {
    console.error('Error sending money:', error);
    alert('Failed to send money. Please try again.');
  }
}

// Enhanced wallet top-up with currency support
async function topupWallet() {
  const childId = document.getElementById('topupChild').value;
  const amount = parseFloat(document.getElementById('topupAmount').value);

  if (!childId || !amount || amount <= 0) {
    alert('Please select a child and enter a valid amount.');
    return;
  }

  const supabase = createClient();
  if (!supabase) {
    alert('Supabase client not available. Please refresh the page.');
    return;
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('You must be logged in to top up wallet.');
      return;
    }

    // Get child's currency information
    const { data: childData } = await supabase
      .from('children')
      .select('currency_code, first_name, surname')
      .eq('id', childId)
      .single();

    if (!childData) {
      alert('Child not found.');
      return;
    }

    const childCurrency = childData.currency_code || 'USD';
    const childName = `${childData.first_name} ${childData.surname}`;

    // Update wallet balance
    const { error: walletError } = await supabase.rpc('update_wallet_balance', {
      p_child_id: childId,
      p_currency_code: childCurrency,
      p_amount: amount,
      p_operation: 'add'
    });

    if (walletError) throw walletError;

    // Record transaction
    const { error: transactionError } = await supabase
      .from('transactions')
      .insert({
        parent_id: user.id,
        child_id: childId,
        amount: amount,
        currency_code: childCurrency,
        type: 'wallet_topup',
        description: 'Wallet top-up from parent',
        status: 'completed'
      });

    if (transactionError) throw transactionError;

    // Log parent activity
    await logParentActivity(user.id, childId, 'wallet_topup', amount, 
      'Wallet top-up', 'wallet_management', childName);

    alert(`Successfully topped up ${CURRENCY_SYMBOLS[childCurrency] || ''}${amount.toFixed(2)} to ${childName}'s wallet!`);
    closeWalletTopUpModal();
    loadChildren(); // Refresh to show updated balances
  } catch (error) {
    console.error('Error topping up wallet:', error);
    alert('Failed to top up wallet. Please try again.');
  }
}

// Helper function to log parent activities
async function logParentActivity(parentId, childId, activityType, amount, description, category, childName) {
  const supabase = createClient();
  if (!supabase) return;

  try {
    await supabase
      .from('parent_activities')
      .insert({
        parent_id: parentId,
        child_id: childId,
        activity_type: activityType,
        amount: amount,
        description: description,
        category: category,
        child_name: childName,
        metadata: {
          timestamp: new Date().toISOString(),
          currency: 'USD' // This should be dynamic based on the transaction
        }
      });
  } catch (error) {
    console.error('Error logging parent activity:', error);
  }
}

// Enhanced loadChildren function to display currency information
async function loadChildren() {
  const supabase = createClient();
  if (!supabase) return;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get children with their wallet information
    const { data: children, error } = await supabase
      .from('children')
      .select(`
        *,
        multi_currency_wallets!inner(
          currency_code,
          balance,
          is_primary
        )
      `)
      .eq('parent_id', user.id)
      .eq('multi_currency_wallets.is_primary', true);

    if (error) throw error;

    const childrenList = document.getElementById('childrenList');
    if (!childrenList) return;

    if (!children || children.length === 0) {
      childrenList.innerHTML = `
        <div class="empty-children">
          <div class="empty-icon">
            <i class="fas fa-users"></i>
          </div>
          <p class="empty-text">No children added yet</p>
          <p class="empty-subtext">Add your first child to start managing their finances</p>
        </div>
      `;
      return;
    }

    childrenList.innerHTML = children.map(child => {
      const wallet = child.multi_currency_wallets[0];
      const currency = wallet?.currency_code || 'USD';
      const balance = wallet?.balance || 0;
      const symbol = CURRENCY_SYMBOLS[currency] || '$';
      const dailyLimit = child.daily_limit || 0;
      const weeklyLimit = child.weekly_limit || 0;
      
      return `
        <div class="child-card">
          <div class="child-info">
            <div class="child-avatar">
              <i class="fas fa-user"></i>
            </div>
            <div class="child-details">
              <h4 class="child-name">${child.first_name} ${child.surname}</h4>
              <p class="child-email">${child.email}</p>
              <div class="child-currency">
                <i class="fas fa-coins"></i>
                <span>Currency: ${currency}</span>
                ${child.currency_override ? '<span class="override-badge">Override</span>' : ''}
              </div>
              <div class="child-limits">
                <small>Daily: ${symbol}${dailyLimit.toFixed(2)} • Weekly: ${symbol}${weeklyLimit.toFixed(2)}</small>
              </div>
            </div>
          </div>
          <div class="child-balance">
            <div class="balance-amount">${symbol}${parseFloat(balance).toFixed(2)}</div>
            <div class="balance-label">Current Balance</div>
          </div>
          <div class="child-actions">
            <button class="btn btn-primary btn-sm" onclick="openSendMoneyModal('${child.id}', '${child.first_name} ${child.surname}')">
              <i class="fas fa-paper-plane"></i>
              Send Money
            </button>
            <button class="btn btn-secondary btn-sm" onclick="viewChildDetails('${child.id}')">
              <i class="fas fa-eye"></i>
              View Details
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Update dropdowns for other modals
    updateChildDropdowns(children);
  } catch (error) {
    console.error('Error loading children:', error);
  }
}

// Update child dropdowns in various modals
function updateChildDropdowns(children) {
  const dropdowns = ['emergencyChild', 'topupChild', 'recurringChild'];
  
  dropdowns.forEach(dropdownId => {
    const dropdown = document.getElementById(dropdownId);
    if (dropdown) {
      dropdown.innerHTML = '<option value="">Select child</option>' +
        children.map(child => {
          const wallet = child.multi_currency_wallets[0];
          const currency = wallet?.currency_code || 'USD';
          return `<option value="${child.id}">${child.first_name} ${child.surname} (${currency})</option>`;
        }).join('');
    }
  });
}
