-- Migration: section_blocks
-- 1. Create the SectionBlock table
CREATE TABLE "SectionBlock" (
    "id"        SERIAL       NOT NULL,
    "sectionId" INTEGER      NOT NULL,
    "type"      TEXT         NOT NULL,
    "order"     INTEGER      NOT NULL DEFAULT 0,
    "data"      JSONB        NOT NULL DEFAULT '{}',
    CONSTRAINT "SectionBlock_pkey" PRIMARY KEY ("id")
);

-- 2. Foreign key + index
ALTER TABLE "SectionBlock"
    ADD CONSTRAINT "SectionBlock_sectionId_fkey"
    FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "SectionBlock_sectionId_order_idx"
    ON "SectionBlock"("sectionId", "order");

-- 3. Migrate existing body text into TEXT blocks (only when at least one is non-empty)
INSERT INTO "SectionBlock" ("sectionId", "type", "order", "data")
SELECT
    "id",
    'TEXT',
    0,
    jsonb_build_object('textAr', "bodyAr", 'textEn', "bodyEn")
FROM "Section"
WHERE "bodyAr" <> '' OR "bodyEn" <> '';

-- 4. Drop old body columns
ALTER TABLE "Section" DROP COLUMN "bodyAr";
ALTER TABLE "Section" DROP COLUMN "bodyEn";
