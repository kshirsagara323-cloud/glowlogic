-- 003_demo_products.sql  (safe to run repeatedly)
-- DEMO DATA. Every product here is FICTIONAL, from the fictional brand "Demo Labs". They exist only to
-- demonstrate the recommendation engine. No real product, price, review or claim is represented.
-- Real, sourced product data is imported in a later phase.

INSERT INTO brand (name, data_source_id)
SELECT 'Demo Labs', id FROM data_source WHERE slug = 'demo-data'
ON CONFLICT (name) DO NOTHING;

INSERT INTO product (slug, brand_id, name, category, price_tier, spf, fragrance_free, description, data_source_id, status)
SELECT v.slug, b.id, v.name, v.category, v.tier, v.spf, v.ff,
       'DEMO DATA: fictional product used to demonstrate the recommendation engine.', ds.id, 'active'
FROM (VALUES
  ('demo-gentle-gel-cleanser','Demo Gentle Gel Cleanser','cleanser',1,NULL::smallint,true),
  ('demo-cream-cleanser','Demo Cream Cleanser','cleanser',2,NULL,true),
  ('demo-foam-cleanser-fragranced','Demo Fragranced Foam Cleanser','cleanser',1,NULL,false),
  ('demo-bha-cleanser','Demo BHA Cleanser','cleanser',2,NULL,true),
  ('demo-hydrating-serum','Demo Hydrating Serum','serum',2,NULL,true),
  ('demo-niacinamide-serum','Demo Niacinamide Serum','serum',2,NULL,true),
  ('demo-vitamin-c-serum','Demo Vitamin C Serum','serum',3,NULL,true),
  ('demo-azelaic-serum','Demo Azelaic Serum','serum',2,NULL,true),
  ('demo-retinol-serum','Demo Retinol Serum','serum',3,NULL,true),
  ('demo-aha-exfoliant','Demo AHA Exfoliant','exfoliant',2,NULL,true),
  ('demo-pha-exfoliant','Demo PHA Exfoliant','exfoliant',2,NULL,true),
  ('demo-bha-liquid','Demo BHA Liquid','exfoliant',2,NULL,true),
  ('demo-bp-treatment','Demo Benzoyl Peroxide Treatment','acne_treatment',1,NULL,true),
  ('demo-gel-moisturizer','Demo Gel Moisturizer','moisturizer',1,NULL,true),
  ('demo-rich-moisturizer','Demo Rich Barrier Moisturizer','moisturizer',2,NULL,true),
  ('demo-barrier-cream-fragranced','Demo Fragranced Barrier Cream','moisturizer',3,NULL,false),
  ('demo-mineral-sunscreen-spf50','Demo Mineral Sunscreen SPF 50','sunscreen',2,50,true),
  ('demo-gel-sunscreen-spf30','Demo Gel Sunscreen SPF 30','sunscreen',1,30,true),
  ('demo-light-sunscreen-spf15','Demo Light Sunscreen SPF 15','sunscreen',1,15,true)
) AS v(slug, name, category, tier, spf, ff)
CROSS JOIN brand b CROSS JOIN data_source ds
WHERE b.name = 'Demo Labs' AND ds.slug = 'demo-data'
ON CONFLICT (slug) DO NOTHING;

