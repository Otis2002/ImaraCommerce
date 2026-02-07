require("dotenv").config();

const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 8000;

// ====== FIXED CORS ======
app.use(cors({
  origin: "https://imaracommerce.netlify.app", // your frontend URL
  credentials: true, // allow cookies/auth
}));

app.use(bodyParser.json());

// SSE clients
const sseClients = [];

function sendSSE(event, data) {
  const payload = `event: ${event}\n` + `data: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach(res => res.write(payload));
}

// File storage
const ORDERS_FILE = "orders.json";
const LOYALTY_POINTS_FILE = "loyaltyPoints.json";

const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASS = process.env.ADMIN_PASS;

// ===== UTILITY FUNCTIONS =====
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
  if (!loyaltyData[username]) loyaltyData[username] = 0;
  loyaltyData[username] += points;
  writeLoyaltyPoints(loyaltyData);
  return loyaltyData[username];
}

function deductLoyaltyPoints(username, points) {
  const loyaltyData = readLoyaltyPoints();
  if (!loyaltyData[username]) loyaltyData[username] = 0;
  if (loyaltyData[username] < points) return { success: false, message: "Insufficient loyalty points" };
  loyaltyData[username] -= points;
  writeLoyaltyPoints(loyaltyData);
  return { success: true, remainingPoints: loyaltyData[username] };
}

// ===== ROUTES =====

// Admin login
app.post("/admin/login", (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    return res.json({ success: true, message: "Login successful" });
  }
  res.status(401).json({ success: false, message: "Invalid credentials" });
});

// Get orders
app.get("/orders", (req, res) => {
  const { username } = req.query;
  let orders = readOrders();
  if (username) orders = orders.filter(o => o.username === username);
  res.json(orders);
});

// Add new order
app.post("/orders", (req, res) => {
  const order = req.body;
  let orders = readOrders();
  orders.push(order);
  writeOrders(orders);

  const pointsToAward = Math.floor(order.total * 0.0246);
  let loyaltyPoints = awardLoyaltyPoints(order.username, pointsToAward);
  order.loyaltyPointsAwarded = pointsToAward;
  order.totalLoyaltyPoints = loyaltyPoints;

  // Deduct points if payment method allows
  if (order.payment && order.payment.method !== "loyalty") {
    const pointsToUse = Math.floor(order.total * 0.05);
    const result = deductLoyaltyPoints(order.username, pointsToUse);
    order.payment.loyaltyPointsUsed = result.success ? pointsToUse : 0;
    if (result.success) order.total -= pointsToUse;
  }

  // Broadcast SSE
  try { sendSSE('new-order', order); } catch (e) { console.error('SSE error', e); }
  res.json({ success: true, order, loyaltyPoints });
});

// Update order
app.put("/orders/:orderId", (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;

  const orders = readOrders();
  const order = orders.find(o => o.orderId === orderId);
  if (!order) return res.status(404).json({ message: "Order not found" });

  order.status = status;
  writeOrders(orders);

  try { sendSSE('update-order', order); } catch (e) { console.error('SSE error', e); }
  res.json({ success: true, order });
});

// Loyalty points routes
app.get("/loyalty-points/:username", (req, res) => {
  const { username } = req.params;
  const points = readLoyaltyPoints()[username] || 0;
  res.json({ username, points });
});

app.post("/loyalty-points/:username/deduct", (req, res) => {
  const { username } = req.params;
  const { points } = req.body;
  if (!points || points < 0) return res.status(400).json({ success: false, message: "Invalid points" });

  const result = deductLoyaltyPoints(username, points);
  if (!result.success) return res.status(400).json(result);
  res.json({ success: true, username, pointsDeducted: points, remainingPoints: result.remainingPoints });
});

app.post("/loyalty-points/:username/award", (req, res) => {
  const { username } = req.params;
  const { points } = req.body;
  if (!points || points <= 0) return res.status(400).json({ success: false, message: "Invalid points" });

  const totalPoints = awardLoyaltyPoints(username, points);
  res.json({ success: true, username, pointsAwarded: points, totalPoints });
});

// SSE endpoint
app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders && res.flushHeaders();
  res.write(': connected\n\n');

  sseClients.push(res);
  req.on('close', () => {
    const idx = sseClients.indexOf(res);
    if (idx !== -1) sseClients.splice(idx, 1);
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
