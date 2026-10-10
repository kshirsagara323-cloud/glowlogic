-- 002_ingredients_and_rules.sql  (safe to run repeatedly)
-- DRAFT ingredient knowledge used by the recommendation engine.
-- Every row is review_status = 'needs_verification': the concern links and irritation levels are
-- cautious rules of thumb that a human must check against cited sources (Phase 7) before launch.
-- No educational prose is stored here yet.

INSERT INTO ingredient (slug, inci_name, common_name, family_id, functions, irritation_potential,
                        is_fragrance_related, is_sunscreen_filter, introduce_slowly, review_status)
SELECT v.slug, v.inci, v.common, f.id, string_to_array(v.funcs, ','), v.irr, v.frag, v.sun, v.slow, 'needs_verification'
FROM (VALUES
  ('water','Aqua','Water',NULL::text,'solvent',0,false,false,false),
  ('glycerin','Glycerin','Glycerin','humectant','humectant',0,false,false,false),
  ('niacinamide','Niacinamide','Vitamin B3','niacinamide','skin conditioning',1,false,false,false),
  ('sodium-hyaluronate','Sodium Hyaluronate','Hyaluronic acid (sodium salt)','humectant','humectant',0,false,false,false),
  ('ceramide-np','Ceramide NP','Ceramide','ceramide','skin conditioning',0,false,false,false),
  ('panthenol','Panthenol','Provitamin B5','soothing-agent','skin conditioning',0,false,false,false),
  ('squalane','Squalane','Squalane','emollient','emollient',0,false,false,false),
  ('salicylic-acid','Salicylic Acid','Beta hydroxy acid','bha','exfoliant',2,false,false,true),
  ('benzoyl-peroxide','Benzoyl Peroxide','Benzoyl peroxide','benzoyl-peroxide','acne treatment',3,false,false,true),
  ('azelaic-acid','Azelaic Acid','Azelaic acid','azelaic-acid','skin conditioning',2,false,false,true),
  ('ascorbic-acid','Ascorbic Acid','Vitamin C','vitamin-c','antioxidant',2,false,false,true),
  ('retinol','Retinol','Retinol','retinoid','skin conditioning',3,false,false,true),
  ('glycolic-acid','Glycolic Acid','Glycolic acid (AHA)','aha','exfoliant',3,false,false,true),
  ('lactic-acid','Lactic Acid','Lactic acid (AHA)','aha','exfoliant',2,false,false,true),
  ('gluconolactone','Gluconolactone','Polyhydroxy acid (PHA)','pha','exfoliant',1,false,false,false),
  ('centella-asiatica-extract','Centella Asiatica Extract','Centella','soothing-agent','skin conditioning',0,false,false,false),
  ('allantoin','Allantoin','Allantoin','soothing-agent','skin conditioning',0,false,false,false),
  ('urea','Urea','Urea','humectant','humectant',1,false,false,false),
  ('zinc-oxide','Zinc Oxide','Zinc oxide (mineral filter)','mineral-sunscreen','uv filter',0,false,true,false),
  ('titanium-dioxide','Titanium Dioxide','Titanium dioxide (mineral filter)','mineral-sunscreen','uv filter',0,false,true,false),
  ('avobenzone','Butyl Methoxydibenzoylmethane','Avobenzone (chemical filter)','chemical-sunscreen','uv filter',1,false,true,false),
  ('parfum','Parfum','Fragrance','fragrance','perfuming',2,true,false,false),
  ('lavender-oil','Lavandula Angustifolia Oil','Lavender oil','essential-oil','perfuming',2,true,false,false),
  ('alcohol-denat','Alcohol Denat.','Denatured alcohol','denatured-alcohol','solvent',1,false,false,false),
  ('sodium-lauryl-sulfate','Sodium Lauryl Sulfate','Sodium lauryl sulfate','sulfate-surfactant','cleansing',2,false,false,false),
  ('cocamidopropyl-betaine','Cocamidopropyl Betaine','Cocamidopropyl betaine',NULL,'cleansing',1,false,false,false),
  ('dimethicone','Dimethicone','Dimethicone','emollient','emollient',0,false,false,false),
  ('phenoxyethanol','Phenoxyethanol','Phenoxyethanol',NULL,'preservative',0,false,false,false),
  ('tocopherol','Tocopherol','Vitamin E',NULL,'antioxidant',0,false,false,false),
  ('caprylic-capric-triglyceride','Caprylic/Capric Triglyceride','Caprylic/capric triglyceride','emollient','emollient',0,false,false,false),
  ('xanthan-gum','Xanthan Gum','Xanthan gum',NULL,'thickener',0,false,false,false),
  ('cetearyl-alcohol','Cetearyl Alcohol','Cetearyl alcohol (fatty alcohol)','emollient','emollient',0,false,false,false)
) AS v(slug, inci, common, family, funcs, irr, frag, sun, slow)
LEFT JOIN ingredient_family f ON f.slug = v.family
ON CONFLICT (slug) DO NOTHING;

