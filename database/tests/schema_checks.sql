-- schema_checks.sql  -- run with: npm run db:test
-- Everything happens inside one transaction that is rolled back at the end,
-- so your database is left untouched. "PASS" lines print as notices.
BEGIN;

INSERT INTO brand (name) VALUES ('Test Brand');
INSERT INTO app_user (id, email)
  VALUES ('00000000-0000-0000-0000-0000000000a1', 'test-user@example.invalid');
INSERT INTO skin_assessment (id, user_id)
  VALUES ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1');
INSERT INTO routine (id, user_id, name, kind)
  VALUES ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1', 'Test routine', 'morning');
INSERT INTO product (slug, brand_id, name, category, data_source_id)
  SELECT 'test-cleanser', b.id, 'Test Cleanser', 'cleanser', s.id
  FROM brand b, data_source s WHERE b.name = 'Test Brand' AND s.slug = 'demo-data';
INSERT INTO favorite (user_id, product_id)
  SELECT '00000000-0000-0000-0000-0000000000a1', id FROM product WHERE slug = 'test-cleanser';

-- 1. Seed data is present
DO $$
BEGIN
  IF (SELECT count(*) FROM skin_concern) <> 16 THEN
    RAISE EXCEPTION 'FAIL: expected 16 skin concerns after seeding (did you run npm run db:seed?)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM data_source WHERE slug = 'demo-data' AND is_demo) THEN
    RAISE EXCEPTION 'FAIL: demo-data source missing';
  END IF;
  RAISE NOTICE 'PASS: seed data present';
END $$;

-- 2. Price needs a currency
DO $$
BEGIN
  INSERT INTO product (slug, brand_id, name, category, data_source_id, price_amount)
  SELECT 'test-price', b.id, 'Price Test', 'cleanser', s.id, 100
  FROM brand b, data_source s WHERE b.name = 'Test Brand' AND s.slug = 'demo-data';
  RAISE EXCEPTION 'FAIL: price without currency was accepted';
EXCEPTION WHEN check_violation THEN
  RAISE NOTICE 'PASS: price without currency is rejected';
END $$;

-- 3. Duplicate product (same brand/name ignoring case/category/size) is rejected
DO $$
BEGIN
  INSERT INTO product (slug, brand_id, name, category, data_source_id)
  SELECT 'test-cleanser-dup', b.id, 'TEST CLEANSER', 'cleanser', s.id
  FROM brand b, data_source s WHERE b.name = 'Test Brand' AND s.slug = 'demo-data';
  RAISE EXCEPTION 'FAIL: duplicate product was accepted';
EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'PASS: duplicate product is rejected';
END $$;

-- 4. Invalid product URL is rejected
DO $$
BEGIN
  UPDATE product SET product_url = 'javascript:alert(1)' WHERE slug = 'test-cleanser';
  RAISE EXCEPTION 'FAIL: non-http product URL was accepted';
EXCEPTION WHEN check_violation THEN
  RAISE NOTICE 'PASS: non-http product URL is rejected';
END $$;

-- 5. Compatibility pairs must be stored in order (a <= b)
DO $$
BEGIN
  INSERT INTO ingredient_compatibility (family_a_id, family_b_id, level, reason)
  SELECT greatest(a.id, b.id), least(a.id, b.id), 'use_caution', 'test'
  FROM ingredient_family a, ingredient_family b WHERE a.slug = 'aha' AND b.slug = 'retinoid';
  RAISE EXCEPTION 'FAIL: out-of-order compatibility pair was accepted';
EXCEPTION WHEN check_violation THEN
  RAISE NOTICE 'PASS: out-of-order compatibility pair is rejected';
END $$;

-- 6. Trait score must be 0-100
DO $$
BEGIN
  INSERT INTO skin_profile_trait (assessment_id, concern_code, score, category, confidence, source)
  VALUES ('00000000-0000-0000-0000-0000000000b1', 'oiliness', 101, 'high', 0.5, 'quiz');
  RAISE EXCEPTION 'FAIL: score 101 was accepted';
