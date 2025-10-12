// Student Dashboard Currency Handler
// This file handles currency display for child accounts to inherit parent's currency

// Currency symbol mapping (limited to supported currencies)
const STUDENT_CURRENCY_SYMBOLS = {
  'USD': '$',
  'ZAR': 'R',
  'ZWL': 'Z$',
  'BWP': 'P'
};

// Get currency symbol function
function getCurrencySymbol(currency) {
  return STUDENT_CURRENCY_SYMBOLS[currency] || 'R';
}

// LocalStorage helpers scoped per-student
function getStudentCurrencyKey(studentId) {
  return `studentCurrencyCode:${studentId}`;
}

function getCachedStudentCurrency() {
  const studentId = localStorage.getItem('studentId');
  if (!studentId) return localStorage.getItem('studentCurrencyCode'); // legacy fallback
  return localStorage.getItem(getStudentCurrencyKey(studentId)) || localStorage.getItem('studentCurrencyCode');
}

function setCachedStudentCurrency(code) {
  const studentId = localStorage.getItem('studentId');
  try {
    if (studentId) localStorage.setItem(getStudentCurrencyKey(studentId), code);
    // keep legacy for backward compatibility
    localStorage.setItem('studentCurrencyCode', code);
  } catch (_) {}
}

// Singleton Supabase client for this page (avoid multiple GoTrueClient instances)
function getSupabase() {
  if (typeof window === 'undefined') return null;
  try {
    if (window.__studentSupabase) return window.__studentSupabase;
    if (window.supabase && window.APP_CONFIG) {
      window.__studentSupabase = window.supabase.createClient(window.APP_CONFIG.SUPABASE_URL, window.APP_CONFIG.SUPABASE_KEY);
      return window.__studentSupabase;
    }
  } catch (_) {}
  return null;
}

