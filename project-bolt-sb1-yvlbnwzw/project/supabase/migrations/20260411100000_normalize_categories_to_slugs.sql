-- Normalize category values to language-neutral slugs
-- Affects both posts and profiles tables

-- Helper function to convert old values to slugs
CREATE OR REPLACE FUNCTION normalize_category_to_slug(cat TEXT) RETURNS TEXT AS $$
BEGIN
  RETURN CASE
    -- Construction
    WHEN lower(cat) ILIKE ANY(ARRAY['%građevin%', '%zanati%', '%construction%', '%trades%', '%bau%', '%handwerk%',
                                    'keramičar', 'keramicar', 'moler', 'soboslikar', 'zidar', 'bravar', 'stolar',
                                    'vodoinstalater', 'krovopokrivač', 'krovopokrivac', 'staklar', '%malter%']) THEN 'construction'
    -- Home Services
    WHEN lower(cat) ILIKE ANY(ARRAY['%kućne%', '%home service%', '%haushalts%', 'čistač', 'cistac', 'baštovan',
                                    'bastovan', 'klima%', '%selidbe%']) THEN 'home_services'
    -- IT
    WHEN lower(cat) ILIKE ANY(ARRAY['%it i%', '%it &%', 'it', '%tehnolog%', '%technolog%', '%računar%',
                                    '%computer%', 'automehanicar', 'automehaničar']) THEN 'it_technology'
    -- Health
    WHEN lower(cat) ILIKE ANY(ARRAY['%zdravstvo%', '%health%', '%medical%', '%gesundheit%', '%medizin%']) THEN 'health'
    -- Finance
    WHEN lower(cat) ILIKE ANY(ARRAY['%finansij%', '%računovod%', '%finance%', '%accounting%', '%finanzen%', '%buchhaltung%']) THEN 'finance'
    -- Beauty
    WHEN lower(cat) ILIKE ANY(ARRAY['%lepota%', '%wellness%', '%beauty%', '%schönheit%', '%schonheit%']) THEN 'beauty'
    -- Security
    WHEN lower(cat) ILIKE ANY(ARRAY['%bezbednost%', '%security%', '%sicherheit%']) THEN 'security'
    -- Education
    WHEN lower(cat) ILIKE ANY(ARRAY['%obrazovanje%', '%education%', '%bildung%']) THEN 'education'
    -- Transport
    WHEN lower(cat) ILIKE ANY(ARRAY['%transport%', '%dostava%', '%delivery%', '%lieferung%', '%prevoz%', 'selidbe']) THEN 'transport'
    -- Food
    WHEN lower(cat) ILIKE ANY(ARRAY['%ugostiteljstvo%', '%food%', '%hospitality%', '%gastro%', '%tourism%', '%turizam%']) THEN 'food'
    -- Marketing
    WHEN lower(cat) ILIKE ANY(ARRAY['%marketing%', '%reklama%', '%advertis%', '%medij%', '%media%', '%werbung%']) THEN 'marketing'
    -- Legal
    WHEN lower(cat) ILIKE ANY(ARRAY['%pravo%', '%konsalting%', '%legal%', '%recht%', '%beratung%']) THEN 'legal'
    -- Real estate
    WHEN lower(cat) ILIKE ANY(ARRAY['%nekretnine%', '%real estate%', '%immobilien%']) THEN 'real_estate'
    -- Other / fallback
    ELSE 'other'
  END;
END;
$$ LANGUAGE plpgsql;

-- Update posts
UPDATE posts
SET category = normalize_category_to_slug(category)
WHERE category IS NOT NULL
  AND category != ''
  AND category NOT IN (
    'construction','home_services','it_technology','health','finance',
    'beauty','security','education','transport','food','marketing',
    'legal','real_estate','other'
  );

-- Update profiles
UPDATE profiles
SET category = normalize_category_to_slug(category)
WHERE category IS NOT NULL
  AND category != ''
  AND category NOT IN (
    'construction','home_services','it_technology','health','finance',
    'beauty','security','education','transport','food','marketing',
    'legal','real_estate','other'
  );

-- Cleanup
DROP FUNCTION normalize_category_to_slug(TEXT);