EXCEPTION WHEN check_violation THEN
  RAISE NOTICE 'PASS: trait score above 100 is rejected';
END $$;

-- 7. Completed assessment needs completed_at
DO $$
BEGIN
  UPDATE skin_assessment SET status = 'completed'
  WHERE id = '00000000-0000-0000-0000-0000000000b1';
  RAISE EXCEPTION 'FAIL: completed assessment without timestamp was accepted';
EXCEPTION WHEN check_violation THEN
  RAISE NOTICE 'PASS: completed assessment requires completed_at';
END $$;

-- 8. Shade hex colour must look like #RRGGBB
DO $$
BEGIN
  INSERT INTO product_shade (product_id, shade_name, hex_color, data_source_id)
  SELECT p.id, 'Test shade', 'not-a-colour', s.id
  FROM product p, data_source s WHERE p.slug = 'test-cleanser' AND s.slug = 'demo-data';
  RAISE EXCEPTION 'FAIL: invalid hex colour was accepted';
EXCEPTION WHEN check_violation THEN
  RAISE NOTICE 'PASS: invalid shade hex colour is rejected';
END $$;

-- 9. Routine item needs a product or a custom name
DO $$
BEGIN
  INSERT INTO routine_item (routine_id, step_order, step_type)
  VALUES ('00000000-0000-0000-0000-0000000000c1', 1, 'cleanser');
  RAISE EXCEPTION 'FAIL: empty routine item was accepted';
EXCEPTION WHEN check_violation THEN
  RAISE NOTICE 'PASS: routine item needs a product or custom name';
END $$;

-- 10. Audit log is append-only
INSERT INTO audit_log (action, entity_type) VALUES ('test', 'test');
DO $$
BEGIN
  UPDATE audit_log SET action = 'tampered' WHERE action = 'test';
  RAISE EXCEPTION 'FAIL: audit_log update was allowed';
EXCEPTION WHEN restrict_violation THEN
  RAISE NOTICE 'PASS: audit_log cannot be modified';
END $$;

-- 11. User override beats quiz result in the effective view
DO $$
DECLARE s smallint;
BEGIN
  INSERT INTO skin_profile_trait (assessment_id, concern_code, score, category, confidence, source)
  VALUES ('00000000-0000-0000-0000-0000000000b1', 'oiliness', 70, 'high', 0.80, 'quiz'),
         ('00000000-0000-0000-0000-0000000000b1', 'oiliness', 40, 'moderate', 1.00, 'user_override');
  SELECT score INTO s FROM effective_skin_trait
  WHERE assessment_id = '00000000-0000-0000-0000-0000000000b1' AND concern_code = 'oiliness';
  IF s IS DISTINCT FROM 40 THEN
    RAISE EXCEPTION 'FAIL: expected override score 40, got %', s;
  END IF;
  RAISE NOTICE 'PASS: user override wins in effective_skin_trait';
END $$;

-- 12. Deleting a user removes their data (privacy requirement)
DELETE FROM app_user WHERE id = '00000000-0000-0000-0000-0000000000a1';
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM skin_assessment WHERE user_id = '00000000-0000-0000-0000-0000000000a1')
     OR EXISTS (SELECT 1 FROM routine  WHERE user_id = '00000000-0000-0000-0000-0000000000a1')
     OR EXISTS (SELECT 1 FROM favorite WHERE user_id = '00000000-0000-0000-0000-0000000000a1')
     OR EXISTS (SELECT 1 FROM skin_profile_trait
                WHERE assessment_id = '00000000-0000-0000-0000-0000000000b1') THEN
    RAISE EXCEPTION 'FAIL: user data survived account deletion';
  END IF;
  RAISE NOTICE 'PASS: deleting a user cascades to all their data';
END $$;

DO $$ BEGIN RAISE NOTICE 'ALL SCHEMA CHECKS PASSED'; END $$;
ROLLBACK;
