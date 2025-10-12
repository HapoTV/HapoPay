// Guard the global fetchAndRenderChildren with debounce + single-flight
function installChildrenRenderGuard() {
  if (typeof window === 'undefined') return;
  const original = window.fetchAndRenderChildren;
  if (typeof original !== 'function') return;
  if (original.__guarded) return; // already guarded

  let inFlight = null;
  let lastTs = 0;
  async function guarded(...args) {
    const now = Date.now();
    if (inFlight) return inFlight;
    if (now - lastTs < 350) return; // drop rapid duplicates
    lastTs = now;
    inFlight = Promise.resolve().then(() => original.apply(this, args)).finally(() => { inFlight = null; });
    return inFlight;
  }
  guarded.__guarded = true;
  window.fetchAndRenderChildren = guarded;
}
// Multi-Currency Dashboard Functions
// This file contains JavaScript functions for handling multi-currency functionality in the parent dashboard

// Currency symbol mapping
const CURRENCY_SYMBOLS = {
  'USD': '$',
  'ZAR': 'R',
  'ZWL': 'Z$',
  'BWP': 'P'
};

// Initialize multi-currency functionality when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  // 1) Do NOT apply cached currency to avoid flashing the wrong symbol.
  //    Start with no symbol until resolved from DB/metadata.
  try {
    const symEls = [
      document.getElementById('familyBalanceSymbol'),
      document.getElementById('monthlySpendingSymbol')
    ];
    symEls.forEach(el => { if (el) el.textContent = ''; });
  } catch (_) {}

  // 1.1) Install guarded fetchAndRenderChildren to prevent duplicate renders
  try { installChildrenRenderGuard(); } catch(_) {}

// Ensure all children without overrides use the parent's currency (data consistency)
async function enforceChildrenCurrencyConsistency() {
  try {
    const supabase = createClient();
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get parent currency
    let parentCurrency = window.parentDefaultCurrency || localStorage.getItem('parentDefaultCurrency') || 'ZAR';
    try {
      const { data: prof } = await supabase
        .from('profiles')
        .select('default_currency')
        .eq('id', user.id)
        .single();
      if (prof?.default_currency) parentCurrency = prof.default_currency;
    } catch(_) {}

    // Fetch children with currency
    const { data: children } = await supabase
      .from('children')
      .select('id, first_name, surname, currency_code, currency_override')
      .eq('parent_id', user.id);
    if (!children || !children.length) return;

    for (const c of children) {
      if (c.currency_override) continue; // respect override
      if (!c.currency_code || c.currency_code !== parentCurrency) {
        try {
          await supabase.rpc('set_child_currency', {
            p_child_id: c.id,
            p_currency_code: parentCurrency
          });
          // Also ensure a primary wallet exists in the parent currency
          await supabase.from('multi_currency_wallets')
            .upsert({ child_id: c.id, currency_code: parentCurrency, is_primary: true, balance: 0.0000 }, { onConflict: 'child_id,currency_code' });
        } catch (e) {
          console.warn('Consistency update failed for child', c.id, e?.message);
        }
      }
    }
  } catch (_) {}
}
  // 2) Load currency settings from DB/metadata and then update + cache
  await loadParentCurrencySettings();
  // 2.5) Enforce child currency consistency for existing children without overrides
  try { await enforceChildrenCurrencyConsistency(); } catch(_) {}
  initializeMultiCurrency();

  if (parentDefaultCurrency) {
    const symbol = CURRENCY_SYMBOLS[parentDefaultCurrency] || 'R';
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
  // Hide currency dropdown (policy change: child uses parent's currency by default)
  hideChildCurrencyDropdown();
}

// Hide the Child Currency dropdown and replace with info note
function hideChildCurrencyDropdown() {
  try {
    const select = document.getElementById('childCurrency');
    if (!select) return;
    // Hide the field container if possible
    const field = select.closest('.field') || select.parentElement;
    if (field) field.style.display = 'none';

    // Insert info text below where the field was
    const info = document.createElement('div');
    info.className = 'small-note';
    const parentCurrency = (window.parentDefaultCurrency || localStorage.getItem('parentDefaultCurrency') || 'ZAR');
    const symbol = (window.CURRENCY_SYMBOLS && window.CURRENCY_SYMBOLS[parentCurrency]) || 'R';
    info.textContent = `Using same currency as parent account (${parentCurrency} ${symbol}). You can change it later using "Change Currency".`;

    // Place the note right after field's container or after the select's parent
    const anchor = field || select.parentElement;
    if (anchor && anchor.parentNode) {
      anchor.parentNode.insertBefore(info, anchor.nextSibling);
    }
  } catch (_) { /* no-op */ }
}

