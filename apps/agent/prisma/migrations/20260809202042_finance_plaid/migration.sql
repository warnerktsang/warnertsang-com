-- CreateTable
CREATE TABLE "finance_connections" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "encryptedAccessToken" TEXT NOT NULL,
    "institutionId" TEXT,
    "institutionName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'connected',
    "lastSyncedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finance_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_accounts" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "officialName" TEXT,
    "mask" TEXT,
    "type" TEXT NOT NULL,
    "subtype" TEXT,
    "isoCurrencyCode" TEXT,
    "currentBalance" DECIMAL(65,30),
    "availableBalance" DECIMAL(65,30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finance_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_transactions" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerTransactionId" TEXT NOT NULL,
    "pendingTransactionId" TEXT,
    "name" TEXT NOT NULL,
    "merchantName" TEXT,
    "originalDescription" TEXT,
    "amount" DECIMAL(65,30) NOT NULL,
    "isoCurrencyCode" TEXT,
    "postedAt" TIMESTAMP(3) NOT NULL,
    "authorizedAt" TIMESTAMP(3),
    "pending" BOOLEAN NOT NULL DEFAULT false,
    "paymentChannel" TEXT,
    "category" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finance_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_sync_runs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "requestedStart" TIMESTAMP(3) NOT NULL,
    "requestedEnd" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "transactionsSeen" INTEGER NOT NULL DEFAULT 0,
    "transactionsSaved" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "finance_sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "finance_connections_userId_idx" ON "finance_connections"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "finance_connections_userId_provider_key" ON "finance_connections"("userId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "finance_connections_provider_itemId_key" ON "finance_connections"("provider", "itemId");

-- CreateIndex
CREATE INDEX "finance_accounts_connectionId_idx" ON "finance_accounts"("connectionId");

-- CreateIndex
CREATE UNIQUE INDEX "finance_accounts_connectionId_providerAccountId_key" ON "finance_accounts"("connectionId", "providerAccountId");

-- CreateIndex
CREATE INDEX "finance_transactions_accountId_postedAt_idx" ON "finance_transactions"("accountId", "postedAt");

-- CreateIndex
CREATE INDEX "finance_transactions_postedAt_idx" ON "finance_transactions"("postedAt");

-- CreateIndex
CREATE UNIQUE INDEX "finance_transactions_accountId_providerTransactionId_key" ON "finance_transactions"("accountId", "providerTransactionId");

-- CreateIndex
CREATE INDEX "finance_sync_runs_userId_startedAt_idx" ON "finance_sync_runs"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "finance_sync_runs_connectionId_startedAt_idx" ON "finance_sync_runs"("connectionId", "startedAt");

-- AddForeignKey
ALTER TABLE "finance_connections" ADD CONSTRAINT "finance_connections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_accounts" ADD CONSTRAINT "finance_accounts_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "finance_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_transactions" ADD CONSTRAINT "finance_transactions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "finance_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_sync_runs" ADD CONSTRAINT "finance_sync_runs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_sync_runs" ADD CONSTRAINT "finance_sync_runs_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "finance_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
