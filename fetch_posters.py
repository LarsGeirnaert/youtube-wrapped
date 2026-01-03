import json
import requests
import urllib.parse
import time
import os
import re

def clean_text_heavy(artist, title):
    # EXACT DEZELFDE LOGICA ALS IN SYNC SCRIPT
    title = re.sub(r'^(Bekeken|Watched)\s+naar\s+', '', title)
    title = re.sub(r'^(Bekeken|Watched)\s+', '', title)
    title = re.sub(r'\[.*?\]', '', title)
    title = re.sub(r'\(.*?\)', '', title)
    if " - " in title:
        parts = title.split(" - ", 1)
        artist, title = parts[0].strip(), parts[1].strip()
    junk = ['VEVO', '- Topic', 'Official', 'Records', 'Music', 'Channel', '!K7']
    for j in junk: artist = artist.replace(j, '').strip()
    return artist.strip(), title.strip()

def fetch_album_covers():
    file_path = 'data.json'
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Stap 1: Smart Sync - Bouw bibliotheek
    library = {}
    for entry in data:
        a, t = clean_text_heavy(entry['artiest'], entry['titel'])
        key = (a.lower(), t.lower())
        if entry['poster'] != "img/placeholder.png":
            library[key] = entry['poster']

    # Stap 2: Vul placeholders in
    for entry in data:
        if entry['poster'] == "img/placeholder.png":
            a, t = clean_text_heavy(entry['artiest'], entry['titel'])
            key = (a.lower(), t.lower())
            if key in library: entry['poster'] = library[key]

    # Stap 3: Zoeklijst
    unique_missing = []
    seen = set()
    for entry in data:
        if entry['poster'] == "img/placeholder.png":
            a, t = clean_text_heavy(entry['artiest'], entry['titel'])
            key = (a.lower(), t.lower())
            if key not in seen:
                unique_missing.append({'a': a, 't': t})
                seen.add(key)

    if not unique_missing:
        print("✨ Geen nieuwe posters nodig.")
        return

    print(f"🚀 Zoeken naar {len(unique_missing)} posters...")
    for i, item in enumerate(unique_missing):
        query = f"{item['a']} {item['t']}"
        url = f"https://itunes.apple.com/search?term={urllib.parse.quote(query)}&entity=song&limit=1"
        try:
            res = requests.get(url, timeout=10).json()
            if res['resultCount'] > 0:
                img = res['results'][0]['artworkUrl100'].replace('100x100bb', '600x600bb')
                key = (item['a'].lower(), item['t'].lower())
                for e in data:
                    ea, et = clean_text_heavy(e['artiest'], e['titel'])
                    if (ea.lower(), et.lower()) == key: e['poster'] = img
                print(f"✅ {query}")
            time.sleep(1.5)
        except: continue
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

if __name__ == "__main__":
    fetch_album_covers()