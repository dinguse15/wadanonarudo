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
  const lines = raw.split('\n').slice(1);
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

function loadState() {
  if (!fs.existsSync(STATE_FILE)) return {};
  return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function getOrders() {
  const orders = loadCSV();
  const state = loadState();
  return orders.map((o) => ({
    ...o,
    collected: state[o.orderNumber + '_' + o.itemJP] || false,
  }));
}

// ---------- API Routes ----------

app.get('/api/orders', (req, res) => {
  res.json(getOrders());
});

app.get('/api/orders/search/:num', (req, res) => {
  const num = req.params.num.trim();
  const matches = getOrders().filter((o) => o.orderNumber === num);
  if (matches.length === 0) return res.status(404).json({ error: 'Order not found' });
  res.json(matches);
});

app.post('/api/orders/collect', (req, res) => {
  const { orderNumber, itemJP } = req.body;
  const state = loadState();
  state[orderNumber + '_' + itemJP] = true;
  saveState(state);
  res.json({ success: true });
});

// Undo a single collected order
app.post('/api/orders/uncollect', (req, res) => {
  const { orderNumber, itemJP } = req.body;
  const state = loadState();
  delete state[orderNumber + '_' + itemJP];
  saveState(state);
  res.json({ success: true });
});

// Reset ALL collected orders
app.post('/api/reset', (req, res) => {
  saveState({});
  res.json({ success: true });
});

app.get('/api/summary', (req, res) => {
  const orders = getOrders();
  const summary = {};

  for (const o of orders) {
    if (!summary[o.item]) summary[o.item] = { total: 0, remaining: 0 };
    summary[o.item].total++;
    if (!o.collected) summary[o.item].remaining++;
  }

  res.json({
    totalCustomers: orders.length,
    remaining: orders.filter((o) => !o.collected).length,
    items: summary,
  });
});

// ---------- Start ----------
app.listen(PORT, () => {
  console.log(`Server running!`);
  console.log(`  Kitchen:    http://localhost:${PORT}/kitchen.html`);
  console.log(`  Stock:      http://localhost:${PORT}/stock.html`);
  console.log(`  TV Display: http://localhost:${PORT}/admin.html`);
});