-- Draft links between ingredients and concerns. relation: helps | supports | may_worsen. relevance 1-3.
INSERT INTO ingredient_concern (ingredient_id, concern_code, relation, relevance)
SELECT i.id, v.concern, v.relation, v.rel
FROM (VALUES
  ('niacinamide','oiliness','helps',2),('niacinamide','visible_pores','helps',1),('niacinamide','uneven_tone','supports',1),('niacinamide','dark_spots','supports',1),
  ('sodium-hyaluronate','dehydration','helps',3),('sodium-hyaluronate','dryness','supports',1),('sodium-hyaluronate','fine_lines','supports',1),
  ('glycerin','dehydration','helps',2),('glycerin','dryness','helps',2),
  ('ceramide-np','dryness','helps',2),('ceramide-np','sensitivity','supports',2),('ceramide-np','redness','supports',1),
  ('panthenol','dryness','supports',1),('panthenol','sensitivity','supports',1),
  ('squalane','dryness','helps',2),
  ('salicylic-acid','blackheads','helps',3),('salicylic-acid','whiteheads','helps',2),('salicylic-acid','acne','helps',2),('salicylic-acid','visible_pores','supports',1),('salicylic-acid','oiliness','supports',1),
  ('salicylic-acid','dryness','may_worsen',2),('salicylic-acid','sensitivity','may_worsen',2),
  ('benzoyl-peroxide','acne','helps',3),('benzoyl-peroxide','dryness','may_worsen',2),('benzoyl-peroxide','sensitivity','may_worsen',3),
  ('azelaic-acid','acne','helps',2),('azelaic-acid','redness','helps',2),('azelaic-acid','dark_spots','helps',2),('azelaic-acid','hyperpigmentation','helps',2),('azelaic-acid','uneven_tone','helps',2),('azelaic-acid','sensitivity','may_worsen',1),
  ('ascorbic-acid','dullness','helps',2),('ascorbic-acid','dark_spots','supports',1),('ascorbic-acid','uneven_tone','supports',1),('ascorbic-acid','sensitivity','may_worsen',2),
  ('retinol','fine_lines','helps',3),('retinol','texture','helps',2),('retinol','acne','supports',1),('retinol','dark_spots','supports',1),
  ('retinol','dryness','may_worsen',2),('retinol','sensitivity','may_worsen',3),('retinol','redness','may_worsen',1),
  ('glycolic-acid','dullness','helps',2),('glycolic-acid','texture','helps',2),('glycolic-acid','fine_lines','supports',1),('glycolic-acid','dark_spots','supports',1),
  ('glycolic-acid','sensitivity','may_worsen',3),('glycolic-acid','dryness','may_worsen',1),
  ('lactic-acid','texture','helps',2),('lactic-acid','dullness','supports',1),('lactic-acid','sensitivity','may_worsen',2),
  ('gluconolactone','texture','supports',1),('gluconolactone','dullness','supports',1),('gluconolactone','sensitivity','may_worsen',1),
  ('centella-asiatica-extract','redness','helps',2),('centella-asiatica-extract','sensitivity','supports',2),
  ('allantoin','sensitivity','supports',1),('allantoin','dryness','supports',1),
  ('urea','dryness','helps',3),('urea','texture','supports',1),
  ('parfum','sensitivity','may_worsen',3),('lavender-oil','sensitivity','may_worsen',2),
  ('alcohol-denat','dryness','may_worsen',1),('alcohol-denat','sensitivity','may_worsen',2),
  ('sodium-lauryl-sulfate','dryness','may_worsen',2),('sodium-lauryl-sulfate','sensitivity','may_worsen',2)
) AS v(slug, concern, relation, rel)
JOIN ingredient i ON i.slug = v.slug
ON CONFLICT DO NOTHING;

