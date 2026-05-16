-- =====================================================
-- BillFlow - Seed Data (OTP auth, no subscription plans)
-- Run AFTER schema.sql
-- =====================================================

-- Admin user (logs in via OTP to admin@billflow.io)
INSERT INTO profiles (id, email, full_name, phone, role, is_active)
VALUES (
  'a1b2c3d4-0000-0000-0000-000000000001',
  'admin@billflow.io',
  'Super Admin',
  '+91 99999 00000',
  'super_admin',
  TRUE
);

-- Demo business owner (logs in via OTP to demo@billflow.io)
INSERT INTO profiles (id, email, full_name, phone, role, is_active)
VALUES (
  'a1b2c3d4-0000-0000-0000-000000000002',
  'demo@billflow.io',
  'Raj Kumar',
  '+91 98765 43210',
  'business_owner',
  TRUE
);

-- Business for demo user
INSERT INTO businesses (
  id, owner_id, name, slug, gst_number, pan_number,
  email, phone, address_line1, city, state, pincode,
  invoice_prefix, invoice_counter, invoice_notes, invoice_terms, currency
) VALUES (
  'b1b2c3d4-0000-0000-0000-000000000001',
  'a1b2c3d4-0000-0000-0000-000000000002',
  'Raj Traders Pvt Ltd',
  'raj-traders',
  '29AAAPL1234C1Z5',
  'AAAPL1234C',
  'billing@rajtraders.com',
  '+91 80 4567 8901',
  '42, MG Road, 3rd Floor',
  'Bangalore',
  'Karnataka',
  '560001',
  'RT',
  12,
  'Thank you for your business! Payment due within 30 days.',
  '1. Goods once sold will not be returned without prior approval.',
  'INR'
);

-- Products
INSERT INTO products (id, business_id, name, sku, unit, price, cost_price, gst_percentage, hsn_code, stock_quantity, low_stock_threshold) VALUES
('c1000001-0000-0000-0000-000000000001', 'b1b2c3d4-0000-0000-0000-000000000001', 'Dell Laptop i5 8GB', 'DELL-LAP-001', 'pcs', 75000.00, 62000.00, 18, '84713010', 15, 3),
('c1000001-0000-0000-0000-000000000002', 'b1b2c3d4-0000-0000-0000-000000000001', 'HP LaserJet Printer', 'HP-LJ-001', 'pcs', 22500.00, 18000.00, 18, '84433100', 8, 2),
('c1000001-0000-0000-0000-000000000003', 'b1b2c3d4-0000-0000-0000-000000000001', 'Annual IT Support', 'SVC-IT-ANN', 'pcs', 36000.00, NULL, 18, '99831190', 0, 0),
('c1000001-0000-0000-0000-000000000004', 'b1b2c3d4-0000-0000-0000-000000000001', 'Kingston 8GB RAM', 'MEM-8GB-001', 'pcs', 2200.00, 1800.00, 18, '84735000', 42, 10),
('c1000001-0000-0000-0000-000000000005', 'b1b2c3d4-0000-0000-0000-000000000001', 'Samsung 1TB SSD', 'SSD-1TB-001', 'pcs', 6500.00, 5200.00, 18, '84717090', 28, 5);

-- Customers
INSERT INTO customers (id, business_id, name, email, phone, gst_number, city, state, total_purchases, invoice_count) VALUES
('d1000001-0000-0000-0000-000000000001', 'b1b2c3d4-0000-0000-0000-000000000001', 'TechCorp Solutions', 'accounts@techcorp.in', '+91 80 4123 5678', '29AABCT1234A1Z0', 'Bangalore', 'Karnataka', 145000.00, 4),
('d1000001-0000-0000-0000-000000000002', 'b1b2c3d4-0000-0000-0000-000000000001', 'Priya Sharma', 'priya@gmail.com', '+91 98456 78901', NULL, 'Bangalore', 'Karnataka', 75000.00, 2),
('d1000001-0000-0000-0000-000000000003', 'b1b2c3d4-0000-0000-0000-000000000001', 'Kumar Associates', 'billing@kumar.com', '+91 44 2345 6789', '33AABCK9876B1Z1', 'Chennai', 'Tamil Nadu', 58000.00, 3),
('d1000001-0000-0000-0000-000000000004', 'b1b2c3d4-0000-0000-0000-000000000001', 'Amit Verma', 'amit@company.com', '+91 95678 12340', NULL, 'Noida', 'Uttar Pradesh', 36000.00, 2);

