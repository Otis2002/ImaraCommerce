const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(bodyParser.json());

// SSE clients
const sseClients = [];

function sendSSE(event, data) {
  const payload = `event: ${event}\n` + `data: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach(res => res.write(payload));
}

// File to store orders
const ORDERS_FILE = "orders.json";
const LOYALTY_POINTS_FILE = "loyaltyPoints.json";

// Simple admin login credentials (in production, hash the password)
const ADMIN_USER = "admin";
const ADMIN_PASS = "Rwanda20002!";

// Utility functions
function readOrders() {
  if (!fs.existsSync(ORDERS_FILE)) return [];
  const data = fs.readFileSync(ORDERS_FILE);
  return JSON.parse(data);
}

function writeOrders(orders) {
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
}

function readLoyaltyPoints() {
  if (!fs.existsSync(LOYALTY_POINTS_FILE)) return {};
  const data = fs.readFileSync(LOYALTY_POINTS_FILE);
  return JSON.parse(data);
}

function writeLoyaltyPoints(points) {
  fs.writeFileSync(LOYALTY_POINTS_FILE, JSON.stringify(points, null, 2));
}

function awardLoyaltyPoints(username, points = 1) {
  const loyaltyData = readLoyaltyPoints();
  if (!loyaltyData[username]) {
    loyaltyData[username] = 0;
  }
  loyaltyData[username] += points;
  writeLoyaltyPoints(loyaltyData);
  return loyaltyData[username];
}

function deductLoyaltyPoints(username, points) {
  const loyaltyData = readLoyaltyPoints();
  if (!loyaltyData[username]) {
    loyaltyData[username] = 0;
  }
  if (loyaltyData[username] < points) {
    return { success: false, message: "Insufficient loyalty points" };
  }
  loyaltyData[username] -= points;
  writeLoyaltyPoints(loyaltyData);
  return { success: true, remainingPoints: loyaltyData[username] };
}

// Admin login endpoint
app.post("/admin/login", (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    // In production: return JWT token
    return res.json({ success: true, message: "Login successful" });
  }
  res.status(401).json({ success: false, message: "Invalid credentials" });
});

// Get orders by username
app.get("/orders", (req, res) => {
  const { username } = req.query;
  let orders = readOrders();

  // If username is provided → return ONLY that user's orders
  if (username) {
    orders = orders.filter(order => order.username === username);
  }

  res.json(orders);
});


// Add new order (from frontend)
app.post("/orders", (req, res) => {
  const order = req.body;
  let orders = readOrders();
  orders.push(order);
  writeOrders(orders);
  
  let loyaltyPoints = 0;
  let loyaltyPointsAwarded = 0;

  // Calculate 1.30% of total amount as loyalty points
  const pointsToAward = Math.floor(order.total * 0.013);

  // Handle loyalty points deduction (3% automatic)
  if (order.payment && order.payment.method !== "loyalty") {
    const pointsToUse = Math.floor(order.total * 0.03);
    const result = deductLoyaltyPoints(order.username, pointsToUse);
    
    if (!result.success) {
      // Not an error - just means user doesn't have enough points
      // Order proceeds anyway
      order.payment.loyaltyPointsUsed = 0;
      order.payment.loyaltyPointsDeducted = 0;
    } else {
      order.payment.loyaltyPointsUsed = pointsToUse;
      order.payment.loyaltyPointsDeducted = pointsToUse;
      order.total -= pointsToUse; // Reduce total by points used
    }
  }

  // Award points for this purchase (1.30% of original total)
  loyaltyPoints = awardLoyaltyPoints(order.username, pointsToAward);
  loyaltyPointsAwarded = pointsToAward;

  order.loyaltyPointsAwarded = loyaltyPointsAwarded;
  order.totalLoyaltyPoints = loyaltyPoints;
  
  // Broadcast new order to SSE clients
  try {
    sendSSE('new-order', order);
  } catch (e) { console.error('SSE broadcast error', e); }
  res.json({ success: true, order, loyaltyPoints });
});


/* ================= UPDATE STATUS ================= */
app.put("/orders/:orderId", (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;

  const orders = readOrders();
  const order = orders.find(o => o.orderId === orderId);

  if (!order) {
    return res.status(404).json({ message: "Order not found" });
  }

  order.status = status;
  writeOrders(orders);

  // Broadcast order update to SSE clients
  try {
    sendSSE('update-order', order);
  } catch (e) { console.error('SSE broadcast error', e); }

  res.json({ success: true, order });
});

// Get loyalty points for a user
app.get("/loyalty-points/:username", (req, res) => {
  const { username } = req.params;
  const loyaltyData = readLoyaltyPoints();
  const points = loyaltyData[username] || 0;
  res.json({ username, points });
});

// Deduct loyalty points (for manual admin adjustment)
app.post("/loyalty-points/:username/deduct", (req, res) => {
  const { username } = req.params;
  const { points } = req.body;
  
  if (!points || points < 0) {
    return res.status(400).json({ success: false, message: "Invalid points value" });
  }
  
  const result = deductLoyaltyPoints(username, points);
  if (!result.success) {
    return res.status(400).json(result);
  }
  
  res.json({ success: true, username, pointsDeducted: points, remainingPoints: result.remainingPoints });
});

// Award loyalty points (for manual admin bonus)
app.post("/loyalty-points/:username/award", (req, res) => {
  const { username } = req.params;
  const { points } = req.body;
  
  if (!points || points <= 0) {
    return res.status(400).json({ success: false, message: "Invalid points value" });
  }
  
  const totalPoints = awardLoyaltyPoints(username, points);
  res.json({ success: true, username, pointsAwarded: points, totalPoints });
});

// Server-Sent Events endpoint for real-time updates (admin dashboard)
app.get('/events', (req, res) => {
  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders && res.flushHeaders();

  // Send initial comment to establish the stream
  res.write(': connected\n\n');

  // Add to clients
  sseClients.push(res);

  // Remove client when connection closes
  req.on('close', () => {
    const idx = sseClients.indexOf(res);
    if (idx !== -1) sseClients.splice(idx, 1);
  });
});

app.get("/", (req, res) => {
  res.send("✅ ImaraCommerce API is running successfully!");
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running on port ${PORT}`);
});


