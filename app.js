// ── Load shoes data ──
let shoesData = [];
fetch("shoes.json").then(r => r.json()).then(data => { shoesData = data.products; });

// ── Cart ──
const cart = [];

// ── Contacts ──
const contacts = [
  { id: 1, name: "StepStyle Shoes 👟", avatar: "SS", lastMsg: "Welcome! How can I help you?", time: "Now", unread: 1 },
  { id: 2, name: "Order Updates", avatar: "OU", lastMsg: "Your order #1234 is shipped!", time: "Yesterday", unread: 0 },
  { id: 3, name: "Support", avatar: "SP", lastMsg: "How can we help you?", time: "Yesterday", unread: 0 },
];

const chatHistory = {
  2: [
    { type: "incoming", text: "📦 Your order #1234 has been shipped!", time: "Yesterday" },
    { type: "incoming", text: "Expected delivery: Tomorrow by 6 PM.", time: "Yesterday" },
  ],
  3: [
    { type: "incoming", text: "Hi! How can we help you today?", time: "Yesterday" },
  ],
};

let activeContactId = 1;

// ── Render contacts ──
function renderContacts() {
  const list = document.getElementById("chatList");
  list.innerHTML = "";
  contacts.forEach(c => {
    const div = document.createElement("div");
    div.className = `contact-item ${c.id === activeContactId ? "active" : ""}`;
    div.innerHTML = `
      <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(c.avatar)}&background=2a3942&color=e9edef&size=40" class="avatar"/>
      <div class="contact-info"><h5>${c.name}</h5><p>${c.lastMsg}</p></div>
      <div class="contact-meta">
        <span class="time">${c.time}</span>
        ${c.unread ? `<span class="badge">${c.unread}</span>` : ""}
      </div>`;
    div.addEventListener("click", () => switchContact(c.id));
    list.appendChild(div);
  });
}

function switchContact(id) {
  activeContactId = id;
  const contact = contacts.find(c => c.id === id);
  contact.unread = 0;
  document.getElementById("chatName").textContent = contact.name;
  document.getElementById("chatAvatar").src =
    `https://ui-avatars.com/api/?name=${encodeURIComponent(contact.avatar)}&background=25D366&color=fff&size=40`;
  renderContacts();
  renderMessages();
}

// ── Render messages ──
function renderMessages() {
  const container = document.getElementById("messagesInner");
  container.innerHTML = "";
  const divider = document.createElement("div");
  divider.className = "date-divider";
  divider.innerHTML = `<span>Today</span>`;
  container.appendChild(divider);
  (chatHistory[activeContactId] || []).forEach(msg => {
    if (msg.card) appendProductCard(msg.card, false);
    else appendMessage(msg.type, msg.text, msg.time, false);
  });
  scrollToBottom();
}

// ── Append text message ──
function appendMessage(type, text, time, save = true) {
  const container = document.getElementById("messagesInner");
  const div = document.createElement("div");
  div.className = `message ${type}`;
  div.innerHTML = `${text}<span class="msg-time">${time}${type === "outgoing" ? ' <i class="fa-solid fa-check-double"></i>' : ""}</span>`;
  container.appendChild(div);
  if (save) {
    if (!chatHistory[activeContactId]) chatHistory[activeContactId] = [];
    chatHistory[activeContactId].push({ type, text, time });
  }
  scrollToBottom();
}

// ── Append quick reply buttons ──
function appendQuickReplies(buttons) {
  const container = document.getElementById("messagesInner");
  const wrap = document.createElement("div");
  wrap.className = "quick-replies";
  buttons.forEach(btn => {
    const b = document.createElement("button");
    b.className = "qr-btn";
    b.textContent = btn.label;
    b.addEventListener("click", () => {
      wrap.remove();
      appendMessage("outgoing", btn.label, now());
      setTimeout(() => btn.action(), 600);
    });
    wrap.appendChild(b);
  });
  container.appendChild(wrap);
  scrollToBottom();
}

// ── Build a single product card element ──
function buildProductCard(product) {
  const card = document.createElement("div");
  card.className = "product-card";
  const stars = "⭐".repeat(Math.round(product.rating));
  card.innerHTML = `
    <img src="${product.image}" class="card-img" alt="${product.name}" onerror="this.src='https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=300&fit=crop'"/>
    <div class="card-body">
      <div class="card-brand">${product.brand} · ${product.category}</div>
      <div class="card-name">${product.name}</div>
      <div class="card-rating">${stars} <span>${product.rating}/5</span></div>
      <div class="card-price">$${product.price.toFixed(2)}</div>
      <div class="card-sizes">Sizes: ${product.sizes.join(", ")}</div>
      <div class="card-colors">🎨 ${product.colors.join(" · ")}</div>
      <div class="card-actions">
        <a class="btn-shop" href="${product.store_url || '#'}" target="_blank">🛍️ Shop Now</a>
      </div>
    </div>`;
  return card;
}

