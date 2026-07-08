// Generates photo INSERT SQL with loremflickr URLs (keyword + color matched)
// Run: node add_photos.js | Out-File -FilePath photos.sql -Encoding utf8

function artId(n) { return 'a' + String(n).padStart(3, '0'); }

// Remaining categories (Tote Bag 21-30 and Wallet 61-70 were deleted)
const CATS = [
  {
    range: [1, 10], colors: ['Black', 'Brown', 'Red'],
    ckws:  ['black,leather+handbag', 'brown,leather+handbag', 'red,leather+handbag'],
  },
  {
    range: [11, 20], colors: ['Black', 'Navy', 'Grey'],
    ckws:  ['black,backpack', 'navy,backpack', 'gray,backpack'],
  },
  {
    range: [31, 40], colors: ['Black', 'Gold', 'Pink'],
    ckws:  ['black,clutch+purse', 'gold,clutch+purse', 'pink,clutch+purse'],
  },
  {
    range: [41, 50], colors: ['Tan', 'Black', 'Burgundy'],
    ckws:  ['tan,shoulder+bag', 'black,shoulder+bag', 'wine,shoulder+bag'],
  },
  {
    range: [51, 60], colors: ['Black', 'Blue', 'Green'],
    ckws:  ['black,crossbody+bag', 'blue,crossbody+bag', 'green,crossbody+bag'],
  },
  {
    range: [71, 80], colors: ['Black', 'Navy', 'Grey'],
    ckws:  ['black,duffel+bag', 'navy,duffel+bag', 'gray,duffel+bag'],
  },
  {
    range: [81, 90], colors: ['Black', 'Olive', 'Brown'],
    ckws:  ['black,luggage+travel', 'olive,travel+bag', 'brown,luggage+travel'],
  },
];

const photoInserts = [];
let lock = 700; // start offset to guarantee variety

CATS.forEach((cat) => {
  for (let n = cat.range[0]; n <= cat.range[1]; n++) {
    const aid = artId(n);
    cat.colors.forEach((color, ci) => {
      const photoId = `p${aid}c${ci}`;
      const url = `https://loremflickr.com/400/400/${cat.ckws[ci]}?lock=${lock++}`;
      photoInserts.push(`('${photoId}','${aid}','${color}','${url}',${ci})`);
    });
  }
});

const lines = [
  '-- Loremflickr photo seed',
  'INSERT INTO photos (id, article_id, color, url, sort_order) VALUES',
  photoInserts.join(',\n') + ';',
];
console.log(lines.join('\n'));
