import json
import os

# Instellingen
INPUT_FILE = 'kijkgeschiedenis.json'
OUTPUT_FILE = 'filtered_music.json'

def filter_music():
    if not os.path.exists(INPUT_FILE):
        print(f"Fout: {INPUT_FILE} niet gevonden!")
        return

    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)

    music_entries = []
    
    for entry in data:
        # 1. Sla advertenties en items zonder kanaal (subtitles) over
        if 'details' in entry or 'subtitles' not in entry:
            continue
            
        # 2. Check of het YouTube Music is OF een Topic-kanaal
        header = entry.get('header', '')
        channel_name = entry['subtitles'][0]['name']
        
        is_music = (header == "YouTube Music") or ("- Topic" in channel_name) or ("VEVO" in channel_name.upper())

        if is_music:
            # 3. Titel opschonen: "Je hebt naar Love Again gekeken" -> "Love Again"
            raw_title = entry.get('title', '')
            clean_title = raw_title.replace('Je hebt naar ', '').replace(' gekeken', '').strip()
            
            # 4. Artiest opschonen: "Dua Lipa - Topic" -> "Dua Lipa"
            artiest = channel_name.replace(' - Topic', '').strip()

            # 5. Datum pakken (YYYY-MM-DD)
            datum = entry['time'].split('T')[0]

            music_entries.append({
                "datum": datum,
                "titel": clean_title,
                "artiest": artiest,
                "poster": "img/placeholder.png"
            })

    # Verwijder exacte dubbelingen (als je een nummer 3x achter elkaar luistert op 1 dag)
    unique_music = []
    seen = set()
    for item in music_entries:
        identifier = f"{item['datum']}-{item['titel']}-{item['artiest']}"
        if identifier not in seen:
            unique_music.append(item)
            seen.add(identifier)

    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(unique_music, f, indent=2, ensure_ascii=False)

    print(f"✅ Klaar! {len(unique_music)} muzieknummers gefilterd uit je geschiedenis.")
    print(f"Resultaat staat in: {OUTPUT_FILE}")

if __name__ == "__main__":
    filter_music()