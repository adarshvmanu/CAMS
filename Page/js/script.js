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

// Initialize variable to store the last fetched timestamp and fetched data
var lastFetchedTimestamp = null;
var fetchedData = null;

// Define the updateChartData function to fetch data and update the chart
async function updateChartData() {
    try {
        if (!fetchedData) {
            // Make a request to fetch data only if no data has been fetched yet
            const response = await fetch('http://localhost:3000/data.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            fetchedData = await response.json();
            lastFetchedTimestamp = Object.keys(fetchedData)[0];
        }
        
        // Check if it has been at least 10 seconds since the last fetch
        const currentTime = new Date().getTime();
        const timeSinceLastFetch = currentTime - lastFetchedTimestamp;
        if (timeSinceLastFetch >= 10000) {
            const latestData = fetchedData[lastFetchedTimestamp];
            const attentionScore = latestData.attention_scores;

            // Update the chart only if it has been at least 10 seconds since the last fetch
            Plotly.extendTraces('attentionscore', {
                x: [[lastFetchedTimestamp]],
                y: [[attentionScore]]
            }, [0]);
            
            // Reset lastFetchedTimestamp to null to indicate that a new fetch is needed
            lastFetchedTimestamp = null;
        }
    } catch (error) {
        console.error("Could not fetch the data:", error);
    }
}


updateChartData();
setInterval(updateChartData, 1000); // Check for new data every second
