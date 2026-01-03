import json
import requests
import urllib.parse
import time
import os
import re

def clean_text_heavy(artist, title):
    # 1. Verwijder YouTube-specifieke tekst
    title = re.sub(r'^(Bekeken|Watched)\s+naar\s+', '', title, flags=re.IGNORECASE)
    title = re.sub(r'^(Bekeken|Watched)\s+', '', title, flags=re.IGNORECASE)

    # 2. Verwijder versie-ruis voor betere API-matches
    noise = [
        r'Bass Boosted', r'Sped Up', r'Nightcore', r'Remix', r'Edit', 
        r'Official Video', r'Lyrics', r'Audio', r'Central', r'Topic',
        r'and\s+', r',\s+', r'prod\..*', r'x\s.*'
    ]
    for n in noise:
        title = re.sub(n, '', title, flags=re.IGNORECASE).strip()
        artist = re.sub(n, '', artist, flags=re.IGNORECASE).strip()

    # 3. Haal tekst tussen haakjes/blokhaken weg
    title = re.sub(r'\[.*?\]', '', title)
    title = re.sub(r'\(.*?\)', '', title)
    
    # 4. SPLIT-FIX: Voor "Goose - Synrise"
    if " - " in title:
        parts = title.split(" - ", 1)
        artist = parts[0].strip()
        title = parts[1].strip()

    return artist.strip(), title.strip()

def search_apple(q):
    try:
        url = f"https://itunes.apple.com/search?term={urllib.parse.quote(q)}&entity=song&limit=1"
        res = requests.get(url, timeout=10).json()
        if res['resultCount'] > 0:
            return res['results'][0]['artworkUrl100'].replace('100x100bb', '600x600bb')
    except:
        pass
    return None

def fetch_all_posters():
    files = ['data.json', 'stats.json']
    all_data = {}

    # --- STAP 1: LAAD BESTANDEN EN BOUW POSTER-BIBLIOTHEEK ---
    poster_library = {}
    
    for file_name in files:
        if os.path.exists(file_name):
            with open(file_name, 'r', encoding='utf-8') as f:
                data = json.load(f)
                all_data[file_name] = data
                for entry in data:
                    a_clean, t_clean = clean_text_heavy(entry['artiest'], entry['titel'])
                    key = (a_clean.lower(), t_clean.lower())
                    # Als we al een poster hebben, voeg toe aan bieb
                    if entry.get('poster') and entry['poster'] != "img/placeholder.png":
                        poster_library[key] = entry['poster']

    # --- STAP 2: VUL ELKAAR AAN (SMART SYNC) ---
    # Als een poster in data.json staat maar niet in stats.json (of andersom), vul aan.
    for file_name in files:
        if file_name in all_data:
            for entry in all_data[file_name]:
                if entry['poster'] == "img/placeholder.png":
                    a_clean, t_clean = clean_text_heavy(entry['artiest'], entry['titel'])
                    key = (a_clean.lower(), t_clean.lower())
                    if key in poster_library:
                        entry['poster'] = poster_library[key]

    # --- STAP 3: ZOEKLIST MAKEN VOOR WAT ECHT NOG ONTBREEKT ---
    unique_missing = []
    seen_missing = set()
    
    for file_name in files:
        if file_name in all_data:
            for entry in all_data[file_name]:
                if entry['poster'] == "img/placeholder.png":
                    a_clean, t_clean = clean_text_heavy(entry['artiest'], entry['titel'])
                    key = (a_clean.lower(), t_clean.lower())
                    if key not in seen_missing:
                        unique_missing.append({'a': a_clean, 't': t_clean, 'orig_a': entry['artiest'], 'orig_t': entry['titel']})
                        seen_missing.add(key)

    if not unique_missing:
        print("✨ Beide bestanden zijn al volledig voorzien van posters!")
        # Sla op voor de zekerheid (in geval van stap 2 updates)
        save_files(all_data)
        return

    # --- STAP 4: API CALLS ---
    print(f"🚀 Zoeken naar {len(unique_missing)} missende posters voor data.json & stats.json...")
    
    for i, item in enumerate(unique_missing):
        query = f"{item['a']} {item['t']}"
        img = search_apple(query)

        # Fallback: Alleen titel
        if not img and len(item['t']) > 3:
            img = search_apple(item['t'])

        if img:
            # Update de poster in de interne lijsten van beide bestanden
            for file_name in files:
                if file_name in all_data:
                    for e in all_data[file_name]:
                        ea, et = clean_text_heavy(e['artiest'], e['titel'])
                        if (ea.lower(), et.lower()) == (item['a'].lower(), item['t_clean'].lower() if 't_clean' in item else item['t'].lower()):
                             e['poster'] = img
                        # Extra check op originele namen voor de zekerheid
                        elif e['artiest'] == item['orig_a'] and e['titel'] == item['orig_t']:
                             e['poster'] = img
            print(f"✅ Gevonden: {query}")
        else:
            print(f"❌ Niet gevonden: {query}")
        
        # Tussen tijds opslaan om dataverlies te voorkomen
        if i % 5 == 0:
            save_files(all_data)
        
        time.sleep(1.2)

    save_files(all_data)
    print("🏁 Alle bestanden zijn bijgewerkt en opgeslagen.")

def save_files(all_data):
    for file_name, content in all_data.items():
        with open(file_name, 'w', encoding='utf-8') as f:
            json.dump(content, f, indent=2, ensure_ascii=False)

if __name__ == "__main__":
    fetch_all_posters()