// =============================
// Child Details Modal Utilities
// =============================
function ensureChildDetailsModal() {
  let modal = document.getElementById('childDetailsModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'childDetailsModal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3 class="modal-title">Child Details</h3>
          <button class="modal-close" onclick="closeChildDetailsModal()"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-body" id="childDetailsBody">
          <div class="loading">Loading details...</div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" onclick="closeChildDetailsModal()">Close</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }
  return modal;
}

async function viewChildDetails(childId) {
  const modal = ensureChildDetailsModal();
  const body = document.getElementById('childDetailsBody');
  if (body) body.innerHTML = '<div class="loading">Loading details...</div>';
  modal.style.display = 'block';

  try {
    const supabase = createClient();
    if (!supabase) { if (body) body.innerHTML = '<div class="error">Supabase not available.</div>'; return; }

    // Load child core fields
    const { data: child, error } = await supabase
      .from('children')
      .select('id, first_name, surname, email, password_hash, weekly_limit, daily_limit, currency_code, currency_override, balance')
      .eq('id', childId)
      .single();
    if (error || !child) { if (body) body.innerHTML = '<div class="error">Could not load child details.</div>'; return; }

    // Load wallets explicitly
    let wallets = [];
    try {
      const { data: w } = await supabase
        .from('multi_currency_wallets')
        .select('id, currency_code, balance, is_primary')
        .eq('child_id', child.id)
        .order('is_primary', { ascending: false });
      wallets = w || [];
    } catch (_) {}

    const parentCurrency = window.parentDefaultCurrency || 'ZAR';
    const parentSymbol = CURRENCY_SYMBOLS[parentCurrency] || 'R';
    const primaryWallet = wallets.find(w => w.is_primary) || null;
    const childCurrency = (primaryWallet && primaryWallet.currency_code) || child.currency_code || parentCurrency;
    const childSymbol = CURRENCY_SYMBOLS[childCurrency] || 'R';

    const walletsHtml = (wallets.length ? wallets.map(w => {
      const s = CURRENCY_SYMBOLS[w.currency_code] || 'R';
      return `<tr><td>${w.currency_code}</td><td>${s}${(parseFloat(w.balance||0)).toFixed(2)}</td><td>${w.is_primary ? '<span class="badge">Primary</span>' : ''}</td></tr>`;
    }).join('') : '<tr><td colspan="3">No wallets yet</td></tr>');

    const detailsHtml = `
      <div class="child-details-modal">
        <div class="child-header-row">
          <div class="child-avatar">${(child.first_name?.[0]||'')}${(child.surname?.[0]||'')}</div>
          <div>
            <div class="child-name">${child.first_name} ${child.surname}</div>
            <div class="child-email">${child.email || ''}</div>
          </div>
        </div>
        <div class="details-grid">
          <div class="detail"><span class="label">Password</span><span class="value">${child.password_hash || '—'}</span></div>
          <div class="detail"><span class="label">Primary Currency</span><span class="value">${childCurrency} ${child.currency_override ? '<span class="override-badge">Override</span>' : ''}</span></div>
          <div class="detail"><span class="label">Current Balance</span><span class="value">${childSymbol}${(parseFloat(primaryWallet?.balance ?? child.balance ?? 0)).toFixed(2)}</span></div>
          <div class="detail"><span class="label">Daily Limit</span><span class="value">${parentSymbol}${(parseFloat(child.daily_limit||0)).toFixed(2)}</span></div>
          <div class="detail"><span class="label">Weekly Limit</span><span class="value">${parentSymbol}${(parseFloat(child.weekly_limit||0)).toFixed(2)}</span></div>
        </div>
        <div class="wallets-section">
          <h4>Wallets</h4>
          <table class="wallets-table">
            <thead><tr><th>Currency</th><th>Balance</th><th></th></tr></thead>
            <tbody>${walletsHtml}</tbody>
          </table>
        </div>
      </div>`;

    if (body) body.innerHTML = detailsHtml;
  } catch (e) {
    console.error('viewChildDetails error:', e);
    if (body) body.innerHTML = '<div class="error">Failed to load details.</div>';
  }
}

function closeChildDetailsModal() {
  const modal = document.getElementById('childDetailsModal');
  if (modal) modal.style.display = 'none';
}

if (typeof window !== 'undefined') {
  window.viewChildDetails = viewChildDetails;
  window.closeChildDetailsModal = closeChildDetailsModal;
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
    // Resolve parent currency from reliable sources
    const parentCurrency = (function() {
      if (typeof window !== 'undefined' && window.parentDefaultCurrency) return window.parentDefaultCurrency;
      try { return localStorage.getItem('parentDefaultCurrency') || getParentDefaultCurrency(); } catch(_) { return getParentDefaultCurrency(); }
    })();

    if (selectedCurrency && parentCurrency && selectedCurrency !== parentCurrency) {
      childCurrencyNote.innerHTML = `<i class="fas fa-globe"></i> Child currency overrides parent. Child wallet and limits will be in ${symbol}.`;
    } else if (selectedCurrency && parentCurrency && selectedCurrency === parentCurrency) {
      childCurrencyNote.innerHTML = `<i class="fas fa-info-circle"></i> Using same currency as parent account.`;
    } else {
      // Fallback if parent currency not yet resolved
      childCurrencyNote.innerHTML = `<i class="fas fa-info-circle"></i> Defaults to your currency. Change if child needs different currency (e.g., abroad).`;
    }
  }
}