// Load and apply student's currency settings
async function loadStudentCurrencySettings() {
  try {
    const supabase = getSupabase();
    const studentId = localStorage.getItem('studentId');
    
    if (!studentId) {
      // No student context yet: keep numeric-only (no symbol) until resolved
      setDefaultCurrencySymbols();
      return;
    }

    // 0) Apply cached currency immediately to avoid flashing wrong default
    try {
      let cachedCurrency = getCachedStudentCurrency();
      // Prefer cached student data currency_code if available
      const cachedStudentDataRaw = localStorage.getItem('cachedStudentData');
      if (!cachedCurrency && cachedStudentDataRaw) {
        try {
          const cachedStudentData = JSON.parse(cachedStudentDataRaw);
          cachedCurrency = cachedStudentData?.currency_code || cachedStudentData?.multi_currency_wallets?.[0]?.currency_code;
          if (cachedCurrency) setCachedStudentCurrency(cachedCurrency);
        } catch (_) {}
      }
      if (cachedCurrency) {
        const symbol = getCurrencySymbol(cachedCurrency);
        updateStudentCurrencyDisplays(cachedCurrency, symbol, { daily_limit: 0, weekly_limit: 0, balance: 0 });
        window.studentCurrencyHandler = window.studentCurrencyHandler || {};
        window.studentCurrencyHandler.parentCurrency = cachedCurrency;
        window.studentCurrencyHandler.activeCurrency = cachedCurrency;
      }
    } catch (_) {}

    // Check if we have a valid session before making any API calls
    const { data: { user } } = await supabase.auth.getUser();

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
        currency_override,
        multi_currency_wallets (
          currency_code,
          balance,
          is_primary
        )
      `)
      .eq('id', studentId)
      .single();

    if (error) {
      console.error('Error loading student currency:', error);
      // Only use cached currency if present; otherwise keep numeric-only until resolved
      const cachedCurrency = getCachedStudentCurrency();
      if (cachedCurrency) {
        const symbol = getCurrencySymbol(cachedCurrency);
        updateStudentCurrencyDisplays(cachedCurrency, symbol, { daily_limit: 0, weekly_limit: 0, balance: 0 });
      } else {
        setDefaultCurrencySymbols();
      }
      return;
    }

    if (studentData) {
      const walletArray = studentData.multi_currency_wallets || [];
      const wallet = walletArray.find(w => w.is_primary) || walletArray[0];

      // Resolve via server RPC bound to current auth.uid()
      let currency = null;
      try {
        const { data: rpcCurrency } = await supabase.rpc('get_my_child_currency');
        if (rpcCurrency) currency = rpcCurrency;
      } catch (e) { console.warn('RPC get_my_child_currency error:', e?.message || e); }

      // Fallback: child's primary wallet > child currency_code
      if (!currency) {
        currency = wallet?.currency_code || studentData.currency_code || null;
      }

      const symbol = STUDENT_CURRENCY_SYMBOLS[currency] || (currency === 'USD' ? '$' : 'R');
      
      console.log(`Student currency: ${currency} (${symbol})`);
      
      // Update all currency displays
      updateStudentCurrencyDisplays(currency, symbol, studentData);

      // Cache resolved currency and expose for other scripts
      setCachedStudentCurrency(currency);
      window.studentCurrencyHandler = window.studentCurrencyHandler || {};
      window.studentCurrencyHandler.parentCurrency = currency; // backward compatibility
      window.studentCurrencyHandler.activeCurrency = currency;
    }
  } catch (error) {
    console.error('Error in loadStudentCurrencySettings:', error);
    // Final fallback to ZAR since parent uses Rands
    const cachedCurrency = getCachedStudentCurrency();
    if (cachedCurrency) {
      const symbol = getCurrencySymbol(cachedCurrency);
      updateStudentCurrencyDisplays(cachedCurrency, symbol, { daily_limit: 0, weekly_limit: 0, balance: 0 });
    }
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
    // Always update with correct currency symbol (replace any token)
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
  const tokenRegex = /(\$|R)/g;

  // Update all card values that might contain currency
  const cardValues = document.querySelectorAll('.card-value');
  cardValues.forEach(element => {
    const text = element.textContent;
    if (tokenRegex.test(text) || /^\d+\.\d{2}$/.test(text.trim())) {
      const amount = text.replace(/[^\d.]/g, '') || '0.00';
      element.textContent = `${symbol}${amount}`;
    }
  });

  // Update profile field values that contain currency
  const profileValues = document.querySelectorAll('.profile-field-value');
  profileValues.forEach(element => {
    const text = element.textContent;
    if (tokenRegex.test(text) || /^\d+\.\d{2}$/.test(text.trim())) {
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
    label.textContent = label.textContent.replace(/(\$|R)/g, symbol);
  });

  // Update payment amount displays
  const paymentAmountElement = document.getElementById('paymentAmount');
  if (paymentAmountElement) {
    const currentText = paymentAmountElement.textContent;
    const amount = currentText.replace(/[^\d.]/g, '') || '0.00';
    paymentAmountElement.textContent = `${symbol}${amount}`;
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
  
  // Do not inject any default symbol; keep numeric-only until currency resolves
}

// Initialize currency handling when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  // Apply cached currency instantly before async
  try {
    let cachedCurrency = getCachedStudentCurrency();
    if (!cachedCurrency) {
      const raw = localStorage.getItem('cachedStudentData');
      if (raw) {
        try {
          const cached = JSON.parse(raw);
          cachedCurrency = cached?.currency_code || cached?.multi_currency_wallets?.[0]?.currency_code || null;
          if (cachedCurrency) setCachedStudentCurrency(cachedCurrency);
        } catch (_) {}
      }
    }
    if (cachedCurrency) {
      const symbol = getCurrencySymbol(cachedCurrency);
      updateStudentCurrencyDisplays(cachedCurrency, symbol, { daily_limit: 0, weekly_limit: 0, balance: 0 });
      window.studentCurrencyHandler = window.studentCurrencyHandler || {};
      window.studentCurrencyHandler.parentCurrency = cachedCurrency;
      window.studentCurrencyHandler.activeCurrency = cachedCurrency;
    }
  } catch (_) {}
  
  // Then fetch/resolve actual settings
  await loadStudentCurrencySettings();
});

// Export functions for use in other scripts
window.studentCurrencyHandler = {
  loadStudentCurrencySettings,
  updateStudentCurrencyDisplays,
  STUDENT_CURRENCY_SYMBOLS
};

// Helper to resolve the student's currency code synchronously from caches/handler
function resolveStudentCurrencyCode() {
  try {
    if (window.studentCurrencyHandler && window.studentCurrencyHandler.activeCurrency) {
      return window.studentCurrencyHandler.activeCurrency;
    }
    let code = getCachedStudentCurrency();
    if (code) return code;
    const raw = localStorage.getItem('cachedStudentData');
    if (raw) {
      try {
        const s = JSON.parse(raw);
        code = s?.multi_currency_wallets?.[0]?.currency_code || s?.currency_code || null;
        return code || null;
      } catch(_) {}
    }
  } catch (_) {}
  return null; // explicit: no symbol until resolved
}

// Expose helper
if (typeof window !== 'undefined') {
  window.resolveStudentCurrencyCode = resolveStudentCurrencyCode;
}
