const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'client')));

// ---------- Load CSV on startup ----------
const CSV_FILE = path.join(__dirname, 'orders.csv');
const STATE_FILE = path.join(__dirname, 'state.json');

// Item name mapping (Japanese → English label)
const ITEM_LABELS = {
  'ワックチキン(単品)': 'Wac Chicken',
  'ワックチキチー(単品)': 'Wac Chiki-Chi',
  'ワッピーセットA': 'Combo A',
  'ワッピーセットB': 'Combo B',
  'ワッピーセットC': 'Combo C',
  'ワッピーセットD': 'Combo D',
};

function loadCSV() {
  const raw = fs.readFileSync(CSV_FILE, 'utf-8');
  const lines = raw.split('\n').slice(1); // skip header
  const orders = [];

  for (const line of lines) {
    const cols = line.split(',');
    if (!cols[1] || !cols[2]) continue;
    const orderNum = cols[1].trim();
    const itemJP = cols[2].trim();
    if (!orderNum || !itemJP) continue;

    orders.push({
      orderNumber: orderNum,
      itemJP: itemJP,
      item: ITEM_LABELS[itemJP] || itemJP,
      collected: false,
    });
  }
  return orders;
}

// Load state (who has collected) from state.json
function loadState() {
  if (!fs.existsSync(STATE_FILE)) return {};
  return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// Merge CSV orders with saved state
function getOrders() {
  const orders = loadCSV();
  const state = loadState();
  return orders.map((o) => ({
    ...o,
    collected: state[o.orderNumber + '_' + o.itemJP] || false,
  }));
}

// ---------- API Routes ----------

// Get all orders (with collected status)
app.get('/api/orders', (req, res) => {
  const orders = getOrders();
  res.json(orders);
});

// Search by order number
app.get('/api/orders/search/:num', (req, res) => {
  const num = req.params.num.trim();
  const orders = getOrders();
  const matches = orders.filter((o) => o.orderNumber === num);
  if (matches.length === 0) {
    return res.status(404).json({ error: 'Order not found' });
  }
  res.json(matches);
});

// Mark order as collected
app.post('/api/orders/collect', (req, res) => {
  const { orderNumber, itemJP } = req.body;
  const state = loadState();
  state[orderNumber + '_' + itemJP] = true;
  saveState(state);
  res.json({ success: true });
});

// Get summary: remaining counts per item
app.get('/api/summary', (req, res) => {
  const orders = getOrders();
  const summary = {};

  for (const o of orders) {
    const label = o.item;
    if (!summary[label]) {
      summary[label] = { total: 0, remaining: 0 };
    }
    summary[label].total++;
    if (!o.collected) summary[label].remaining++;
  }

  const totalCustomers = orders.length;
  const remaining = orders.filter((o) => !o.collected).length;

  res.json({ totalCustomers, remaining, items: summary });
});

// ---------- Start ----------
app.listen(PORT, () => {
  console.log(`Server running!`);
  console.log(`  Kitchen: http://localhost:${PORT}/kitchen.html`);
  console.log(`  TV Display: http://localhost:${PORT}/admin.html`);
});