// Global variable to store parent's default currency (start empty to avoid symbol flash)
let parentDefaultCurrency = null;

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
      
      // No currency information found yet; leave symbols blank until resolved
      console.log('No currency information found yet; leaving symbols blank until resolved');
      return;
    }

    if (profile?.default_currency) {
      parentDefaultCurrency = profile.default_currency;
      try { localStorage.setItem('parentDefaultCurrency', parentDefaultCurrency); } catch (_) {}
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
        try { localStorage.setItem('parentDefaultCurrency', 'ZAR'); } catch (_) {}
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
    'US': 'USD'
  };

  return countryToCurrency[countryCode] || 'USD';
}

// Update dashboard currency symbols
function updateDashboardCurrency(currency) {
  const symbol = CURRENCY_SYMBOLS[currency] || 'R';
  
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
      // Replace any existing currency symbols with the correct one (supports multi-char symbols)
      const currencyTokenRegex = /(\$|R)/g;
      const updatedText = text.replace(currencyTokenRegex, symbol);
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
    // Update if it contains any supported currency token or looks like a currency amount
    if (/(\$|R)\s?\d/.test(text) || /^(\$)?\d+\.\d{2}$/.test(text.trim())) {
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

// =============================
// Change Child Currency Handlers
// =============================
let changeCurrencyChildId = null;
const __currencyChangeInFlight = new Map(); // childId -> boolean

function openChangeCurrencyModal(childId, childName, currentCurrency) {
  changeCurrencyChildId = childId;
  const modal = document.getElementById('changeCurrencyModal');
  const nameEl = document.getElementById('changeCurrencyChildName');
  const select = document.getElementById('changeCurrencySelect');
  if (nameEl) nameEl.textContent = childName || childId;
  if (select && currentCurrency) select.value = currentCurrency;
  if (modal) modal.style.display = 'block';
}

function closeChangeCurrencyModal() {
  changeCurrencyChildId = null;
  const modal = document.getElementById('changeCurrencyModal');
  if (modal) modal.style.display = 'none';
}

async function confirmChangeCurrency() {
  const select = document.getElementById('changeCurrencySelect');
  const childId = (changeCurrencyChildId || '').toString().trim();
  if (!childId || childId === 'null' || childId === 'undefined' || childId === '[object Object]') {
    console.warn('Invalid childId for currency change:', changeCurrencyChildId);
    alert('Could not determine which child to update. Please refresh and try again.');
    return;
  }
  if (!select || !select.value) {
    alert('Please select a currency.');
    return;
  }
  const newCode = select.value;

  // Prevent double-submission for the same child
  if (__currencyChangeInFlight.get(childId)) return;
  __currencyChangeInFlight.set(childId, true);

  const supabase = createClient();
  if (!supabase) {
    alert('Supabase not available. Please refresh the page.');
    __currencyChangeInFlight.delete(childId);
    return;
  }

  try {
    // Determine parent's default currency to compute override flag
    let parentCurrency = 'ZAR';
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('default_currency')
          .eq('id', user.id)
          .single();
        if (prof?.default_currency) parentCurrency = prof.default_currency;
      }
    } catch (_) {}
    const isOverride = newCode !== parentCurrency;

    // Direct safe update sequence (no RPC to avoid 409 noise)
    // 1) Update child row
    const { error: updErr } = await supabase
      .from('children')
      .update({ currency_code: newCode, currency_override: isOverride })
      .eq('id', childId);
    if (updErr) throw updErr;

    // 2) Ensure wallet exists (idempotent upsert)
    try {
      const { error: upErr } = await supabase
        .from('multi_currency_wallets')
        .upsert(
          { child_id: childId, currency_code: newCode, balance: 0, is_primary: false },
          { onConflict: 'child_id,currency_code' }
        );
      if (upErr) throw upErr;
    } catch (e) {
      console.warn('Wallet upsert warning:', e?.message || e);
    }

    // 3) Unset all as primary
    const { error: unsetErr } = await supabase
      .from('multi_currency_wallets')
      .update({ is_primary: false })
      .eq('child_id', childId);
    if (unsetErr) throw unsetErr;

    // 4) Set new as primary
    const { error: setErr } = await supabase
      .from('multi_currency_wallets')
      .update({ is_primary: true })
      .eq('child_id', childId)
      .eq('currency_code', newCode);
    if (setErr) throw setErr;

    // 5) Verify child row reflects the new currency and override
    try {
      const { data: ch } = await supabase
        .from('children')
        .select('currency_code, currency_override')
        .eq('id', childId)
        .single();
      console.log('Child currency after update:', ch);
    } catch (_) {}

    // Note: We intentionally do NOT call set_child_currency RPC here because some implementations reset
    // currency_override back to false, which would cause the consistency enforcer to revert the change.

    alert('Child currency updated successfully.');
    closeChangeCurrencyModal();
    try { window.dispatchEvent(new CustomEvent('childCurrencyChanged', { detail: { childId, currency: newCode } })); } catch (_) {}
    await loadChildren(); // Safe: single-flight prevents flicker
  } catch (e) {
    console.error('Currency change failed:', { error: e, childId, newCode });
    alert('Failed to change currency. Please try again.');
  } finally {
    __currencyChangeInFlight.delete(childId);
  }
}

