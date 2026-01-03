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

    # 2. Verwijder versie-ruis (Bass Boosted, Sped Up, etc.)
    # Dit zorgt ervoor dat "Let it happen, Bass Boosted" gewoon "Let it happen" wordt.
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
    
    # 4. SPLIT-FIX: Als de titel "Artiest - Nummer" bevat
    if " - " in title:
        parts = title.split(" - ", 1)
        artist = parts[0].strip()
        title = parts[1].strip()

    return artist.strip(), title.strip()

def fetch_album_covers():
    file_path = 'data.json'
    if not os.path.exists(file_path): return

    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Stap 1: Alleen unieke missende nummers zoeken
    unique_missing = []
    seen = set()
    for entry in data:
        if entry['poster'] == "img/placeholder.png":
            a, t = clean_text_heavy(entry['artiest'], entry['titel'])
            key = (a.lower(), t.lower())
            if key not in seen:
                unique_missing.append({'a': a, 't': t, 'orig_a': entry['artiest'], 'orig_t': entry['titel']})
                seen.add(key)

    if not unique_missing:
        print("✨ Geen nieuwe posters nodig.")
        return

    print(f"🚀 Zoeken naar {len(unique_missing)} posters (met fallback-logica)...")
    
    for i, item in enumerate(unique_missing):
        # Poging 1: Schone artiest + Schone titel
        query = f"{item['a']} {item['t']}"
        img = search_apple(query)

        # Poging 2 (Fallback): Alleen de titel (werkt goed voor remixes/central kanalen)
        if not img and len(item['t']) > 3:
            print(f"  🔍 Fallback voor: {item['t']}...")
            img = search_apple(item['t'])

        if img:
            # Update alle matching entries in de data
            key_a = item['orig_a'].lower()
            key_t = item['orig_t'].lower()
            for e in data:
                if e['artiest'].lower() == key_a and e['titel'].lower() == key_t:
                    e['poster'] = img
            print(f"✅ Gevonden: {query}")
        else:
            print(f"❌ Niet gevonden: {query}")
        
        time.sleep(1.2) # Apple is streng met limieten

    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def search_apple(q):
    try:
        url = f"https://itunes.apple.com/search?term={urllib.parse.quote(q)}&entity=song&limit=1"
        res = requests.get(url, timeout=10).json()
        if res['resultCount'] > 0:
            return res['results'][0]['artworkUrl100'].replace('100x100bb', '600x600bb')
    except:
        pass
    return None

if __name__ == "__main__":
    fetch_album_covers()