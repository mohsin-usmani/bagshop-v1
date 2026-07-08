-- Set 10 articles to near-sold-out status (total qty < 10)
UPDATE variants SET available_qty = 0 WHERE article_id IN ('a003','a008','a013','a019','a033','a038','a044','a054','a073','a086');
UPDATE variants SET available_qty = 7 WHERE article_id = 'a003' AND color = 'Black' AND size = 'M';
UPDATE variants SET available_qty = 4 WHERE article_id = 'a008' AND color = 'Red'   AND size = 'L';
UPDATE variants SET available_qty = 6 WHERE article_id = 'a013' AND color = 'Black' AND size = 'S';
UPDATE variants SET available_qty = 3 WHERE article_id = 'a019' AND color = 'Grey'  AND size = 'M';
UPDATE variants SET available_qty = 5 WHERE article_id = 'a033' AND color = 'Black' AND size = 'S';
UPDATE variants SET available_qty = 2 WHERE article_id = 'a038' AND color = 'Pink'  AND size = 'XL';
UPDATE variants SET available_qty = 8 WHERE article_id = 'a044' AND color = 'Tan'   AND size = 'M';
UPDATE variants SET available_qty = 5 WHERE article_id = 'a054' AND color = 'Blue'  AND size = 'L';
UPDATE variants SET available_qty = 4 WHERE article_id = 'a073' AND color = 'Grey'  AND size = 'S';
UPDATE variants SET available_qty = 6 WHERE article_id = 'a086' AND color = 'Black' AND size = 'M';
