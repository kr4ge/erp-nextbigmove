DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum enum_value
    JOIN pg_type enum_type
      ON enum_type.oid = enum_value.enumtypid
    WHERE enum_type.typname = 'WmsInventoryMovementType'
      AND enum_value.enumlabel = 'DISPATCH'
  ) THEN
    ALTER TYPE "WmsInventoryMovementType" ADD VALUE 'DISPATCH';
  END IF;
END $$;
