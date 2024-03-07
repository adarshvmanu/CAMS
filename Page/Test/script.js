var ctx = document.getElementById('myChart').getContext('2d');

// Function to update the chart with new data
function updateChart() {
    fetch('data.json')
        .then(response => response.json())
        .then(data => {
            var timeLabels = data.chart1.map(entry => entry.time);
            var values = data.chart1.map(entry => entry.value);

            chart.data.labels = timeLabels;
            chart.data.datasets[0].data = values;
            chart.update();
        });
}

// Chart configuration
var chartConfig = {
    type: 'line',
    data: {
        datasets: [{
            label: 'Value',
            data: [],
            borderColor: 'blue',
            borderWidth: 2,
            fill: false
        }]
    },
    options: {
        scales: {
            x: {
                type: 'time',
                time: {
                    unit: 'second' // Adjust as needed
                },
                title: {
                    display: true,
                    text: 'Time'
                }
            },
            y: {
                title: {
                    display: true,
                    text: 'Value'
                }
            }
        }
    }
};

// Create the chart
var chart = new Chart(ctx, chartConfig);

// Update the chart every 5 seconds
setInterval(updateChart, 5000);