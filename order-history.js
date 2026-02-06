const API_URL = "http://localhost:8000/orders";

document.addEventListener("DOMContentLoaded", async () => {
  const user = localStorage.getItem("loggedInUserId");
  const userInfo = document.getElementById("userInfo");
  const ordersContainer = document.getElementById("ordersContainer");

  if (!user) {
    ordersContainer.innerHTML =
      '<p class="empty">Please login to see your orders.</p>';
    return;
  }

  // Fetch and display loyalty points
  try {
    const loyaltyRes = await fetch(`http://localhost:8000/loyalty-points/${encodeURIComponent(user)}`);
    const loyaltyData = await loyaltyRes.json();
    userInfo.innerHTML = `<div>Hello, <strong>${user}</strong></div><div class="loyalty-points-display">⭐ ${loyaltyData.points} Loyalty Points</div>`;
  } catch (err) {
    console.error("Error fetching loyalty points:", err);
    userInfo.textContent = `Hello, ${user}`;
  }

  try {
    const res = await fetch(`${API_URL}?username=${encodeURIComponent(user)}`);
    const orders = await res.json();

    if (!orders || orders.length === 0) {
      ordersContainer.innerHTML =
        '<p class="empty">You have no orders yet.</p>';
      return;
    }

    ordersContainer.innerHTML = "";

    orders.reverse().forEach(order => {
      const itemsList = order.items
        .map(i => `<li>${i.name} × ${i.qty} = ${i.price.toLocaleString()} RWF</li>`)
        .join("");

      const whatsappText = encodeURIComponent(
        `Hello, I want to ask about my order:
Order ID: ${order.orderId}
Total: ${order.total.toLocaleString()} RWF`
      );

      const card = document.createElement("div");
      card.className = "order-card";
      const pointsInfo = order.loyaltyPointsAwarded ? `<p style="color: #ff9800; font-weight: 600;">⭐ +${order.loyaltyPointsAwarded} Loyalty Points</p>` : '';
      card.innerHTML = `
        <p class="order-id">Order ID: ${order.orderId}</p>
        <p>Date: ${order.date}</p>
        <p class="order-status ${order.status}">
          Status: ${order.status}
        </p>
        <ul>${itemsList}</ul>
        <p class="order-total">
          Total: ${order.total.toLocaleString()} RWF
        </p>
        ${pointsInfo}
      `;

      // ---------- WHATSAPP BUTTON ----------
      const waBtn = document.createElement("button");
      waBtn.textContent = "Send on WhatsApp";
      waBtn.onclick = () => {
        window.open(`https://wa.me/250781106751?text=${whatsappText}`, "_blank");
      };

      // ---------- PAY NOW BUTTON ----------
      const payBtn = document.createElement("button");
      payBtn.style.marginLeft = "10px";

      if (order.status && order.status.toLowerCase() === "paid") {
        payBtn.textContent = "Paid ✔";
        payBtn.disabled = true;
        payBtn.style.opacity = "0.6";
        payBtn.style.cursor = "not-allowed";
      } else {
        payBtn.textContent = "Pay Now";
        payBtn.onclick = () => startPayment(order);
      }

      // ---------- INVOICE BUTTON ----------
      const invoiceBtn = document.createElement("button");
      invoiceBtn.style.marginLeft = "10px";

      if (order.status && order.status.toLowerCase() === "paid") {
        invoiceBtn.textContent = "Download Invoice";
        invoiceBtn.onclick = () => downloadInvoice(order);
      } else {
        invoiceBtn.textContent = "🔒 Invoice Locked";
        invoiceBtn.disabled = true;
        invoiceBtn.style.opacity = "0.6";
        invoiceBtn.style.cursor = "not-allowed";
      }

      card.appendChild(waBtn);
      card.appendChild(payBtn);
      card.appendChild(invoiceBtn);
      ordersContainer.appendChild(card);
    });
  } catch (err) {
    console.error(err);
    ordersContainer.innerHTML =
      '<p class="empty">Failed to load orders.</p>';
  }
});