// Expose handlers to window for inline onclick usage
if (typeof window !== 'undefined') {
  window.openChangeCurrencyModal = openChangeCurrencyModal;
  window.closeChangeCurrencyModal = closeChangeCurrencyModal;
  window.confirmChangeCurrency = confirmChangeCurrency;
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
  if (!firstName || !lastName || !email || !password) {
    alert('Please fill in all required fields.');
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

    const parentCurrency = parentProfile?.default_currency || 'ZAR';
    // Persist parent's default currency for consistent UI checks
    try {
      window.parentDefaultCurrency = parentCurrency;
      localStorage.setItem('parentDefaultCurrency', parentCurrency);
    } catch (_) {}
    // Policy: child's default currency = parent's currency (no override at creation)
    const currency = parentCurrency;
    const currencyOverride = false;

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

    // Enforce child's currency and primary wallet atomically on the server
    try {
      await supabase.rpc('set_child_currency', {
        p_child_id: childData.id,
        p_currency_code: currency
      });
      // Verify DB state
      const { data: verify } = await supabase
        .from('multi_currency_wallets')
        .select('currency_code, is_primary')
        .eq('child_id', childData.id);
      console.log('Post-create wallets:', verify);
    } catch (rpcErr) {
      console.warn('set_child_currency RPC failed (creation path):', rpcErr?.message || rpcErr);
    }

    // Log parent activity
    await logParentActivity(
      user.id,
      childData.id,
      'child_account_created',
      0,
      `Created account for ${firstName} ${lastName} with ${currency} currency`,
      'account_management',
      `${firstName} ${lastName}`,
      currency
    );

    alert(`Child account created successfully for ${firstName} ${lastName}. Using parent's currency (${currency}).`);
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

    const childCurrency = childData.currency_code || 'ZAR';
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
    await logParentActivity(
      user.id,
      window.selectedChildForMoney,
      'money_sent',
      amount,
      note || 'Direct money transfer',
      'direct_transfer',
      childName,
      childCurrency
    );

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
    await logParentActivity(
      user.id,
      childId,
      'wallet_topup',
      amount,
      'Wallet top-up',
      'wallet_management',
      childName,
      childCurrency
    );

    alert(`Successfully topped up ${CURRENCY_SYMBOLS[childCurrency] || ''}${amount.toFixed(2)} to ${childName}'s wallet!`);
    closeWalletTopUpModal();
    loadChildren(); // Refresh to show updated balances
  } catch (error) {
    console.error('Error topping up wallet:', error);
    alert('Failed to top up wallet. Please try again.');
  }
}

