-- CreateTable
CREATE TABLE "integration_shared_teams" (
    "id" UUID NOT NULL,
    "integrationId" UUID NOT NULL,
    "teamId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integration_shared_teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_shared_teams" (
    "id" UUID NOT NULL,
    "workflowId" UUID NOT NULL,
    "teamId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_shared_teams_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "integration_shared_teams_teamId_idx" ON "integration_shared_teams"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "integration_shared_teams_integrationId_teamId_key" ON "integration_shared_teams"("integrationId", "teamId");

-- CreateIndex
CREATE INDEX "workflow_shared_teams_teamId_idx" ON "workflow_shared_teams"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_shared_teams_workflowId_teamId_key" ON "workflow_shared_teams"("workflowId", "teamId");

-- AddForeignKey
ALTER TABLE "integration_shared_teams" ADD CONSTRAINT "integration_shared_teams_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_shared_teams" ADD CONSTRAINT "integration_shared_teams_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_shared_teams" ADD CONSTRAINT "workflow_shared_teams_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_shared_teams" ADD CONSTRAINT "workflow_shared_teams_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
