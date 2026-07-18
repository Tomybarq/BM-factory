-- Create User table
CREATE TABLE IF NOT EXISTS "User" (
    id UUID PRIMARY KEY,
    role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'production_manager', 'accountant', 'viewer')),
    full_name TEXT,
    email TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create RawMaterial table
CREATE TABLE IF NOT EXISTS "RawMaterial" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    category TEXT,
    unit TEXT NOT NULL CHECK (unit IN ('كجم', 'لتر', 'وحدة')),
    purchase_price NUMERIC NOT NULL,
    supplier TEXT,
    notes TEXT,
    price_history JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create PackagingCost table
CREATE TABLE IF NOT EXISTS "PackagingCost" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    size TEXT NOT NULL UNIQUE CHECK (size IN ('5 لتر', '2 لتر', '1.5 لتر', '750 مل')),
    bottle_cost NUMERIC NOT NULL DEFAULT 0,
    cap_cost NUMERIC NOT NULL DEFAULT 0,
    label_cost NUMERIC NOT NULL DEFAULT 0,
    carton_cost NUMERIC NOT NULL DEFAULT 0,
    operational_cost NUMERIC NOT NULL DEFAULT 0,
    transportation_cost NUMERIC NOT NULL DEFAULT 0,
    miscellaneous_cost NUMERIC NOT NULL DEFAULT 0
);

-- Create Product table
CREATE TABLE IF NOT EXISTS "Product" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    category TEXT,
    notes TEXT,
    updated_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create ProductFormula table
CREATE TABLE IF NOT EXISTS "ProductFormula" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES "Product"(id) ON DELETE CASCADE,
    product_name TEXT NOT NULL,
    version TEXT NOT NULL DEFAULT '1.0',
    ingredients JSONB NOT NULL DEFAULT '[]'::jsonb,
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    updated_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create ManualCost table
CREATE TABLE IF NOT EXISTS "ManualCost" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    default_amount NUMERIC NOT NULL DEFAULT 0,
    category TEXT
);

-- Create Calculation table
CREATE TABLE IF NOT EXISTS "Calculation" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID,
    product_name TEXT NOT NULL,
    formula_id UUID,
    packaging_size TEXT NOT NULL,
    volume_liters NUMERIC NOT NULL,
    raw_material_cost NUMERIC NOT NULL DEFAULT 0,
    packaging_cost NUMERIC NOT NULL DEFAULT 0,
    manual_cost NUMERIC NOT NULL DEFAULT 0,
    total_cost NUMERIC NOT NULL DEFAULT 0,
    cost_per_liter NUMERIC NOT NULL DEFAULT 0,
    manual_costs JSONB NOT NULL DEFAULT '[]'::jsonb,
    ingredients_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
    notes TEXT,
    created_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create ProductionOrder table
CREATE TABLE IF NOT EXISTS "ProductionOrder" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number TEXT,
    product_id UUID,
    product_name TEXT NOT NULL,
    quantity NUMERIC NOT NULL DEFAULT 1,
    packaging_size TEXT,
    status TEXT NOT NULL DEFAULT 'preparing' CHECK (status IN ('preparing', 'packaging', 'shipping', 'done')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    notes TEXT,
    due_date TEXT,
    updated_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create GoogleSheetsConfig table
CREATE TABLE IF NOT EXISTS "GoogleSheetsConfig" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prices_spreadsheet_id TEXT NOT NULL,
    prices_sheet_name TEXT NOT NULL DEFAULT 'أسعار المواد',
    reports_spreadsheet_id TEXT NOT NULL,
    reports_sheet_name TEXT NOT NULL DEFAULT 'التقارير',
    auto_sync_enabled BOOLEAN NOT NULL DEFAULT FALSE
);

-- Enable RLS Policies on User table (matching RBAC)
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access for authenticated users on User" 
ON "User" FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow all access for admin and production managers on User" 
ON "User" FOR ALL TO authenticated 
USING (
    auth.jwt() ->> 'email' IN (
        SELECT email FROM "User" WHERE role IN ('admin', 'production_manager')
    )
);

-- Enable Realtime for ProductionOrder table
ALTER PUBLICATION supabase_realtime ADD TABLE "ProductionOrder";

-- Seed default admin user (matched by email)
INSERT INTO "User" (id, role, email, full_name)
VALUES ('00000000-0000-0000-0000-000000000000', 'admin', 'tomyalkethiri@gmail.com', 'مدير النظام')
ON CONFLICT (id) DO UPDATE SET role = 'admin', email = 'tomyalkethiri@gmail.com';

-- Create SyncLog table for operations tracking
CREATE TABLE IF NOT EXISTS "SyncLog" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL CHECK (action IN ('sync', 'export')),
    status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
    summary TEXT,
    error_details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