// Helper function to log parent activities
async function logParentActivity(parentId, childId, activityType, amount, description, category, childName, currencyCode) {
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
          currency: currencyCode || null
        }
      });
  } catch (error) {
    console.error('Error logging parent activity:', error);
  }
}

// Single-flight guard state to prevent duplicate renders
let __childrenRenderInFlight = null;
let __childrenRenderScheduledTs = 0;

// Enhanced loadChildren function to display currency information
// IMPORTANT: To keep a single source of truth for the children UI, delegate to
// parentDashboard.html's fetchAndRenderChildren() when available. This prevents
// the UI from switching styles after certain actions (e.g., currency change).
async function loadChildren() {
  // Coalesce rapid calls into a single render within 400ms window
  const nowTs = Date.now();
  if (nowTs - __childrenRenderScheduledTs < 400 && __childrenRenderInFlight) {
    return __childrenRenderInFlight;
  }
  __childrenRenderScheduledTs = nowTs;

  // If a render is already in flight, return the same promise to prevent duplicate DOM work
  if (__childrenRenderInFlight) return __childrenRenderInFlight;

  __childrenRenderInFlight = (async () => {
    // Preferred unified path
    if (typeof window !== 'undefined' && typeof window.fetchAndRenderChildren === 'function') {
      await window.fetchAndRenderChildren();
      return;
    }

    // Fallback rendering if unified function is unavailable
    const supabase = createClient();
    if (!supabase) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

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

      // Resolve currency per child via server RPC first to match student side exactly
      const cards = [];
      for (const child of children) {
        let resolvedCode = null;
        try {
          const { data: rpcCode } = await supabase.rpc('get_resolved_child_currency_for_me', { p_child_id: child.id });
          if (rpcCode) resolvedCode = rpcCode;
        } catch (_) {}

        const wallet = child.multi_currency_wallets[0];
        const currency = resolvedCode || wallet?.currency_code || child.currency_code || 'USD';
        const balance = wallet?.balance || 0;
        const symbol = CURRENCY_SYMBOLS[currency] || '$';
        const dailyLimit = child.daily_limit || 0;
        const weeklyLimit = child.weekly_limit || 0;

        cards.push(`
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
              <button class="btn btn-primary btn-sm" onclick="openChangeCurrencyModal('${child.id}', '${child.first_name} ${child.surname}', '${currency}')">
                <i class="fas fa-coins"></i>
                Change Currency
              </button>
              <button class="btn btn-secondary btn-sm" onclick="viewChildDetails('${child.id}')">
                <i class="fas fa-eye"></i>
                View Details
              </button>
            </div>
          </div>
        `);
      }
      childrenList.innerHTML = cards.join('');

      updateChildDropdowns(children);
    } catch (error) {
      console.error('Error loading children:', error);
    }
  })();

  try {
    await __childrenRenderInFlight;
  } finally {
    __childrenRenderInFlight = null;
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
