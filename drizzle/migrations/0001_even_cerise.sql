ALTER TABLE "profiles" RENAME COLUMN "location_uk" TO "locations_uk";
ALTER TABLE "profiles" ALTER COLUMN "locations_uk" TYPE text[] USING
  CASE WHEN "locations_uk" IS NULL OR "locations_uk" = '' THEN NULL
       ELSE ARRAY["locations_uk"]
  END;