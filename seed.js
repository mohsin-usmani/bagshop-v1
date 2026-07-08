// Run: node seed.js > seed.sql
// Then: wrangler d1 execute bagshop --file=./seed.sql --remote

const { randomUUID } = require('crypto');
const id = () => randomUUID().replace(/-/g, '');
const now = Date.now();

const CATEGORIES = [
  {
    name: 'Handbag',
    colors: ['Black', 'Brown', 'Red'],
    products: [
      { code:'HB-001', name:'Classic Leather Handbag',    price:450, desc:'Timeless PU leather handbag with gold-tone hardware, zip closure and multiple inner compartments.' },
      { code:'HB-002', name:'Mini Fashion Handbag',       price:280, desc:'Compact trendy handbag for evenings out. Adjustable chain strap with smooth PU finish.' },
      { code:'HB-003', name:'Structured Office Handbag',  price:520, desc:'Sleek, boxy silhouette ideal for professionals. Fits a tablet and daily essentials.' },
      { code:'HB-004', name:'Boho Fringe Handbag',        price:340, desc:'Free-spirited boho design with tassel fringe detail and wide shoulder strap.' },
      { code:'HB-005', name:'Quilted Chain Handbag',      price:420, desc:'Quilted diamond-pattern body with long chain strap. Lightweight and durable.' },
      { code:'HB-006', name:'Top-Handle Handbag',         price:390, desc:'Classic top-handle style with detachable crossbody strap. Fits phone, wallet, and keys.' },
      { code:'HB-007', name:'Flap Lock Handbag',          price:470, desc:'Elegant flap-closure handbag with turn-lock hardware. Suede-feel interior lining.' },
      { code:'HB-008', name:'Woven Straw Handbag',        price:220, desc:'Trendy woven straw body with PU leather trim. Perfect for summer and casual outings.' },
      { code:'HB-009', name:'Velvet Evening Handbag',     price:310, desc:'Rich velvet exterior with satin-lined interior. Ideal for weddings and festive occasions.' },
      { code:'HB-010', name:'Croc-Print Handbag',         price:380, desc:'Eye-catching croc-embossed PU leather with a bold look and spacious interior.' },
    ],
  },
  {
    name: 'Backpack',
    colors: ['Black', 'Navy', 'Grey'],
    products: [
      { code:'BP-001', name:'Urban College Backpack',     price:380, desc:'Spacious 20L backpack with padded laptop sleeve (fits 15"). Multiple zip pockets.' },
      { code:'BP-002', name:'Mini Casual Backpack',       price:220, desc:'Compact 10L daypack, perfect for quick outings. Lightweight nylon with adjustable straps.' },
      { code:'BP-003', name:'Anti-Theft Backpack',        price:490, desc:'Hidden back-panel zip pockets and lockable zippers to keep your valuables safe.' },
      { code:'BP-004', name:'Leather Backpack',           price:620, desc:'Premium PU leather backpack with brass zip pulls. Professional look for work or travel.' },
      { code:'BP-005', name:'Canvas Hiking Backpack',     price:320, desc:'Durable canvas body with padded back panel. Ideal for day hikes and weekend trips.' },
      { code:'BP-006', name:'Drawstring Backpack',        price:150, desc:'Lightweight poly drawstring bag. Great for gym, sports, and quick daily use.' },
      { code:'BP-007', name:'Rolling Backpack',           price:580, desc:'Convertible trolley + backpack with retractable handle. Perfect for students and travellers.' },
      { code:'BP-008', name:'Technical Laptop Bag',       price:450, desc:'Padded compartment for 15.6" laptop, USB charging port, and water-bottle side pocket.' },
      { code:'BP-009', name:'Vintage Rucksack',           price:350, desc:'Classic rucksack silhouette with antique brass buckles and waxed canvas exterior.' },
      { code:'BP-010', name:'Hydration Backpack',         price:270, desc:'Includes 1.5L water bladder. Mesh back panel for ventilation during outdoor activities.' },
    ],
  },
  {
    name: 'Tote Bag',
    colors: ['Beige', 'Black', 'Olive'],
    products: [
      { code:'TT-001', name:'Classic Canvas Tote',        price:180, desc:'Heavy-duty cotton canvas, reinforced handles. Ideal for groceries, beach, and everyday use.' },
      { code:'TT-002', name:'Leather Trim Tote',          price:340, desc:'Canvas body with genuine leather handles and base corners for added durability.' },
      { code:'TT-003', name:'Oversized Beach Tote',       price:250, desc:'Large open tote with inner zip pocket. Fits towels, sunscreen, and a change of clothes.' },
      { code:'TT-004', name:'Woven Jute Tote',            price:140, desc:'Eco-friendly jute weave with cotton lining. Foldable and reusable.' },
      { code:'TT-005', name:'Office Tote Bag',            price:390, desc:'Structured tote with zipper closure, padded laptop sleeve, and organiser pockets.' },
      { code:'TT-006', name:'Mini Tote Bag',              price:160, desc:'Compact tote for light shopping or daily essentials. Short and long handles included.' },
      { code:'TT-007', name:'Printed Tote Bag',           price:130, desc:'Bold graphic-print cotton canvas tote. Sturdy stitching and wide gusset.' },
      { code:'TT-008', name:'Zip-Top Tote',               price:290, desc:'Secure zip-top closure keeps contents safe. Internal divider organises your items.' },
      { code:'TT-009', name:'Neoprene Tote',              price:210, desc:'Water-resistant neoprene body, easy to wipe clean. Great for gym and beach.' },
      { code:'TT-010', name:'Reversible Tote',            price:200, desc:'Flip it inside out for two looks in one. Double-sided cotton canvas with contrast lining.' },
    ],
  },
  {
    name: 'Clutch',
    colors: ['Black', 'Gold', 'Pink'],
    products: [
      { code:'CL-001', name:'Satin Evening Clutch',       price:200, desc:'Luxurious satin finish with crystal clasp closure. Fits phone, cards, and lipstick.' },
      { code:'CL-002', name:'Hard Box Clutch',            price:280, desc:'Rigid box frame clutch with magnetic closure and wrist strap.' },
      { code:'CL-003', name:'Envelope Clutch',            price:170, desc:'Classic envelope silhouette in smooth PU leather. Slim and elegant.' },
      { code:'CL-004', name:'Beaded Clutch',              price:260, desc:'Intricate beadwork on full front panel. Ideal for weddings and parties.' },
      { code:'CL-005', name:'Fold-Over Clutch',           price:190, desc:'Soft leather fold-over with magnetic snap. Detachable wrist strap included.' },
      { code:'CL-006', name:'Metallic Clutch',            price:240, desc:'Shimmery metallic finish, perfect for festive nights. Chain detail handle.' },
      { code:'CL-007', name:'Wristlet Clutch',            price:150, desc:'Compact wristlet with multi-card slots and zip coin pocket inside.' },
      { code:'CL-008', name:'Pleated Satin Clutch',       price:220, desc:'Delicate pleated satin with vintage brooch accent on the flap.' },
      { code:'CL-009', name:'Sequin Party Clutch',        price:210, desc:'All-over sequin body that catches every light. Zip-top closure.' },
      { code:'CL-010', name:'Acrylic Chain Clutch',       price:300, desc:'Clear acrylic box with detachable chain strap. Modern and statement-making.' },
    ],
  },
  {
    name: 'Shoulder Bag',
    colors: ['Tan', 'Black', 'Burgundy'],
    products: [
      { code:'SH-001', name:'Hobo Shoulder Bag',          price:360, desc:'Soft slouchy hobo with single wide strap and zip closure. Fits a full day\'s essentials.' },
      { code:'SH-002', name:'Bucket Shoulder Bag',        price:310, desc:'Drawstring bucket bag with flat base. Spacious interior with inner slip pocket.' },
      { code:'SH-003', name:'Saddle Shoulder Bag',        price:390, desc:'Classic saddle shape with front flap and magnetic snap. Adjustable strap.' },
      { code:'SH-004', name:'Half-Moon Shoulder Bag',     price:420, desc:'Curved half-moon silhouette in soft PU leather. Interior zip pocket.' },
      { code:'SH-005', name:'Suede Shoulder Bag',         price:480, desc:'Soft suede-feel exterior with fringe trim. Bohemian and sophisticated.' },
      { code:'SH-006', name:'Structured Shoulder Bag',    price:400, desc:'Rigid structured body with flap closure. Side metal feet protect the base.' },
      { code:'SH-007', name:'Slouch Shoulder Bag',        price:330, desc:'Relaxed slouchy silhouette with multiple external pockets.' },
      { code:'SH-008', name:'Convertible Shoulder Bag',   price:450, desc:'Switch from shoulder to crossbody to clutch in seconds. 3-in-1 versatility.' },
      { code:'SH-009', name:'Wicker Shoulder Bag',        price:250, desc:'Natural rattan wicker with leather strap. Summer-ready and unique.' },
      { code:'SH-010', name:'Zip Shoulder Bag',           price:370, desc:'Full-zip closure with exterior front pocket and padded handles.' },
    ],
  },
  {
    name: 'Sling Bag',
    colors: ['Black', 'Blue', 'Green'],
    products: [
      { code:'SL-001', name:'Casual Canvas Sling',        price:180, desc:'Lightweight canvas sling with adjustable strap. Two zip compartments and a bottle holder.' },
      { code:'SL-002', name:'Leather Sling Bag',          price:320, desc:'Premium PU leather single-strap crossbody. Anti-theft hidden back pocket.' },
      { code:'SL-003', name:'Sport Sling Pack',           price:200, desc:'Water-resistant ripstop nylon. Chest strap clip and quick-access top zip.' },
      { code:'SL-004', name:'Mini Sling Bag',             price:140, desc:'Tiny sling for cards, keys, and essentials. Perfect for walks and light travel.' },
      { code:'SL-005', name:'Festival Sling Bag',         price:160, desc:'Colourful patterned sling with multiple zip pockets. Hands-free convenience.' },
      { code:'SL-006', name:'Utility Sling Pack',         price:250, desc:'Tactical-style sling with MOLLE webbing and quick-access front zip.' },
      { code:'SL-007', name:'Crescent Sling Bag',         price:290, desc:'Curved crescent body in smooth vegan leather. Internal organiser pocket.' },
      { code:'SL-008', name:'Nylon Sling Bag',            price:170, desc:'Ultra-light nylon with reflective strip. Good for evening walks and commutes.' },
      { code:'SL-009', name:'Travel Sling Bag',           price:310, desc:'Passport-friendly sling with dedicated card slots and RFID-blocking pocket.' },
      { code:'SL-010', name:'Camera Sling Bag',           price:360, desc:'Padded sling designed for mirrorless cameras. Cushioned divider inside.' },
    ],
  },
  {
    name: 'Wallet',
    colors: ['Black', 'Brown', 'Red'],
    products: [
      { code:'WL-001', name:'Slim Card Wallet',           price: 90, desc:'Ultra-thin design holds up to 8 cards. Minimalist style in genuine-feel PU.' },
      { code:'WL-002', name:'Bi-Fold Wallet',             price:120, desc:'Classic bi-fold with 6 card slots, bill compartment, and clear ID window.' },
      { code:'WL-003', name:'Zip-Around Wallet',          price:170, desc:'Full zip enclosure with 12 card slots, coin pocket, and note section.' },
      { code:'WL-004', name:'Ladies Long Wallet',         price:180, desc:'Elegant long wallet with snap closure. Plenty of slots for cards, cash, and receipts.' },
      { code:'WL-005', name:'RFID Blocking Wallet',       price:150, desc:'Built-in RFID shield protects contactless cards from unauthorised scanning.' },
      { code:'WL-006', name:'Coin Purse Wallet',          price: 80, desc:'Small coin purse with kiss-lock frame. Holds coins and a few folded notes.' },
      { code:'WL-007', name:'Wristlet Wallet',            price:140, desc:'Zip-around wallet with wrist strap. Fits phone up to 6.5" alongside cards and cash.' },
      { code:'WL-008', name:'Travel Wallet',              price:200, desc:'Large travel organiser for passport, boarding pass, cards, and foreign currency.' },
      { code:'WL-009', name:'Tri-Fold Wallet',            price:110, desc:'Compact tri-fold with 9 card slots and external coin pocket.' },
      { code:'WL-010', name:'Monogram Wallet',            price:130, desc:'Classic monogram-print wallet in coated canvas with leather trim.' },
    ],
  },
  {
    name: 'Duffel Bag',
    colors: ['Black', 'Navy', 'Grey'],
    products: [
      { code:'DF-001', name:'Weekend Duffel Bag',         price:480, desc:'40L capacity duffel with shoe compartment, wet-dry separation, and padded shoulder strap.' },
      { code:'DF-002', name:'Gym Duffel Bag',             price:320, desc:'Lightweight 25L gym bag with ventilated shoe pocket and water-bottle holder.' },
      { code:'DF-003', name:'Canvas Duffel Bag',          price:360, desc:'Heavy-duty waxed canvas with leather base. Vintage-inspired and waterproof bottom.' },
      { code:'DF-004', name:'Rolling Duffel Bag',         price:680, desc:'Duffel on wheels with retractable handle. Carry-on compliant for most airlines.' },
      { code:'DF-005', name:'Mini Duffel Bag',            price:220, desc:'Compact 15L duffel for gym essentials or overnight bags. Fits in overhead bin.' },
      { code:'DF-006', name:'Leather Duffel Bag',         price:780, desc:'Full-grain PU leather duffel with brass hardware. Business-class travel in style.' },
      { code:'DF-007', name:'Military Duffel Bag',        price:400, desc:'Rugged 60L military-style bag with wide zip opening and compression straps.' },
      { code:'DF-008', name:'Convertible Duffel Bag',     price:540, desc:'Converts from duffel to backpack to crossbody. Versatile for every journey.' },
      { code:'DF-009', name:'Foldable Duffel Bag',        price:200, desc:'Packs down to the size of a pouch. Lightweight nylon, ideal for extra luggage.' },
      { code:'DF-010', name:'Sports Duffel Bag',          price:290, desc:'Bold colour-block sports duffel with adjustable divider and easy-grip handles.' },
    ],
  },
  {
    name: 'Travel Bag',
    colors: ['Black', 'Olive', 'Brown'],
    products: [
      { code:'TR-001', name:'Carry-On Travel Bag',        price:720, desc:'Cabin-size spinner with TSA lock, expandable zip, and garment-organiser section.' },
      { code:'TR-002', name:'Under-Seat Travel Bag',      price:380, desc:'Compact bag that fits under most airline seats. Telescoping handle, 2 spinner wheels.' },
      { code:'TR-003', name:'Weekender Travel Bag',       price:490, desc:'Structured weekender with trolley sleeve. Removable shoe bag and toiletry pouch included.' },
      { code:'TR-004', name:'Garment Travel Bag',         price:560, desc:'Tri-fold suit carrier with hanger loop. Keeps formal wear crease-free on the go.' },
      { code:'TR-005', name:'Tech Travel Bag',            price:620, desc:'Dedicated tech organiser pockets for cables, chargers, and power banks. TSA-friendly lay-flat.' },
      { code:'TR-006', name:'Backpack Travel Bag',        price:540, desc:'Carry-on compliant backpack with clamshell opening. Padded laptop sleeve and hip belt.' },
      { code:'TR-007', name:'Packing Cube Set Bag',       price:320, desc:'Set of 3 packing cubes in a zip travel bag. Keeps clothes compressed and organised.' },
      { code:'TR-008', name:'Soft Shell Travel Bag',      price:650, desc:'Lightweight soft-shell with 360° spinner wheels and expandable capacity.' },
      { code:'TR-009', name:'Luxury Travel Bag',          price:980, desc:'Full-grain PU leather hard-shell with velvet lining. The ultimate travel companion.' },
      { code:'TR-010', name:'Kids Travel Bag',            price:280, desc:'Fun-size roller bag for kids. Lightweight, colourful, and easy to pull.' },
    ],
  },
];

