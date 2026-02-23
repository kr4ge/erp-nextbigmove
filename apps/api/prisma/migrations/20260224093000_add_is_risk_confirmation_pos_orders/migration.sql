ALTER TABLE "pos_orders"
ADD COLUMN "isRiskConfirmation" BOOLEAN NOT NULL DEFAULT false;

UPDATE "pos_orders" p
SET "isRiskConfirmation" = (
  EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(p."tags", '[]'::jsonb)) AS tag(value)
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
    ) = 'risk confirmation'
  )
  AND COALESCE(
    jsonb_path_exists(COALESCE(p."statusHistory", '[]'::jsonb), '$[*] ? (@.status == 1)'),
    false
  )
);

CREATE INDEX IF NOT EXISTS "pos_orders_tenant_team_date_risk_confirmation_idx"
ON "pos_orders" ("tenantId", "teamId", "dateLocal", "isRiskConfirmation");
