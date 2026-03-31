-- CreateEnum
CREATE TYPE "vendor_trade_type" AS ENUM ('STRUCTURAL', 'ARCHITECTURAL', 'MEP', 'CIVIL', 'FINISHES', 'OTHER');

-- CreateEnum
CREATE TYPE "project_status" AS ENUM ('PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "purchase_order_status" AS ENUM ('DRAFT', 'ISSUED', 'PARTIALLY_RECEIVED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "material_status" AS ENUM ('ORDERED', 'RELEASED', 'SHIPPED', 'DELIVERED', 'INSTALLED', 'REJECTED');

-- CreateEnum
CREATE TYPE "shop_drawing_status" AS ENUM ('NOT_REQUIRED', 'NOT_SUBMITTED', 'SUBMITTED', 'APPROVED', 'REJECTED', 'REVISION_REQUIRED');

-- CreateEnum
CREATE TYPE "system_category" AS ENUM ('MECHANICAL', 'ELECTRICAL', 'PLUMBING', 'STRUCTURAL', 'ARCHITECTURAL', 'CIVIL', 'FIRE_PROTECTION', 'OTHER');

-- CreateEnum
CREATE TYPE "submittal_status" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'REVISE_AND_RESUBMIT');

-- CreateEnum
CREATE TYPE "rfi_status" AS ENUM ('DRAFT', 'SUBMITTED', 'ANSWERED', 'CLOSED');

-- CreateEnum
CREATE TYPE "employee_position" AS ENUM ('PROJECT_MANAGER', 'PROJECT_ENGINEER', 'SITE_SUPERVISOR', 'COORDINATOR', 'QA_QC_ENGINEER', 'SAFETY_OFFICER', 'STOREKEEPER', 'ADMIN');

-- CreateEnum
CREATE TYPE "employee_role" AS ENUM ('COMPANY_MANAGER', 'PROJECT_MANAGER', 'PROJECT_ENGINEER', 'SITE_SUPERVISOR', 'COORDINATOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "module_access" AS ENUM ('MATERIALS', 'SUBMITTALS', 'RFIS', 'ALL');

-- CreateTable
CREATE TABLE "vendors" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "contactPerson" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "address" TEXT,
    "taxId" TEXT,
    "notes" TEXT,
    "isSubcontractor" BOOLEAN NOT NULL DEFAULT false,
    "tradeType" "vendor_trade_type" NOT NULL DEFAULT 'OTHER',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "projectNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "description" TEXT,
    "totalValue" DOUBLE PRECISION NOT NULL,
    "laborHours" DOUBLE PRECISION,
    "laborValue" DOUBLE PRECISION,
    "materialCost" DOUBLE PRECISION,
    "miscCost" DOUBLE PRECISION,
    "durationDays" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3),
    "finishDate" TIMESTAMP(3),
    "actualStartDate" TIMESTAMP(3),
    "actualFinishDate" TIMESTAMP(3),
    "status" "project_status" NOT NULL DEFAULT 'PLANNING',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL,
    "poNumber" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "poDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "status" "purchase_order_status" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "materials" (
    "id" TEXT NOT NULL,
    "poId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "unitPrice" DOUBLE PRECISION,
    "totalPrice" DOUBLE PRECISION,
    "status" "material_status" NOT NULL DEFAULT 'ORDERED',
    "releasedDate" TIMESTAMP(3),
    "leadTimeDays" INTEGER,
    "expectedDeliveryDate" TIMESTAMP(3),
    "actualDeliveryDate" TIMESTAMP(3),
    "shopDrawingStatus" "shop_drawing_status" NOT NULL DEFAULT 'NOT_SUBMITTED',
    "shopDrawingFileUrl" TEXT,
    "proofOfDeliveryFileUrl" TEXT,
    "testReportFileUrl" TEXT,
    "manualFileUrl" TEXT,
    "location" TEXT,
    "drawingReference" TEXT,
    "systemCategory" "system_category" NOT NULL DEFAULT 'OTHER',
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submittals" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "submittalNumber" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "submittal_status" NOT NULL DEFAULT 'DRAFT',
    "submittedDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "approvedDate" TIMESTAMP(3),
    "attachment1Url" TEXT,
    "attachment2Url" TEXT,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "parentSubmittalId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "submittals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rfis" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "rfiNumber" TEXT NOT NULL,
    "dateRaised" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "question" TEXT NOT NULL,
    "response" TEXT,
    "responseDate" TIMESTAMP(3),
    "status" "rfi_status" NOT NULL DEFAULT 'DRAFT',
    "attachment1Url" TEXT,
    "attachment2Url" TEXT,
    "raisedById" TEXT NOT NULL,
    "respondedById" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rfis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "position" "employee_position" NOT NULL,
    "role" "employee_role" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_assignments" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "positionInProject" TEXT,
    "moduleAccess" "module_access" NOT NULL DEFAULT 'ALL',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedById" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "oldValues" JSONB,
    "newValues" JSONB,
    "ipAddress" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "projects_projectNumber_key" ON "projects"("projectNumber");

