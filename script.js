let currentViewDate = new Date(2025, 0, 1);
let musicData = [];
let myChart = null;
let activeFilter = null;

function handleImageError(img) {
    const currentSrc = img.src;
    if (img.getAttribute('data-tried-switch')) return;
    if (currentSrc.toLowerCase().endsWith('.jpg')) img.src = currentSrc.replace(/\.jpg$/i, '.png');
    else if (currentSrc.toLowerCase().endsWith('.png')) img.src = currentSrc.replace(/\.png$/i, '.jpg');
    img.setAttribute('data-tried-switch', 'true');
}

async function loadMusic() {
    try {
        const response = await fetch('data.json');
        musicData = await response.json();
        renderDashboardAndChart();
        calculateStreak();
        renderCalendar();
    } catch (error) { console.error("Fout:", error); }
}

function calculateStreak() {
    const dates = [...new Set(musicData.map(d => d.datum))].sort();
    if (dates.length === 0) return;
    let currentStreak = 1;
    for (let i = dates.length - 1; i > 0; i--) {
        const d1 = new Date(dates[i]), d2 = new Date(dates[i-1]);
        if ((d1 - d2) / (1000 * 60 * 60 * 24) === 1) currentStreak++;
        else break;
    }
    const streakEl = document.getElementById('streak-count');
    if (streakEl) streakEl.innerText = currentStreak;
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

    const totalEl = document.getElementById('total-days-count');
    if (totalEl) totalEl.innerText = uniekeDagen.size;

    const topSongs = Object.entries(songPoints).sort((a,b) => b[1] - a[1]).slice(0, 10);
    const topArtists = Object.entries(artistCounts).sort((a,b) => b[1] - a[1]).slice(0, 5);

    renderList('top-songs-list', topSongs, 'pt', 'song');
    renderList('top-artists-list', topArtists, 'x', 'artist');
    initChart(sortedDates, artistPointsOverTime, topArtists.map(a => a[0]));
}

// --- NIEUW: INTERACTIEVE FUNCTIES ---

function renderList(id, items, unit, type) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = items.map(([name, val]) => `
        <li onclick="${type === 'artist' ? `showArtistDetails('${name}')` : `showSongSpotlight('${name}')`}">
            <span class="name">${name}</span>
            <span class="point-badge">${val}${unit}</span>
        </li>
    `).join('');
}

function showArtistDetails(artist) {
    activeFilter = artist;
    document.getElementById('resetFilter').classList.remove('hidden');
    renderCalendar();

    const artistSongs = musicData.filter(s => s.artiest === artist);
    const uniqueSongs = [...new Set(artistSongs.map(s => s.titel))];
    
    const container = document.getElementById('day-top-three-container');
    document.getElementById('modal-datum-titel').innerText = `Artiest: ${artist}`;
    container.innerHTML = `<p style="color:#888; margin-bottom:10px;">Liedjes in je Top 5:</p>` + 
        uniqueSongs.map(titel => {
            const s = artistSongs.find(song => song.titel === titel);
            return `<div class="top-item"><img src="${s.poster}" onerror="handleImageError(this)"><div><b>${titel}</b></div></div>`;
        }).join('');
    
    document.getElementById('modal').classList.remove('hidden');
}

function showSongSpotlight(songFull) {
    const [titel, artiest] = songFull.split(' - ');
    const songEntries = musicData.filter(s => s.titel === titel);
    const s = songEntries[0];

    const container = document.getElementById('day-top-three-container');
    document.getElementById('modal-datum-titel').innerText = "Song Spotlight!";
    
    container.innerHTML = `
        <img src="${s.poster}" class="spotlight-img" onerror="handleImageError(this)">
        <h2 style="text-align:center; margin-bottom:5px;">${titel}</h2>
        <p style="text-align:center; color:var(--spotify-green); font-weight:bold; margin-bottom:20px;">${artiest}</p>
        <div style="text-align:center; background:rgba(255,255,255,0.05); padding:15px; border-radius:15px;">
            Aantal keer in Top 5: <b>${songEntries.length}</b><br>
            Datums: <small>${songEntries.map(e => e.datum).join(', ')}</small>
        </div>
    `;
    
    createConfetti();
    document.getElementById('modal').classList.remove('hidden');
}

