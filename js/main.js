// ==========================================
// 8. MAIN & INITIALIZATION
// ==========================================

function calculateStreak() {
    const dates = [...new Set(musicData.map(item => item.datum))].sort().reverse(); 
    const el = document.getElementById('streak-count');
    if (!el) return;

    if (dates.length === 0) {
        el.innerText = 0;
        return;
    }

    // Controleer of de streak nog actief is (vandaag of gisteren geluisterd)
    const today = new Date();
    today.setHours(0,0,0,0);
    const lastListenDate = new Date(dates[0]);
    lastListenDate.setHours(0,0,0,0);
    const diffToToday = (today - lastListenDate) / 86400000;

    if (diffToToday > 1) {
        el.innerText = 0;
        el.style.cursor = 'default';
        el.onclick = null;
        return;
    }

    let streak = 1;
    const oneDay = 86400000;
    for (let i = 0; i < dates.length - 1; i++) {
        const d1 = new Date(dates[i]);
        const d2 = new Date(dates[i+1]);
        const c1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
        const c2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
        
        if ((c1 - c2) / oneDay === 1) {
            streak++;
        } else {
            break;
        }
    }

    el.innerText = streak;
    el.style.cursor = 'pointer';
    el.title = "Klik om streak op de kalender te zien";
    
    // Maak het getal klikbaar om de streak op de kalender te tonen
    el.onclick = () => {
        const startDate = dates[streak - 1];
        const endDate = dates[0];
        // We sturen 'null' als artiest omdat dit een globale streak is
        applyCalendarFilter(null, startDate, endDate);
    };
}

function renderStatsDashboard() {
    console.log("[DEBUG] renderStatsDashboard gestart...");
    
    const topSongs = [...statsData].sort((a, b) => b.count - a.count).slice(0, 10);
    const artistMap = {}; statsData.forEach(s => { artistMap[s.artiest] = (artistMap[s.artiest] || 0) + s.count; });
    const topArtists = Object.entries(artistMap).sort((a,b) => b[1] - a[1]).slice(0, 10);
    
    renderList('top-songs-list-small', topSongs.slice(0, 5).map(s => [`${s.titel} - ${s.artiest}`, s.count, s.poster]), 'x', 'song');
    renderList('top-artists-list-small', topArtists.slice(0, 5).map(a => [a[0], a[1], null]), 'x', 'artist');
    
    const totalListens = Object.values(artistMap).reduce((a, b) => a + b, 0);
    const el = document.getElementById('total-listens-count');
    if(el) el.innerText = totalListens;

    renderList('top-songs-list', topSongs.map(s => [`${s.titel} - ${s.artiest}`, s.count, s.poster]), 'x', 'song');
    renderList('top-artists-list', topArtists.map(a => [a[0], a[1], null]), 'x', 'artist');
    renderList('comeback-list', comebackData.slice(0, 10).map(c => [`${c.titel} - ${c.artiest}`, `${c.gap}d stilte`, c.poster, c.periode]), '', 'song');
    renderList('old-favorites-list', oldFavoritesData.slice(0, 10).map(c => [`${c.titel} - ${c.artiest}`, `${c.days_silent}d stil`, c.poster, `Laatst: ${c.last_played}`]), '', 'song');

    if (streakData.songs_current) {
        renderList('current-song-streaks', streakData.songs_current.slice(0, 10).map(s => [
            `${s.titel} - ${s.artiest}`, 
            s.streak, 
            statsData.find(x=>x.titel===s.titel)?.poster, 
            null, 
            s.period, 
            s.start, s.end 
        ]), ' d', 'song');

        renderList('top-song-streaks', streakData.songs_top.slice(0, 10).map(s => [
            `${s.titel} - ${s.artiest}`, 
            s.streak, 
            statsData.find(x=>x.titel===s.titel)?.poster, 
            null, 
            s.period,
            s.start, s.end 
        ]), ' d', 'song');

        renderList('current-artist-streaks', streakData.artists_current.slice(0, 10).map(a => [
            a.naam, a.streak, null, 
            null, 
            a.period, a.start, a.end 
        ]), ' d', 'artist');

        renderList('top-artist-streaks', streakData.artists_top.slice(0, 10).map(a => [
            a.naam, a.streak, null, 
            null, 
            a.period, a.start, a.end 
        ]), ' d', 'artist');
    }

    const albumMap = {};
    statsData.forEach(s => {
        if (s.poster === "img/placeholder.png") return;
        const key = getAlbumKey(s.poster, s.artiest);
        if (!albumMap[key]) albumMap[key] = { poster: s.poster, artiest: s.artiest, total: 0, unique: new Set() };
        albumMap[key].total += s.count; albumMap[key].unique.add(s.titel);
    });
    const albums = Object.values(albumMap);
    
    renderList('top-albums-listens', albums.sort((a,b) => b.total - a.total).slice(0, 10).map(a => [`Album van ${a.artiest}`, a.total, a.poster, a.artiest]), 'x', 'album');
    
    const sortedVariety = [...albums].sort((a,b) => b.unique.size - a.unique.size);
    const filteredVariety = []; const counts = {};
    for (const alb of sortedVariety) {
        if (filteredVariety.length >= 10) break;
        const art = alb.artiest; counts[art] = (counts[art] || 0) + 1;
        if (counts[art] <= 2) filteredVariety.push(alb);
    }
    renderList('top-albums-variety', filteredVariety.map(a => [`Album van ${a.artiest}`, a.unique.size, a.poster, a.artiest]), ' songs', 'album');

    const artistGroups = {}; statsData.forEach(s => { if (!artistGroups[s.artiest]) artistGroups[s.artiest] = []; artistGroups[s.artiest].push(s); });
    const obsessions = [], explorers = [];
    Object.entries(artistGroups).forEach(([artist, songs]) => {
        if (songs.length === 1 && songs[0].count > 50) obsessions.push([`${songs[0].titel} - ${artist}`, songs[0].count, songs[0].poster]);
        if (songs.length >= 10) explorers.push([artist, songs.length, null]);
    });
    renderList('obsessions-list', obsessions.sort((a,b) => b[1] - a[1]).slice(0, 10), 'x', 'song');
    renderList('variety-list', explorers.sort((a,b) => b[1] - a[1]).slice(0, 10), ' songs', 'artist');
}