-- Sample invoices
INSERT INTO invoices (
  id, business_id, customer_id, invoice_number, status, payment_status,
  invoice_date, subtotal, cgst_amount, sgst_amount, total_tax, grand_total,
  amount_paid, amount_due, customer_name, customer_phone
) VALUES
(
  'e1000001-0000-0000-0000-000000000001',
  'b1b2c3d4-0000-0000-0000-000000000001',
  'd1000001-0000-0000-0000-000000000001',
  'RT-0001', 'sent', 'paid',
  NOW() - INTERVAL '25 days',
  63559.32, 5720.34, 5720.34, 11440.68, 75000.00, 75000.00, 0,
  'TechCorp Solutions', '+91 80 4123 5678'
),
(
  'e1000001-0000-0000-0000-000000000002',
  'b1b2c3d4-0000-0000-0000-000000000001',
  'd1000001-0000-0000-0000-000000000002',
  'RT-0002', 'sent', 'pending',
  NOW() - INTERVAL '10 days',
  63559.32, 5720.34, 5720.34, 11440.68, 75000.00, 0, 75000.00,
  'Priya Sharma', '+91 98456 78901'
),
(
  'e1000001-0000-0000-0000-000000000003',
  'b1b2c3d4-0000-0000-0000-000000000001',
  'd1000001-0000-0000-0000-000000000003',
  'RT-0003', 'sent', 'overdue',
  NOW() - INTERVAL '45 days',
  4915.25, 442.37, 442.37, 884.74, 5800.00, 0, 5800.00,
  'Kumar Associates', '+91 44 2345 6789'
);

-- Invoice items for RT-0001
INSERT INTO invoice_items (invoice_id, product_id, product_name, unit, quantity, unit_price, taxable_amount, gst_percentage, cgst_percentage, sgst_percentage, tax_amount, total_amount, sort_order) VALUES
('e1000001-0000-0000-0000-000000000001', 'c1000001-0000-0000-0000-000000000001', 'Dell Laptop i5 8GB', 'pcs', 1, 75000.00, 63559.32, 18, 9, 9, 11440.68, 75000.00, 0);

-- Invoice items for RT-0002
INSERT INTO invoice_items (invoice_id, product_id, product_name, unit, quantity, unit_price, taxable_amount, gst_percentage, cgst_percentage, sgst_percentage, tax_amount, total_amount, sort_order) VALUES
('e1000001-0000-0000-0000-000000000002', 'c1000001-0000-0000-0000-000000000001', 'Dell Laptop i5 8GB', 'pcs', 1, 75000.00, 63559.32, 18, 9, 9, 11440.68, 75000.00, 0);

-- Invoice items for RT-0003
INSERT INTO invoice_items (invoice_id, product_id, product_name, unit, quantity, unit_price, taxable_amount, gst_percentage, cgst_percentage, sgst_percentage, tax_amount, total_amount, sort_order) VALUES
('e1000001-0000-0000-0000-000000000003', 'c1000001-0000-0000-0000-000000000004', 'Kingston 8GB RAM', 'pcs', 2, 2200.00, 3728.81, 18, 9, 9, 671.19, 4400.00, 0);

SELECT 'Profiles' AS tbl, COUNT(*) FROM profiles
UNION ALL SELECT 'Businesses', COUNT(*) FROM businesses
UNION ALL SELECT 'Products', COUNT(*) FROM products
UNION ALL SELECT 'Customers', COUNT(*) FROM customers
UNION ALL SELECT 'Invoices', COUNT(*) FROM invoices
UNION ALL SELECT 'Invoice Items', COUNT(*) FROM invoice_items;