function createConfetti() {
    for(let i=0; i<30; i++) {
        const c = document.createElement('div');
        c.className = 'confetti';
        c.style.left = Math.random() * 100 + 'vw';
        c.style.backgroundColor = ['#1db954', '#ffffff', '#ffd700'][Math.floor(Math.random()*3)];
        c.style.animationDelay = Math.random() * 2 + 's';
        document.body.appendChild(c);
        setTimeout(() => c.remove(), 3000);
    }
}

// --- KALENDER & OVERIG ---

function renderCalendar() {
    const grid = document.getElementById('calendarGrid'), monthDisplay = document.getElementById('monthDisplay');
    grid.innerHTML = '';
    const year = currentViewDate.getFullYear(), month = currentViewDate.getMonth();
    monthDisplay.innerText = new Intl.DateTimeFormat('nl-NL', { month: 'long', year: 'numeric' }).format(currentViewDate);
    const firstDay = new Date(year, month, 1).getDay(), daysInMonth = new Date(year, month + 1, 0).getDate();
    const startOffset = firstDay === 0 ? 6 : firstDay - 1;

    for (let i = 0; i < startOffset; i++) grid.appendChild(Object.assign(document.createElement('div'), {className: 'calendar-day empty'}));

    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const daySongs = musicData.filter(d => d.datum === dateStr);
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day';
        dayDiv.innerHTML = `<span class="day-number">${day}</span>`;
        if (daySongs.length > 0) {
            dayDiv.classList.add('has-data');
            if (activeFilter && !daySongs.some(s => s.artiest === activeFilter)) dayDiv.classList.add('dimmed');
            dayDiv.innerHTML += `<img src="${daySongs[0].poster}" onerror="handleImageError(this)">`;
            dayDiv.onclick = () => openDagDetails(dateStr, daySongs);
        }
        grid.appendChild(dayDiv);
    }
}

document.getElementById('resetFilter').onclick = function() {
    activeFilter = null;
    this.classList.add('hidden');
    renderCalendar();
}

function initChart(dates, history, topArtistNames) {
    const ctx = document.getElementById('artistChart').getContext('2d');
    const chartColors = ['#1db954', '#9d50bb', '#2196f3', '#ff9800', '#e91e63'];
    const datasets = topArtistNames.map((name, i) => ({
        label: name, data: dates.map(d => history[d][name] || 0),
        borderColor: chartColors[i % chartColors.length], backgroundColor: chartColors[i % chartColors.length] + '22',
        tension: 0.4, fill: true, borderWidth: 3
    }));
    if (myChart) myChart.destroy();
    myChart = new Chart(ctx, {
        type: 'line', data: { labels: dates.map(d => new Date(d).toLocaleDateString('nl-NL', {day:'numeric', month:'short'})), datasets },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#fff' } } }, scales: { y: { ticks: { color: '#888' } }, x: { ticks: { color: '#888' } } } }
    });
}

function openDagDetails(date, songs) {
    const container = document.getElementById('day-top-three-container');
    document.getElementById('modal-datum-titel').innerText = new Date(date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' });
    container.innerHTML = songs.slice(0, 5).map((song, i) => `
        <div class="top-item">
            <div class="rank-badge">${i + 1}</div>
            <img src="${song.poster}" onerror="handleImageError(this)">
            <div><b>${song.titel}</b><br><small>${song.artiest}</small></div>
        </div>`).join('');
    document.getElementById('modal').classList.remove('hidden');
}

document.getElementById('prevMonth').onclick = () => { currentViewDate.setMonth(currentViewDate.getMonth() - 1); renderCalendar(); };
document.getElementById('nextMonth').onclick = () => { currentViewDate.setMonth(currentViewDate.getMonth() + 1); renderCalendar(); };
document.getElementById('close-button').onclick = () => document.getElementById('modal').classList.add('hidden');

loadMusic();