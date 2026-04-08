/*
  # Ažuriranje kategorija na srpski jezik
  
  1. Izmene
    - Zamenjuje "Plumber" sa "vodoinstalater"
    - Zamenjuje "Other" sa "ostalo"
    
  2. Napomene
    - Svi postojeći oglasi sa engleskim kategorijama će biti ažurirani
    - Kategorije su sada u potpunosti na srpskom jeziku
*/

-- Ažuriraj postojeće kategorije sa engleskog na srpski
UPDATE posts 
SET category = 'vodoinstalater' 
WHERE category = 'Plumber';

UPDATE posts 
SET category = 'ostalo' 
WHERE category = 'Other';

-- Ažuriraj normalizovane vrednosti
UPDATE posts 
SET category_normalized = 'vodoinstalater' 
WHERE category_normalized = 'plumber';

UPDATE posts 
SET category_normalized = 'ostalo' 
WHERE category_normalized = 'other';