const SIZES = ['S', 'M', 'L', 'XL'];

// Qty and price variation per size
const SIZE_QTY  = { S: 35, M: 50, L: 40, XL: 25 };
const SIZE_ADJ  = { S: -30, M: 0, L: 20, XL: 40 };  // price adjustment per size

// Picsum seed per (category index, color index) to get consistent distinct placeholder photos
function photoUrl(catIdx, artIdx, colorIdx) {
  const seed = catIdx * 100 + artIdx * 10 + colorIdx + 1;
  return `https://picsum.photos/seed/bag${seed}/400/400`;
}

const lines = [];
lines.push('-- Auto-generated seed data');
lines.push('DELETE FROM photos;');
lines.push('DELETE FROM variants;');
lines.push('DELETE FROM articles;');
lines.push('');

const articleInserts = [];
const variantInserts = [];
const photoInserts   = [];

CATEGORIES.forEach((cat, catIdx) => {
  cat.products.forEach((prod, artIdx) => {
    const artId = `a${String(catIdx * 10 + artIdx + 1).padStart(3, '0')}`;
    const desc = prod.desc.replace(/'/g, "''");
    const name = prod.name.replace(/'/g, "''");
    articleInserts.push(
      `('${artId}','${prod.code}','${name}','${cat.name}','${desc}',${prod.price},1,${now})`
    );

    cat.colors.forEach((color, colorIdx) => {
      // photo per (article, color)
      const photoId = `p${artId}c${colorIdx}`;
      const url = photoUrl(catIdx, artIdx, colorIdx);
      photoInserts.push(`('${photoId}','${artId}','${color}','${url}',${colorIdx})`);

      SIZES.forEach((size) => {
        const varId = `v${artId}c${colorIdx}${size.toLowerCase()}`;
        const price = prod.price + SIZE_ADJ[size];
        const qty   = SIZE_QTY[size];
        variantInserts.push(
          `('${varId}','${artId}','${color}','${size}',${price},${qty},1,${now})`
        );
      });
    });
  });
});

lines.push('INSERT INTO articles (id,article_code,name,category,description,base_price,is_active,created_at) VALUES');
lines.push(articleInserts.join(',\n') + ';');
lines.push('');
lines.push('INSERT INTO variants (id,article_id,color,size,price,available_qty,is_active,updated_at) VALUES');
lines.push(variantInserts.join(',\n') + ';');
lines.push('');
lines.push('INSERT INTO photos (id,article_id,color,url,sort_order) VALUES');
lines.push(photoInserts.join(',\n') + ';');

console.log(lines.join('\n'));
