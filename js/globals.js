// --- GLOBALE VARIABELEN ---
let currentViewDate = new Date();
let musicData = [], statsData = [], monthlyStats = {}, streakData = {}, chartData = {}, comebackData = [], activeFilter = null;
let charts = {};

// Navigatie geschiedenis
let modalHistory = [];

// Merge Mode State
let mergeMode = false;
let selectedForMerge = []; 
let existingCorrections = [];
let fileHandle = null;

// Comparison State
let comparisonItems = []; 

// --- HULPFUNCTIES ---
function escapeStr(str) {
    if (!str) return '';
    return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function getAlbumKey(posterUrl, artist) {
    if (!posterUrl || posterUrl.includes('placeholder')) return artist.toLowerCase();
    const uniqueId = posterUrl.split('/image/thumb/')[1] || posterUrl;
    return `${artist.toLowerCase()}_${uniqueId}`;
}