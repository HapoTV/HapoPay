// Student Dashboard Currency Handler
// This file handles currency display for child accounts to inherit parent's currency

// Currency symbol mapping
const STUDENT_CURRENCY_SYMBOLS = {
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

// Get currency symbol function
function getCurrencySymbol(currency) {
  return STUDENT_CURRENCY_SYMBOLS[currency] || 'R';
}

// Load and apply student's currency settings
async function loadStudentCurrencySettings() {
  try {
    const supabase = window.supabase.createClient(window.APP_CONFIG.SUPABASE_URL, window.APP_CONFIG.SUPABASE_KEY);
    const studentId = localStorage.getItem('studentId');
    
    if (!studentId) {
      // Set default currency if no student ID - use ZAR since parent uses Rands
      updateStudentCurrencyDisplays('ZAR', 'R', { daily_limit: 0, weekly_limit: 0, balance: 0 });
      return;
    }
    
    // Check if we have a valid session before making any API calls
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log('No authenticated user, using cached currency settings');
      // Use default currency without making API calls
      updateStudentCurrencyDisplays('ZAR', 'R', { daily_limit: 0, weekly_limit: 0, balance: 0 });
      return;
    }

    // First try to get parent's currency for immediate inheritance
    let parentCurrency = 'ZAR'; // Default to ZAR for this user since parent uses Rands
    try {
      const parentId = localStorage.getItem('parentId');
      if (parentId) {
        const { data: parentData } = await supabase
          .from('profiles')
          .select('default_currency')
          .eq('id', parentId)
          .single();
        
        if (parentData?.default_currency) {
          parentCurrency = parentData.default_currency;
          console.log(`Found parent currency: ${parentCurrency}`);
        }
      }
    } catch (parentError) {
      console.log('Could not fetch parent currency initially, using ZAR default');
    }

    // Get student data with multi-currency wallet
    const { data: studentData, error } = await supabase
      .from('children')
      .select(`
        id,
        first_name,
        surname,
        balance,
        daily_limit,
        weekly_limit,
        parent_id,
        currency_code,
        multi_currency_wallets!inner (
          currency_code,
          balance,
          is_primary
        )
      `)
      .eq('id', studentId)
      .eq('multi_currency_wallets.is_primary', true)
      .single();

    if (error) {
      console.error('Error loading student currency:', error);
      // Use parent currency as fallback
      const symbol = STUDENT_CURRENCY_SYMBOLS[parentCurrency] || '$';
      console.log(`Using parent currency fallback: ${parentCurrency} (${symbol})`);
      updateStudentCurrencyDisplays(parentCurrency, symbol, { daily_limit: 0, weekly_limit: 0, balance: 0 });
      return;
    }

    if (studentData) {
      const wallet = studentData.multi_currency_wallets[0];
      let currency = wallet?.currency_code || studentData.currency_code || parentCurrency;
      
      // Try to get parent's currency again if we have parent_id from student data
      if (studentData.parent_id && !parentCurrency) {
        try {
          const { data: parentData } = await supabase
            .from('profiles')
            .select('default_currency')
            .eq('id', studentData.parent_id)
            .single();
          
          if (parentData?.default_currency) {
            currency = parentData.default_currency;
            console.log(`Inherited parent currency: ${currency}`);
          }
        } catch (parentError) {
          console.log('Could not fetch parent currency from student data');
        }
      } else if (parentCurrency !== 'USD') {
        currency = parentCurrency;
      }
      
      const symbol = STUDENT_CURRENCY_SYMBOLS[currency] || '$';
      
      console.log(`Student currency: ${currency} (${symbol})`);
      
      // Update all currency displays
      updateStudentCurrencyDisplays(currency, symbol, studentData);
    }
  } catch (error) {
    console.error('Error in loadStudentCurrencySettings:', error);
    // Final fallback to ZAR since parent uses Rands
    updateStudentCurrencyDisplays('ZAR', 'R', { daily_limit: 0, weekly_limit: 0, balance: 0 });
  }
}

