// Real Unsplash photo IDs from unsplash.com/napi/search/photos
// URL: https://images.unsplash.com/photo-{ID}?w=400&h=400&fit=crop&q=80

const u = (id) => `https://images.unsplash.com/photo-${id}?w=400&h=400&fit=crop&q=80`;

// [article_id, color_name, color_idx, unsplash_photo_id]
// Photos matched by product type (searched per category) then product name
const ROWS = [
  // ─── HANDBAGS (a001-a010) Colors: Black, Brown, Red ───
  // HB-001 Classic Leather Handbag
  ['a001','Black',0,'BXWGZgFhBuU'],['a001','Brown',1,'lnbuoKz2GlM'],['a001','Red',2,'J4DnKxz_3sA'],
  // HB-002 Mini Fashion Handbag
  ['a002','Black',0,'XwjrPFW7xw0'],['a002','Brown',1,'IjfvQXXGHNo'],['a002','Red',2,'hCG34GSdYTA'],
  // HB-003 Structured Office Handbag
  ['a003','Black',0,'IFlg3kFbR0E'],['a003','Brown',1,'PfyljNniz_c'],['a003','Red',2,'TLoMyRdcQOE'],
  // HB-004 Boho Fringe Handbag  (searched "boho fringe bag")
  ['a004','Black',0,'NZtnbgJDgqQ'],['a004','Brown',1,'ddNtzPcgfr8'],['a004','Red',2,'pr7Fq7RcyJA'],
  // HB-005 Quilted Chain Handbag  (searched "quilted chain bag luxury")
  ['a005','Black',0,'8AWcEs3lpKs'],['a005','Brown',1,'ZmeFtu11Hpc'],['a005','Red',2,'RycLeDdrWJ0'],
  // HB-006 Top-Handle Handbag
  ['a006','Black',0,'jKoRZkv2o0U'],['a006','Brown',1,'Aqx94H6bi4g'],['a006','Red',2,'5Ixrei3mmwI'],
  // HB-007 Flap Lock Handbag
  ['a007','Black',0,'rpUKVRCyceo'],['a007','Brown',1,'NUU6DBMLf2w'],['a007','Red',2,'cK4aqr_zQVM'],
  // HB-008 Woven Straw Handbag  (searched "woven straw rattan bag")
  ['a008','Black',0,'kIZJESePCAc'],['a008','Brown',1,'Ak7lAuarT1I'],['a008','Red',2,'RTNmxxva6w4'],
  // HB-009 Velvet Evening Handbag  (searched "velvet evening bag party")
  ['a009','Black',0,'NA6xafd-dXw'],['a009','Brown',1,'nOnT17lKYz8'],['a009','Red',2,'qbhDm59niWI'],
  // HB-010 Croc-Print Handbag
  ['a010','Black',0,'zxPo13geJ5U'],['a010','Brown',1,'eej74DpSHU0'],['a010','Red',2,'V4fugp6h0_4'],

  // ─── BACKPACKS (a011-a020) Colors: Black, Navy, Grey ───
  // BP-001 Urban College Backpack
  ['a011','Black',0,'oRAqLrLPPN8'],['a011','Navy',1,'_H0fjILH5Vw'],['a011','Grey',2,'GQQ6BRJxysU'],
  // BP-002 Mini Casual Backpack
  ['a012','Black',0,'iFelMiWMuO4'],['a012','Navy',1,'xsHFaT4ihgA'],['a012','Grey',2,'1Frndjy7tkM'],
  // BP-003 Anti-Theft Backpack
  ['a013','Black',0,'3o-X8WJOP5E'],['a013','Navy',1,'EG7Z3r0PEmo'],['a013','Grey',2,'q1Wd5MJvcKo'],
  // BP-004 Leather Backpack  (searched "leather luxury backpack")
  ['a014','Black',0,'SwWCo1k92M4'],['a014','Navy',1,'9LvXZIS8Uis'],['a014','Grey',2,'OFHkPCkhYEY'],
  // BP-005 Canvas Hiking Backpack  (searched "hiking camping backpack")
  ['a015','Black',0,'MzTTVl_trFw'],['a015','Navy',1,'7w6JYDd1jMg'],['a015','Grey',2,'juHayWuaaoQ'],
  // BP-006 Drawstring Backpack
  ['a016','Black',0,'8TSqJoI-NVs'],['a016','Navy',1,'toJ2H9oPpSo'],['a016','Grey',2,'BmH09wAkJa8'],
  // BP-007 Rolling Backpack  (searched "rolling trolley luggage wheels")
  ['a017','Black',0,'kKBQ2IEG2IU'],['a017','Navy',1,'VqLqFGdy4mg'],['a017','Grey',2,'KLp9S-K6BrY'],
  // BP-008 Technical Laptop Bag
  ['a018','Black',0,'jzF3PYBnhiY'],['a018','Navy',1,'O_bhy3TnSYU'],['a018','Grey',2,'zYihALOsZHc'],
  // BP-009 Vintage Rucksack
  ['a019','Black',0,'DfI-w0yb1Zs'],['a019','Navy',1,'UcgSpU8bOYY'],['a019','Grey',2,'S1mSsru32QM'],
  // BP-010 Hydration Backpack  (searched "hiking camping backpack")
  ['a020','Black',0,'7EtzgOxT9B4'],['a020','Navy',1,'bQl2kRQyUE8'],['a020','Grey',2,'E9hoLMrGj9E'],

  // ─── CLUTCHES (a031-a040) Colors: Black, Gold, Pink ───
  // CL-001 Satin Evening Clutch
  ['a031','Black',0,'yBS1MHW3HBY'],['a031','Gold',1,'gpipTmDphMQ'],['a031','Pink',2,'U26Jsp9BXcc'],
  // CL-002 Hard Box Clutch
  ['a032','Black',0,'NwBbHt_K8-w'],['a032','Gold',1,'DBqqusDBEVI'],['a032','Pink',2,'PzMkssEwenU'],
  // CL-003 Envelope Clutch
  ['a033','Black',0,'2A5RGRkKaMM'],['a033','Gold',1,'ePl3XUofGEs'],['a033','Pink',2,'TRNBKonJpsw'],
  // CL-004 Beaded Clutch
  ['a034','Black',0,'_8QJ30PDh1g'],['a034','Gold',1,'0RL1REWrTAw'],['a034','Pink',2,'8NL8U5Hut9w'],
  // CL-005 Fold-Over Clutch
  ['a035','Black',0,'noPBVmLgqOE'],['a035','Gold',1,'hj7cjKNcFHs'],['a035','Pink',2,'vzQwtwu8GaU'],
  // CL-006 Metallic Clutch
  ['a036','Black',0,'HPzupGvnA3w'],['a036','Gold',1,'1vkeb9AaN0E'],['a036','Pink',2,'c0zvfXcmjpQ'],
  // CL-007 Wristlet Clutch
  ['a037','Black',0,'61zBkYyksEY'],['a037','Gold',1,'c75rqnoUBss'],['a037','Pink',2,'ePl3XUofGEs'],
  // CL-008 Pleated Satin Clutch  (searched "velvet evening bag")
  ['a038','Black',0,'6PPxbgO238I'],['a038','Gold',1,'JjVQOJNRBUI'],['a038','Pink',2,'4eF4u48VDpo'],
  // CL-009 Sequin Party Clutch
  ['a039','Black',0,'8LCEI21Hl3s'],['a039','Gold',1,'UEDzOV8xZhs'],['a039','Pink',2,'HPzupGvnA3w'],
  // CL-010 Acrylic Chain Clutch
  ['a040','Black',0,'oPnU0Vy40VI'],['a040','Gold',1,'xSNcL7GuEy0'],['a040','Pink',2,'PYgHApWh7kE'],

  // ─── SHOULDER BAGS (a041-a050) Colors: Tan, Black, Burgundy ───
  // SH-001 Hobo Shoulder Bag
  ['a041','Tan',0,'tg0E4SwykU8'],['a041','Black',1,'zxPo13geJ5U'],['a041','Burgundy',2,'Zha2jqwxzMY'],
  // SH-002 Bucket Shoulder Bag  (searched "bucket bag drawstring")
  ['a042','Tan',0,'5e5zTQg3Qzs'],['a042','Black',1,'6XShU8ZtUig'],['a042','Burgundy',2,'Kzk92-fCJBw'],
  // SH-003 Saddle Shoulder Bag
  ['a043','Tan',0,'34mc9TqRznQ'],['a043','Black',1,'hWs4qKwJkD4'],['a043','Burgundy',2,'0H2qpkqxLgY'],
  // SH-004 Half-Moon Shoulder Bag
  ['a044','Tan',0,'cK4aqr_zQVM'],['a044','Black',1,'WogVejBX8q0'],['a044','Burgundy',2,'v_praOEpVcI'],
  // SH-005 Suede Shoulder Bag
  ['a045','Tan',0,'We47wLCUKf4'],['a045','Black',1,'s7_rbNNq1go'],['a045','Burgundy',2,'eCSEAlw85zc'],
  // SH-006 Structured Shoulder Bag
  ['a046','Tan',0,'LW2iqpHzr8Y'],['a046','Black',1,'ZcMLlZLag2o'],['a046','Burgundy',2,'wpYHGyhyjcs'],
  // SH-007 Slouch Shoulder Bag
  ['a047','Tan',0,'NNNwh-qH0Y8'],['a047','Black',1,'N2058Yn7BRo'],['a047','Burgundy',2,'SNPDQAE4EHY'],
  // SH-008 Convertible Shoulder Bag
  ['a048','Tan',0,'TLoMyRdcQOE'],['a048','Black',1,'cK4aqr_zQVM'],['a048','Burgundy',2,'tg0E4SwykU8'],
  // SH-009 Wicker Shoulder Bag  (woven/rattan)
  ['a049','Tan',0,'SB4yTkbGLz0'],['a049','Black',1,'efo3GhZ3VCg'],['a049','Burgundy',2,'wnKW5oyWeWI'],
  // SH-010 Zip Shoulder Bag  (bucket bag search)
  ['a050','Tan',0,'BKcKIIdOdlc'],['a050','Black',1,'bs7kqVg_YnY'],['a050','Burgundy',2,'iFQhTLUFSv4'],

  // ─── SLING BAGS (a051-a060) Colors: Black, Blue, Green ───
  // SL-001 Casual Canvas Sling
  ['a051','Black',0,'kTozgN5CQHc'],['a051','Blue',1,'J9PGbtyQ08Q'],['a051','Green',2,'UDYE-agPbj4'],
  // SL-002 Leather Sling Bag
  ['a052','Black',0,'CYEP7mVNDHM'],['a052','Blue',1,'dNXGaWbzSVc'],['a052','Green',2,'BBrM8ja22BE'],
  // SL-003 Sport Sling Pack
  ['a053','Black',0,'h0k5fB9kzfo'],['a053','Blue',1,'8ZLzRcrEd38'],['a053','Green',2,'B7KeqRqvKTQ'],
  // SL-004 Mini Sling Bag
  ['a054','Black',0,'lCYfAJPp61o'],['a054','Blue',1,'Scw8kJLBMiA'],['a054','Green',2,'J4DUtJN4MZk'],
  // SL-005 Festival Sling Bag
  ['a055','Black',0,'jqRQH4xlW1c'],['a055','Blue',1,'a-od0mJSVMg'],['a055','Green',2,'KElVcdWIDLk'],
  // SL-006 Utility Sling Pack
  ['a056','Black',0,'4CVhHVQaUNM'],['a056','Blue',1,'Pmr1tg3NThk'],['a056','Green',2,'UBJTc4IVnuA'],
  // SL-007 Crescent Sling Bag
  ['a057','Black',0,'8zT3fmaqeg0'],['a057','Blue',1,'J9PGbtyQ08Q'],['a057','Green',2,'CYEP7mVNDHM'],
  // SL-008 Nylon Sling Bag
  ['a058','Black',0,'BBrM8ja22BE'],['a058','Blue',1,'lCYfAJPp61o'],['a058','Green',2,'dNXGaWbzSVc'],
  // SL-009 Travel Sling Bag
  ['a059','Black',0,'Scw8kJLBMiA'],['a059','Blue',1,'kTozgN5CQHc'],['a059','Green',2,'UDYE-agPbj4'],
  // SL-010 Camera Sling Bag  (searched "camera bag photography")
  ['a060','Black',0,'oKYD8CdLmzg'],['a060','Blue',1,'_5cM7W0c1jc'],['a060','Green',2,'iCtJF-A5hvs'],

  // ─── DUFFEL BAGS (a071-a080) Colors: Black, Navy, Grey ───
  // DF-001 Weekend Duffel Bag
  ['a071','Black',0,'WiMyw8Y5ea0'],['a071','Navy',1,'YFFj8Vv9v8c'],['a071','Grey',2,'5rfiIvSDG4s'],
  // DF-002 Gym Duffel Bag
  ['a072','Black',0,'_q-XZ1DYEZA'],['a072','Navy',1,'MBLOtIcGpws'],['a072','Grey',2,'YWOt8bOYd78'],
  // DF-003 Canvas Duffel Bag
  ['a073','Black',0,'e8oJQjeJ-eY'],['a073','Navy',1,'3kwXdrAm00k'],['a073','Grey',2,'PA7_6MiVJrQ'],
  // DF-004 Rolling Duffel Bag  (searched "rolling trolley luggage")
  ['a074','Black',0,'VqLqFGdy4mg'],['a074','Navy',1,'5CBYK06DvfM'],['a074','Grey',2,'xrfNohujIdM'],
  // DF-005 Mini Duffel Bag
  ['a075','Black',0,'c6huDrLBQJg'],['a075','Navy',1,'On0cUsfdbsc'],['a075','Grey',2,'wEbT5USJudQ'],
  // DF-006 Leather Duffel Bag
  ['a076','Black',0,'7vRbOLuM9i0'],['a076','Navy',1,'nBy96B6nxS4'],['a076','Grey',2,'WiMyw8Y5ea0'],
  // DF-007 Military Duffel Bag
  ['a077','Black',0,'YFFj8Vv9v8c'],['a077','Navy',1,'e8oJQjeJ-eY'],['a077','Grey',2,'_q-XZ1DYEZA'],
  // DF-008 Convertible Duffel Bag
  ['a078','Black',0,'YWOt8bOYd78'],['a078','Navy',1,'MBLOtIcGpws'],['a078','Grey',2,'5rfiIvSDG4s'],
  // DF-009 Foldable Duffel Bag
  ['a079','Black',0,'nBy96B6nxS4'],['a079','Navy',1,'c6huDrLBQJg'],['a079','Grey',2,'3kwXdrAm00k'],
  // DF-010 Sports Duffel Bag
  ['a080','Black',0,'PA7_6MiVJrQ'],['a080','Navy',1,'YFFj8Vv9v8c'],['a080','Grey',2,'WiMyw8Y5ea0'],

  // ─── TRAVEL BAGS (a081-a090) Colors: Black, Olive, Brown ───
  // TR-001 Carry-On Travel Bag
  ['a081','Black',0,'eOUtprtGgV8'],['a081','Olive',1,'TVllFyGaLEA'],['a081','Brown',2,'GOZxrAlNIt4'],
  // TR-002 Under-Seat Travel Bag
  ['a082','Black',0,'ji5XMfO3dXY'],['a082','Olive',1,'ARZLr5FQWps'],['a082','Brown',2,'166umbWL6Ec'],
  // TR-003 Weekender Travel Bag
  ['a083','Black',0,'5SWgIJSsVJo'],['a083','Olive',1,'6uWRmqYNxBE'],['a083','Brown',2,'G3AWk9MkQ08'],
  // TR-004 Garment Travel Bag  (searched "garment suit bag travel")
  ['a084','Black',0,'PHMI9chVk10'],['a084','Olive',1,'9XiN0r2NWSM'],['a084','Brown',2,'2heJHPFDpKU'],
  // TR-005 Tech Travel Bag
  ['a085','Black',0,'tVKQmny4VXM'],['a085','Olive',1,'y_cczw0Uc6E'],['a085','Brown',2,'r2jpr8MDw0I'],
  // TR-006 Backpack Travel Bag
  ['a086','Black',0,'oXk-03LEFsk'],['a086','Olive',1,'0H02FswtQ0I'],['a086','Brown',2,'uUWD7fsh9tg'],
  // TR-007 Packing Cube Set Bag
  ['a087','Black',0,'DbfjXr5ylIs'],['a087','Olive',1,'q-4fbq8pUO4'],['a087','Brown',2,'BJ5gcirJa4Y'],
  // TR-008 Soft Shell Travel Bag
  ['a088','Black',0,'GOZxrAlNIt4'],['a088','Olive',1,'TVllFyGaLEA'],['a088','Brown',2,'eOUtprtGgV8'],
  // TR-009 Luxury Travel Bag
  ['a089','Black',0,'C-o9HNzQ_rA'],['a089','Olive',1,'vXduK0SeYjU'],['a089','Brown',2,'ji5XMfO3dXY'],
  // TR-010 Kids Travel Bag
  ['a090','Black',0,'6uWRmqYNxBE'],['a090','Olive',1,'G3AWk9MkQ08'],['a090','Brown',2,'ARZLr5FQWps'],
];

const inserts = ROWS.map(([aid, color, ci, pid]) => {
  const photoId = `p${aid}c${ci}`;
  const url = u(pid);
  return `('${photoId}','${aid}','${color}','${url}',${ci})`;
});

const lines = [
  '-- Real Unsplash photos matched by product type',
  'DELETE FROM photos;',
  'INSERT INTO photos (id, article_id, color, url, sort_order) VALUES',
  inserts.join(',\n') + ';',
];

console.log(lines.join('\n'));
