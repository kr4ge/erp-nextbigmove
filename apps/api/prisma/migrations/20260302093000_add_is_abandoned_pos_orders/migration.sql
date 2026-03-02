ALTER TABLE "pos_orders"
ADD COLUMN "isAbandoned" BOOLEAN NOT NULL DEFAULT false;

UPDATE "pos_orders" p
SET "isAbandoned" = (
  COALESCE(p."status", -1) = 0
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(p."tags") = 'array' THEN p."tags"
        ELSE '[]'::jsonb
      END
    ) AS tag(value)
    WHERE LOWER(
      NULLIF(
        BTRIM(
          REGEXP_REPLACE(
            COALESCE(
              CASE
                WHEN jsonb_typeof(tag.value) = 'object' THEN tag.value->>'name'
                WHEN jsonb_typeof(tag.value) = 'string' THEN trim(BOTH '"' FROM tag.value::text)
                ELSE ''
              END,
              ''
            ),
            '\s+',
            ' ',
            'g'
          )
        ),
        ''
      )
    ) = 'abandoned'
  )
);
