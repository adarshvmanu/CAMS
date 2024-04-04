var attentiontrace = {
  x: [],
  y: [],
  mode: 'lines',
  type: 'scatter',
  line: {
    color: '#ff7f0e',
    width: 2,
    shape: 'spline'
  },
};

var drowsytrace = {
  x: [],
  y: [],
  mode: 'lines',
  type: 'scatter',
  line: {
    color: '#2ca02c',
    width: 2,
    shape: 'spline'
  },
};

var yawntrace = {
  x: [],
  y: [],
  mode: 'lines',
  type: 'scatter',
  line: {
    color: '#d62728',
    width: 2,
    shape: 'spline'
  },
};

var facingtrace = {
  x: [],
  y: [],
  mode: 'lines',
  type: 'scatter',
  line: {
    color: '#e377c2',
    width: 2,
    shape: 'spline'
  },
};



var attentionlayout = {
  title: 'Attention Scores',

  autosize: true,
  frameMargin: 0,
  font: {
    family: 'Poppins , sans-serif',
    color: '#ffffff',
    size: 10
  },
  showlegend: false,
  paper_bgcolor: '#1e1f20',
  plot_bgcolor: '#1e1f20',
};

var drowsylayout = {
  title: 'Percentage of Drowsy Students',
  autosize: true,
  frameMargin: 0,
  font: {
    family: 'Poppins , sans-serif',
    color: '#ffffff',
    size: 10
  },
  showlegend: false,
  paper_bgcolor: '#1e1f20',
  plot_bgcolor: '#1e1f20'
};

var yawnlayout = {
  title: 'Perentage of Students Yawning',
  autosize: true,
  frameMargin: 0,
  font: {
    family: 'Poppins , sans-serif',
    color: '#ffffff',
    size: 10
  },
  showlegend: false,
  paper_bgcolor: '#1e1f20',
  plot_bgcolor: '#1e1f20'
};

var facinglayout = {
  title: 'Percentage of Students Facing Classroom',
  autosize: true,
  frameMargin: 0,
  font: {
    family: 'Poppins , sans-serif',
    color: '#ffffff',
    size: 10
  },
  showlegend: false,
  paper_bgcolor: '#1e1f20',
  plot_bgcolor: '#1e1f20'
};

Plotly.newPlot('attentionscore', [attentiontrace], attentionlayout, { displayModeBar: false, autosize: true });
Plotly.newPlot('drowsy', [drowsytrace], drowsylayout, { displayModeBar: false, autosize: true });
Plotly.newPlot('yawn', [yawntrace], yawnlayout, { displayModeBar: false, autosize: true });
Plotly.newPlot('facing', [facingtrace], facinglayout, { displayModeBar: false, autosize: true });


const socket = new WebSocket('ws://localhost:3000');
socket.addEventListener('message', function (event) {
  try {
    const data = JSON.parse(event.data);
    const dataChart = data.chart
    const timestamp = dataChart.timestamp;
    const attentionScore = dataChart.attention_scores;
    const sleep = dataChart.sleep_detected;
    const yawn = dataChart.yawn_detected;
    const facing = dataChart.facing_classroom;
    Plotly.extendTraces('attentionscore', {
      x: [[timestamp]],
      y: [[attentionScore]]
    }, [0]);
    Plotly.extendTraces('drowsy', {
      x: [[timestamp]],
      y: [[sleep]]
    }, [0]);
    Plotly.extendTraces('yawn', {
      x: [[timestamp]],
      y: [[yawn]]
    }, [0]);
    Plotly.extendTraces('facing', {
      x: [[timestamp]],
      y: [[facing]]
    }, [0]);
    console.log("Updated Charts")
    const overallAttentionElement = document.querySelector('.overall-attention');
    const studentCountElement = document.querySelector('.student-count');
    const newCount = dataChart.count;
    studentCountElement.textContent='Average Attention From '+newCount+' Students';
    const newPercentage = dataChart.overall_score;
    overallAttentionElement.textContent = newPercentage + '%';
  } catch (error) {
    console.error('Error parsing data:', error);
  }
});