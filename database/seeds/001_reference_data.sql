-- 001_reference_data.sql  (safe to run repeatedly)
-- Structural reference data only. No product, ingredient-claim or scientific content here:
-- that content needs real sources and arrives in Phases 7-8.

INSERT INTO skin_concern (code, label, sort_order) VALUES
 ('acne','Acne',1),('blackheads','Blackheads',2),('whiteheads','Whiteheads',3),
 ('dryness','Dryness',4),('dehydration','Dehydration',5),('oiliness','Oiliness',6),
 ('redness','Redness',7),('uneven_tone','Uneven tone',8),('dark_spots','Dark spots',9),
 ('hyperpigmentation','Hyperpigmentation',10),('dullness','Dullness',11),('texture','Texture',12),
 ('visible_pores','Visible pores',13),('fine_lines','Fine lines',14),
 ('under_eye','Under-eye concerns',15),('sensitivity','Sensitivity',16)
ON CONFLICT DO NOTHING;

INSERT INTO product_category (code, label, is_makeup) VALUES
 ('cleanser','Cleanser',false),('toner','Toner',false),('serum','Serum',false),
 ('moisturizer','Moisturizer',false),('sunscreen','Sunscreen',false),
 ('acne_treatment','Acne treatment',false),('exfoliant','Exfoliant',false),
 ('mask','Mask',false),('eye_product','Eye product',false),('lip_product','Lip product',false),
 ('makeup_remover','Makeup remover',false),
 ('foundation','Foundation',true),('concealer','Concealer',true),('primer','Primer',true),
 ('blush','Blush',true),('bronzer','Bronzer',true),('highlighter','Highlighter',true),
 ('powder','Powder',true),('setting_spray','Setting spray',true)
ON CONFLICT DO NOTHING;

-- Family names only (grouping for compatibility rules). The rules themselves come in Phase 7.
INSERT INTO ingredient_family (slug, name) VALUES
 ('aha','Alpha hydroxy acids'),('bha','Beta hydroxy acids'),('pha','Polyhydroxy acids'),
 ('retinoid','Retinoids'),('vitamin-c','Vitamin C (ascorbic acid and derivatives)'),
 ('benzoyl-peroxide','Benzoyl peroxide'),('azelaic-acid','Azelaic acid'),
 ('niacinamide','Niacinamide'),('humectant','Humectants'),('ceramide','Ceramides and barrier lipids'),
 ('peptide','Peptides'),('chemical-sunscreen','Chemical (organic) sunscreen filters'),
 ('mineral-sunscreen','Mineral sunscreen filters'),('fragrance','Fragrance and fragrance allergens'),
 ('essential-oil','Essential oils'),('denatured-alcohol','Drying alcohols'),
 ('sulfate-surfactant','Sulfate surfactants'),('tranexamic-acid','Tranexamic acid'),
 ('kojic-acid','Kojic acid'),('soothing-agent','Soothing agents'),('emollient','Emollients and oils')
ON CONFLICT DO NOTHING;

INSERT INTO admin_permission (code, description) VALUES
 ('products.write','Create, edit and review products'),
 ('ingredients.write','Create and edit ingredient knowledge'),
 ('sources.write','Manage data sources and imports'),
 ('articles.write','Create and edit educational articles'),
 ('rules.write','Edit recommendation and compatibility rules'),
 ('users.read','View user accounts (never photos)'),
 ('users.disable','Disable user accounts'),
 ('feedback.read','Read feedback and reports'),
 ('analytics.read','View anonymous analytics'),
 ('audit.read','View audit logs'),
 ('system.read','View system health and error logs')
ON CONFLICT DO NOTHING;

INSERT INTO admin_role (name) VALUES ('super_admin'),('data_manager'),('content_editor'),('support')
ON CONFLICT DO NOTHING;

INSERT INTO admin_role_permission (role_id, permission_code)
SELECT r.id, p.code FROM admin_role r JOIN admin_permission p ON
  r.name = 'super_admin'
  OR (r.name = 'data_manager'   AND p.code IN ('products.write','sources.write','rules.write','system.read'))
  OR (r.name = 'content_editor' AND p.code IN ('articles.write','ingredients.write'))
  OR (r.name = 'support'        AND p.code IN ('users.read','feedback.read'))
ON CONFLICT DO NOTHING;

-- date_accessed stays NULL until a real import actually happens. Never invent it.
INSERT INTO data_source
  (slug, name, kind, url, license, attribution_text, share_alike, is_demo, limitations)
VALUES
 ('demo-data','DEMO DATA (fictional sample records)','demo',NULL,'n/a',
  'DEMO DATA - not real products',false,true,
  'Fictional records for demos and tests only. Not real products, prices or reviews.'),
 ('manual-curation','Manually curated from official brand pages','manual_curation',NULL,
  'Facts only; each record links to its source page',NULL,false,false,
  'Small hand-entered set. Each product keeps its own product_url and last_verified_on.'),
 ('open-beauty-facts','Open Beauty Facts','open_dataset','https://world.openbeautyfacts.org',
  'ODbL 1.0 (database); Database Contents License (contents); CC BY-SA (images)',
  'Contains information from Open Beauty Facts',true,false,
  'Crowd-sourced; completeness varies by country. Share-alike applies to combined databases.')
ON CONFLICT DO NOTHING;