// Update all currency displays in student dashboard
function updateStudentCurrencyDisplays(currency, symbol, studentData) {
  // Update balance display
  const balanceElement = document.getElementById('studentBalance');
  if (balanceElement) {
    const balance = studentData.multi_currency_wallets?.[0]?.balance || studentData.balance || 0;
    balanceElement.textContent = `${symbol}${parseFloat(balance).toFixed(2)}`;
  }

  // Update monthly spending display
  const monthlySpendingElement = document.getElementById('monthlySpending');
  if (monthlySpendingElement) {
    // Always update with correct currency symbol
    const currentText = monthlySpendingElement.textContent;
    const amount = currentText.replace(/[^\d.]/g, '') || '0.00';
    monthlySpendingElement.textContent = `${symbol}${amount}`;
  }

  // Update profile spending limits
  const weeklyLimitElement = document.getElementById('profileWeeklyLimit');
  if (weeklyLimitElement) {
    const weeklyLimit = studentData.weekly_limit || 0;
    weeklyLimitElement.textContent = `${symbol}${parseFloat(weeklyLimit).toFixed(2)}`;
  }

  const dailyLimitElement = document.getElementById('profileDailyLimit');
  if (dailyLimitElement) {
    const dailyLimit = studentData.daily_limit || 0;
    dailyLimitElement.textContent = `${symbol}${parseFloat(dailyLimit).toFixed(2)}`;
  }

  // Update profile current balance
  const profileBalanceElement = document.getElementById('profileCurrentBalance');
  if (profileBalanceElement) {
    const balance = studentData.multi_currency_wallets?.[0]?.balance || studentData.balance || 0;
    profileBalanceElement.textContent = `${symbol}${parseFloat(balance).toFixed(2)}`;
  }

  // Update all card values and stat values in student dashboard
  updateAllStudentCurrencyElements(symbol);

  // Update any other currency displays in modals
  updateStudentModalCurrencyDisplays(symbol);
}

// Update all currency elements in student dashboard
function updateAllStudentCurrencyElements(symbol) {
  // Update all card values that might contain currency
  const cardValues = document.querySelectorAll('.card-value');
  cardValues.forEach(element => {
    const text = element.textContent;
    if (text.includes('$') || /^\$?\d+\.\d{2}$/.test(text.trim())) {
      const amount = text.replace(/[^\d.]/g, '') || '0.00';
      element.textContent = `${symbol}${amount}`;
    }
  });

  // Update profile field values that contain currency
  const profileValues = document.querySelectorAll('.profile-field-value');
  profileValues.forEach(element => {
    const text = element.textContent;
    if (text.includes('$') || /^\$?\d+\.\d{2}$/.test(text.trim())) {
      const amount = text.replace(/[^\d.]/g, '') || '0.00';
      element.textContent = `${symbol}${amount}`;
    }
  });
}

// Update currency displays in modals
function updateStudentModalCurrencyDisplays(symbol) {
  // Update money request modal
  const requestAmountLabels = document.querySelectorAll('label[for="requestAmount"], label[for="emergencyAmount"]');
  requestAmountLabels.forEach(label => {
    if (label.textContent.includes('$')) {
      label.textContent = label.textContent.replace('$', symbol);
    }
  });

  // Update payment amount displays
  const paymentAmountElement = document.getElementById('paymentAmount');
  if (paymentAmountElement) {
    const currentText = paymentAmountElement.textContent;
    if (currentText.includes('$')) {
      const amount = currentText.replace(/[^\d.]/g, '') || '0.00';
      paymentAmountElement.textContent = `${symbol}${amount}`;
    }
  }
}

// Set default currency symbols to prevent blank display
function setDefaultCurrencySymbols() {
  const balanceElement = document.getElementById('studentBalance');
  const monthlySpendingElement = document.getElementById('monthlySpending');
  const profileWeeklyLimit = document.getElementById('profileWeeklyLimit');
  const profileDailyLimit = document.getElementById('profileDailyLimit');
  const profileCurrentBalance = document.getElementById('profileCurrentBalance');
  const paymentAmount = document.getElementById('paymentAmount');
  
  // Set default USD symbols initially
  if (balanceElement && balanceElement.textContent === '0.00') {
    balanceElement.textContent = '$0.00';
  }
  if (monthlySpendingElement && monthlySpendingElement.textContent === '0.00') {
    monthlySpendingElement.textContent = '$0.00';
  }
  if (profileWeeklyLimit && profileWeeklyLimit.textContent === '0.00') {
    profileWeeklyLimit.textContent = '$0.00';
  }
  if (profileDailyLimit && profileDailyLimit.textContent === '0.00') {
    profileDailyLimit.textContent = '$0.00';
  }
  if (profileCurrentBalance && profileCurrentBalance.textContent === '0.00') {
    profileCurrentBalance.textContent = '$0.00';
  }
  if (paymentAmount && paymentAmount.textContent === '0.00') {
    paymentAmount.textContent = '$0.00';
  }
}

// Initialize currency handling when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  // Load actual currency settings immediately
  await loadStudentCurrencySettings();
});

// Export functions for use in other scripts
window.studentCurrencyHandler = {
  loadStudentCurrencySettings,
  updateStudentCurrencyDisplays,
  STUDENT_CURRENCY_SYMBOLS
};
