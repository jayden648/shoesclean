-- 0001_create_services.sql
CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    price INTEGER NOT NULL, -- Harga dalam rupiah (integer untuk menghindari floating point issues)
    duration_minutes INTEGER DEFAULT 60,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample data
INSERT INTO services (name, description, price, duration_minutes) VALUES
('Deep Clean Premium', 'Pembersihan mendalam dengan teknologi terbaru dan produk premium untuk hasil maksimal', 75000, 90),
('Quick Clean Express', 'Pembersihan cepat untuk sepatu harian dengan hasil yang memuaskan', 35000, 30),
('Leather Care Specialist', 'Perawatan khusus untuk sepatu kulit dengan produk berkualitas tinggi', 95000, 120),
('Whitening Treatment', 'Treatment khusus untuk mengembalikan warna putih sepatu seperti baru', 55000, 60),
('Waterproof Protection', 'Perlindungan anti air dengan coating khusus untuk sepatu outdoor', 45000, 45),
('Complete Restoration', 'Restorasi lengkap untuk sepatu kesayangan yang sudah lama tidak dirawat', 125000, 150);