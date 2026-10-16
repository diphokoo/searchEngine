-- Default login: diphokoo@outlook.com / Tlalefo@12
INSERT INTO admin_users (email, name, password_hash, role)
VALUES ('diphokoo@outlook.com', 'System Admin', 'b4cb49ef4a35338f63994a1e4a2c9b73f5785a36abc30e9cf2a203d8fbb8709f', 'SUPER_ADMIN')
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;

INSERT INTO sources (name, url, platform, source_type, province, city, connector, status, reliability_score) VALUES

-- ─── Ticketing Platforms ──────────────────────────────────────────────────────
('Quicket', 'https://www.quicket.co.za', 'website', 'ticketing', NULL, NULL, 'website', 'ACTIVE', 95),
('Computicket', 'https://www.computicket.com', 'website', 'ticketing', NULL, NULL, 'website', 'ACTIVE', 95),
('Webtickets', 'https://www.webtickets.co.za', 'website', 'ticketing', NULL, NULL, 'website', 'ACTIVE', 90),
('TicketPros', 'https://www.ticketpros.co.za', 'website', 'ticketing', NULL, NULL, 'website', 'ACTIVE', 85),

-- ─── Event Platforms ──────────────────────────────────────────────────────────
('Howler', 'https://howler.co.za', 'website', 'event_platform', NULL, NULL, 'website', 'ACTIVE', 90),
('Eventbrite SA', 'https://www.eventbrite.co.za', 'website', 'event_platform', NULL, NULL, 'website', 'ACTIVE', 85),

-- ─── Gauteng Venues ───────────────────────────────────────────────────────────
('Taboo Nightclub Pretoria', 'https://www.taboo.co.za', 'website', 'venue', 'Gauteng', 'Pretoria', 'website', 'ACTIVE', 90),
('Konka Soweto', 'https://www.konka.co.za', 'website', 'venue', 'Gauteng', 'Soweto', 'website', 'ACTIVE', 90),
('Ayepyep Lifestyle Lounge', 'https://www.ayepyep.co.za', 'website', 'venue', 'Gauteng', 'Pretoria', 'website', 'ACTIVE', 85),

-- ─── Western Cape Venues ──────────────────────────────────────────────────────
('Shimmy Beach Club', 'https://www.shimmybeachclub.com', 'website', 'venue', 'Western Cape', 'Cape Town', 'website', 'ACTIVE', 90),
('Coco Safar', 'https://www.cocosafar.com', 'website', 'venue', 'Western Cape', 'Cape Town', 'website', 'ACTIVE', 85),

-- ─── KwaZulu-Natal Venues ─────────────────────────────────────────────────────
('Cubana Durban', 'https://www.cubana.co.za', 'website', 'venue', 'KwaZulu-Natal', 'Durban', 'website', 'ACTIVE', 85),

-- ─── RSS Feeds ────────────────────────────────────────────────────────────────
('Quicket Nightlife RSS', 'https://www.quicket.co.za/rss/nightlife', 'rss', 'ticketing', NULL, NULL, 'rss', 'PENDING', 90),
('Howler Events RSS', 'https://howler.co.za/feed', 'rss', 'event_platform', NULL, NULL, 'rss', 'PENDING', 88)

ON CONFLICT DO NOTHING;
