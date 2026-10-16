-- CreateEnum
CREATE TYPE "SymbolFileType" AS ENUM ('ANDROID_MAPPING', 'IOS_DSYM', 'ANDROID_NATIVE_LIB');

-- CreateTable
CREATE TABLE "symbol_files" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "type" "SymbolFileType" NOT NULL,
    "key" TEXT NOT NULL,
    "release" TEXT,
    "debug_id" TEXT,
    "name" TEXT,
    "arch" TEXT,
    "path" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "symbol_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "symbol_files_application_id_type_idx" ON "symbol_files"("application_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "symbol_files_application_id_key_key" ON "symbol_files"("application_id", "key");

-- AddForeignKey
ALTER TABLE "symbol_files" ADD CONSTRAINT "symbol_files_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

