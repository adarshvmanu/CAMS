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

// Serve static frontend files (HTML, CSS, JS)
app.use(express.static(pageDir));

app.get('/', (req, res) => {
  res.sendFile(path.join(pageDir, 'Index.html'));
});

let latestData = null;

function readDataFromFile() {
    try {
      if (!fs.existsSync(dataFilePath)) {
        return null;
      }
      const rawData = fs.readFileSync(dataFilePath, 'utf8');
      if (!rawData || !rawData.trim()) {
        return null;
      }
      return JSON.parse(rawData);
    } catch (error) {
      console.error('Error reading data from file:', error);
      return null;
    }
  }

wss.on('connection', (ws) => {
  if (latestData) {
    ws.send(JSON.stringify(latestData));
    console.log('Server Sent Data');
  }
});

setInterval(() => {
  latestData = readDataFromFile();
  if (latestData) {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(latestData));
      }
    });
  }
}, 3000); 

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server started at http://localhost:${PORT}`);
});
