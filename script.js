let currentViewDate = new Date(); // Start op vandaag
let musicData = [];
let myChart = null;
let activeFilter = null;

async function loadMusic() {
    try {
        const response = await fetch('data.json');
        musicData = await response.json();
        renderDashboardAndChart();
        renderCalendar();
    } catch (error) { console.error("Fout bij laden:", error); }
}

function renderDashboardAndChart() {
    const songPoints = {}, artistCounts = {}, uniekeDagen = new Set(musicData.map(item => item.datum));
    const grouped = {};
    
    musicData.forEach(item => {
        if (!grouped[item.datum]) grouped[item.datum] = [];
        grouped[item.datum].push(item);
    });

    const sortedDates = Object.keys(grouped).sort(), artistPointsOverTime = {};
    let runningPoints = {};
    
    sortedDates.forEach(date => {
        grouped[date].slice(0, 5).forEach((song, index) => {
            const points = 5 - index;
            const songKey = `${song.titel} - ${song.artiest}`;
            songPoints[songKey] = (songPoints[songKey] || 0) + points;
            artistCounts[song.artiest] = (artistCounts[song.artiest] || 0) + 1;
            runningPoints[song.artiest] = (runningPoints[song.artiest] || 0) + points;
        });
        artistPointsOverTime[date] = JSON.parse(JSON.stringify(runningPoints));
    });

    document.getElementById('total-days-count').innerText = uniekeDagen.size;
    
    const topSongs = Object.entries(songPoints).sort((a,b) => b[1] - a[1]).slice(0, 10);
    const topArtists = Object.entries(artistCounts).sort((a,b) => b[1] - a[1]).slice(0, 5);

    renderList('top-songs-list', topSongs, 'pt', 'song');
    renderList('top-artists-list', topArtists, 'x', 'artist');
    initChart(sortedDates, artistPointsOverTime, topArtists.map(a => a[0]));
}

function renderCalendar() {
    const grid = document.getElementById('calendarGrid');
    const monthDisplay = document.getElementById('monthDisplay');
    grid.innerHTML = '';
    
    const year = currentViewDate.getFullYear(), month = currentViewDate.getMonth();
    monthDisplay.innerText = new Intl.DateTimeFormat('nl-NL', { month: 'long', year: 'numeric' }).format(currentViewDate);
    
    const firstDay = new Date(year, month, 1).getDay();
    const startOffset = firstDay === 0 ? 6 : firstDay - 1;

    for (let i = 0; i < startOffset; i++) {
        grid.appendChild(Object.assign(document.createElement('div'), {className: 'calendar-day empty'}));
    }

    for (let day = 1; day <= new Date(year, month + 1, 0).getDate(); day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const daySongs = musicData.filter(d => d.datum === dateStr);
        const cell = document.createElement('div');
        cell.className = 'calendar-day';
        cell.innerHTML = `<span class="day-number">${day}</span>`;
        if (daySongs.length > 0) {
            cell.classList.add('has-data');
            if (activeFilter && !daySongs.some(s => s.artiest === activeFilter)) cell.classList.add('dimmed');
            cell.innerHTML += `<img src="${daySongs[0].poster}" onerror="this.src='img/placeholder.png'">`;
            cell.onclick = () => openDagDetails(dateStr, daySongs);
        }
        grid.appendChild(cell);
    }
}

function openDagDetails(date, songs) {
    const container = document.getElementById('day-top-three-container');
    document.getElementById('modal-datum-titel').innerText = new Date(date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' });
    container.innerHTML = songs.slice(0, 5).map((s, i) => `
        <div class="top-item" style="display:flex; align-items:center; gap:15px; margin-bottom:10px; background:rgba(255,255,255,0.03); padding:10px; border-radius:12px;">
            <b style="color:var(--spotify-green)">${i + 1}</b>
            <img src="${s.poster}" style="width:50px; height:50px; border-radius:8px; object-fit:cover;">
            <div><b>${s.titel}</b><br><small style="color:#888;">${s.artiest}</small></div>
        </div>`).join('');
    document.getElementById('modal').classList.remove('hidden');
}

// Event Listeners voor de knoppen
document.getElementById('prevMonth').onclick = () => { currentViewDate.setMonth(currentViewDate.getMonth() - 1); renderCalendar(); };
document.getElementById('nextMonth').onclick = () => { currentViewDate.setMonth(currentViewDate.getMonth() + 1); renderCalendar(); };
document.getElementById('close-button').onclick = () => document.getElementById('modal').classList.add('hidden');
document.getElementById('resetFilter').onclick = function() { activeFilter = null; this.classList.add('hidden'); renderCalendar(); };

// Helpers voor Chart en Lijsten
function renderList(id, items, unit, type) {
    const el = document.getElementById(id);
    el.innerHTML = items.map(([name, val]) => `
        <li onclick="${type === 'artist' ? `showArtistDetails('${name}')` : `showSongSpotlight('${name}')`}">
            <span>${name}</span><span class="point-badge">${val}${unit}</span>
        </li>`).join('');
}

function initChart(dates, history, names) {
    const ctx = document.getElementById('artistChart').getContext('2d');
    const datasets = names.map((name, i) => ({
        label: name, data: dates.map(d => history[d][name] || 0),
        borderColor: ['#1db954', '#9d50bb', '#2196f3', '#ff9800', '#e91e63'][i],
        tension: 0.4, fill: false
    }));
    if (myChart) myChart.destroy();
    myChart = new Chart(ctx, {
        type: 'line', data: { labels: dates.map(d => d.split('-').reverse().slice(0,2).join('/')), datasets },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function showArtistDetails(artist) { activeFilter = artist; document.getElementById('resetFilter').classList.remove('hidden'); renderCalendar(); }
function showSongSpotlight(songFull) { 
    const [titel, artiest] = songFull.split(' - ');
    const s = musicData.find(s => s.titel === titel) || { poster: 'img/placeholder.png' };
    document.getElementById('day-top-three-container').innerHTML = `<div class="vinyl-container"><div class="vinyl-record"></div><img src="${s.poster}" class="vinyl-cover"></div><h2 style="text-align:center;">${titel}</h2><p style="text-align:center; color:var(--spotify-green);">${artiest}</p>`;
    document.getElementById('modal').classList.remove('hidden');
}

loadMusic();