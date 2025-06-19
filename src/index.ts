// index.ts - Enhanced Backend with CORS Fix
import { Hono } from 'hono';
import { cors } from 'hono/cors';

export interface Env {
  DB: D1Database;
}

const app = new Hono<{ Bindings: Env }>();

// CORS Middleware - Perbaikan untuk allow semua origins
app.use('/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Helper function untuk validasi ID
const validateId = (id: string): number => {
  const numId = parseInt(id);
  if (isNaN(numId) || numId <= 0) {
    throw new Error('Invalid ID format');
  }
  return numId;
};

// Helper function untuk validasi service data
const validateServiceData = (data: any) => {
  const { name, price } = data;
  
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw new Error('Name is required and must be a non-empty string');
  }
  
  if (price === undefined || price === null || typeof price !== 'number' || price < 0) {
    throw new Error('Price is required and must be a non-negative number');
  }
  
  return {
    name: name.trim(),
    description: data.description?.trim() || null,
    price: price,
    duration_minutes: data.duration_minutes && data.duration_minutes > 0 ? data.duration_minutes : null
  };
};

// Helper function untuk konversi tipe data dari database
const safeNumber = (value: any): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string') return parseInt(value) || 0;
  return 0;
};

// GET - Mendapatkan semua layanan dengan pagination dan search
app.get('/api/services', async (c) => {
  try {
    // Query parameters
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '10');
    const search = c.req.query('search')?.trim() || '';
    const sortBy = c.req.query('sortBy') || 'id';
    const sortOrder = c.req.query('sortOrder') || 'asc';
    
    // Validasi parameters
    if (page < 1 || limit < 1 || limit > 100) {
      return c.json({ success: false, error: 'Invalid pagination parameters' }, 400);
    }
    
    const validSortColumns = ['id', 'name', 'price', 'duration_minutes', 'created_at'];
    if (!validSortColumns.includes(sortBy)) {
      return c.json({ success: false, error: 'Invalid sort column' }, 400);
    }
    
    const validSortOrders = ['asc', 'desc'];
    if (!validSortOrders.includes(sortOrder.toLowerCase())) {
      return c.json({ success: false, error: 'Invalid sort order' }, 400);
    }

    const offset = (page - 1) * limit;
    
    // Build query dengan search
    let whereClause = '';
    let countWhereClause = '';
    const params: any[] = [];
    const countParams: any[] = [];
    
    if (search) {
      whereClause = 'WHERE name LIKE ? OR description LIKE ?';
      countWhereClause = 'WHERE name LIKE ? OR description LIKE ?';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern);
      countParams.push(searchPattern, searchPattern);
    }
    
    // Query untuk mendapatkan total count
    const countQuery = `SELECT COUNT(*) as total FROM services ${countWhereClause}`;
    const countResult = await c.env.DB.prepare(countQuery).bind(...countParams).first();
    
    // FIX: Konversi total ke number yang aman
    const total = safeNumber(countResult?.total);
    
    // Query untuk mendapatkan data dengan pagination
    const dataQuery = `
      SELECT id, name, description, price, duration_minutes, created_at 
      FROM services 
      ${whereClause}
      ORDER BY ${sortBy} ${sortOrder.toUpperCase()}
      LIMIT ? OFFSET ?
    `;
    
    params.push(limit, offset);
    const { results } = await c.env.DB.prepare(dataQuery).bind(...params).all();
    
    // Hitung pagination info - sekarang aman karena total sudah number
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;
    
    return c.json({
      success: true,
      services: results,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: total,
        itemsPerPage: limit,
        hasNextPage,
        hasPrevPage
      },
      search: search || null,
      sort: {
        sortBy,
        sortOrder
      }
    });
    
  } catch (e: any) {
    console.error("Error fetching services:", e.message);
    return c.json({ success: false, error: e.message }, 500);
  }
});

// GET - Mendapatkan layanan berdasarkan ID
app.get('/api/services/:id', async (c) => {
  try {
    const id = validateId(c.req.param('id'));
    
    const result = await c.env.DB.prepare(
      'SELECT id, name, description, price, duration_minutes, created_at FROM services WHERE id = ?'
    ).bind(id).first();
    
    if (!result) {
      return c.json({ success: false, error: 'Service not found' }, 404);
    }
    
    return c.json({ success: true, service: result });
    
  } catch (e: any) {
    console.error("Error fetching service:", e.message);
    return c.json({ success: false, error: e.message }, 500);
  }
});

