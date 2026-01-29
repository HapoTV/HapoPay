class GamePointsManager {
  constructor() {
    this.points = 0;
    this.dailyStats = {};
    this.loadPoints();
    this.setupEventListeners();
  }

  // Load points from localStorage
  loadPoints() {
    const savedPoints = localStorage.getItem('gamePoints');
    const savedStats = localStorage.getItem('dailyGameStats');
    
    if (savedPoints) {
      this.points = parseInt(savedPoints, 10) || 0;
    }
    
    if (savedStats) {
      this.dailyStats = JSON.parse(savedStats);
    }
    
    this.updatePointsDisplay();
  }

  // Save points to localStorage
  savePoints() {
    localStorage.setItem('gamePoints', this.points.toString());
    localStorage.setItem('dailyGameStats', JSON.stringify(this.dailyStats));
    this.triggerPointsUpdate();
  }

  // Add points and save to localStorage
  addPoints(amount, gameName = 'Game') {
    if (amount <= 0) return;
    
    const today = new Date().toDateString();
    
    // Initialize daily stats if not exists
    if (!this.dailyStats[today]) {
      this.dailyStats[today] = { gamesPlayed: 0, totalPoints: 0 };
    }
    
    // Update points and stats
    this.points += amount;
    this.dailyStats[today].gamesPlayed++;
    this.dailyStats[today].totalPoints += amount;
    
    // Save to localStorage
    this.savePoints();
    
    // Update UI
    this.updatePointsDisplay();
    
    // Log the points addition
    console.log(`Added ${amount} points from ${gameName}. Total: ${this.points}`);
    
    return this.points;
  }

  // Deduct points (for rewards)
  deductPoints(amount) {
    if (this.points >= amount) {
      this.points -= amount;
      this.savePoints();
      this.updatePointsDisplay();
      return true;
    }
    return false;
  }

  // Get current points
  getPoints() {
    return this.points;
  }

  // Update points display in the UI
  updatePointsDisplay() {
    // Update points in the rewards section
    const pointsElement = document.getElementById('rewardsPointsBalance');
    if (pointsElement) {
      pointsElement.textContent = this.points.toLocaleString();
    }
    
    // Update points in the games section if it exists
    const gamePointsElement = document.getElementById('gamePointsDisplay');
    if (gamePointsElement) {
      gamePointsElement.textContent = this.points.toLocaleString();
    }
  }

  // Trigger custom event when points are updated
  triggerPointsUpdate() {
    const event = new CustomEvent('gamePointsUpdated', { 
      detail: { points: this.points } 
    });
    window.dispatchEvent(event);
  }

  // Setup event listeners for game completion
  setupEventListeners() {
    // Listen for game completion messages from iframes
    window.addEventListener('message', (event) => {
      if (event.data.type === 'gameCompleted' && event.data.points) {
        this.addPoints(event.data.points, event.data.gameName || 'Game');
      }
    });
    
    // Listen for points update events
    window.addEventListener('gamePointsUpdated', (e) => {
      this.updatePointsDisplay();
    });
  }
}

// Initialize the points manager
const gamePointsManager = new GamePointsManager();

// Make it globally available
window.gamePointsManager = gamePointsManager;

// Update the redeemReward function to use the points manager
window.redeemReward = async function(rewardId, pointsCost) {
  if (!gamePointsManager.deductPoints(pointsCost)) {
    alert('Not enough points for this reward');
    return false;
  }
  
  try {
    const { error } = await supabase
      .from('student_rewards')
      .insert([
        { 
          student_id: currentStudent?.id, 
          reward_id: rewardId,
          points_used: pointsCost,
          status: 'pending',
          redeemed_at: new Date().toISOString()
        }
      ]);
    
    if (error) throw error;
    
    alert('Reward redeemed successfully!');
    return true;
    
  } catch (error) {
    console.error('Error redeeming reward:', error);
    alert('Failed to redeem reward. Please try again.');
    return false;
  }
};

// Load initial points when the page loads
document.addEventListener('DOMContentLoaded', () => {
  gamePointsManager.updatePointsDisplay();
});
