const { Client } = require('pg');

const client = new Client({
    host: '43.134.134.169',
    port: 5432,
    user: 'daftarkitab',
    password: 'postgres',
    database: 'daftarkitab'
});

const sql = `
-- Drop existing e-commerce tables if they exist
DROP TABLE IF EXISTS shipment_tracking_history CASCADE;
DROP TABLE IF EXISTS shipments CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS cart_items CASCADE;
DROP TABLE IF EXISTS carts CASCADE;

-- Revert books table
ALTER TABLE books DROP COLUMN IF EXISTS stock;
ALTER TABLE books DROP COLUMN IF EXISTS weight_grams;

-- Create Products table (Physical Store)
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(12, 2) NOT NULL,
    stock INTEGER DEFAULT 0,
    weight_grams INTEGER DEFAULT 0,
    cover_image_url VARCHAR(255),
    publisher VARCHAR(255),
    isbn VARCHAR(50),
    linked_book_id TEXT REFERENCES books(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Recreate Carts table
CREATE TABLE IF NOT EXISTS carts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Recreate Cart Items referencing products
CREATE TABLE IF NOT EXISTS cart_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cart_id UUID REFERENCES carts(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER DEFAULT 1,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Recreate Orders table
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(100) UNIQUE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    total_price DECIMAL(12, 2) NOT NULL,
    shipping_cost DECIMAL(12, 2) NOT NULL,
    grand_total DECIMAL(12, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    shipping_address_id UUID REFERENCES user_addresses(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Recreate Order Items referencing products
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    quantity INTEGER NOT NULL,
    price_at_purchase DECIMAL(12, 2) NOT NULL
);

-- Recreate Payments table
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    payment_method VARCHAR(100),
    payment_gateway_ref VARCHAR(255),
    amount DECIMAL(12, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    paid_at TIMESTAMP
);

-- Recreate Shipments table
CREATE TABLE IF NOT EXISTS shipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    courier_name VARCHAR(100),
    courier_service VARCHAR(100),
    tracking_number VARCHAR(100),
    shipped_at TIMESTAMP,
    estimated_delivery DATE,
    status VARCHAR(50) DEFAULT 'preparing'
);

-- Recreate Shipment Tracking History table
CREATE TABLE IF NOT EXISTS shipment_tracking_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id UUID REFERENCES shipments(id) ON DELETE CASCADE,
    status_description TEXT,
    location VARCHAR(255),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

async function run() {
    await client.connect();
    
    try {
        console.log('Running revised migrations...');
        await client.query(sql);
        console.log('Revised e-commerce schema integrated successfully!');
    } catch (err) {
        console.error('Error during migration:', err.message);
    } finally {
        await client.end();
    }
}

run();
