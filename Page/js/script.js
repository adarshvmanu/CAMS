// CAMS Studio - Real-Time Telemetry Engine & Dynamic Visualization

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
    line: { color: '#10B981', width: 2.5, shape: 'spline' },
    fill: 'tozeroy',
    fillcolor: 'rgba(16, 185, 129, 0.06)'
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
    line: { color: '#EF4444', width: 1.8, dash: 'dot' }
  },
  {
    name: 'Yawn %',
    x: [],
    y: [],
    mode: 'lines',
    type: 'scatter',
    line: { color: '#F59E0B', width: 1.8, dash: 'dot' }
  }
];

const layout = {
  autosize: true,
  margin: { l: 38, r: 18, t: 24, b: 32 },
  paper_bgcolor: '#0F172A',
  plot_bgcolor: '#0F172A',
  font: { family: 'Inter, sans-serif', color: '#64748B', size: 10 },
  legend: { orientation: 'h', x: 0, y: 1.16, font: { color: '#CBD5E1', size: 10 } },
  xaxis: {
    showgrid: true,
    gridcolor: 'rgba(255, 255, 255, 0.05)',
    zeroline: false,
    tickfont: { color: '#64748B' }
  },
  yaxis: {
    range: [0, 105],
    showgrid: true,
    gridcolor: 'rgba(255, 255, 255, 0.05)',
    zeroline: false,
    tickfont: { color: '#64748B' }
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

// Toast notification helper
function showToast(msg, icon = '🎯') {
  const toast = document.getElementById('toast-notice');
  const msgEl = document.getElementById('toast-msg');
  const iconEl = document.getElementById('toast-icon');
  if (!toast) return;

  msgEl.textContent = msg;
  iconEl.textContent = icon;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2800);
}

// Calibration Button Handler
document.getElementById('btn-calibrate').addEventListener('click', function() {
  fetch('/api/calibrate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    .then(res => res.json())
    .then(data => {
      showToast('Camera Calibrated! Normal posture set to Forward Facing.');
      logIncident('Head pose baseline auto-calibrated to current posture', 'good');
    })
    .catch(err => {
      showToast('Calibration failed. Make sure face is in view.', '⚠️');
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
    }).catch(err => console.error('Failed to update capacity:', err));
    logIncident(`Classroom capacity mode set to: ${val === 'auto' ? 'Auto-Adaptive' : val + ' Seats'}`, 'good');
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

  students.forEach(s => {
    if (s.id > maxSessionStudents) maxSessionStudents = s.id;
  });

  const existingCards = {};
  container.querySelectorAll('.student-card').forEach(card => {
    const id = parseInt(card.getAttribute('data-id'), 10);
    existingCards[id] = card;
  });

  students.forEach(student => {
    let cardEl = existingCards[student.id];

    if (!cardEl) {
      cardEl = document.createElement('div');
      cardEl.className = 'student-card';
      cardEl.setAttribute('data-id', student.id);
      cardEl.innerHTML = `
        <div class="student-card-header">
          <div class="student-profile">
            <div class="student-avatar">#${student.id}</div>
            <span class="student-name">Student #${student.id}</span>
          </div>
          <span class="status-tag good">Attentive</span>
        </div>
        <div class="student-score-row">
          <span class="student-score-val">100%</span>
          <div class="student-score-bar-bg">
            <div class="student-score-bar-fill" style="width: 100%; background-color: var(--status-good);"></div>
          </div>
        </div>
        <div class="student-meters">
          <div class="meter-col">
            <div class="meter-label-row">
              <span>Blink (EAR)</span>
              <span class="meter-val ear-val">0.28</span>
            </div>
            <div class="meter-bar"><div class="meter-fill ear-fill" style="width: 70%; background-color: var(--accent-sky);"></div></div>
          </div>
          <div class="meter-col">
            <div class="meter-label-row">
              <span>Mouth (MAR)</span>
              <span class="meter-val mar-val">0.08</span>
            </div>
            <div class="meter-bar"><div class="meter-fill mar-fill" style="width: 15%; background-color: var(--accent-sky);"></div></div>
          </div>
        </div>
        <div class="meter-label-row" style="font-size: 0.65rem; color: var(--text-muted); margin-top: -2px;">
          <span>Gaze Angle:</span>
          <span class="meter-val gaze-val">0° / 0°</span>
        </div>
      `;
      container.appendChild(cardEl);
    }

    // Update Elements
    const scoreVal = cardEl.querySelector('.student-score-val');
    const scoreFill = cardEl.querySelector('.student-score-bar-fill');
    const statusTag = cardEl.querySelector('.status-tag');
    const earVal = cardEl.querySelector('.ear-val');
    const marVal = cardEl.querySelector('.mar-val');
    const earFill = cardEl.querySelector('.ear-fill');
    const marFill = cardEl.querySelector('.mar-fill');
    const gazeVal = cardEl.querySelector('.gaze-val');

    const score = Number(student.score || 0);
    scoreVal.textContent = `${score.toFixed(0)}%`;
    scoreFill.style.width = `${Math.max(score, 5)}%`;

    if (score >= 80) {
      scoreVal.style.color = 'var(--status-good)';
      scoreFill.style.backgroundColor = 'var(--status-good)';
    } else if (score >= 50) {
      scoreVal.style.color = 'var(--status-warn)';
      scoreFill.style.backgroundColor = 'var(--status-warn)';
    } else {
      scoreVal.style.color = 'var(--status-crit)';
      scoreFill.style.backgroundColor = 'var(--status-crit)';
    }

    statusTag.textContent = student.status || 'Active';
    statusTag.className = 'status-tag';
    if (student.status === 'Attentive') statusTag.classList.add('good');
    else if (student.status === 'Sleeping') statusTag.classList.add('crit');
    else statusTag.classList.add('warn');

    const ear = Number(student.ear || 0);
    const mar = Number(student.mar || 0);
    const yaw = Number(student.yaw || 0);
    const pitch = Number(student.pitch || 0);

    earVal.textContent = ear.toFixed(2);
    marVal.textContent = mar.toFixed(2);
    gazeVal.textContent = `Yaw ${yaw > 0 ? '+' : ''}${yaw.toFixed(0)}° | Pitch ${pitch > 0 ? '+' : ''}${pitch.toFixed(0)}°`;

    // EAR meter: normal ~0.25 (scale 0 to 0.40)
    const earPct = Math.min(Math.max((ear / 0.40) * 100, 5), 100);
    earFill.style.width = `${earPct}%`;
    earFill.style.backgroundColor = (ear < 0.16) ? 'var(--status-crit)' : 'var(--accent-sky)';

    // MAR meter: normal ~0.08 (scale 0 to 0.60)
    const marPct = Math.min(Math.max((mar / 0.60) * 100, 5), 100);
    marFill.style.width = `${marPct}%`;
    marFill.style.backgroundColor = (mar > 0.45) ? 'var(--status-warn)' : 'var(--accent-sky)';

    // Incident tracking
    if (prevStudentStates[student.id] && prevStudentStates[student.id] !== student.status) {
      const tagType = student.status === 'Attentive' ? 'good' : (student.status === 'Sleeping' ? 'crit' : 'warn');
      logIncident(`Student #${student.id} state changed to: ${student.status}`, tagType);
    }
    prevStudentStates[student.id] = student.status;
  });

  // Remove cards for students who departed
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
  document.getElementById('video-feed-stats').textContent = `${count} face(s) tracked in real time`;
  document.getElementById('overlay-face-count').textContent = `${count} ACTIVE`;

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
    students: students.map(s => ({ id: s.id, score: s.score, status: s.status, ear: s.ear, mar: s.mar, yaw: s.yaw, pitch: s.pitch }))
  });
}

function logIncident(text, type = 'good') {
  const list = document.getElementById('events-list');
  const row = document.createElement('div');
  row.className = `event-row ${type}`;

  const now = new Date().toLocaleTimeString();
  row.innerHTML = `<span>${text}</span><span class="event-time">${now}</span>`;
  list.prepend(row);

  while (list.children.length > 25) {
    list.removeChild(list.lastChild);
  }
}

// Export CSV handler
document.getElementById('btn-export-csv').addEventListener('click', function() {
  if (sessionLogs.length === 0) {
    showToast('No session data to export yet.', '⚠️');
    return;
  }

  const maxId = Math.max(maxSessionStudents, 1);
  let csvContent = "data:text/csv;charset=utf-8,";
  let headers = ["Timestamp", "Overall_Score", "Active_Count", "Attentive_Count", "Facing_Pct", "Sleep_Pct", "Yawn_Pct"];
  for (let i = 1; i <= maxId; i++) {
    headers.push(`S${i}_Score`, `S${i}_Status`, `S${i}_EAR`, `S${i}_MAR`);
  }
  csvContent += headers.join(",") + "\n";

  sessionLogs.forEach(entry => {
    let sCols = [];
    for (let i = 1; i <= maxId; i++) {
      const s = entry.students.find(x => x.id === i);
      if (s) {
        sCols.push(s.score, `"${s.status}"`, s.ear, s.mar);
      } else {
        sCols.push("", '""', "", "");
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
  link.setAttribute("download", `cams_studio_telemetry_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('Session CSV Exported!', '⬇');
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
      logIncident('Live WebSocket telemetry stream connected', 'good');
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
