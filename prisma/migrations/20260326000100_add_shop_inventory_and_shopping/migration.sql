CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "location" TEXT,
    "unit" TEXT NOT NULL,
    "currentQuantity" REAL NOT NULL DEFAULT 0,
    "minimumQuantity" REAL NOT NULL DEFAULT 0,
    "preferredBuyQuantity" REAL NOT NULL DEFAULT 1,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "ShoppingItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "inventoryItemId" TEXT,
    "name" TEXT NOT NULL,
    "quantity" REAL NOT NULL DEFAULT 1,
    "unit" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "store" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "purchasedAt" DATETIME,
    CONSTRAINT "ShoppingItem_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "InventoryItem_name_idx" ON "InventoryItem"("name");
CREATE INDEX "InventoryItem_category_idx" ON "InventoryItem"("category");
CREATE INDEX "InventoryItem_location_idx" ON "InventoryItem"("location");
CREATE INDEX "ShoppingItem_status_idx" ON "ShoppingItem"("status");
CREATE INDEX "ShoppingItem_inventoryItemId_idx" ON "ShoppingItem"("inventoryItemId");
CREATE INDEX "ShoppingItem_createdAt_idx" ON "ShoppingItem"("createdAt");
