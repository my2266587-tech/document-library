-- =====================================================================
-- Seed customer categories
-- Run once in Supabase Studio → SQL Editor.
--
-- Each row maps to one category: `name` (the instructor / primary label)
-- + `description` (the topic / specialty), shown as a subtitle in the UI.
--
-- ON CONFLICT DO NOTHING — safe to re-run; it won't duplicate.
-- =====================================================================

insert into document_categories (name, description, sort_order) values
  ('ד"ר מתוקה הורביץ',          'שאלונים, אבחונים, ידע',              100),
  ('עדנה גלבוע',                'פסיכותרפיה',                          110),
  ('רבקה גורן',                  'גישור',                                120),
  ('היילי רוזנבלום',             'תרפיה באומנות',                       130),
  ('חמד מיידן',                  'תרפיה בקלפים',                        140),
  ('מיה',                        'דמיון מודרך',                          150),
  ('הרב גבירצמן',                'סדרת שיעורים מוקלטים',                160),
  ('יעל זלץ',                    'סדר וארגון',                          170),
  ('הרבנית גנחובסקי',            'הבית היהודי',                          180),
  ('הרבנית שמש',                 'הבית היהודית',                         190),
  ('חני שרלין',                  'שיווק ומכירות',                       200),
  ('פנחס הורביץ',                'קורסים מוקלטים',                       210),
  ('נחמה שלזינגר',               'ייעוץ נישואין',                       220),
  ('הרבנית ריבה לפידות',         null,                                   230),
  ('ד"ר אדאהן מרים',             'א.מ.ת.',                               240),
  ('הרב חנוך סגל',               '10 דרכים למימוש עצמי',                250),
  ('הרב בויאר - ויועצנו כבתחילה', null,                                  260),
  ('הרב בויאר - הטיפול היהודי',  null,                                   270)
on conflict do nothing;

-- =====================================================================
-- OPTIONAL: remove the original default categories if you don't need them
-- (only run these if those categories are empty — the DELETE API blocks
-- deleting non-empty categories anyway).
-- =====================================================================
-- delete from document_categories where name in ('שדה חמד', 'אבחונים', 'שונות');
-- NOTE: 'כללי' is protected — the app forbids deleting it; leave it alone.
