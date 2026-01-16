// ==========================================
// 6. CHARTS & GRAPHS
// ==========================================

function updateComparisonChart() {
    const ctx = document.getElementById('comparisonChart').getContext('2d');
    const ctxMonthly = document.getElementById('comparisonMonthlyChart').getContext('2d');
    
    if (charts['comparison']) charts['comparison'].destroy();
    if (charts['comparisonMonthly']) charts['comparisonMonthly'].destroy();

    const rawLabels = chartData.history ? chartData.history.labels : chartData.labels;
    const labels = rawLabels.slice(1); 
    const datasetsCumulative = [];
    const datasetsMonthly = [];

    comparisonItems.forEach((item, i) => {
        const color = ['#1db954', '#2196f3', '#ff9800', '#e91e63', '#9c27b0'][i % 5];
        let dataPointsCumulative = [];
        let dataPointsMonthly = [];
        let runningTotal = 0;

        rawLabels.forEach((month, index) => {
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
            
            if (index > 0) {
                dataPointsMonthly.push(count);
                dataPointsCumulative.push(runningTotal);
            }
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

    const rawLabels = chartData.history.labels;
    const labels = rawLabels.slice(1);
    const colors = ['#1db954', '#2196f3', '#ff9800', '#e91e63', '#9c27b0', '#00bcd4', '#ffeb3b', '#cddc39', '#f44336', '#795548'];

    const datasets = songs.map((song, i) => {
        let dataPoints = [];
        let runningTotal = 0;
        
        rawLabels.forEach((month, index) => {
            let count = 0;
            const key = `${song.titel}|${song.artiest}`;
            if (monthlyStats[month] && monthlyStats[month].song_counts) {
                count = monthlyStats[month].song_counts[key] || 0;
            }
            runningTotal += count;
            
            if (index > 0) {
                dataPoints.push(runningTotal);
            }
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

    const labels = chartData.history.labels.slice(1).map(l => {
        const [y, m] = l.split('-'); 
        return new Intl.DateTimeFormat('nl-NL', { month: 'short', year: '2-digit' }).format(new Date(y, m-1));
    });
    const colors = ['#1db954', '#2196f3', '#ff9800', '#e91e63', '#9c27b0'];

    const datasets = songs.map((song, i) => {
        const dataPoints = chartData.history.labels.slice(1).map(month => {
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

function showRepertoireChart(artistName, poster) {
    document.getElementById('repertoire-search').value = '';
    document.getElementById('repertoire-results').classList.add('hidden');
    document.getElementById('repertoire-chart-container').classList.remove('hidden');
    
    // Update Titel
    document.getElementById('repertoire-title').innerText = `Top 5 van ${artistName}`;
    
    // Update Cover
    const coverEl = document.getElementById('repertoire-chart-cover');
    coverEl.src = poster || 'img/placeholder.png';

    renderRepertoireGrowthChart(artistName);
    renderRepertoireMonthlyChart(artistName);
}

function renderRankingHistoryChart(name, type, artist = null) {
    document.getElementById('history-search-results').classList.add('hidden');
    document.getElementById('history-search').value = "";
    document.getElementById('history-chart-container').classList.remove('hidden');
    
    const labelEl = document.getElementById('history-chart-title');
    const coverEl = document.getElementById('history-chart-cover');
    const ctx = document.getElementById('rankingHistoryChart').getContext('2d');

    if (charts['rankingHistory']) charts['rankingHistory'].destroy();

    const rawLabels = chartData.history ? chartData.history.labels : chartData.labels;
    const labels = rawLabels.slice(1); // Sla de eerste maand over
    let datasets = [];

    if (type === 'artist-all-songs') {
        // --- LOGICA VOOR ALLE LIEDJES VAN EEN ARTIEST ---
        labelEl.innerText = `Top 100 Verloop: Alle songs van ${name}`;
        const artInfo = statsData.find(s => s.artiest === name);
        coverEl.src = (artInfo && artInfo.poster) ? artInfo.poster : 'img/placeholder.png';
        coverEl.style.borderRadius = '50%';

        // 1. Zoek alle unieke songs van deze artiest die OOIT in de top 100 stonden
        let uniqueSongs = new Set();
        Object.values(monthlyStats).forEach(month => {
            month.top_songs.forEach(s => {
                if (s[0] === name) uniqueSongs.add(s[1]);
            });
        });

        // 2. Maak een dataset per song
        const colors = ['#1db954', '#2196f3', '#ff9800', '#e91e63', '#9c27b0', '#00bcd4', '#ffeb3b'];
        let colorIdx = 0;

        uniqueSongs.forEach(songTitle => {
            const rankingData = [];
            const pointRadii = [];
            
            labels.forEach(monthKey => {
                const data = monthlyStats[monthKey];
                let rank = 106;
                if (data) {
                    const idx = data.top_songs.findIndex(s => s[1] === songTitle && s[0] === name);
                    if (idx !== -1) rank = idx + 1;
                }
                rankingData.push(rank);
                pointRadii.push(rank > 100 ? 0 : 3);
            });

            datasets.push({
                label: songTitle,
                data: rankingData,
                borderColor: colors[colorIdx % colors.length],
                backgroundColor: 'transparent',
                borderWidth: 2,
                pointRadius: pointRadii,
                tension: 0.3,
                spanGaps: true
            });
            colorIdx++;
        });

    } else {
        // --- STANDAARD LOGICA (ÉÉN ARTIEST OF ÉÉN LIEDJE) ---
        labelEl.innerText = type === 'artist' ? `Ranking verloop: ${name}` : `Ranking verloop: ${name} (${artist})`;
        const info = (type === 'artist') ? statsData.find(s => s.artiest === name) : statsData.find(s => s.titel === name && s.artiest === artist);
        coverEl.src = (info && info.poster && info.poster !== 'img/placeholder.png') ? info.poster : 'img/placeholder.png';
        coverEl.style.borderRadius = (type === 'artist') ? '50%' : '10px';

        const rankingData = [];
        const pointRadii = [];

        labels.forEach(monthKey => {
            const data = monthlyStats[monthKey];
            let rank = 106; 
            if (data) {
                if (type === 'artist') {
                    const idx = data.top_artists.findIndex(a => a[0] === name);
                    if (idx !== -1) rank = idx + 1;
                } else {
                    const idx = data.top_songs.findIndex(s => s[1] === name && s[0] === artist);
                    if (idx !== -1) rank = idx + 1;
                }
            }
            rankingData.push(rank);
            pointRadii.push(rank > 100 ? 0 : 4);
        });

        datasets.push({
            label: 'Positie',
            data: rankingData,
            borderColor: '#1db954',
            backgroundColor: 'rgba(29, 185, 84, 0.1)',
            borderWidth: 3,
            pointBackgroundColor: '#1db954',
            pointRadius: pointRadii,
            tension: 0.3,
            fill: true,
            spanGaps: true
        });
    }

    charts['rankingHistory'] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels.map(l => {
                const [y, m] = l.split('-');
                return new Intl.DateTimeFormat('nl-NL', { month: 'short', year: '2-digit' }).format(new Date(y, m - 1));
            }),
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    reverse: true,
                    min: 1,
                    max: 105,
                    ticks: {
                        color: '#777',
                        stepSize: 10,
                        callback: function(value) { return value > 100 ? '' : '#' + value; }
                    },
                    grid: { color: 'rgba(255,255,255,0.05)' }
                },
                x: { ticks: { color: '#777' }, grid: { display: false } }
            },
            plugins: {
                legend: { 
                    display: type === 'artist-all-songs', 
                    position: 'bottom',
                    labels: { color: '#ccc', font: { size: 10 }, boxWidth: 12 }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const val = context.parsed.y;
                            if (val > 100) return `${context.dataset.label}: Buiten Top 100`;
                            return `${context.dataset.label}: #${val}`;
                        }
                    }
                }
            }
        }
    });
}

function renderCharts() {
    const ctxHist = document.getElementById('listeningChart').getContext('2d');
    if (charts['history']) charts['history'].destroy();
    
    const rawLabels = chartData.history ? chartData.history.labels : chartData.labels;
    const rawValues = chartData.history ? chartData.history.values : chartData.values;
    
    const histLabels = rawLabels.slice(1);
    const histValues = rawValues.slice(1);

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