// ── Append a single product card ──
function appendProductCard(product, save = true) {
  const container = document.getElementById("messagesInner");
  const card = buildProductCard(product);
  container.appendChild(card);
  if (save) {
    if (!chatHistory[activeContactId]) chatHistory[activeContactId] = [];
    chatHistory[activeContactId].push({ card: product });
  }
  scrollToBottom();
}

// ── Typing indicator ──
function showTyping() {
  const container = document.getElementById("messagesInner");
  const el = document.createElement("div");
  el.className = "typing-indicator";
  el.id = "typingIndicator";
  el.innerHTML = `<span></span><span></span><span></span>`;
  container.appendChild(el);
  scrollToBottom();
}
function hideTyping() {
  const el = document.getElementById("typingIndicator");
  if (el) el.remove();
}

function now() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function scrollToBottom() {
  const c = document.getElementById("messages");
  c.scrollTop = c.scrollHeight;
}

// ── Bot flow ──
function botReply(text, delay = 900) {
  showTyping();
  return new Promise(resolve => setTimeout(() => {
    hideTyping();
    appendMessage("incoming", text, now());
    resolve();
  }, delay));
}

// ── Welcome flow ──
async function sendWelcome() {
  await botReply("👋 Welcome to *StepStyle Shoes*! 👟\nYour one-stop shop for premium footwear.");
  await botReply("What would you like to do today?", 600);
  appendQuickReplies([
    { label: "👟 Browse Catalog", action: showCategories },
    { label: "🔥 Top Rated", action: showTopRated },
    { label: "💰 Under $100", action: showBudget },
    { label: "🛒 View Cart", action: showCart },
  ]);
}

// ── Show categories ──
async function showCategories() {
  const categories = [...new Set(shoesData.map(p => p.category))];
  await botReply("Here are our categories. Pick one to explore 👇");
  appendQuickReplies(
    categories.map(cat => ({
      label: cat,
      action: () => showByCategory(cat)
    })).concat([{ label: "⬅️ Back", action: sendWelcome }])
  );
}

// ── Show by category ──
// ── Append a row of product cards ──
function appendProductRow(productList) {
  const row = document.createElement("div");
  row.className = "product-row";
  productList.forEach(p => row.appendChild(buildProductCard(p)));
  document.getElementById("messagesInner").appendChild(row);
  scrollToBottom();
}

async function showByCategory(category) {
  const filtered = shoesData.filter(p => p.category === category);
  await botReply(`Here are our *${category}* shoes (${filtered.length} items) 👇`);
  appendProductRow(filtered);
  appendQuickReplies([
    { label: "🔁 Browse More", action: showCategories },
    { label: "🏠 Main Menu", action: sendWelcome },
  ]);
}

// ── Top rated ──
async function showTopRated() {
  const top = [...shoesData].sort((a, b) => b.rating - a.rating).slice(0, 6);
  await botReply("🌟 Here are our top-rated shoes!");
  appendProductRow(top);
  appendQuickReplies([
    { label: "👟 Browse Catalog", action: showCategories },
    { label: "🏠 Main Menu", action: sendWelcome },
  ]);
}

// ── Budget filter ──
async function showBudget() {
  const affordable = shoesData.filter(p => p.price < 100);
  await botReply(`💰 Great picks under $100! (${affordable.length} items)`);
  appendProductRow(affordable);
  appendQuickReplies([
    { label: "👟 Browse Catalog", action: showCategories },
    { label: "🏠 Main Menu", action: sendWelcome },
  ]);
}

// ── Add to cart ──
function addToCart(productId) {
  const product = shoesData.find(p => p.id === productId);
  const existing = cart.find(i => i.id === productId);
  if (existing) existing.qty++;
  else cart.push({ ...product, qty: 1 });
  appendMessage("incoming", `✅ *${product.name}* added to cart! 🛒\nType "cart" or tap View Cart to checkout.`, now());
}

// ── Show detail ──
async function showDetail(productId) {
  const p = shoesData.find(pr => pr.id === productId);
  await botReply(
    `👟 *${p.name}*\n\n` +
    `🏷️ Brand: ${p.brand}\n` +
    `📂 Category: ${p.category}\n` +
    `👤 Gender: ${p.gender}\n` +
    `💵 Price: $${p.price.toFixed(2)}\n` +
    `⭐ Rating: ${p.rating}/5\n` +
    `📦 In Stock: ${p.stock} pairs\n` +
    `📏 Sizes: ${p.sizes.join(", ")}\n` +
    `🎨 Colors: ${p.colors.join(", ")}\n\n` +
    `📝 ${p.description}`
  );
  appendQuickReplies([
    { label: "🛒 Add to Cart", action: () => addToCart(p.id) },
    { label: "🔁 Browse More", action: showCategories },
    { label: "🏠 Main Menu", action: sendWelcome },
  ]);
}

