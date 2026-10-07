-- CreateTable
CREATE TABLE "quirofanos_moviles" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL DEFAULT 'Quirófano Móvil',
    "direccion" TEXT NOT NULL,
    "barrio" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3) NOT NULL,
    "horario" TEXT,
    "informacion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quirofanos_moviles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "quirofanos_moviles_activo_idx" ON "quirofanos_moviles"("activo");

-- CreateIndex
CREATE INDEX "quirofanos_moviles_fechaInicio_idx" ON "quirofanos_moviles"("fechaInicio");

-- CreateIndex
CREATE INDEX "quirofanos_moviles_fechaFin_idx" ON "quirofanos_moviles"("fechaFin");
