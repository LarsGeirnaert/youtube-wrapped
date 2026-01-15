// ==========================================
// 6. CHARTS & GRAPHS
// ==========================================

function updateComparisonChart() {
    const ctx = document.getElementById('comparisonChart').getContext('2d');
    const ctxMonthly = document.getElementById('comparisonMonthlyChart').getContext('2d');
    
    if (charts['comparison']) charts['comparison'].destroy();
    if (charts['comparisonMonthly']) charts['comparisonMonthly'].destroy();

    const labels = chartData.history.labels; 
    const datasetsCumulative = [];
    const datasetsMonthly = [];

    comparisonItems.forEach((item, i) => {
        const color = ['#1db954', '#2196f3', '#ff9800', '#e91e63', '#9c27b0'][i % 5];
        let dataPointsCumulative = [];
        let dataPointsMonthly = [];
        let runningTotal = 0;

        labels.forEach(month => {
            let count = 0;
            if (monthlyStats[month]) {
                if (item.type === 'artist') {
                    if (monthlyStats[month].artist_counts) {
                        count = monthlyStats[month].artist_counts[item.key] || 0;
                    }
                } else {
                    if (monthlyStats[month].song_counts) {
                        count = monthlyStats[month].song_counts[item.key] || 0;
                    }
                }
            }
            runningTotal += count;
            dataPointsMonthly.push(count);
            dataPointsCumulative.push(runningTotal);
        });

        datasetsCumulative.push({
            label: item.label,
            data: dataPointsCumulative,
            borderColor: color,
            backgroundColor: color + '22',
            tension: 0.3,
            fill: false
        });

        datasetsMonthly.push({
            label: item.label,
            data: dataPointsMonthly,
            backgroundColor: color + '88', 
            borderColor: color,
            borderWidth: 1,
            tension: 0.4,
            fill: true,
            pointRadius: 3
        });
    });

    charts['comparison'] = new Chart(ctx, {
        type: 'line',
        data: { labels: labels.map(l => l.substring(2)), datasets: datasetsCumulative },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#ccc' } } },
            scales: { x: { grid: { color: '#333' }, ticks: { color: '#777' } }, y: { grid: { color: '#333' }, ticks: { color: '#777' } } }
        }
    });

    charts['comparisonMonthly'] = new Chart(ctxMonthly, {
        type: 'line', 
        data: { labels: labels.map(l => l.substring(2)), datasets: datasetsMonthly },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#ccc' } } },
            scales: { x: { grid: { display: false }, ticks: { color: '#777' } }, y: { grid: { color: '#333' }, ticks: { color: '#777' } } }
        }
    });
}

function renderRepertoireGrowthChart(artistName) {
    const ctx = document.getElementById('repertoireChart').getContext('2d');
    if (charts['repertoire']) charts['repertoire'].destroy();

    const songs = statsData.filter(s => s.artiest === artistName)
                            .sort((a, b) => b.count - a.count)
                            .slice(0, 5);

    const labels = chartData.history.labels;
    const colors = ['#1db954', '#2196f3', '#ff9800', '#e91e63', '#9c27b0', '#00bcd4', '#ffeb3b', '#cddc39', '#f44336', '#795548'];

    const datasets = songs.map((song, i) => {
        let dataPoints = [];
        let runningTotal = 0;
        labels.forEach(month => {
            let count = 0;
            const key = `${song.titel}|${song.artiest}`;
            if (monthlyStats[month] && monthlyStats[month].song_counts) {
                count = monthlyStats[month].song_counts[key] || 0;
            }
            runningTotal += count;
            dataPoints.push(runningTotal);
        });
        return {
            label: song.titel, data: dataPoints, borderColor: colors[i % colors.length],
            backgroundColor: 'transparent', tension: 0.3, pointRadius: 0, borderWidth: 2
        };
    });

    charts['repertoire'] = new Chart(ctx, {
        type: 'line',
        data: { labels: labels.map(l => l.substring(2)), datasets: datasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#ccc', boxWidth: 10, font: {size:10} } } },
            scales: { x: { grid: { color: '#333' }, ticks: { color: '#777' } }, y: { grid: { color: '#333' }, ticks: { color: '#777' } } },
            interaction: { mode: 'index', intersect: false }
        }
    });
}