// ================= PAYMENT FUNCTION =================
function startPayment(order) {
  // Create overlay
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.top = "0";
  overlay.style.left = "0";
  overlay.style.width = "100%";
  overlay.style.height = "100%";
  overlay.style.backgroundColor = "rgba(0,0,0,0.6)";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.zIndex = "9999";

  // Create popup container
  const popup = document.createElement("div");
  popup.style.backgroundColor = "#fff";
  popup.style.padding = "20px";
  popup.style.borderRadius = "10px";
  popup.style.width = "90%";
  popup.style.maxWidth = "500px";
  popup.style.maxHeight = "90%";
  popup.style.overflowY = "auto";
  popup.style.boxShadow = "0 5px 15px rgba(0,0,0,0.3)";

  // Build order items HTML
  let itemsHtml = order.items.map(i => 
    `<li>${i.name} × ${i.qty} = ${i.price.toLocaleString()} RWF</li>`).join("");

  // Popup HTML with user input fields
  popup.innerHTML = `
    <h2>Order #${order.orderId}</h2>
    <p><strong>Date:</strong> ${order.date}</p>
    <p><strong>Items:</strong></p>
    <ul>${itemsHtml}</ul>
    <p><strong>Total:</strong> ${order.total.toLocaleString()} RWF</p>
    <p><strong>Payment Method:</strong> Momo</p>
    <hr>
    <h3>Your Information</h3>
    <label>Full Name:</label><br>
    <input type="text" id="userFullName" placeholder="Your full name" style="width: 100%; margin-bottom: 10px; padding:5px;"><br>
    <label>Phone Number:</label><br>
    <input type="text" id="userPhone" placeholder="Your phone number" style="width: 100%; margin-bottom: 10px; padding:5px;"><br>
    <label>Address:</label><br>
    <textarea id="userAddress" placeholder="Your address" style="width: 100%; margin-bottom: 10px; padding:5px;"></textarea>
    <hr>
    <p><strong>Receiver Info:</strong><br>
      Name: Iradukunda Jacques<br>
      Phone: 0793549871<br>
      Momo Code: *182*8*1*1946159#
    </p>
    <div style="text-align: right; margin-top: 20px;">
      <button id="confirmPay" style="padding: 8px 15px; margin-right: 10px;">
        Confirm Payment via WhatsApp
      </button>
      <button id="cancelPay" style="padding: 8px 15px;">Cancel</button>
    </div>
  `;

  overlay.appendChild(popup);
  document.body.appendChild(overlay);

  // Cancel button closes popup
  document.getElementById("cancelPay").onclick = () => {
    document.body.removeChild(overlay);
  };

  // Confirm button sends WhatsApp message
  document.getElementById("confirmPay").onclick = () => {
    const fullName = document.getElementById("userFullName").value.trim();
    const phone = document.getElementById("userPhone").value.trim();
    const address = document.getElementById("userAddress").value.trim();

    if (!fullName || !phone || !address) {
      alert("Please fill in all your information before confirming payment.");
      return;
    }

    const whatsappText = encodeURIComponent(
      `Hello, I have completed payment for my order:

Order ID: ${order.orderId}
Total: ${order.total.toLocaleString()} RWF

--- My Information ---
Name: ${fullName}
Phone: ${phone}
Address: ${address}

--- Receiver Info ---
Name: Iradukunda Jacques
Phone: 0793549871
Momo Code: *182*8*1*1946159#`
    );

    window.open(`https://wa.me/250793549871?text=${whatsappText}`, "_blank");
    document.body.removeChild(overlay);
  };
}


// ================= INVOICE FUNCTION =================
function downloadInvoice(order) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  let y = 20;

  // -------- LOGO --------
  const img = new Image();
  img.src = "images/ImaraCommerce_logo_transparent.png";

  img.onload = () => {
    doc.addImage(img, "PNG", 20, y, 40, 15);

    // -------- COMPANY INFO --------
    doc.setFontSize(14);
    doc.text("Imara Commerce", 105, y + 10, { align: "center" });
    doc.setFontSize(10);
    doc.text("+250 781106751 | imaracommerce@gmail.com", 105, y + 16, { align: "center" });
    doc.text("Kigali, Rwanda", 105, y + 22, { align: "center" });

    y += 40;

    // -------- PAID STAMP --------
    if (order.status && order.status.toLowerCase() === "paid") {
      doc.setTextColor(200, 0, 0);
      doc.setFontSize(50);
      doc.setFont("helvetica", "bold");

      doc.saveGraphicsState();
      doc.setGState(new doc.GState({ opacity: 0.15 }));
      doc.text("PAID", 105, 140, {
        align: "center",
        angle: 30
      });
      doc.restoreGraphicsState();
    }

    // -------- INVOICE HEADER --------
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(16);
    doc.text("INVOICE", 105, y, { align: "center" });
    y += 10;

    doc.setFontSize(11);
    doc.text(`Order ID: ${order.orderId}`, 20, y);

    let formattedDate = "N/A";
    if (order.date) {
      const parts = order.date.split(",");
      if (parts.length === 2) {
        formattedDate = parts[0].trim() + " " + parts[1].trim().slice(0, 5);
      }
    }
    doc.text(`Date: ${formattedDate}`, 150, y);
    y += 10;

    // -------- CUSTOMER INFO --------
    if (order.address) {
      doc.text("Customer Information:", 20, y);
      y += 6;
      doc.text(`Full Name: ${order.address.fullName}`, 25, y);
      y += 6;
      doc.text(`Phone: ${order.payment?.momoNumber || "N/A"}`, 25, y);
      y += 6;
      doc.text(`Address: ${order.address.address}`, 25, y);
      y += 6;
      doc.text(`City: ${order.address.city}`, 25, y);
      y += 6;
      doc.text(`ZIP Code: ${order.address.zip}`, 25, y);
      y += 10;
    }

    // -------- TABLE --------
    const startX = 20;
    const rowHeight = 7;
    const colWidths = [10, 90, 20, 30, 30];

    doc.setFillColor(41, 128, 185);
    doc.setTextColor(255, 255, 255);
    doc.rect(startX, y, colWidths.reduce((a,b)=>a+b), rowHeight, "F");

    doc.text("No.", startX + 2, y + 5);
    doc.text("Item", startX + 12, y + 5);
    doc.text("Qty", startX + 102, y + 5);
    doc.text("Price", startX + 122, y + 5);
    doc.text("Subtotal", startX + 152, y + 5);

    y += rowHeight;

    doc.setTextColor(0,0,0);
    order.items.forEach((item, i) => {
      doc.rect(startX, y, colWidths.reduce((a,b)=>a+b), rowHeight);
      doc.text(String(i + 1), startX + 2, y + 5);
      doc.text(item.name, startX + 12, y + 5);
      doc.text(String(item.qty), startX + 102, y + 5);
      doc.text(item.price.toLocaleString(), startX + 122, y + 5);
      doc.text((item.qty * item.price).toLocaleString(), startX + 152, y + 5);
      y += rowHeight;
    });

    y += 5;
    doc.setFontSize(12);
    doc.text(`Total: ${order.total.toLocaleString()} RWF`, 150, y);

    y += 15;
    doc.setFontSize(10);
    doc.text("Thank you for shopping with Imara Commerce!", 105, y, { align: "center" });

    doc.save(`Invoice-${order.orderId}.pdf`);
  };
}