-- Skin types the (fictional) product is made for. Origin 'curated' = chosen by us for the demo.
INSERT INTO product_skin_type (product_id, skin_type, origin)
SELECT p.id, t.skin_type, 'curated'
FROM (VALUES
  ('demo-gentle-gel-cleanser','oily,combination,normal,sensitive'),
  ('demo-cream-cleanser','dry,sensitive,normal,dehydrated'),
  ('demo-foam-cleanser-fragranced','oily,combination'),
  ('demo-bha-cleanser','oily,combination'),
  ('demo-hydrating-serum','dry,dehydrated,normal,sensitive,combination,oily'),
  ('demo-niacinamide-serum','oily,combination,normal'),
  ('demo-vitamin-c-serum','normal,dry,combination'),
  ('demo-azelaic-serum','oily,combination,normal'),
  ('demo-retinol-serum','normal,dry,combination,oily'),
  ('demo-aha-exfoliant','normal,combination,oily'),
  ('demo-pha-exfoliant','sensitive,dry,normal,dehydrated'),
  ('demo-bha-liquid','oily,combination'),
  ('demo-bp-treatment','oily,combination'),
  ('demo-gel-moisturizer','oily,combination,normal,dehydrated'),
  ('demo-rich-moisturizer','dry,sensitive,normal,dehydrated'),
  ('demo-barrier-cream-fragranced','dry,normal'),
  ('demo-mineral-sunscreen-spf50','dry,sensitive,normal,combination,oily'),
  ('demo-gel-sunscreen-spf30','oily,combination,normal'),
  ('demo-light-sunscreen-spf15','oily,combination,normal')
) AS v(slug, types)
JOIN product p ON p.slug = v.slug
CROSS JOIN LATERAL unnest(string_to_array(v.types, ',')) AS t(skin_type)
ON CONFLICT DO NOTHING;

-- Ingredient lists, in label order.
INSERT INTO product_ingredient (product_id, position, raw_name, ingredient_id)
SELECT p.id, t.pos::smallint, i.inci_name, i.id
FROM (VALUES
  ('demo-gentle-gel-cleanser','water,glycerin,cocamidopropyl-betaine,panthenol,phenoxyethanol'),
  ('demo-cream-cleanser','water,glycerin,caprylic-capric-triglyceride,ceramide-np,cetearyl-alcohol,phenoxyethanol'),
  ('demo-foam-cleanser-fragranced','water,sodium-lauryl-sulfate,glycerin,parfum,phenoxyethanol'),
  ('demo-bha-cleanser','water,cocamidopropyl-betaine,salicylic-acid,glycerin,phenoxyethanol'),
  ('demo-hydrating-serum','water,glycerin,sodium-hyaluronate,panthenol,phenoxyethanol'),
  ('demo-niacinamide-serum','water,niacinamide,glycerin,panthenol,phenoxyethanol'),
  ('demo-vitamin-c-serum','water,ascorbic-acid,glycerin,tocopherol,phenoxyethanol'),
  ('demo-azelaic-serum','water,azelaic-acid,glycerin,dimethicone,phenoxyethanol'),
  ('demo-retinol-serum','squalane,retinol,tocopherol,caprylic-capric-triglyceride,dimethicone'),
  ('demo-aha-exfoliant','water,glycolic-acid,lactic-acid,glycerin,phenoxyethanol'),
  ('demo-pha-exfoliant','water,gluconolactone,glycerin,allantoin,phenoxyethanol'),
  ('demo-bha-liquid','water,alcohol-denat,salicylic-acid,glycerin,phenoxyethanol'),
  ('demo-bp-treatment','water,benzoyl-peroxide,glycerin,xanthan-gum,phenoxyethanol'),
  ('demo-gel-moisturizer','water,glycerin,sodium-hyaluronate,niacinamide,dimethicone,phenoxyethanol'),
  ('demo-rich-moisturizer','water,glycerin,ceramide-np,squalane,urea,cetearyl-alcohol,panthenol,phenoxyethanol'),
  ('demo-barrier-cream-fragranced','water,glycerin,squalane,ceramide-np,parfum,lavender-oil,phenoxyethanol'),
  ('demo-mineral-sunscreen-spf50','water,zinc-oxide,titanium-dioxide,glycerin,dimethicone,tocopherol,phenoxyethanol'),
  ('demo-gel-sunscreen-spf30','water,avobenzone,glycerin,niacinamide,dimethicone,phenoxyethanol'),
  ('demo-light-sunscreen-spf15','water,zinc-oxide,glycerin,dimethicone,phenoxyethanol')
) AS v(slug, ings)
JOIN product p ON p.slug = v.slug
CROSS JOIN LATERAL unnest(string_to_array(v.ings, ',')) WITH ORDINALITY AS t(ing, pos)
JOIN ingredient i ON i.slug = t.ing
ON CONFLICT DO NOTHING;