function renderRepertoireMonthlyChart(artistName) {
    const ctx = document.getElementById('repertoireMonthlyChart').getContext('2d');
    if (charts['repertoireMonthly']) charts['repertoireMonthly'].destroy();

    const songs = statsData.filter(s => s.artiest === artistName)
                            .sort((a, b) => b.count - a.count)
                            .slice(0, 5);

    const labels = chartData.history.labels.map(l => {
        const [y, m] = l.split('-'); 
        return new Intl.DateTimeFormat('nl-NL', { month: 'short', year: '2-digit' }).format(new Date(y, m-1));
    });
    const colors = ['#1db954', '#2196f3', '#ff9800', '#e91e63', '#9c27b0'];

    const datasets = songs.map((song, i) => {
        const dataPoints = chartData.history.labels.map(month => {
            let count = 0;
            const key = `${song.titel}|${song.artiest}`;
            if (monthlyStats[month] && monthlyStats[month].song_counts) {
                count = monthlyStats[month].song_counts[key] || 0;
            }
            return count;
        });

        return {
            label: song.titel,
            data: dataPoints,
            borderColor: colors[i % colors.length],
            backgroundColor: colors[i % colors.length] + '22',
            borderWidth: 2,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 4,
            fill: false
        };
    });

    charts['repertoireMonthly'] = new Chart(ctx, {
        type: 'line',
        data: { labels: labels, datasets: datasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { 
                legend: { display: true, labels: { color: '#ccc', boxWidth: 10, font: { size: 10 } } },
                tooltip: { mode: 'index', intersect: false }
            },
            scales: {
                y: { beginAtZero: true, grid: { color: '#333' }, ticks: { color: '#777' } },
                x: { grid: { display: false }, ticks: { color: '#777', maxTicksLimit: 10 } }
            },
            interaction: { mode: 'index', intersect: false }
        }
    });
}

function renderCharts() {
    const ctxHist = document.getElementById('listeningChart').getContext('2d');
    if (charts['history']) charts['history'].destroy();
    
    const histLabels = chartData.history ? chartData.history.labels : chartData.labels;
    const histValues = chartData.history ? chartData.history.values : chartData.values;

    charts['history'] = new Chart(ctxHist, {
        type: 'line',
        data: {
            labels: histLabels.map(l => { const [y, m] = l.split('-'); return new Intl.DateTimeFormat('nl-NL', { month: 'short', year: '2-digit' }).format(new Date(y, m-1)); }),
            datasets: [{ data: histValues, borderColor: '#1db954', backgroundColor: 'rgba(29, 185, 84, 0.1)', borderWidth: 3, tension: 0.4, fill: true, pointRadius: 2 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { display: false }, x: { grid: { display: false }, ticks: { color: '#b3b3b3', font: { size: 10 } } } } }
    });

    if (!chartData.hours) return;

    const ctxHours = document.getElementById('hoursChart').getContext('2d');
    if (charts['hours']) charts['hours'].destroy();
    charts['hours'] = new Chart(ctxHours, {
        type: 'line',
        data: {
            labels: chartData.hours.labels,
            datasets: [{
                data: chartData.hours.values,
                borderColor: '#2196f3',
                backgroundColor: 'rgba(33, 150, 243, 0.2)',
                fill: true,
                tension: 0.4,
                pointRadius: 3
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
            scales: { x: { ticks: { color: '#777', font: { size: 9 } }, grid: { display: false } }, y: { display: false } }
        }
    });

    const ctxWeek = document.getElementById('weekChart').getContext('2d');
    if (charts['week']) charts['week'].destroy();
    charts['week'] = new Chart(ctxWeek, {
        type: 'line',
        data: {
            labels: chartData.weekdays.labels,
            datasets: [{
                data: chartData.weekdays.values,
                borderColor: '#ff9800',
                backgroundColor: 'rgba(255, 165, 0, 0.2)',
                fill: true,
                tension: 0.4,
                pointRadius: 3
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
            scales: { x: { ticks: { color: '#777' }, grid: { display: false } }, y: { display: false } }
        }
    });
    
    renderArtistPieChart();
    renderSongPieChart();
}

function renderArtistPieChart() {
    const ctxArtist = document.getElementById('artistPieChart').getContext('2d');
    if (charts['artist']) charts['artist'].destroy();
    charts['artist'] = new Chart(ctxArtist, { 
        type: 'doughnut', 
        data: { 
            labels: chartData.artists.labels, 
            datasets: [{ 
                data: chartData.artists.values, 
                backgroundColor: ['#1db954', '#2196f3', '#ff9800', '#e91e63', '#9c27b0', '#00bcd4', '#ffeb3b', '#cddc39', '#f44336', '#795548'], 
                borderWidth: 0 
            }] 
        }, 
        options: { 
            responsive: true, maintainAspectRatio: false, 
            plugins: { legend: { position: 'right', labels: { color: '#ccc', boxWidth: 10, font: { size: 10 } } } }, 
            cutout: '70%' 
        } 
    });
}

function renderSongPieChart() {
    const ctxSong = document.getElementById('songPieChart').getContext('2d');
    if (charts['song']) charts['song'].destroy();
    charts['song'] = new Chart(ctxSong, { 
        type: 'doughnut', 
        data: { 
            labels: chartData.songs.labels, 
            datasets: [{ 
                data: chartData.songs.values, 
                backgroundColor: ['#1db954', '#2196f3', '#ff9800', '#e91e63', '#9c27b0', '#00bcd4', '#ffeb3b', '#cddc39', '#f44336', '#795548'], 
                borderWidth: 0 
            }] 
        }, 
        options: { 
            responsive: true, maintainAspectRatio: false, 
            plugins: { legend: { position: 'right', labels: { color: '#ccc', boxWidth: 10, font: { size: 10 } } } }, 
            cutout: '70%' 
        } 
    });
}