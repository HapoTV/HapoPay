    // Game Activities
    window.addToRecentActivity = function(activity) {
      try {
        // Get existing activities from localStorage or initialize empty array
        const activities = JSON.parse(localStorage.getItem('gameActivities') || '[]');
        
        // Add timestamp if not provided
        if (!activity.timestamp) {
          activity.timestamp = new Date().toISOString();
        }
        
        // Add the new activity to the beginning of the array
        activities.unshift(activity);
        
        // Keep only the last 10 activities
        const recentActivities = activities.slice(0, 10);
        
        // Save back to localStorage
        localStorage.setItem('gameActivities', JSON.stringify(recentActivities));
        
        // Update the UI
        updateRecentGameActivities();
        
      } catch (error) {
        console.error('Error adding to recent activity:', error);
      }
    };

    // Function to update the recent game activities UI
    function updateRecentGameActivities() {
      try {
        const gameActivityList = document.getElementById('gameActivityList');
        if (!gameActivityList) return;
        
        // Get activities from localStorage
        const activities = JSON.parse(localStorage.getItem('gameActivities') || '[]');
        
        if (activities.length === 0) {
          // Show empty state if no activities
          gameActivityList.innerHTML = `
            <div class="empty-activity">
              <div class="empty-icon">
                <i class="fas fa-gamepad"></i>
              </div>
              <p class="empty-text">No games played yet</p>
              <p class="empty-subtext">Start playing games to see your activity here</p>
            </div>
          `;
          return;
        }
        
        // Create HTML for each activity
        const activitiesHtml = activities.map(activity => {
          const gameName = getGameDisplayName(activity.game) || 'Game';
          const points = activity.points || 0;
          const difficulty = activity.difficulty ? ` ${activity.difficulty.charAt(0).toUpperCase() + activity.difficulty.slice(1)}` : '';
          const date = new Date(activity.timestamp);
          const timeAgo = formatTimeAgo(date);
          
          return `
            <div class="activity-item">
              <div class="activity-icon">
                <i class="fas fa-${getGameIcon(activity.game)}"></i>
              </div>
              <div class="activity-details">
                <div class="activity-header">
                  <span class="activity-title">${gameName} ${difficulty}</span>
                  <span class="activity-points">+${points} pts</span>
                </div>
                <div class="activity-meta">
                  <span class="activity-time">${timeAgo}</span>
                </div>
              </div>
            </div>
          `;
        }).join('');
        
        // Update the UI
        gameActivityList.innerHTML = `
          <div class="activity-list">
            ${activitiesHtml}
          </div>
        `;
        
      } catch (error) {
        console.error('Error updating recent game activities:', error);
      }
    }

    // Helper function to get game icon
    function getGameIcon(gameType) {
      const icons = {
        memory: 'brain',
        math: 'calculator',
        fun: 'gamepad'
      };
      return icons[gameType] || 'gamepad';
    }
