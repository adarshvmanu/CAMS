const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let latestData = null;

function readDataFromFile() {
    try {
      const originalFilePath = '../data.json';
      const data = fs.readFileSync(originalFilePath, 'utf8');
      return JSON.parse(data);
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

server.listen(3000, () => {
  console.log('Server started on port 3000');
});
