/**
 * Loyalty Points Display Module
 * Displays user's loyalty points across pages
 * Exchange: 1 point = 1 RWF
 */

// Load and display loyalty points
function loadLoyaltyPoints() {
  const user = localStorage.getItem("loggedInUserId");
  
  if (!user) {
    // Guest user
    const pointsContainer = document.getElementById("loyaltyPointsDisplay");
    if (pointsContainer) {
      pointsContainer.innerHTML = `<span style="color: #999; font-size: 0.9em;">⭐ <a href="Userloginpage.html">Login to earn points</a></span>`;
    }
    return;
  }

  // Fetch user's loyalty points
  fetch(`http://localhost:8000/loyalty-points/${user}`)
    .then(res => res.json())
    .then(data => {
      const points = data.points || 0;
      
      const pointsContainer = document.getElementById("loyaltyPointsDisplay");
      if (pointsContainer) {
        pointsContainer.innerHTML = `
          <div style="padding: 10px; background: linear-gradient(135deg, #ffd700, #ffed4e); border-radius: 8px; color: #333; font-weight: 600; text-align: center;">
            <div style="font-size: 1.2em;">⭐ ${points.toLocaleString()} RWF</div>
            <div style="font-size: 0.85em; margin-top: 4px; color: #555;">Your Loyalty Balance</div>
          </div>
        `;
      }
    })
    .catch(err => {
      console.error("Error loading loyalty points:", err);
      const pointsContainer = document.getElementById("loyaltyPointsDisplay");
      if (pointsContainer) {
        pointsContainer.innerHTML = `<span style="color: #999;">⭐ Points unavailable</span>`;
      }
    });
}

// Run on page load
document.addEventListener("DOMContentLoaded", loadLoyaltyPoints);

// Also run if DOM is already loaded
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", loadLoyaltyPoints);
} else {
  loadLoyaltyPoints();
}