function renderFunStats() {
    if(!chartData.fun_stats) return;
    const fs = chartData.fun_stats;
    document.getElementById('fun-total-days').innerText = fs.total_time_days;
    document.getElementById('fun-total-hours').innerText = `${fs.total_time_hours} uur totaal`;
    
    if(fs.busiest_day.date !== "-") {
        const d = new Date(fs.busiest_day.date);
        document.getElementById('fun-busiest-date').innerText = d.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' });
        document.getElementById('fun-busiest-count').innerText = fs.busiest_day.count;
    }
    
    document.getElementById('fun-discovery').innerText = fs.avg_discovery;
}

async function loadMusic() {
    try {
        const savedHandle = await getHandleFromDB();
        if (savedHandle) {
            fileHandle = savedHandle;
            console.log("💾 Bestandskoppeling hersteld.");
            updateFileStatus(true);
            try {
                if ((await fileHandle.queryPermission({ mode: 'read' })) === 'granted') {
                    const file = await fileHandle.getFile();
                    const text = await file.text();
                    if (text) existingCorrections = JSON.parse(text);
                }
            } catch (e) { console.log("Wacht op permissie...", e); }
        }

        const [dataRes, statsRes, monthlyRes, streaksRes, chartRes, comebackRes, correctionsRes, calendarRes, oldFavRes, fullHistRes] = await Promise.all([
            fetch('data.json'), fetch('stats.json'), fetch('monthly_stats.json'), 
            fetch('streaks.json').catch(() => ({json: () => ({})})),
            fetch('chart_data.json').catch(() => ({json: () => ({})})),
            fetch('comebacks.json').catch(() => ({json: () => ([])})),
            fetch('corrections.json').catch(() => ({json: () => ([])})),
            fetch('calendar_index.json').catch(() => ({json: () => ({})})),
            fetch('old_favorites.json').catch(() => ({json: () => ([])})),
            fetch('full_history.json').catch(() => ({json: () => ([])})) 
        ]);

        musicData = await dataRes.json();
        statsData = await statsRes.json();
        monthlyStats = await monthlyRes.json();
        chartData = await chartRes.json();
        comebackData = await comebackRes.json();
        try { streakData = await streaksRes.json(); } catch(e) { streakData = {}; }
        try { calendarIndex = await calendarRes.json(); } catch(e) { calendarIndex = {}; }
        oldFavoritesData = await oldFavRes.json(); 
        
        fullHistoryData = await fullHistRes.json(); 
        
        if (existingCorrections.length === 0) {
            try { existingCorrections = await correctionsRes.json(); } catch(e) { existingCorrections = []; }
        }

        document.getElementById('unique-songs-count').innerText = statsData.length;
        document.getElementById('total-days-count').innerText = new Set(musicData.map(s => s.datum)).size;
        
        renderCharts();
        calculateStreak();
        renderCalendar();
        renderFunStats();
        updateComparisonChart(); 
        renderRecapSelector();
    } catch (error) { console.error("Fout bij laden:", error); }
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('prevMonth').onclick = () => { currentViewDate.setMonth(currentViewDate.getMonth() - 1); renderCalendar(); };
    document.getElementById('nextMonth').onclick = () => { currentViewDate.setMonth(currentViewDate.getMonth() + 1); renderCalendar(); };
    document.getElementById('close-button').onclick = () => closeModal();
    document.getElementById('resetFilter').onclick = function() { 
        activeFilter = null; 
        activeSongFilter = null; 
        focusStreakRange = null; 
        this.classList.add('hidden'); 
        renderCalendar(); 
    };    
    loadMusic();
});