// CAMS Studio - Client Telemetry Engine & Visualization

const MAX_POINTS = 100;
let sessionLogs = [];
let prevStudentStates = {};

// Master Multi-Trace Timeline Plotly Config
const traces = [
  {
    name: 'Attention %',
    x: [],
    y: [],
    mode: 'lines',
    type: 'scatter',
    line: { color: '#10B981', width: 2.5, shape: 'spline' }
  },
  {
    name: 'Facing Board %',
    x: [],
    y: [],
    mode: 'lines',
    type: 'scatter',
    line: { color: '#38BDF8', width: 2, shape: 'spline' }
  },
  {
    name: 'Drowsy %',
    x: [],
    y: [],
    mode: 'lines',
    type: 'scatter',
    line: { color: '#F43F5E', width: 2, dash: 'dot' }
  },
  {
    name: 'Yawn %',
    x: [],
    y: [],
    mode: 'lines',
    type: 'scatter',
    line: { color: '#F59E0B', width: 2, dash: 'dot' }
  }
];

const layout = {
  autosize: true,
  margin: { l: 35, r: 20, t: 25, b: 35 },
  paper_bgcolor: '#1E293B',
  plot_bgcolor: '#1E293B',
  font: { family: 'Inter, sans-serif', color: '#94A3B8', size: 10 },
  legend: { orientation: 'h', x: 0, y: 1.15, font: { color: '#F8FAFC', size: 10 } },
  xaxis: {
    showgrid: true,
    gridcolor: '#334155',
    zeroline: false,
    tickfont: { color: '#94A3B8' }
  },
  yaxis: {
    range: [0, 105],
    showgrid: true,
    gridcolor: '#334155',
    zeroline: false,
    tickfont: { color: '#94A3B8' }
  }
};

const config = { responsive: true, displayModeBar: false };
Plotly.newPlot('master-timeline', traces, layout, config);

// Timeline filter tabs
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    const filter = this.getAttribute('data-filter');

    let visibility = [true, true, true, true];
    if (filter === 'attention') visibility = [true, false, false, false];
    else if (filter === 'facing') visibility = [false, true, false, false];
    else if (filter === 'drowsy') visibility = [false, false, true, false];
    else if (filter === 'yawn') visibility = [false, false, false, true];

    Plotly.restyle('master-timeline', { visible: visibility });
  });
});

// Update UI Components
function updateDashboard(data) {
  const chartData = data.chart || data;
  const timestamp = chartData.timestamp || new Date().toLocaleTimeString();
  const overall = Number(chartData.overall_score || 0);
  const count = Number(chartData.count || 0);
  const attentive = Number(chartData.attention_count || 0);
  const facing = Number(chartData.facing_classroom || 0);
  const sleep = Number(chartData.sleep_detected || 0);
  const yawn = Number(chartData.yawn_detected || 0);
  const students = chartData.students || [];

  // 1. KPI Tiles
  document.getElementById('kpi-overall').textContent = `${overall.toFixed(1)}%`;
  document.getElementById('kpi-attentive').textContent = `${attentive} / ${count}`;
  document.getElementById('kpi-facing').textContent = `${facing.toFixed(0)}%`;
  document.getElementById('kpi-drowsy').textContent = `${sleep.toFixed(0)}% / ${yawn.toFixed(0)}%`;
  document.getElementById('roster-active-count').textContent = `${count} / 4 Active`;
  document.getElementById('video-feed-stats').textContent = `${count} face(s) in view`;

  // 2. Timeline Sliding Window
  Plotly.extendTraces(
    'master-timeline',
    {
      x: [[timestamp], [timestamp], [timestamp], [timestamp]],
      y: [[overall], [facing], [sleep], [yawn]]
    },
    [0, 1, 2, 3],
    MAX_POINTS
  );

  // 3. 4-Seat Roster Matrix
  for (let i = 1; i <= 4; i++) {
    const cardEl = document.getElementById(`seat-${i}`);
    const student = students.find(s => s.id === i) || { id: i, active: false };

    if (!cardEl) continue;

    const statusPill = cardEl.querySelector('.seat-status-pill');
    const scoreEl = cardEl.querySelector('.seat-score');
    const earVal = cardEl.querySelector('.ear-val');
    const marVal = cardEl.querySelector('.mar-val');
    const earFill = cardEl.querySelector('.ear-fill');
    const marFill = cardEl.querySelector('.mar-fill');

    if (student.active) {
      cardEl.className = 'seat-card active';
      const score = Number(student.score || 0);
      scoreEl.textContent = `${score.toFixed(0)}%`;

      if (score >= 80) scoreEl.style.color = '#10B981';
      else if (score >= 50) scoreEl.style.color = '#F59E0B';
      else scoreEl.style.color = '#F43F5E';

      statusPill.textContent = student.status || 'Active';
      statusPill.className = 'seat-status-pill';
      if (student.status === 'Attentive') statusPill.classList.add('good');
      else if (student.status === 'Sleeping') statusPill.classList.add('crit');
      else statusPill.classList.add('warn');

      const ear = Number(student.ear || 0);
      const mar = Number(student.mar || 0);
      earVal.textContent = ear.toFixed(2);
      marVal.textContent = mar.toFixed(1);

      // EAR progress: 0.0 to 0.40 scale
      const earPct = Math.min(Math.max((ear / 0.40) * 100, 5), 100);
      earFill.style.width = `${earPct}%`;
      earFill.style.backgroundColor = (ear < 0.22) ? '#F43F5E' : '#38BDF8';

      // MAR progress: 0.0 to 5.0 scale
      const marPct = Math.min(Math.max((mar / 5.0) * 100, 5), 100);
      marFill.style.width = `${marPct}%`;
      marFill.style.backgroundColor = (mar < 1.8) ? '#F59E0B' : '#38BDF8';

      // Incident event check
      if (prevStudentStates[i] && prevStudentStates[i] !== student.status) {
        logIncident(`Student #${i} transitioned to ${student.status}`, student.status);
      }
      prevStudentStates[i] = student.status;
    } else {
      cardEl.className = 'seat-card empty';
      scoreEl.textContent = '—';
      scoreEl.style.color = '#94A3B8';
      statusPill.textContent = 'Empty Slot';
      statusPill.className = 'seat-status-pill';
      earVal.textContent = '—';
      marVal.textContent = '—';
      earFill.style.width = '0%';
      marFill.style.width = '0%';
      prevStudentStates[i] = 'Empty';
    }
  }

  // 4. Record to session log for CSV export
  sessionLogs.push({
    timestamp,
    overall,
    count,
    attentive,
    facing,
    sleep,
    yawn,
    students: students.map(s => ({ id: s.id, score: s.score, status: s.status, ear: s.ear, mar: s.mar }))
  });
}

