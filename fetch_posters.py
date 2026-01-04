import json
import requests
import urllib.parse
import time
import os
import re

def clean_for_api(artist, title):
    title = re.sub(r'^(Bekeken|Watched)\s+naar\s+', '', title, flags=re.IGNORECASE)
    title = re.sub(r'^(Bekeken|Watched)\s+', '', title, flags=re.IGNORECASE)
    noise = [r'Official Video', r'Lyrics', r'Audio', r'ft\.', r'feat\.', r'//.*']
    for n in noise:
        title = re.sub(n, ' ', title, flags=re.IGNORECASE).strip()
    return artist, title

def search_apple(q):
    try:
        url = f"https://itunes.apple.com/search?term={urllib.parse.quote(q)}&entity=song&limit=1"
        res = requests.get(url, timeout=10).json()
        if res['resultCount'] > 0:
            return res['results'][0]['artworkUrl100'].replace('100x100bb', '600x600bb')
    except: pass
    return None

def fetch_all_posters():
    files = ['data.json', 'stats.json']
    all_data = {}
    poster_library = {}
    
    for file_name in files:
        if os.path.exists(file_name):
            with open(file_name, 'r', encoding='utf-8') as f:
                data = json.load(f)
                all_data[file_name] = data
                for entry in data:
                    if entry.get('poster') and entry['poster'] != "img/placeholder.png":
                        poster_library[(entry['artiest'].lower(), entry['titel'].lower())] = entry['poster']

    unique_missing = []
    seen_keys = set()
    for file_name, data in all_data.items():
        for entry in data:
            if entry.get('poster') == "img/placeholder.png":
                key = (entry['artiest'].lower(), entry['titel'].lower())
                if key in poster_library:
                    entry['poster'] = poster_library[key]
                elif key not in seen_keys:
                    unique_missing.append({'a': entry['artiest'], 't': entry['titel']})
                    seen_keys.add(key)

    if not unique_missing:
        print("✨ Geen nieuwe posters nodig.")
        return

    print(f"🚀 Zoeken naar {len(unique_missing)} unieke posters...")
    try:
        for i, item in enumerate(unique_missing):
            ca, ct = clean_for_api(item['a'], item['t'])
            img = search_apple(f"{ca} {ct}") or search_apple(ct)

            if img:
                for f_name, f_data in all_data.items():
                    for e in f_data:
                        if e['artiest'] == item['a'] and e['titel'] == item['t']:
                            e['poster'] = img
                print(f"✅ Gevonden ({i+1}/{len(unique_missing)}): {item['a']} - {item['t']}")
                for f_n, f_c in all_data.items():
                    with open(f_n, 'w', encoding='utf-8') as f: json.dump(f_c, f, indent=2, ensure_ascii=False)
            else:
                print(f"❌ Niet gevonden: {item['a']} - {item['t']}")
            time.sleep(1.2)
    except KeyboardInterrupt:
        print("\n🛑 Gestopt door gebruiker.")

if __name__ == "__main__":
    fetch_all_posters()