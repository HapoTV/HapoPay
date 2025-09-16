// Function to load pending requests from localStorage when parent is logged out
function loadPendingRequestsFromStorage() {
  console.log('Loading pending requests from localStorage...');
  
  const pendingEmergencyRequests = JSON.parse(localStorage.getItem('pendingEmergencyRequests') || '[]');
  const pendingMoneyRequests = JSON.parse(localStorage.getItem('pendingMoneyRequests') || '[]');
  
  console.log('Pending emergency requests:', pendingEmergencyRequests);
  console.log('Pending money requests:', pendingMoneyRequests);
  
  const list = document.getElementById('notificationsList');
  if (!list) {
    console.error('Notifications list element not found');
    return;
  }
  
  const allRequests = [];
  
  // Add pending emergency requests
  pendingEmergencyRequests.forEach(request => {
    allRequests.push({
      ...request,
      type: 'emergency',
      child_name: 'Student', // Default name when parent is logged out
      is_pending: true
    });
  });
  
  // Add pending money requests
  pendingMoneyRequests.forEach(request => {
    allRequests.push({
      ...request,
      type: 'money',
      child_name: 'Student', // Default name when parent is logged out
      is_pending: true
    });
  });
  
  // Sort by creation date (newest first)
  allRequests.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  
  if (allRequests.length === 0) {
    list.innerHTML = `
      <div class="empty-notifications">
        <div class="empty-icon">
          <i class="fas fa-bell"></i>
        </div>
        <p class="empty-text">No notifications yet</p>
        <p class="empty-subtext">You'll receive notifications when your children request money or top-ups</p>
      </div>
    `;
    return;
  }
  
  // Render notifications
  allRequests.forEach(request => {
    const notificationItem = document.createElement('div');
    notificationItem.className = 'notification-item';
    
    const currency = window.multiCurrencyHandler?.currentCurrency || 'ZAR';
    const symbol = getCurrencySymbol(currency);
    
    if (request.type === 'emergency') {
      notificationItem.innerHTML = `
        <div class="notification-icon emergency">
          <i class="fas fa-exclamation-triangle"></i>
        </div>
        <div class="notification-content">
          <div class="notification-title">${request.child_name} needs emergency funds</div>
          <div class="notification-subtitle">${request.reason || 'Emergency request'} • ${request.urgency_level || 'Medium'} urgency • ${formatTransactionDate(request.created_at)}</div>
        </div>
        <div class="notification-amount">${symbol}${request.amount}</div>
        <div class="notification-actions">
          <button class="btn btn-success btn-sm" onclick="approveEmergencyRequest('${request.id}', ${request.amount}, '${request.child_id}')">
            <i class="fas fa-check"></i> Approve
          </button>
          <button class="btn btn-danger btn-sm" onclick="declineEmergencyRequest('${request.id}')">
            <i class="fas fa-times"></i> Decline
          </button>
        </div>
      `;
    } else if (request.type === 'money') {
      notificationItem.innerHTML = `
        <div class="notification-icon money">
          <i class="fas fa-hand-holding-usd"></i>
        </div>
        <div class="notification-content">
          <div class="notification-title">${request.child_name} requests money</div>
          <div class="notification-subtitle">${request.reason || 'Money request'} • ${formatTransactionDate(request.created_at)}</div>
        </div>
        <div class="notification-amount">${symbol}${request.amount}</div>
        <div class="notification-actions">
          <button class="btn btn-success btn-sm" onclick="approveMoneyRequest('${request.id}', ${request.amount}, '${request.child_id}')">
            <i class="fas fa-check"></i> Approve
          </button>
          <button class="btn btn-danger btn-sm" onclick="declineMoneyRequest('${request.id}')">
            <i class="fas fa-times"></i> Decline
          </button>
        </div>
      `;
    }
    
    list.appendChild(notificationItem);
  });
}