// Log incident to event feed
function logIncident(text, status) {
  const list = document.getElementById('events-list');
  const row = document.createElement('div');
  row.className = 'event-row';
  if (status === 'Sleeping') row.classList.add('crit');
  else if (status !== 'Attentive') row.classList.add('warn');

  const now = new Date().toLocaleTimeString();
  row.innerHTML = `<span>${text}</span><span class="event-time">${now}</span>`;
  list.prepend(row);

  // Keep max 20 events in list
  while (list.children.length > 20) {
    list.removeChild(list.lastChild);
  }
}

// Export CSV handler
document.getElementById('btn-export-csv').addEventListener('click', function() {
  if (sessionLogs.length === 0) {
    alert('No telemetry recorded yet in this session.');
    return;
  }

  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += "Timestamp,Overall_Score,Active_Count,Attentive_Count,Facing_Pct,Sleep_Pct,Yawn_Pct," +
    "S1_Score,S1_Status,S2_Score,S2_Status,S3_Score,S3_Status,S4_Score,S4_Status\n";

  sessionLogs.forEach(entry => {
    let sCols = [];
    for (let i = 1; i <= 4; i++) {
      const s = entry.students.find(x => x.id === i);
      if (s) {
        sCols.push(s.score, `"${s.status}"`);
      } else {
        sCols.push("", '""');
      }
    }
    const row = [
      entry.timestamp, entry.overall, entry.count, entry.attentive, entry.facing, entry.sleep, entry.yawn,
      ...sCols
    ].join(",");
    csvContent += row + "\n";
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `cams_session_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
});

// WebSocket Connection Management with Auto-Reconnect
let socket = null;
let reconnectTimer = null;

function connectWebSocket() {
  const badge = document.getElementById('connection-badge');
  const badgeText = document.getElementById('connection-text');
  const host = window.location.host || 'localhost:3000';
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${host}`;

  try {
    socket = new WebSocket(wsUrl);

    socket.onopen = function() {
      badge.className = 'status-badge';
      badgeText.textContent = 'LIVE • 30 FPS';
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      logIncident('Telemetry stream connected', 'Attentive');
    };

    socket.onmessage = function(event) {
      try {
        const payload = JSON.parse(event.data);
        updateDashboard(payload);
      } catch (err) {
        console.error('Error parsing telemetry payload:', err);
      }
    };

    socket.onclose = function() {
      badge.className = 'status-badge disconnected';
      badgeText.textContent = 'RECONNECTING...';
      scheduleReconnect();
    };

    socket.onerror = function() {
      socket.close();
    };
  } catch (err) {
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (!reconnectTimer) {
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connectWebSocket();
    }, 2000);
  }
}

// REST fallback polling in case WebSocket is unavailable
setInterval(() => {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    fetch('/api/data')
      .then(res => res.json())
      .then(data => {
        if (data && data.chart) updateDashboard(data);
      })
      .catch(() => {});
  }
}, 2000);

// Initialize connection
connectWebSocket();
