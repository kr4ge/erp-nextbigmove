DO $$
BEGIN
  IF to_regclass('public.mkt_kpi_targets_scope_team_metric_date_idx') IS NOT NULL
     AND to_regclass('public.marketing_kpi_targets_tenantId_scopeType_teamCode_metricKey_idx') IS NULL THEN
    ALTER INDEX "mkt_kpi_targets_scope_team_metric_date_idx"
      RENAME TO "marketing_kpi_targets_tenantId_scopeType_teamCode_metricKey_idx";
  END IF;

  IF to_regclass('public.mkt_kpi_targets_team_cat_metric_date_idx') IS NOT NULL
     AND to_regclass('public.marketing_kpi_targets_tenantId_teamCode_category_metricKey__idx') IS NULL THEN
    ALTER INDEX "mkt_kpi_targets_team_cat_metric_date_idx"
      RENAME TO "marketing_kpi_targets_tenantId_teamCode_category_metricKey__idx";
  END IF;

  IF to_regclass('public.mkt_kpi_targets_user_metric_date_idx') IS NOT NULL
     AND to_regclass('public.marketing_kpi_targets_tenantId_userId_metricKey_startDate_e_idx') IS NULL THEN
    ALTER INDEX "mkt_kpi_targets_user_metric_date_idx"
      RENAME TO "marketing_kpi_targets_tenantId_userId_metricKey_startDate_e_idx";
  END IF;

  IF to_regclass('public.mkt_kpi_user_cat_cat_team_date_idx') IS NOT NULL
     AND to_regclass('public.marketing_kpi_user_category_assignments_tenantId_category_t_idx') IS NULL THEN
    ALTER INDEX "mkt_kpi_user_cat_cat_team_date_idx"
      RENAME TO "marketing_kpi_user_category_assignments_tenantId_category_t_idx";
  END IF;

  IF to_regclass('public.mkt_kpi_user_cat_team_user_date_idx') IS NOT NULL
     AND to_regclass('public.marketing_kpi_user_category_assignments_tenantId_teamCode_u_idx') IS NULL THEN
    ALTER INDEX "mkt_kpi_user_cat_team_user_date_idx"
      RENAME TO "marketing_kpi_user_category_assignments_tenantId_teamCode_u_idx";
  END IF;
END $$;
