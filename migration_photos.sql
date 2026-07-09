-- Demo photos: one curated Unsplash photo per article, matched by category/name
-- Base URL format: https://images.unsplash.com/{id}?w=600&auto=format&fit=crop&q=80

INSERT OR IGNORE INTO photos (id, article_id, color, url, sort_order) VALUES

-- ── HANDBAG (a001–a010) ──
('ph-a001-1','a001',NULL,'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&auto=format&fit=crop&q=80',0),
('ph-a002-1','a002',NULL,'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&auto=format&fit=crop&q=80',0),
('ph-a003-1','a003',NULL,'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=600&auto=format&fit=crop&q=80',0),
('ph-a004-1','a004',NULL,'https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?w=600&auto=format&fit=crop&q=80',0),
('ph-a005-1','a005',NULL,'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&auto=format&fit=crop&q=80',0),
('ph-a006-1','a006',NULL,'https://images.unsplash.com/photo-1591561954557-26941169b49e?w=600&auto=format&fit=crop&q=80',0),
('ph-a007-1','a007',NULL,'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&auto=format&fit=crop&q=80',0),
('ph-a008-1','a008',NULL,'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=600&auto=format&fit=crop&q=80',0),
('ph-a009-1','a009',NULL,'https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?w=600&auto=format&fit=crop&q=80',0),
('ph-a010-1','a010',NULL,'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&auto=format&fit=crop&q=80',0),

-- ── BACKPACK (a011–a020) ──
('ph-a011-1','a011',NULL,'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&auto=format&fit=crop&q=80',0),
('ph-a012-1','a012',NULL,'https://images.unsplash.com/photo-1622560480605-d83c853bc5c3?w=600&auto=format&fit=crop&q=80',0),
('ph-a013-1','a013',NULL,'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&auto=format&fit=crop&q=80',0),
('ph-a014-1','a014',NULL,'https://images.unsplash.com/photo-1622560480605-d83c853bc5c3?w=600&auto=format&fit=crop&q=80',0),
('ph-a015-1','a015',NULL,'https://images.unsplash.com/photo-1501555088652-021faa106b9b?w=600&auto=format&fit=crop&q=80',0),
('ph-a016-1','a016',NULL,'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&auto=format&fit=crop&q=80',0),
('ph-a017-1','a017',NULL,'https://images.unsplash.com/photo-1622560480605-d83c853bc5c3?w=600&auto=format&fit=crop&q=80',0),
('ph-a018-1','a018',NULL,'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&auto=format&fit=crop&q=80',0),
('ph-a019-1','a019',NULL,'https://images.unsplash.com/photo-1622560480605-d83c853bc5c3?w=600&auto=format&fit=crop&q=80',0),
('ph-a020-1','a020',NULL,'https://images.unsplash.com/photo-1501555088652-021faa106b9b?w=600&auto=format&fit=crop&q=80',0),

-- ── TOTE BAG (a021–a030) ──
('ph-a021-1','a021',NULL,'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=600&auto=format&fit=crop&q=80',0),
('ph-a022-1','a022',NULL,'https://images.unsplash.com/photo-1597484661643-2f5fef640dd1?w=600&auto=format&fit=crop&q=80',0),
('ph-a023-1','a023',NULL,'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=600&auto=format&fit=crop&q=80',0),
('ph-a024-1','a024',NULL,'https://images.unsplash.com/photo-1597484661643-2f5fef640dd1?w=600&auto=format&fit=crop&q=80',0),
('ph-a025-1','a025',NULL,'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?w=600&auto=format&fit=crop&q=80',0),
('ph-a026-1','a026',NULL,'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=600&auto=format&fit=crop&q=80',0),
('ph-a027-1','a027',NULL,'https://images.unsplash.com/photo-1597484661643-2f5fef640dd1?w=600&auto=format&fit=crop&q=80',0),
('ph-a028-1','a028',NULL,'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?w=600&auto=format&fit=crop&q=80',0),
('ph-a029-1','a029',NULL,'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=600&auto=format&fit=crop&q=80',0),
('ph-a030-1','a030',NULL,'https://images.unsplash.com/photo-1597484661643-2f5fef640dd1?w=600&auto=format&fit=crop&q=80',0),

