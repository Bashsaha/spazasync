-- Migration 033 — Foreign-national compliance path corrections (Phase 43)
--
-- Two seed-data fixes that mirror scripts/seed-municipalities.ts:
--   1. Tshwane: the foreign-national trading_permit row claimed foreigners must
--      prove "R5 million capital investment". The Gauteng demand that foreign
--      spaza owners prove R5m was DECLARED UNLAWFUL by the courts, so that copy
--      was both wrong and misleading. Reword to the actual requirement: a
--      certified passport + valid permit (business visa / s22 asylum / s24
--      refugee).
--   2. Mangaung: previously had NO requirements rows, so a foreign-national
--      owner there saw no "what to bring" list at all. Add a minimal
--      trading_permit row carrying both nationality document rows.
--
-- Idempotent — safe to re-run (UPDATE is self-correcting; INSERT is guarded by
-- ON CONFLICT against the UNIQUE(municipality_id, requirement_type) constraint).

-- 1. Tshwane trading_permit documents_required reword
UPDATE municipality_requirements
SET documents_required = '[
  {"name": "Certified copy of SA ID", "applies_to": "sa_citizen", "required": true},
  {"name": "Certified copy of passport with a valid permit (not older than 3 months)", "applies_to": "foreign_national", "required": true, "notes": "Business visa OR Section 22 asylum seeker permit OR Section 24 refugee permit. (The Gauteng demand that foreign spaza owners prove R5 million was declared unlawful by the courts — it is NOT a registration requirement.)"},
  {"name": "Affidavit and certified ID of stand/erf owner", "applies_to": "all", "required": true, "notes": "Required if property is zoned as Residential 5"},
  {"name": "Proof of ownership or permission to use premises", "applies_to": "all", "required": true, "notes": "If City-owned property: Special Power of Attorney from City Manager through Group Property (Ou Raadsaal or Tshwane House)"}
]'::jsonb
WHERE municipality_id = (
  SELECT id FROM municipalities WHERE name = 'City of Tshwane' AND province = 'gauteng'
)
AND requirement_type = 'trading_permit';

-- 2. Mangaung trading_permit requirements (insert only if missing)
INSERT INTO municipality_requirements (municipality_id, requirement_type, documents_required)
SELECT m.id, 'trading_permit', '[
  {"name": "Certified copy of SA ID", "applies_to": "sa_citizen", "required": true},
  {"name": "Certified copy of passport with a valid permit (not older than 3 months)", "applies_to": "foreign_national", "required": true, "notes": "Business visa OR Section 22 asylum seeker permit OR Section 24 refugee permit."},
  {"name": "Proof of address / permission to use the premises", "applies_to": "all", "required": true},
  {"name": "Affidavit: not trading in illegal goods (stamped by a Commissioner of Oaths)", "applies_to": "all", "required": true}
]'::jsonb
FROM municipalities m
WHERE m.name = 'Mangaung Metropolitan Municipality' AND m.province = 'free_state'
ON CONFLICT (municipality_id, requirement_type) DO NOTHING;
