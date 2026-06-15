const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'records.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'docs')));

function readData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { production: [], downtime: [], config: { dailyTarget: 5000, hourlyTarget: 400, buckets: ['Bucket 1', 'Bucket 2', 'Bucket 3', 'Bucket 4', 'Bucket 5'] } };
  }
}

function writeData(data) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

app.get('/api/data', (_req, res) => {
  res.json(readData());
});

app.get('/api/data/:date', (req, res) => {
  const data = readData();
  const date = req.params.date;
  res.json({
    production: data.production.filter(r => r.date === date),
    downtime: data.downtime.filter(r => r.date === date),
    config: data.config
  });
});

app.post('/api/production', (req, res) => {
  const data = readData();
  const record = { id: genId(), createdAt: new Date().toISOString(), ...req.body };
  data.production.push(record);
  writeData(data);
  res.status(201).json(record);
});

app.post('/api/downtime', (req, res) => {
  const data = readData();
  const record = { id: genId(), createdAt: new Date().toISOString(), ...req.body };
  data.downtime.push(record);
  writeData(data);
  res.status(201).json(record);
});

app.put('/api/downtime/:id', (req, res) => {
  const data = readData();
  const idx = data.downtime.findIndex(r => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  data.downtime[idx] = { ...data.downtime[idx], ...req.body, updatedAt: new Date().toISOString() };
  writeData(data);
  res.json(data.downtime[idx]);
});

app.delete('/api/production/:id', (req, res) => {
  const data = readData();
  data.production = data.production.filter(r => r.id !== req.params.id);
  writeData(data);
  res.json({ ok: true });
});

app.delete('/api/downtime/:id', (req, res) => {
  const data = readData();
  data.downtime = data.downtime.filter(r => r.id !== req.params.id);
  writeData(data);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Bucket Dashboard running at http://localhost:${PORT}`);
  console.log(`  Dashboard: http://localhost:${PORT}/`);
  console.log(`  Form:      http://localhost:${PORT}/form.html`);
});
