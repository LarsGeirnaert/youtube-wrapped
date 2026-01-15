import json
import os
import subprocess

def verwijder_onbekend():
    print("🗑️  Bezig met scannen naar items zonder cover...")

    # We lezen stats.json omdat daar alle unieke liedjes in staan
    if not os.path.exists('stats.json'):
        print("Fout: stats.json niet gevonden. Draai eerst generate_smart_top5.py")
        return

    with open('stats.json', 'r', encoding='utf-8') as f:
        all_songs = json.load(f)

    # 1. Zoek de "stouterds"
    to_ignore = []
    count = 0
    
    for song in all_songs:
        if song.get('poster') == "img/placeholder.png":
            to_ignore.append({
                "artiest": song['artiest'],
                "titel": song['titel']
            })
            count += 1

    if count == 0:
        print("✅ Geen items zonder cover gevonden!")
        return

    print(f"⚠️  {count} items gevonden zonder cover. Toevoegen aan 'ignored.json'...")

    # 2. Laad bestaande blacklist (als die er is)
    current_ignored = []
    if os.path.exists('ignored.json'):
        try:
            with open('ignored.json', 'r', encoding='utf-8') as f:
                current_ignored = json.load(f)
        except: pass

    # 3. Voeg nieuwe toe (voorkom dubbelingen)
    # We gebruiken een set van strings om dubbelen makkelijk te filteren
    existing_keys = set(f"{x['artiest']}|{x['titel']}" for x in current_ignored)
    
    added = 0
    for item in to_ignore:
        key = f"{item['artiest']}|{item['titel']}"
        if key not in existing_keys:
            current_ignored.append(item)
            existing_keys.add(key)
            added += 1

    # 4. Opslaan
    with open('ignored.json', 'w', encoding='utf-8') as f:
        json.dump(current_ignored, f, indent=2, ensure_ascii=False)

    print(f"✅ {added} nieuwe items toegevoegd aan de blacklist.")
    print("🔄 Bezig met herberekenen van de data...")

    # 5. Run het hoofdscript opnieuw om de data te verversen
    subprocess.run(["python3", "generate_smart_top5.py"])

if __name__ == "__main__":
    verwijder_onbekend()