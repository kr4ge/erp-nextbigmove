-- RenameIndex
ALTER INDEX "mkt_kpi_targets_scope_team_metric_date_idx" RENAME TO "marketing_kpi_targets_tenantId_scopeType_teamCode_metricKey_idx";

-- RenameIndex
ALTER INDEX "mkt_kpi_targets_team_cat_metric_date_idx" RENAME TO "marketing_kpi_targets_tenantId_teamCode_category_metricKey__idx";

-- RenameIndex
ALTER INDEX "mkt_kpi_targets_user_metric_date_idx" RENAME TO "marketing_kpi_targets_tenantId_userId_metricKey_startDate_e_idx";

-- RenameIndex
ALTER INDEX "mkt_kpi_user_cat_cat_team_date_idx" RENAME TO "marketing_kpi_user_category_assignments_tenantId_category_t_idx";

-- RenameIndex
ALTER INDEX "mkt_kpi_user_cat_team_user_date_idx" RENAME TO "marketing_kpi_user_category_assignments_tenantId_teamCode_u_idx";
