const DB_NAME = 'MuziekDagboekDB';
const STORE_NAME = 'Settings';

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

async function saveHandleToDB(handle) {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(handle, 'correctionsHandle');
    return tx.complete;
}

async function getHandleFromDB() {
    const db = await openDB();
    return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get('correctionsHandle');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
    });
}

async function linkFile() {
    try {
        const [handle] = await window.showOpenFilePicker({
            types: [{ description: 'JSON Files', accept: { 'application/json': ['.json'] } }],
            multiple: false
        });
        fileHandle = handle;
        await saveHandleToDB(fileHandle);
        const file = await fileHandle.getFile();
        const text = await file.text();
        if(text) existingCorrections = JSON.parse(text);
        updateFileStatus(true);
        alert("✅ Bestand gekoppeld!");
    } catch (err) { console.error(err); alert("Kon bestand niet koppelen."); }
}

async function verifyPermission(handle, readWrite) {
    const options = {};
    if (readWrite) options.mode = 'readwrite';
    if ((await handle.queryPermission(options)) === 'granted') return true;
    if ((await handle.requestPermission(options)) === 'granted') return true;
    return false;
}

async function saveCorrections() {
    if (fileHandle) {
        try {
            const hasPermission = await verifyPermission(fileHandle, true);
            if (!hasPermission) return false;
            const writable = await fileHandle.createWritable();
            await writable.write(JSON.stringify(existingCorrections, null, 2));
            await writable.close();
            return true;
        } catch (err) { console.error("Auto-save mislukt:", err); return false; }
    } else {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(existingCorrections, null, 2));
        const dl = document.createElement('a');
        dl.setAttribute("href", dataStr);
        dl.setAttribute("download", "corrections.json");
        document.body.appendChild(dl);
        dl.click();
        dl.remove();
        return false; 
    }
}

function updateFileStatus(isConnected) {
    const statusEl = document.getElementById('file-status');
    const btnEl = document.getElementById('btn-link-file');
    if (isConnected) {
        statusEl.innerHTML = "💾 Opslaan: <b>Automatisch</b>";
        statusEl.style.color = "#1db954";
        statusEl.style.borderColor = "#1db954";
        btnEl.classList.add('hidden');
    } else {
        statusEl.innerHTML = "💾 Opslaan: Handmatig";
        statusEl.style.color = "#aaa";
        statusEl.style.borderColor = "#333";
        btnEl.classList.remove('hidden');
    }
}