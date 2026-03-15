import sqlite3
import requests
from bs4 import BeautifulSoup
import re
import json
import time
from pathlib import Path
from tqdm import tqdm
import random

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "data" / "processed" / "cannalchemy.db"
OUTPUT_JSON = ROOT / "scripts" / "allbud_flavors_scraped.json"

# Flavor categories we care about
QUIZ_FLAVORS = ['citrus', 'pine', 'earthy', 'berry', 'diesel', 'sweet', 'spicy', 'skunky', 'floral']

RAW_FLAVOR_MAP = {
    'citrus': 'citrus', 'lemon': 'citrus', 'lime': 'citrus', 'orange': 'citrus',
    'grapefruit': 'citrus', 'tangerine': 'citrus', 'tangy': 'citrus', 'sour': 'citrus',
    'pine': 'pine', 'piney': 'pine', 'woody': 'pine', 'cedar': 'pine', 'wood': 'pine',
    'earthy': 'earthy', 'earth': 'earthy', 'pungent': 'earthy', 'nutty': 'earthy',
    'coffee': 'earthy', 'tobacco': 'earthy', 'mushroom': 'earthy', 'tea': 'earthy',
    'chocolate': 'earthy', 'hash': 'earthy',
    'berry': 'berry', 'fruity': 'berry', 'blueberry': 'berry', 'grape': 'berry',
    'strawberry': 'berry', 'tropical': 'berry', 'mango': 'berry', 'pineapple': 'berry',
    'banana': 'berry', 'apple': 'berry', 'peach': 'berry', 'cherry': 'berry',
    'plum': 'berry', 'watermelon': 'berry', 'melon': 'berry', 'fruit': 'berry',
    'diesel': 'diesel', 'chemical': 'diesel', 'ammonia': 'diesel', 'tar': 'diesel',
    'gas': 'diesel', 'fuel': 'diesel', 'gasoline': 'diesel', 'skunk': 'diesel',
    'sweet': 'sweet', 'candy': 'sweet', 'vanilla': 'sweet', 'butter': 'sweet',
    'caramel': 'sweet', 'cream': 'sweet', 'honey': 'sweet', 'cake': 'sweet',
    'cookie': 'sweet', 'sugary': 'sweet', 'syrup': 'sweet', 'sugary sweet': 'sweet',
    'spicy': 'spicy', 'herbal': 'spicy', 'peppery': 'spicy', 'pepper': 'spicy',
    'sage': 'spicy', 'mint': 'spicy', 'minty': 'spicy', 'basil': 'spicy',
    'clove': 'spicy', 'cinnamon': 'spicy',
    'skunky': 'skunky', 'dank': 'skunky', 'musky': 'skunky',
    'cheese': 'skunky', 'cheesy': 'skunky', 'funky': 'skunky',
    'floral': 'floral', 'flowery': 'floral', 'lavender': 'floral', 'rose': 'floral',
    'jasmine': 'floral', 'violet': 'floral',
}

def create_allbud_url(strain_name):
    """Convert strain name to an AllBud URL slug."""
    clean_name = re.sub(r'[^a-zA-Z0-9\s-]', '', strain_name)
    slug = clean_name.strip().lower().replace(' ', '-')
    return slug

