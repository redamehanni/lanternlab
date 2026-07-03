-- Ma Zone — Données de démarrage (zone pilote Paris 1er–4e)

-- ── Commerces ──────────────────────────────────────────────────────────────
insert into stores (id, name, store_type, address, lat, lng) values
  ('11111111-1111-1111-1111-111111111111', 'Boutique Gaming', 'Spécialiste', '12 rue de Rivoli, 75004 Paris', 48.8570, 2.3580),
  ('22222222-2222-2222-2222-222222222222', 'Fnac', 'High-tech', '1 rue Pierre Lescot, 75001 Paris', 48.8628, 2.3470),
  ('33333333-3333-3333-3333-333333333333', 'Carrefour', 'Grande surface', '11 rue Beaubourg, 75003 Paris', 48.8600, 2.3530),
  ('44444444-4444-4444-4444-444444444444', 'Apple Store', 'High-tech', '12 rue Halévy, 75009 Paris', 48.8710, 2.3320),
  ('55555555-5555-5555-5555-555555555555', 'Boulanger', 'Électroménager', '8 rue Saint-Paul, 75004 Paris', 48.8550, 2.3620)
on conflict (id) do nothing;

-- ── Produits ───────────────────────────────────────────────────────────────
insert into products (id, name, category, image_url, sku) values
  ('a0000000-0000-0000-0000-000000000001', 'Nintendo Switch', 'Gaming', 'https://images.unsplash.com/photo-1578303512597-81e6cc155167?w=600&h=600&fit=crop', 'NSW-001'),
  ('a0000000-0000-0000-0000-000000000002', 'Chargeur iPhone USB-C', 'Accessoires', 'https://images.unsplash.com/photo-1591290619762-dc222acba72e?w=600&h=600&fit=crop', 'CHG-001'),
  ('a0000000-0000-0000-0000-000000000003', 'Casque Sony WH-1000XM5', 'Audio', 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&h=600&fit=crop', 'AUD-001'),
  ('a0000000-0000-0000-0000-000000000004', 'Câble HDMI 2.1', 'Accessoires', 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=600&fit=crop', 'HDM-001'),
  ('a0000000-0000-0000-0000-000000000005', 'Perceuse Bosch 18V', 'Bricolage', 'https://images.unsplash.com/photo-1504141927866-0a4f4dcb5567?w=600&h=600&fit=crop', 'DRL-001'),
  ('a0000000-0000-0000-0000-000000000006', 'Le Petit Prince', 'Livres', 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=600&h=600&fit=crop', 'BOK-001')
on conflict (id) do nothing;

-- ── Inventaire (prix + stock par commerce) ─────────────────────────────────
insert into inventory (store_id, product_id, price, stock, available) values
  -- Nintendo Switch
  ('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001', 299, 5, true),
  ('22222222-2222-2222-2222-222222222222', 'a0000000-0000-0000-0000-000000000001', 299, 2, true),
  ('33333333-3333-3333-3333-333333333333', 'a0000000-0000-0000-0000-000000000001', 299, 3, true),
  -- Chargeur
  ('44444444-4444-4444-4444-444444444444', 'a0000000-0000-0000-0000-000000000002', 29, 20, true),
  ('22222222-2222-2222-2222-222222222222', 'a0000000-0000-0000-0000-000000000002', 25, 12, true),
  -- Casque
  ('22222222-2222-2222-2222-222222222222', 'a0000000-0000-0000-0000-000000000003', 349, 4, true),
  ('44444444-4444-4444-4444-444444444444', 'a0000000-0000-0000-0000-000000000003', 349, 2, true),
  -- HDMI
  ('55555555-5555-5555-5555-555555555555', 'a0000000-0000-0000-0000-000000000004', 19, 30, true),
  ('33333333-3333-3333-3333-333333333333', 'a0000000-0000-0000-0000-000000000004', 19, 15, true),
  -- Perceuse
  ('55555555-5555-5555-5555-555555555555', 'a0000000-0000-0000-0000-000000000005', 129, 6, true),
  -- Livre
  ('33333333-3333-3333-3333-333333333333', 'a0000000-0000-0000-0000-000000000006', 12, 25, true)
on conflict (store_id, product_id) do nothing;