-- CreateIndex
CREATE INDEX "projects_projectNumber_idx" ON "projects"("projectNumber");

-- CreateIndex
CREATE INDEX "projects_status_idx" ON "projects"("status");

-- CreateIndex
CREATE INDEX "projects_startDate_idx" ON "projects"("startDate");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_poNumber_key" ON "purchase_orders"("poNumber");

-- CreateIndex
CREATE INDEX "purchase_orders_poNumber_idx" ON "purchase_orders"("poNumber");

-- CreateIndex
CREATE INDEX "purchase_orders_vendorId_idx" ON "purchase_orders"("vendorId");

-- CreateIndex
CREATE INDEX "purchase_orders_projectId_idx" ON "purchase_orders"("projectId");

-- CreateIndex
CREATE INDEX "purchase_orders_status_idx" ON "purchase_orders"("status");

-- CreateIndex
CREATE INDEX "materials_poId_idx" ON "materials"("poId");

-- CreateIndex
CREATE INDEX "materials_projectId_idx" ON "materials"("projectId");

-- CreateIndex
CREATE INDEX "materials_vendorId_idx" ON "materials"("vendorId");

-- CreateIndex
CREATE INDEX "materials_status_idx" ON "materials"("status");

-- CreateIndex
CREATE INDEX "materials_systemCategory_idx" ON "materials"("systemCategory");

-- CreateIndex
CREATE INDEX "materials_expectedDeliveryDate_idx" ON "materials"("expectedDeliveryDate");

-- CreateIndex
CREATE INDEX "submittals_projectId_idx" ON "submittals"("projectId");

-- CreateIndex
CREATE INDEX "submittals_status_idx" ON "submittals"("status");

-- CreateIndex
CREATE INDEX "submittals_submittalNumber_idx" ON "submittals"("submittalNumber");

-- CreateIndex
CREATE UNIQUE INDEX "submittals_projectId_submittalNumber_key" ON "submittals"("projectId", "submittalNumber");

-- CreateIndex
CREATE INDEX "rfis_projectId_idx" ON "rfis"("projectId");

-- CreateIndex
CREATE INDEX "rfis_status_idx" ON "rfis"("status");

-- CreateIndex
CREATE INDEX "rfis_rfiNumber_idx" ON "rfis"("rfiNumber");

-- CreateIndex
CREATE UNIQUE INDEX "rfis_projectId_rfiNumber_key" ON "rfis"("projectId", "rfiNumber");

-- CreateIndex
CREATE UNIQUE INDEX "employees_email_key" ON "employees"("email");

-- CreateIndex
CREATE INDEX "employees_email_idx" ON "employees"("email");

-- CreateIndex
CREATE INDEX "employees_role_idx" ON "employees"("role");

-- CreateIndex
CREATE INDEX "employees_isActive_idx" ON "employees"("isActive");

-- CreateIndex
CREATE INDEX "project_assignments_employeeId_idx" ON "project_assignments"("employeeId");

-- CreateIndex
CREATE INDEX "project_assignments_projectId_idx" ON "project_assignments"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "project_assignments_employeeId_projectId_key" ON "project_assignments"("employeeId", "projectId");

-- CreateIndex
CREATE INDEX "activity_logs_userId_idx" ON "activity_logs"("userId");

-- CreateIndex
CREATE INDEX "activity_logs_entityType_idx" ON "activity_logs"("entityType");

-- CreateIndex
CREATE INDEX "activity_logs_entityId_idx" ON "activity_logs"("entityId");

-- CreateIndex
CREATE INDEX "activity_logs_createdAt_idx" ON "activity_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_poId_fkey" FOREIGN KEY ("poId") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submittals" ADD CONSTRAINT "submittals_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submittals" ADD CONSTRAINT "submittals_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submittals" ADD CONSTRAINT "submittals_parentSubmittalId_fkey" FOREIGN KEY ("parentSubmittalId") REFERENCES "submittals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfis" ADD CONSTRAINT "rfis_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfis" ADD CONSTRAINT "rfis_raisedById_fkey" FOREIGN KEY ("raisedById") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfis" ADD CONSTRAINT "rfis_respondedById_fkey" FOREIGN KEY ("respondedById") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_assignments" ADD CONSTRAINT "project_assignments_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_assignments" ADD CONSTRAINT "project_assignments_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_assignments" ADD CONSTRAINT "project_assignments_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