def scrape_strain_data(strain_name):
    """Scrapes flavor/aroma data directly from a strain's AllBud search page to find correct URL, then visits page."""
    slug = create_allbud_url(strain_name)
    
    urls_to_try = [
        f"https://www.allbud.com/marijuana-strains/hybrid/{slug}",
        f"https://www.allbud.com/marijuana-strains/indica-dominant-hybrid/{slug}",
        f"https://www.allbud.com/marijuana-strains/sativa-dominant-hybrid/{slug}",
        f"https://www.allbud.com/marijuana-strains/indica/{slug}",
        f"https://www.allbud.com/marijuana-strains/sativa/{slug}",
    ]
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
    }
    
    soup = None
    
    # Try different URLs
    for url in urls_to_try:
        try:
            time.sleep(random.uniform(0.1, 0.5))
            response = requests.get(url, headers=headers, timeout=10)
            if response.status_code == 200:
                soup = BeautifulSoup(response.text, 'html.parser')
                break
        except Exception as e:
            continue
            
    if not soup:
        # Try finding via search as fallback
        search_url = f"https://www.allbud.com/marijuana-strains/search?results=true&q={requests.utils.quote(strain_name)}"
        try:
            time.sleep(random.uniform(0.5, 1.0))
            search_response = requests.get(search_url, headers=headers, timeout=10)
            if search_response.status_code == 200:
                search_soup = BeautifulSoup(search_response.text, 'html.parser')
                first_result = search_soup.find('a', class_='object-title')
                if first_result and 'href' in first_result.attrs:
                    url = f"https://www.allbud.com{first_result['href']}"
                    time.sleep(random.uniform(0.5, 1.0))
                    detail_response = requests.get(url, headers=headers, timeout=10)
                    if detail_response.status_code == 200:
                        soup = BeautifulSoup(detail_response.text, 'html.parser')
        except Exception as e:
            pass

    if not soup:
        return None
        
    flavors = set()
    
    # 1. Check Flavors & Aromas section tags
    for tag_type in ['taste', 'aroma']:
        tags = soup.find_all('a', href=re.compile(rf'/marijuana-strains/{tag_type}/'))
        for tag in tags:
            tag_text = tag.text.strip().lower()
            if tag_text in RAW_FLAVOR_MAP:
                flavors.add(RAW_FLAVOR_MAP[tag_text])
            else:
                for key, mapped in RAW_FLAVOR_MAP.items():
                    if key in tag_text:
                        flavors.add(mapped)
                    
    # 2. Check user reviews for flavor mentions
    reviews = soup.find_all('div', class_='strain-review-attributes')
    for review in reviews:
        text = review.text.lower()
        if 'flavors:' in text:
            # Extract just the flavors part
            parts = text.split('flavors:')
            if len(parts) > 1:
                flavor_part = parts[1].split('span')[0] if 'span' in parts[1] else parts[1]
                for key, mapped in RAW_FLAVOR_MAP.items():
                    if key in flavor_part:
                        flavors.add(mapped)
                        
    # 3. Check description if still empty
    if not flavors:
        desc_div = soup.find('div', id='strain-description')
        if desc_div:
            desc_text = desc_div.text.lower()
            for key, mapped in RAW_FLAVOR_MAP.items():
                if re.search(r'\b' + re.escape(key) + r'\b', desc_text):
                    if any(word in desc_text for word in ['taste', 'flavor', 'aroma', 'smell', 'notes of']):
                        flavors.add(mapped)
                        
    return list(flavors)

def main():
    conn = sqlite3.connect(DB_PATH)
    
    strains = conn.execute("SELECT id, name FROM strains ORDER BY id").fetchall()
    print(f"Found {len(strains)} strains in DB")
    
    # Load existing results to resume if stopped
    results = {}
    if OUTPUT_JSON.exists():
        with open(OUTPUT_JSON, 'r') as f:
            try:
                results = json.load(f)
                print(f"Loaded {len(results)} existing scraped flavors")
            except json.JSONDecodeError:
                pass
    
    # Filter out already scraped strains
    strains_to_scrape = [s for s in strains if s[1] not in results]
    print(f"Need to scrape {len(strains_to_scrape)} strains")
    
    try:
        for strain_id, name in tqdm(strains_to_scrape):
            flavors = scrape_strain_data(name)
            if flavors:
                results[name] = flavors
            else:
                results[name] = [] # Mark as scraped but no flavors found to avoid re-scraping endlessly
                
            # Save progress every 50 strains
            if len(results) % 50 == 0:
                with open(OUTPUT_JSON, 'w') as f:
                    json.dump(results, f, indent=2)
                    
    except KeyboardInterrupt:
        print("\nScraping interrupted by user. Saving progress...")
    except Exception as e:
        print(f"\nError occurred: {e}. Saving progress...")
    finally:
        with open(OUTPUT_JSON, 'w') as f:
            json.dump(results, f, indent=2)
        print(f"Finished. Total scraped data for {len(results)} strains saved to {OUTPUT_JSON}")

if __name__ == "__main__":
    main()
