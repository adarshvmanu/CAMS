// CAMS Studio - Adaptive Multi-Student Telemetry Engine & Dynamic Visualization

const MAX_POINTS = 100;
let sessionLogs = [];
let prevStudentStates = {};
let maxSessionStudents = 0;

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

// Capacity Selector change handler
const capacitySelect = document.getElementById('capacity-select');
if (capacitySelect) {
  capacitySelect.addEventListener('change', function() {
    const val = this.value;
    const maxFaces = val === 'auto' ? 16 : parseInt(val, 10);
    fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ max_faces: maxFaces, mode: val })
    }).catch(err => console.error('Failed to update capacity config:', err));
    logIncident(`Classroom capacity set to: ${val === 'auto' ? 'Auto-Adaptive' : val + ' Students'}`, 'Attentive');
  });
}

// Dynamically render / update student cards
function renderDynamicRoster(students) {
  const container = document.getElementById('roster-grid');
  const emptyState = document.getElementById('roster-empty');

  if (!students || students.length === 0) {
    container.style.display = 'none';
    emptyState.style.display = 'flex';
    return;
  }

  container.style.display = 'grid';
  emptyState.style.display = 'none';

  // Track max students observed in this session for CSV export
  students.forEach(s => {
    if (s.id > maxSessionStudents) maxSessionStudents = s.id;
  });

  // Track existing DOM cards
  const existingCards = {};
  container.querySelectorAll('.seat-card').forEach(card => {
    const id = parseInt(card.getAttribute('data-id'), 10);
    existingCards[id] = card;
  });

  // Render or update cards for each active student
  students.forEach(student => {
    let cardEl = existingCards[student.id];

    if (!cardEl) {
      cardEl = document.createElement('div');
      cardEl.className = 'seat-card active';
      cardEl.setAttribute('data-id', student.id);
      cardEl.innerHTML = `
        <div class="seat-header">
          <span class="seat-name">Student #${student.id}</span>
          <span class="seat-status-pill">Active</span>
        </div>
        <div class="seat-score-row">
          <span class="seat-score">—</span>
          <span class="seat-score-label">ATTENTION</span>
        </div>
        <div class="seat-metrics">
          <div class="metric-bar-row">
            <span>EAR (Eyes)</span>
            <span class="ear-val">—</span>
            <div class="metric-track"><div class="metric-fill ear-fill" style="width: 0%"></div></div>
          </div>
          <div class="metric-bar-row">
            <span>MAR (Mouth)</span>
            <span class="mar-val">—</span>
            <div class="metric-track"><div class="metric-fill mar-fill" style="width: 0%"></div></div>
          </div>
        </div>
      `;
      container.appendChild(cardEl);
    }

    // Update Card Values
    const scoreEl = cardEl.querySelector('.seat-score');
    const statusPill = cardEl.querySelector('.seat-status-pill');
    const earVal = cardEl.querySelector('.ear-val');
    const marVal = cardEl.querySelector('.mar-val');
    const earFill = cardEl.querySelector('.ear-fill');
    const marFill = cardEl.querySelector('.mar-fill');

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

    const earPct = Math.min(Math.max((ear / 0.40) * 100, 5), 100);
    earFill.style.width = `${earPct}%`;
    earFill.style.backgroundColor = (ear < 0.22) ? '#F43F5E' : '#38BDF8';

    const marPct = Math.min(Math.max((mar / 5.0) * 100, 5), 100);
    marFill.style.width = `${marPct}%`;
    marFill.style.backgroundColor = (mar < 1.8) ? '#F59E0B' : '#38BDF8';

    // Incident logging
    if (prevStudentStates[student.id] && prevStudentStates[student.id] !== student.status) {
      logIncident(`Student #${student.id} transitioned to ${student.status}`, student.status);
    }
    prevStudentStates[student.id] = student.status;
  });

  // Remove cards of students who left
  const activeIds = new Set(students.map(s => s.id));
  Object.keys(existingCards).forEach(idStr => {
    const id = parseInt(idStr, 10);
    if (!activeIds.has(id)) {
      container.removeChild(existingCards[id]);
      prevStudentStates[id] = 'Absent';
    }
  });
}

// Update Dashboard Engine
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
  document.getElementById('roster-active-count').textContent = `${count} Active`;
  document.getElementById('video-feed-stats').textContent = `${count} student(s) detected`;

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

  // 3. Adaptive Student Roster
  renderDynamicRoster(students);

  // 4. Session telemetry record
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

function logIncident(text, status) {
  const list = document.getElementById('events-list');
  const row = document.createElement('div');
  row.className = 'event-row';
  if (status === 'Sleeping') row.classList.add('crit');
  else if (status !== 'Attentive') row.classList.add('warn');

  const now = new Date().toLocaleTimeString();
  row.innerHTML = `<span>${text}</span><span class="event-time">${now}</span>`;
  list.prepend(row);

  while (list.children.length > 20) {
    list.removeChild(list.lastChild);
  }
}

// Export CSV handler (Dynamic for any number of students)
document.getElementById('btn-export-csv').addEventListener('click', function() {
  if (sessionLogs.length === 0) {
    alert('No telemetry recorded yet in this session.');
    return;
  }

  const maxId = Math.max(maxSessionStudents, 1);
  let csvContent = "data:text/csv;charset=utf-8,";
  let headers = ["Timestamp", "Overall_Score", "Active_Count", "Attentive_Count", "Facing_Pct", "Sleep_Pct", "Yawn_Pct"];
  for (let i = 1; i <= maxId; i++) {
    headers.push(`S${i}_Score`, `S${i}_Status`);
  }
  csvContent += headers.join(",") + "\n";

  sessionLogs.forEach(entry => {
    let sCols = [];
    for (let i = 1; i <= maxId; i++) {
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
  link.setAttribute("download", `cams_adaptive_session_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
});

// WebSocket Connection with Auto-Reconnect
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

// REST fallback polling
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

connectWebSocket();