// ── Show cart ──
async function showCart() {
  if (cart.length === 0) {
    await botReply("🛒 Your cart is empty! Start browsing to add items.");
    appendQuickReplies([{ label: "👟 Browse Catalog", action: showCategories }]);
    return;
  }
  let summary = "🛒 *Your Cart:*\n\n";
  let total = 0;
  cart.forEach((item, i) => {
    summary += `${i + 1}. ${item.name} x${item.qty} — $${(item.price * item.qty).toFixed(2)}\n`;
    total += item.price * item.qty;
  });
  summary += `\n💵 *Total: $${total.toFixed(2)}*`;
  await botReply(summary);
  appendQuickReplies([
    { label: "✅ Checkout", action: checkout },
    { label: "🛍️ Continue Shopping", action: showCategories },
    { label: "🗑️ Clear Cart", action: clearCart },
  ]);
}

// ── Checkout ──
async function checkout() {
  await botReply("🎉 Order placed successfully! Thank you for shopping at *StepStyle Shoes*! 👟\n\nYou'll receive a confirmation shortly.");
  cart.length = 0;
  appendQuickReplies([{ label: "🏠 Main Menu", action: sendWelcome }]);
}

// ── Clear cart ──
async function clearCart() {
  cart.length = 0;
  await botReply("🗑️ Cart cleared!");
  appendQuickReplies([{ label: "👟 Browse Catalog", action: showCategories }]);
}

// ── Render structured bot response ──
function renderBotResponse(data) {
  // Support both formats:
  // New: { text: "...", actions: [...] }
  // Old: { type: "bot_response", actions: [{type:"text", content:"..."}, ...] }
  let textContent = data.text || null;
  let actions = data.actions || [];

  // Extract text from old format
  if (!textContent) {
    const textAction = actions.find(a => a.type === "text");
    if (textAction) textContent = textAction.content;
  }

  if (textContent) {
    appendMessage("incoming", formatText(textContent), now());
  }

  actions.forEach(action => {
    if (action.type === "product_list") {
      const row = document.createElement("div");
      row.className = "product-row";
      action.products.forEach(id => {
        const product = shoesData.find(p => p.id === id);
        if (product) row.appendChild(buildProductCard(product));
      });
      document.getElementById("messagesInner").appendChild(row);
      scrollToBottom();
    } else if (action.type === "quick_replies") {
      appendQuickReplies(
        action.buttons.map(label => ({
          label,
          action: () => quickReplyAction(label)
        }))
      );
    }
  });
}

// ── Map quick reply button labels to actions ──
function quickReplyAction(label) {
  const l = label.toLowerCase();
  if (l.includes("catalog") || l.includes("browse")) { showCategories(); return; }
  if (l.includes("cart")) { showCart(); return; }
  if (l.includes("top rated")) { showTopRated(); return; }
  if (l.includes("under $100") || l.includes("budget")) { showBudget(); return; }
  if (l.includes("menu") || l.includes("main")) { sendWelcome(); return; }
  // For anything else, send as a user message to the bot
  appendMessage("outgoing", label, now());
  setTimeout(() => callNemotron(label), 400);
}

// ── Format bold markdown **text** ──
function formatText(text) {
  return text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br>");
}

// ── Core Nemotron API call ──
async function callNemotron(text) {
  showTyping();
  const history = (chatHistory[activeContactId] || []).filter(m => m.text).slice(-10);
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, history })
    });
    const data = await response.json();
    hideTyping();
    renderBotResponse(data);
    const contact = contacts.find(c => c.id === activeContactId);
    if (contact) {
      const msg = data.text || (data.actions && data.actions.find(a => a.type === "text")?.content) || "";
      if (msg) { contact.lastMsg = msg.slice(0, 40) + "..."; renderContacts(); }
    }
  } catch (err) {
    hideTyping();
    appendMessage("incoming", "⚠️ Bot server is offline. Run server.py first!", now());
  }
}

// ── Handle user text input via Nemotron ──
async function handleUserText(text) {
  const t = text.toLowerCase();
  if (t.includes("cart")) { showCart(); return; }
  if (t.includes("menu") || t.includes("start")) { sendWelcome(); return; }
  await callNemotron(text);
}

// ── Send message ──
function sendMessage() {
  const input = document.getElementById("messageInput");
  const text = input.value.trim();
  if (!text) return;
  appendMessage("outgoing", text, now());
  input.value = "";
  const contact = contacts.find(c => c.id === activeContactId);
  if (contact) contact.lastMsg = text;
  renderContacts();
  if (activeContactId === 1) setTimeout(() => handleUserText(text), 400);
}

// ── Event listeners ──
document.getElementById("sendBtn").addEventListener("click", sendMessage);
document.getElementById("messageInput").addEventListener("keydown", e => {
  if (e.key === "Enter") sendMessage();
});

// ── Init ──
renderContacts();
renderMessages();

// Auto-start welcome for contact 1
if (activeContactId === 1) {
  setTimeout(sendWelcome, 500);
}
