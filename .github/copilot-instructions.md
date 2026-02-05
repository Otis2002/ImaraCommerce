# Imara Commerce - AI Coding Agent Instructions

## Project Overview

Imara Commerce is a **full-stack e-commerce platform** for digital trade in Rwanda. It's a hybrid architecture combining:
- **Frontend**: Vanilla JavaScript + HTML/CSS static pages
- **Backend**: Node.js/Express admin server (port 8000)
- **Auth**: Firebase Authentication with Firestore
- **Data Persistence**: localStorage (client-side) + JSON file storage (Admin/orders.json)

**Key Insight**: This is primarily a **static site with dynamic cart/order management**, not a traditional SPA. Pages are HTML files with inline scripts; data flows through localStorage and Firebase.

---

## Architecture & Critical Components

### Frontend Structure (Client-Side)

**Main Pages** (`*.html` in root):
- `index.html` - Homepage with product showcase and cart display
- `products.html` - Product catalog (1265+ lines, extensive filtering)
- `Cart33.html` - Shopping cart management
- `checkout.html` - Checkout form with order summary
- `Userloginpage.html` - Authentication UI (calls `firebaseauth.js`)
- `order-history.html` - User order tracking
- `Categories/*` - Category landing pages

**Key Patterns**:
- Each page has **inline `<script>` blocks** containing page logic
- Shared CSS in `style.css` (615+ lines)
- **No build step** - files served directly
- Mobile-first responsive design with CSS media queries

### Backend Architecture (Admin Server)

**File**: `Admin/server.js` (Node.js/Express, port 8000)

**Endpoints**:
```
POST   /admin/login              - Admin authentication (hardcoded credentials)
GET    /orders                   - Fetch orders (optionally filtered by username)
POST   /orders                   - Create new order
PUT    /orders/:orderId          - Update order status
GET    /events                   - Server-Sent Events (SSE) for real-time admin dashboard
```

**Data Flow**: Orders are persisted to `Admin/orders.json` (JSON file, not database)

**Real-Time Updates**: SSE stream broadcasts `new-order` and `update-order` events to connected admin clients

### Authentication & User Data

**File**: `firebaseauth.js` (Firebase SDK v12.7.0)

**Flow**:
1. User signs up/logs in via Firebase Auth (email/password)
2. User profile stored in Firestore `users` collection
3. Upon login, Firebase user UID stored in `localStorage.setItem('loggedInUserId', user.uid)`
4. Cart operations use this UID as key: `cart_${userId}`

**Critical**: Guests use `guest_cart` key; must merge when user logs in (see `index.html` login flow)

### Cart & Order Management

**Data Structure** (localStorage):
```javascript
// Guest cart
localStorage.getItem('guest_cart') 
// → [{ name, price, qty }, ...]

// Logged-in user cart
localStorage.getItem(`cart_${userId}`)

// All orders (stored backend)
// Admin/orders.json → [{ orderId, username, items, total, date, status }, ...]
```

**Key Functions** (repeated across pages):
- `addToCart(name, price)` - Add item, increment qty if exists
- `removeItem(index)` - Remove from cart
- `changeQty(index, delta)` - Update quantity
- `renderCart()` - Re-render cart display
- `placeOrder()` - Create order, POST to backend, merge guest cart if needed
- `sendOrderToWhatsApp()` - Share cart to WhatsApp (+250781106751)

---

## Developer Workflows

### Running the Admin Backend

```bash
cd Admin
npm install          # First time only (Express, body-parser, cors)
npm start            # Runs server.js on http://localhost:8000
```

**Credentials** (hardcoded in server.js):
- Username: `admin`
- Password: `Rwanda20002`

### Adding Products

Products are **hardcoded in HTML** (not fetched from database). To add a product:

1. **In `index.html` or `products.html`**: Add `<div class="product">` block inside `.products-container`
2. **Required fields**:
   ```html
   <a href="/Details/ProductName.html"><img src="path/to/image" alt="Name"></a>
   <h4>Product Name</h4>
   <p>Price in RWF</p>
   <button onclick="addToCart('Product Name', 12345)">Add to Cart</button>
   ```
3. **Create detail page** at `Details/ProductName.html` (copy pattern from existing files)
4. **Add to autocomplete search** in index.html `productsData` array

### Category Management

**Files**: `Categories/*.html` + `Categories/style.css`

Each category page manually lists filtered products. No dynamic category fetching.

