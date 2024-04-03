var trace = {
    x: [], 
    y: [], 
    mode: 'lines',
    type: 'scatter'
  };

  var layout = {
    title: '',
    xaxis: {
      title: ''
    },
    yaxis: {
      title: '',
      range:[0,100]
    },
    font: {
      color: '#ffffff'
    },
    paper_bgcolor: '#1e1f20',
    plot_bgcolor: '#1e1f20'
  };

  Plotly.newPlot('attentionscore', [trace], layout);

  const socket = new WebSocket('ws://localhost:3000');

  socket.addEventListener('message', function (event) {
    try {
      const data = JSON.parse(event.data);
      const dataChart = data.chart
      const timestamp = dataChart.timestamp;
      const attentionScore = dataChart.attention_scores;
      console.log(timestamp)
      console.log(attentionScore)
      Plotly.extendTraces('attentionscore', {
        x: [[timestamp]],
        y: [[attentionScore]]
      }, [0]);
      console.log("Updated Chart")
    } catch (error) {
      console.error('Error parsing data:', error);
    }
  });