-- ── CLUTCH (a031–a040) ──
('ph-a031-1','a031',NULL,'https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?w=600&auto=format&fit=crop&q=80',0),
('ph-a032-1','a032',NULL,'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&auto=format&fit=crop&q=80',0),
('ph-a033-1','a033',NULL,'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&auto=format&fit=crop&q=80',0),
('ph-a034-1','a034',NULL,'https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?w=600&auto=format&fit=crop&q=80',0),
('ph-a035-1','a035',NULL,'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&auto=format&fit=crop&q=80',0),
('ph-a036-1','a036',NULL,'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&auto=format&fit=crop&q=80',0),
('ph-a037-1','a037',NULL,'https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?w=600&auto=format&fit=crop&q=80',0),
('ph-a038-1','a038',NULL,'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&auto=format&fit=crop&q=80',0),
('ph-a039-1','a039',NULL,'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&auto=format&fit=crop&q=80',0),
('ph-a040-1','a040',NULL,'https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?w=600&auto=format&fit=crop&q=80',0),

-- ── SHOULDER BAG (a041–a050) ──
('ph-a041-1','a041',NULL,'https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=600&auto=format&fit=crop&q=80',0),
('ph-a042-1','a042',NULL,'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&auto=format&fit=crop&q=80',0),
('ph-a043-1','a043',NULL,'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&auto=format&fit=crop&q=80',0),
('ph-a044-1','a044',NULL,'https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=600&auto=format&fit=crop&q=80',0),
('ph-a045-1','a045',NULL,'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=600&auto=format&fit=crop&q=80',0),
('ph-a046-1','a046',NULL,'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&auto=format&fit=crop&q=80',0),
('ph-a047-1','a047',NULL,'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&auto=format&fit=crop&q=80',0),
('ph-a048-1','a048',NULL,'https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=600&auto=format&fit=crop&q=80',0),
('ph-a049-1','a049',NULL,'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=600&auto=format&fit=crop&q=80',0),
('ph-a050-1','a050',NULL,'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&auto=format&fit=crop&q=80',0),

-- ── SLING BAG (a051–a060) ──
('ph-a051-1','a051',NULL,'https://images.unsplash.com/photo-1614179818511-68c10c1bbca5?w=600&auto=format&fit=crop&q=80',0),
('ph-a052-1','a052',NULL,'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&auto=format&fit=crop&q=80',0),
('ph-a053-1','a053',NULL,'https://images.unsplash.com/photo-1614179818511-68c10c1bbca5?w=600&auto=format&fit=crop&q=80',0),
('ph-a054-1','a054',NULL,'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&auto=format&fit=crop&q=80',0),
('ph-a055-1','a055',NULL,'https://images.unsplash.com/photo-1614179818511-68c10c1bbca5?w=600&auto=format&fit=crop&q=80',0),
('ph-a056-1','a056',NULL,'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&auto=format&fit=crop&q=80',0),
('ph-a057-1','a057',NULL,'https://images.unsplash.com/photo-1614179818511-68c10c1bbca5?w=600&auto=format&fit=crop&q=80',0),
('ph-a058-1','a058',NULL,'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&auto=format&fit=crop&q=80',0),
('ph-a059-1','a059',NULL,'https://images.unsplash.com/photo-1614179818511-68c10c1bbca5?w=600&auto=format&fit=crop&q=80',0),
('ph-a060-1','a060',NULL,'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&auto=format&fit=crop&q=80',0),