### Static Assets

Images organized in `images/` and `Details/images/MyItems/`:
- `Clothes/`, `Electronics/`, `Shoes/`, `Furnitures/`, `Household Items/`, `Vehicles/`
- Videos: `hero.mp4`, `tranding ads.mp4`

---

## Project-Specific Patterns & Conventions

### 1. **Cart Synchronization Across Pages**
After any cart change (`addToCart`, `removeItem`, `changeQty`), **always call**:
```javascript
renderCart();        // Update display
updateCartCount();   // Update badge
```

### 2. **User Authentication Check**
Many pages require login. Standard pattern:
```javascript
const user = localStorage.getItem("loggedInUserId");
if (!user) {
  alert("Please login");
  window.location.href = "Userloginpage.html";
  return;
}
```

### 3. **Guest Cart Merging on Login**
When user logs in, merge `guest_cart` into their personal cart (see `placeOrder()` function). This prevents loss of pre-login items.

### 4. **Cart Key Helper**
```javascript
function getCartKey() {
  const user = localStorage.getItem("loggedInUserId");
  return user ? `cart_${user}` : null;
}
```
Use this to determine the correct localStorage key.

### 5. **WhatsApp Integration**
Order sharing uses WhatsApp API: `https://wa.me/250781106751?text=MESSAGE`

Message must be URL-encoded; items formatted as `${name} x ${qty} = RWF ${total}`.

### 6. **Sidebar Navigation**
Fixed-position sidebar with overlay backdrop (no hamburger menu state persisted). Pattern:
```javascript
// In each category page or sidebar toggle
sidebar.classList.add("active");      // Show
overlay.classList.add("active");      // Show overlay
// User clicks overlay or link → closeSidebar()
sidebar.classList.remove("active");
overlay.classList.remove("active");
```

### 7. **Server-Sent Events (SSE) for Admin**
Admin dashboard connects to `/events` endpoint. Client receives real-time order updates:
```javascript
const eventSource = new EventSource("http://localhost:8000/events");
eventSource.addEventListener("new-order", e => {
  const order = JSON.parse(e.data);
  // Update dashboard UI
});
```

### 8. **CSS Grid for Product Display**
Responsive grid layout in `.products-container`:
- Mobile (≤600px): 2 columns
- Tablet (601-900px): 2-3 columns  
- Desktop (≥1200px): 4 columns

### 9. **Order Structure**
Orders created by `placeOrder()` have this schema:
```javascript
{
  orderId: "ORD-" + Date.now(),
  username: userId,
  items: [{ name, price, qty }, ...],
  total: number,
  date: new Date().toLocaleString(),
  status: "Pending" // Updated via PUT /orders/:orderId
}
```

---

## Integration Points & External Dependencies

### Firebase
- **Auth**: Email/password signup and signin
- **Firestore**: User profiles stored in `users` collection
- **Config**: Hardcoded in `firebaseauth.js` (no .env file)

### Backend Integration
- **Order Creation**: `placeOrder()` POSTs to backend `/orders`
- **Order Retrieval**: `order-history.js` GETs from `/orders?username=USER`
- **Admin Updates**: Backend PUT endpoint updates order status

### Third-Party Services
- **WhatsApp**: Fixed number +250781106751
- **Font**: Google Fonts (Poppins)
- **Icons**: Font Awesome 4.7.0

---

## Common Pitfalls & Edge Cases

1. **Cart Not Updating**: Always call `renderCart()` AND `updateCartCount()` after changes
2. **Lost Guest Cart on Login**: Ensure `placeOrder()` merges guest cart before clearing
3. **Product Images Failing**: Check image paths are relative to root (e.g., `/Details/images/MyItems/...`)
4. **Admin Backend Down**: If port 8000 unavailable, orders POST will fail silently; check console
5. **CORS Issues**: Backend has CORS enabled; ensure requests use full URL with protocol
6. **FirebaseAuth Not Loading**: Requires `type="module"` in script tag; check `Userloginpage.html`

---

## References

- **Firebase Config**: `firebaseauth.js` (lines 1-20)
- **Admin Server**: `Admin/server.js` (API contracts)
- **Cart Logic**: `index.html` (lines with `addToCart`, `renderCart`, `placeOrder`)
- **Order History Fetch**: `order-history.js` (API URL: `http://localhost:8000/orders`)
- **Styling Reference**: `style.css` (responsive breakpoints, `.product` card styles)
