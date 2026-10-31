const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const pageDir = path.join(__dirname, '..');
const dataFilePath = path.join(pageDir, 'data.json');
const frameFeedPath = path.join(pageDir, 'camera_feed.jpg');
const snapshotPath = path.join(__dirname, '../../camera_check.jpg');

// Serve static frontend assets
app.use(express.static(pageDir));

app.get('/', (req, res) => {
  res.sendFile(path.join(pageDir, 'Index.html'));
});

// REST API endpoint
app.get('/api/data', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  if (fs.existsSync(dataFilePath)) {
    res.send(fs.readFileSync(dataFilePath, 'utf8'));
  } else {
    res.send(JSON.stringify({ chart: { status: 'waiting' } }));
  }
});

// MJPEG Video Feed
app.get('/video_feed', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'multipart/x-mixed-replace; boundary=frame',
    'Cache-Control': 'no-cache, private',
    'Pragma': 'no-cache'
  });

  const interval = setInterval(() => {
    const target = fs.existsSync(frameFeedPath) ? frameFeedPath : snapshotPath;
    if (fs.existsSync(target)) {
      try {
        const frame = fs.readFileSync(target);
        res.write(`--frame\r\nContent-Type: image/jpeg\r\n\r\n`);
        res.write(frame);
        res.write('\r\n');
      } catch (err) {}
    }
  }, 80);

  req.on('close', () => {
    clearInterval(interval);
  });
});

let latestData = null;

function readDataFromFile() {
  try {
    if (!fs.existsSync(dataFilePath)) return null;
    const rawData = fs.readFileSync(dataFilePath, 'utf8');
    if (!rawData || !rawData.trim()) return null;
    return JSON.parse(rawData);
  } catch (error) {
    return null;
  }
}

wss.on('connection', (ws) => {
  if (latestData) {
    ws.send(JSON.stringify(latestData));
  }
});

setInterval(() => {
  latestData = readDataFromFile();
  if (latestData) {
    const msg = JSON.stringify(latestData);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    });
  }
}, 1000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`[CAMS Node Server] Started at http://localhost:${PORT}`);
});