-- ── WALLET (a061–a070) ──
('ph-a061-1','a061',NULL,'https://images.unsplash.com/photo-1627123424574-724758594785?w=600&auto=format&fit=crop&q=80',0),
('ph-a062-1','a062',NULL,'https://images.unsplash.com/photo-1598532213919-078e54dd1f40?w=600&auto=format&fit=crop&q=80',0),
('ph-a063-1','a063',NULL,'https://images.unsplash.com/photo-1627123424574-724758594785?w=600&auto=format&fit=crop&q=80',0),
('ph-a064-1','a064',NULL,'https://images.unsplash.com/photo-1598532213919-078e54dd1f40?w=600&auto=format&fit=crop&q=80',0),
('ph-a065-1','a065',NULL,'https://images.unsplash.com/photo-1627123424574-724758594785?w=600&auto=format&fit=crop&q=80',0),
('ph-a066-1','a066',NULL,'https://images.unsplash.com/photo-1598532213919-078e54dd1f40?w=600&auto=format&fit=crop&q=80',0),
('ph-a067-1','a067',NULL,'https://images.unsplash.com/photo-1627123424574-724758594785?w=600&auto=format&fit=crop&q=80',0),
('ph-a068-1','a068',NULL,'https://images.unsplash.com/photo-1598532213919-078e54dd1f40?w=600&auto=format&fit=crop&q=80',0),
('ph-a069-1','a069',NULL,'https://images.unsplash.com/photo-1627123424574-724758594785?w=600&auto=format&fit=crop&q=80',0),
('ph-a070-1','a070',NULL,'https://images.unsplash.com/photo-1598532213919-078e54dd1f40?w=600&auto=format&fit=crop&q=80',0),

-- ── DUFFEL BAG (a071–a080) ──
('ph-a071-1','a071',NULL,'https://images.unsplash.com/photo-1553481187-be93c21490a9?w=600&auto=format&fit=crop&q=80',0),
('ph-a072-1','a072',NULL,'https://images.unsplash.com/photo-1544966503-7cc5ac882d5f?w=600&auto=format&fit=crop&q=80',0),
('ph-a073-1','a073',NULL,'https://images.unsplash.com/photo-1553481187-be93c21490a9?w=600&auto=format&fit=crop&q=80',0),
('ph-a074-1','a074',NULL,'https://images.unsplash.com/photo-1544966503-7cc5ac882d5f?w=600&auto=format&fit=crop&q=80',0),
('ph-a075-1','a075',NULL,'https://images.unsplash.com/photo-1553481187-be93c21490a9?w=600&auto=format&fit=crop&q=80',0),
('ph-a076-1','a076',NULL,'https://images.unsplash.com/photo-1544966503-7cc5ac882d5f?w=600&auto=format&fit=crop&q=80',0),
('ph-a077-1','a077',NULL,'https://images.unsplash.com/photo-1553481187-be93c21490a9?w=600&auto=format&fit=crop&q=80',0),
('ph-a078-1','a078',NULL,'https://images.unsplash.com/photo-1544966503-7cc5ac882d5f?w=600&auto=format&fit=crop&q=80',0),
('ph-a079-1','a079',NULL,'https://images.unsplash.com/photo-1553481187-be93c21490a9?w=600&auto=format&fit=crop&q=80',0),
('ph-a080-1','a080',NULL,'https://images.unsplash.com/photo-1544966503-7cc5ac882d5f?w=600&auto=format&fit=crop&q=80',0),

-- ── TRAVEL BAG (a081–a090) ──
('ph-a081-1','a081',NULL,'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=600&auto=format&fit=crop&q=80',0),
('ph-a082-1','a082',NULL,'https://images.unsplash.com/photo-1562157873-818bc0726f68?w=600&auto=format&fit=crop&q=80',0),
('ph-a083-1','a083',NULL,'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=600&auto=format&fit=crop&q=80',0),
('ph-a084-1','a084',NULL,'https://images.unsplash.com/photo-1578897367842-ef2d9b68ce73?w=600&auto=format&fit=crop&q=80',0),
('ph-a085-1','a085',NULL,'https://images.unsplash.com/photo-1562157873-818bc0726f68?w=600&auto=format&fit=crop&q=80',0),
('ph-a086-1','a086',NULL,'https://images.unsplash.com/photo-1501555088652-021faa106b9b?w=600&auto=format&fit=crop&q=80',0),
('ph-a087-1','a087',NULL,'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=600&auto=format&fit=crop&q=80',0),
('ph-a088-1','a088',NULL,'https://images.unsplash.com/photo-1578897367842-ef2d9b68ce73?w=600&auto=format&fit=crop&q=80',0),
('ph-a089-1','a089',NULL,'https://images.unsplash.com/photo-1562157873-818bc0726f68?w=600&auto=format&fit=crop&q=80',0),
('ph-a090-1','a090',NULL,'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=600&auto=format&fit=crop&q=80',0);