// POST - Menambahkan layanan baru
app.post('/api/services', async (c) => {
  try {
    const rawData = await c.req.json();
    const serviceData = validateServiceData(rawData);
    
    const stmt = c.env.DB.prepare(
      'INSERT INTO services (name, description, price, duration_minutes) VALUES (?, ?, ?, ?)'
    );
    
    const { success, meta } = await stmt.bind(
      serviceData.name,
      serviceData.description,
      serviceData.price,
      serviceData.duration_minutes
    ).run();

    if (success) {
      // Ambil data layanan yang baru dibuat
      const newService = await c.env.DB.prepare(
        'SELECT id, name, description, price, duration_minutes, created_at FROM services WHERE id = ?'
      ).bind(meta.last_row_id).first();
      
      return c.json({ 
        success: true, 
        message: 'Service added successfully', 
        service: newService 
      }, 201);
    } else {
      return c.json({ success: false, error: 'Failed to add service' }, 500);
    }
    
  } catch (e: any) {
    console.error("Error adding service:", e.message);
    return c.json({ success: false, error: e.message }, 400);
  }
});

// PUT - Update layanan berdasarkan ID
app.put('/api/services/:id', async (c) => {
  try {
    const id = validateId(c.req.param('id'));
    const rawData = await c.req.json();
    const serviceData = validateServiceData(rawData);
    
    // Cek apakah service exists
    const existingService = await c.env.DB.prepare(
      'SELECT id FROM services WHERE id = ?'
    ).bind(id).first();
    
    if (!existingService) {
      return c.json({ success: false, error: 'Service not found' }, 404);
    }
    
    // Update service
    const stmt = c.env.DB.prepare(
      'UPDATE services SET name = ?, description = ?, price = ?, duration_minutes = ? WHERE id = ?'
    );
    
    const { success } = await stmt.bind(
      serviceData.name,
      serviceData.description,
      serviceData.price,
      serviceData.duration_minutes,
      id
    ).run();

    if (success) {
      // Ambil data layanan yang sudah diupdate
      const updatedService = await c.env.DB.prepare(
        'SELECT id, name, description, price, duration_minutes, created_at FROM services WHERE id = ?'
      ).bind(id).first();
      
      return c.json({ 
        success: true, 
        message: 'Service updated successfully', 
        service: updatedService 
      });
    } else {
      return c.json({ success: false, error: 'Failed to update service' }, 500);
    }
    
  } catch (e: any) {
    console.error("Error updating service:", e.message);
    return c.json({ success: false, error: e.message }, 400);
  }
});

// DELETE - Hapus layanan berdasarkan ID
app.delete('/api/services/:id', async (c) => {
  try {
    const id = validateId(c.req.param('id'));
    
    // Cek apakah service exists dan ambil datanya untuk response
    const existingService = await c.env.DB.prepare(
      'SELECT id, name, description, price, duration_minutes FROM services WHERE id = ?'
    ).bind(id).first();
    
    if (!existingService) {
      return c.json({ success: false, error: 'Service not found' }, 404);
    }
    
    // Hapus service
    const { success } = await c.env.DB.prepare(
      'DELETE FROM services WHERE id = ?'
    ).bind(id).run();

    if (success) {
      return c.json({ 
        success: true, 
        message: 'Service deleted successfully',
        deletedService: existingService
      });
    } else {
      return c.json({ success: false, error: 'Failed to delete service' }, 500);
    }
    
  } catch (e: any) {
    console.error("Error deleting service:", e.message);
    return c.json({ success: false, error: e.message }, 400);
  }
});

// GET - Endpoint untuk mendapatkan statistik layanan
app.get('/api/services/stats', async (c) => {
  try {
    const totalServices = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM services'
    ).first();
    
    const avgPrice = await c.env.DB.prepare(
      'SELECT AVG(price) as average FROM services'
    ).first();
    
    const priceRange = await c.env.DB.prepare(
      'SELECT MIN(price) as min_price, MAX(price) as max_price FROM services'
    ).first();
    
    return c.json({
      success: true,
      stats: {
        totalServices: safeNumber(totalServices?.count),
        averagePrice: safeNumber(avgPrice?.average),
        priceRange: {
          min: safeNumber(priceRange?.min_price),
          max: safeNumber(priceRange?.max_price)
        }
      }
    });
    
  } catch (e: any) {
    console.error("Error fetching stats:", e.message);
    return c.json({ success: false, error: e.message }, 500);
  }
});

// Endpoint dasar untuk mengecek apakah worker berjalan
app.get('/', (c) => {
  return c.text('🦶 Selamat datang di Shoesclean API! Backend sudah enhanced dengan fitur CRUD lengkap, search, dan pagination.');
});

// Health check endpoint
app.get('/health', (c) => {
  return c.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.1.0'
  });
});

export default app;