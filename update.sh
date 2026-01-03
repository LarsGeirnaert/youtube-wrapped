#!/bin/bash
echo "1/3: Filteren van YouTube geschiedenis..."
python3 filter_yt_music.py
echo "2/3: Top 5 selecteren..."
python3 generate_top5.py
echo "3/3: Posters ophalen (december & januari)..."
python3 fetch_posters.py
echo "Klaar! Vernieuw je browser."