-- Compatibility rules between families. Stored with the lower family id first.
-- level: compatible | generally_compatible | use_caution | potential_irritation | avoid_unless_advised
INSERT INTO ingredient_compatibility (family_a_id, family_b_id, level, reason, suggestion, base_penalty, evidence_level, review_status)
SELECT LEAST(a.id, b.id), GREATEST(a.id, b.id), v.level, v.reason, v.suggestion, v.penalty, v.evidence, 'needs_verification'
FROM (VALUES
  ('retinoid','aha','potential_irritation','Both can dry and irritate the skin, and using them together raises that chance.','Use them on different nights, or choose one.',40,'limited'),
  ('retinoid','bha','potential_irritation','Both can dry and irritate the skin, and using them together raises that chance.','Use them on different nights, or choose one.',40,'limited'),
  ('retinoid','pha','use_caution','Exfoliating acids can add to retinoid irritation, though PHAs are generally gentler.','Introduce one at a time and watch for irritation.',20,'limited'),
  ('retinoid','benzoyl-peroxide','use_caution','Some retinoids are less stable with benzoyl peroxide, and both can be drying.','Use them at different times of day, or ask a pharmacist or dermatologist.',30,'limited'),
  ('aha','bha','use_caution','Combining exfoliating acids increases the chance of irritation.','Alternate days rather than layering them.',30,'limited'),
  ('aha','vitamin-c','use_caution','Layering an acid with vitamin C can sting or irritate sensitive skin.','Use vitamin C in the morning and the acid at night.',20,'limited'),
  ('benzoyl-peroxide','vitamin-c','use_caution','Benzoyl peroxide is oxidising and may reduce vitamin C, and both can irritate.','Use them at different times of day.',20,'limited'),
  ('retinoid','vitamin-c','generally_compatible','Many people use them together by splitting them across the day.','Vitamin C in the morning, retinoid at night.',0,'limited'),
  ('niacinamide','vitamin-c','generally_compatible','The long-repeated claim that these two cancel out is not well supported.','Introduce one at a time if your skin is sensitive.',0,'limited'),
  ('niacinamide','retinoid','compatible','These are commonly used together.',NULL,0,'limited')
) AS v(fa, fb, level, reason, suggestion, penalty, evidence)
JOIN ingredient_family a ON a.slug = v.fa
JOIN ingredient_family b ON b.slug = v.fb
ON CONFLICT DO NOTHING;

-- The only references recorded so far. verified_by_human stays false until YOU open each link and
-- confirm it says what the rule claims.
INSERT INTO ingredient_reference (ingredient_id, citation, url, verified_by_human)
SELECT i.id, v.citation, v.url, false
FROM (VALUES
  ('zinc-oxide','American Academy of Dermatology: Sunscreen FAQs (broad-spectrum, SPF 30 or higher, water resistant)','https://www.aad.org/sun-protection/sunscreen-faqs'),
  ('retinol','Malta Medicines Authority: Retinoid containing medicines, pregnancy prevention (topical retinoids not recommended in pregnancy or when planning a baby, as a precaution)','https://medicinesauthority.gov.mt/file.aspx?f=3875')
) AS v(slug, citation, url)
JOIN ingredient i ON i.slug = v.slug
WHERE NOT EXISTS (SELECT 1 FROM ingredient_reference r WHERE r.ingredient_id = i.id AND r.url = v.url);
