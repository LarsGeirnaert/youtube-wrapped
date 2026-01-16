// ==========================================
// 1. GLOBAL STATE & HELPER FUNCTIONS
// ==========================================

let currentViewDate = new Date();
// Data containers
let musicData = [], fullHistoryData = [], statsData = [], monthlyStats = {}, streakData = {}, chartData = [], comebackData = [];
let oldFavoritesData = [], calendarIndex = {}, existingCorrections = [];
// State trackers
let activeFilter = null, activeSongFilter = null, focusStreakRange = null;
let mergeMode = false, selectedForMerge = [];
let fileHandle = null, comparisonItems = [];
let charts = {}, modalHistory = [];
let isSilenceMode = false;

const DB_NAME = 'MuziekDagboekDB';
const STORE_NAME = 'Settings';

function escapeStr(str) {
    if (!str) return '';
    return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function getAlbumKey(posterUrl, artist) {
    if (!posterUrl || posterUrl.includes('placeholder')) return artist.toLowerCase();
    const uniqueId = posterUrl.split('/image/thumb/')[1] || posterUrl;
    return `${artist.toLowerCase()}_${uniqueId}`;
}

function addToHistory(viewType, args) {
    modalHistory.push({ type: viewType, args: Array.from(args) });
}

// Streaks helper (nodig voor modals en main)
function getSongStreaks(titel, artiest) {
    const rawDates = fullHistoryData
        .filter(m => m.titel === titel && m.artiest === artiest)
        .map(m => m.datum);
    const uniqueDates = [...new Set(rawDates)].sort();

    if (uniqueDates.length === 0) return [];

    let streaks = [];
    const parseDate = (str) => {
        if(!str) return new Date();
        const [y, m, d] = str.split('-').map(Number);
        return new Date(y, m - 1, d, 12, 0, 0);
    };

    // We bewaren datums als strings in de streak objecten
    let currentStreak = { start: uniqueDates[0], end: uniqueDates[0], count: 1 };
    const oneDayMs = 1000 * 60 * 60 * 24;

    for (let i = 1; i < uniqueDates.length; i++) {
        const prevDate = parseDate(uniqueDates[i-1]);
        const currDate = parseDate(uniqueDates[i]);
        const diffDays = Math.round((currDate - prevDate) / oneDayMs);

        if (diffDays === 1) {
            currentStreak.count++;
            currentStreak.end = uniqueDates[i]; // Update end met nieuwe string
        } else {
            if (currentStreak.count > 1) streaks.push(currentStreak);
            currentStreak = { start: uniqueDates[i], end: uniqueDates[i], count: 1 };
        }
    }
    if (currentStreak.count > 1) streaks.push(currentStreak);
    return streaks.sort((a,b) => b.count - a.count).slice(0, 3);
}

function getArtistStreaks(artiest) {
    // 1. Filter op artiest in de volledige historie
    const rawDates = fullHistoryData
        .filter(m => m.artiest === artiest)
        .map(m => m.datum);

    // 2. Unieke datums sorteren
    const uniqueDates = [...new Set(rawDates)].sort();

    if (uniqueDates.length === 0) return [];

    let streaks = [];
    
    // Helper
    const parseDate = (str) => {
        if(!str) return new Date();
        const [y, m, d] = str.split('-').map(Number);
        return new Date(y, m - 1, d, 12, 0, 0);
    };

    let currentStreak = { 
        start: uniqueDates[0], 
        end: uniqueDates[0], 
        count: 1 
    };

    const oneDayMs = 1000 * 60 * 60 * 24;

    for (let i = 1; i < uniqueDates.length; i++) {
        const prevDate = parseDate(uniqueDates[i-1]);
        const currDate = parseDate(uniqueDates[i]);
        const diffDays = Math.round((currDate - prevDate) / oneDayMs);

        if (diffDays === 1) {
            currentStreak.count++;
            currentStreak.end = uniqueDates[i];
        } else {
            if (currentStreak.count > 1) streaks.push(currentStreak);
            currentStreak = { start: uniqueDates[i], end: uniqueDates[i], count: 1 };
        }
    }
    if (currentStreak.count > 1) streaks.push(currentStreak);

    // Top 3 teruggeven
    return streaks.sort((a,b) => b.count - a.count).slice(0, 3);
}