let currentViewDate = new Date(); 
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

// --- DASHBOARD RENDERING ---
function renderDashboardAndChart() {
    const songPoints = {}, artistCounts = {}, uniekeDagen = new Set(musicData.map(item => item.datum));
    const grouped = {};
    
    musicData.forEach(item => {
        if (!grouped[item.datum]) grouped[item.datum] = [];
        grouped[item.datum].push(item);
    });

    const sortedDates = Object.keys(grouped).sort();
    const artistPointsOverTime = {};
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

// --- DE BELANGRIJKE LIJST-FUNCTIE ---
function renderList(id, items, unit, type) {
    const el = document.getElementById(id);
    el.innerHTML = items.map(([name, val]) => {
        // We ontsnappen aanhalingstekens zodat namen als "Don't You" de code niet breken
        const escapedName = name.replace(/'/g, "\\'");
        const clickAction = type === 'artist' 
            ? `showArtistDetails('${escapedName}')` 
            : `showSongSpotlight('${escapedName}')`;
            
        return `<li onclick="${clickAction}" style="cursor:pointer">
            <span>${name}</span><span class="point-badge">${val}${unit}</span>
        </li>`;
    }).join('');
}

// --- KLIK ACTIES ---
function showArtistDetails(artist) {
    activeFilter = artist;
    const resetBtn = document.getElementById('resetFilter');
    if (resetBtn) resetBtn.classList.remove('hidden');
    renderCalendar(); // Dit zorgt dat alleen dagen met deze artiest oplichten
    console.log("Filteren op artiest:", artist);
}

function showSongSpotlight(songFull) { 
    // Splits titel en artiest (gebaseerd op "Titel - Artiest")
    const parts = songFull.split(' - ');
    const titel = parts[0];
    const artiest = parts[1];
    
    // Zoek de poster in onze data
    const songData = musicData.find(s => s.titel === titel && s.artiest === artiest) || { poster: 'img/placeholder.png' };
    
    const container = document.getElementById('day-top-three-container');
    container.innerHTML = `
        <div class="vinyl-container">
            <div class="vinyl-record"></div>
            <img src="${songData.poster}" class="vinyl-cover" onerror="this.src='img/placeholder.png'">
        </div>
        <h2 style="text-align:center; margin-top:20px;">${titel}</h2>
        <p style="text-align:center; color:var(--spotify-green); font-weight:bold;">${artiest}</p>
    `;
    
    document.getElementById('modal-datum-titel').innerText = "Spotlight";
    document.getElementById('modal').classList.remove('hidden');
}

// --- KALENDER & NAVIGATIE ---
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
        
        if (daySongs.length > 0) {
            cell.classList.add('has-data');
            
            // Filter logica: als er een artiest is geselecteerd, dimmen we de rest
            if (activeFilter && !daySongs.some(s => s.artiest === activeFilter)) {
                cell.classList.add('dimmed');
            }

            cell.innerHTML = `<span class="day-number">${day}</span><img src="${daySongs[0].poster}" onerror="this.src='img/placeholder.png'">`;
            cell.onclick = () => openDagDetails(dateStr, daySongs);
        } else {
            cell.innerHTML = `<span class="day-number">${day}</span>`;
        }
        grid.appendChild(cell);
    }
}

function openDagDetails(date, songs) {
    const container = document.getElementById('day-top-three-container');
    document.getElementById('modal-datum-titel').innerText = new Date(date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' });
    
    container.innerHTML = songs.slice(0, 5).map((s, i) => `
        <div style="display:flex; align-items:center; gap:15px; margin-bottom:12px; background:rgba(255,255,255,0.05); padding:12px; border-radius:15px; border:1px solid rgba(255,255,255,0.1);">
            <b style="color:var(--spotify-green); width:20px;">${i + 1}</b>
            <img src="${s.poster}" style="width:50px; height:50px; border-radius:8px; object-fit:cover;" onerror="this.src='img/placeholder.png'">
            <div style="overflow:hidden;">
                <b style="display:block; white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">${s.titel}</b>
                <small style="color:#aaa;">${s.artiest}</small>
            </div>
        </div>`).join('');
    document.getElementById('modal').classList.remove('hidden');
}

// Chart Initialisatie
function initChart(dates, history, names) {
    const canvas = document.getElementById('artistChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const datasets = names.map((name, i) => ({
        label: name, 
        data: dates.map(d => history[d][name] || 0),
        borderColor: ['#1db954', '#9d50bb', '#2196f3', '#ff9800', '#e91e63'][i],
        backgroundColor: 'transparent',
        tension: 0.4,
        pointRadius: 2
    }));

    if (myChart) myChart.destroy();
    myChart = new Chart(ctx, {
        type: 'line', 
        data: { labels: dates.map(d => d.split('-').reverse().slice(0,2).join('/')), datasets },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#aaa', font: { size: 10 } } } },
            scales: {
                x: { ticks: { color: '#666', maxRotation: 0 } },
                y: { ticks: { color: '#666' }, grid: { color: 'rgba(255,255,255,0.05)' } }
            },
            // Zorg dat we ook op de grafiek kunnen klikken!
            onClick: (e, elements) => {
                if (elements.length > 0) {
                    const artistName = datasets[elements[0].datasetIndex].label;
                    showArtistDetails(artistName);
                }
            }
        }
    });
}

// Navigatie Listeners
document.getElementById('prevMonth').onclick = () => { currentViewDate.setMonth(currentViewDate.getMonth() - 1); renderCalendar(); };
document.getElementById('nextMonth').onclick = () => { currentViewDate.setMonth(currentViewDate.getMonth() + 1); renderCalendar(); };
document.getElementById('close-button').onclick = () => document.getElementById('modal').classList.add('hidden');

const resetBtn = document.getElementById('resetFilter');
if (resetBtn) {
    resetBtn.onclick = function() {
        activeFilter = null;
        this.classList.add('hidden');
        renderCalendar();
    };
}

loadMusic();