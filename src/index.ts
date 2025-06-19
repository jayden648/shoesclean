// index.ts - Full Stack Worker dengan Frontend + Backend
import { Hono } from 'hono';
import { cors } from 'hono/cors';

export interface Env {
  DB: D1Database;
}

const app = new Hono<{ Bindings: Env }>();

// CORS Middleware
app.use('/api/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Helper functions
const validateId = (id: string): number => {
  const numId = parseInt(id);
  if (isNaN(numId) || numId <= 0) {
    throw new Error('Invalid ID format');
  }
  return numId;
};

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

const safeNumber = (value: any): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string') return parseInt(value) || 0;
  return 0;
};

// Frontend HTML Template
const getHTMLPage = () => `
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ShoesClean - Layanan Cuci Sepatu</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        .loading { opacity: 0.5; pointer-events: none; }
        .animate-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
    </style>
</head>
<body class="bg-gray-50 min-h-screen">
    <div class="container mx-auto px-4 py-8">
        <!-- Header -->
        <div class="text-center mb-8">
            <h1 class="text-4xl font-bold text-blue-600 mb-2">🦶 ShoesClean</h1>
            <p class="text-gray-600">Layanan Profesional Cuci Sepatu</p>
        </div>

        <!-- Add Service Form -->
        <div class="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 class="text-2xl font-semibold mb-4">Tambah Layanan Baru</h2>
            <form id="serviceForm" class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Nama Layanan</label>
                    <input type="text" id="serviceName" required 
                           class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                           placeholder="Contoh: Basic Cleaning">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Harga (Rp)</label>
                    <input type="number" id="servicePrice" required min="0" 
                           class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                           placeholder="25000">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Durasi (menit)</label>
                    <input type="number" id="serviceDuration" min="0" 
                           class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                           placeholder="30">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Deskripsi</label>
                    <input type="text" id="serviceDescription" 
                           class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                           placeholder="Pembersihan sepatu standar">
                </div>
                <div class="md:col-span-2">
                    <button type="submit" 
                            class="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                        Tambah Layanan
                    </button>
                </div>
            </form>
        </div>

        <!-- Services List -->
        <div class="bg-white rounded-lg shadow-md p-6">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl font-semibold">Daftar Layanan</h2>
                <div class="flex gap-2">
                    <input type="text" id="searchInput" placeholder="Cari layanan..." 
                           class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <button onclick="loadServices()" 
                            class="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700">
                        Refresh
                    </button>
                </div>
            </div>
            
            <div id="servicesContainer" class="space-y-4">
                <div class="text-center py-8">
                    <div class="animate-pulse text-gray-500">Memuat layanan...</div>
                </div>
            </div>
            
            <!-- Pagination -->
            <div id="pagination" class="mt-6 flex justify-center gap-2"></div>
        </div>

        <!-- Stats -->
        <div id="statsContainer" class="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4"></div>
    </div>

    <!-- Edit Modal -->
    <div id="editModal" class="fixed inset-0 bg-black bg-opacity-50 hidden items-center justify-center">
        <div class="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 class="text-xl font-semibold mb-4">Edit Layanan</h3>
            <form id="editForm">
                <input type="hidden" id="editId">
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-2">Nama Layanan</label>
                    <input type="text" id="editName" required 
                           class="w-full px-3 py-2 border border-gray-300 rounded-md">
                </div>
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-2">Harga (Rp)</label>
                    <input type="number" id="editPrice" required min="0" 
                           class="w-full px-3 py-2 border border-gray-300 rounded-md">
                </div>
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-2">Durasi (menit)</label>
                    <input type="number" id="editDuration" min="0" 
                           class="w-full px-3 py-2 border border-gray-300 rounded-md">
                </div>
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-2">Deskripsi</label>
                    <input type="text" id="editDescription" 
                           class="w-full px-3 py-2 border border-gray-300 rounded-md">
                </div>
                <div class="flex gap-2">
                    <button type="submit" class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                        Update
                    </button>
                    <button type="button" onclick="closeEditModal()" 
                            class="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700">
                        Batal
                    </button>
                </div>
            </form>
        </div>
    </div>

    <script>
        let currentPage = 1;
        const itemsPerPage = 10;
        
        // API Base URL (sama dengan worker ini)
        const API_BASE = '';

        // Load services
        async function loadServices(page = 1, search = '') {
            try {
                const container = document.getElementById('servicesContainer');
                container.innerHTML = '<div class="text-center py-8"><div class="animate-pulse text-gray-500">Memuat layanan...</div></div>';

                const params = new URLSearchParams({
                    page: page.toString(),
                    limit: itemsPerPage.toString()
                });
                
                if (search.trim()) {
                    params.append('search', search.trim());
                }

                const response = await fetch(\`/api/services?\${params.toString()}\`);
                const data = await response.json();

                if (data.success) {
                    displayServices(data.services);
                    displayPagination(data.pagination);
                    currentPage = page;
                } else {
                    container.innerHTML = \`<div class="text-center py-8 text-red-500">Error: \${data.error}</div>\`;
                }
            } catch (error) {
                console.error('Error loading services:', error);
                document.getElementById('servicesContainer').innerHTML = 
                    '<div class="text-center py-8 text-red-500">Gagal memuat layanan</div>';
            }
        }

        // Display services
        function displayServices(services) {
            const container = document.getElementById('servicesContainer');
            
            if (services.length === 0) {
                container.innerHTML = '<div class="text-center py-8 text-gray-500">Belum ada layanan tersedia</div>';
                return;
            }

            container.innerHTML = services.map(service => \`
                <div class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div class="flex justify-between items-start">
                        <div class="flex-1">
                            <h3 class="text-lg font-semibold text-gray-800">\${service.name}</h3>
                            <p class="text-gray-600 mt-1">\${service.description || 'Tidak ada deskripsi'}</p>
                            <div class="mt-2 flex flex-wrap gap-4 text-sm text-gray-500">
                                <span class="font-medium text-green-600">Rp \${service.price.toLocaleString('id-ID')}</span>
                                \${service.duration_minutes ? \`<span>⏱️ \${service.duration_minutes} menit</span>\` : ''}
                                <span>📅 \${new Date(service.created_at).toLocaleDateString('id-ID')}</span>
                            </div>
                        </div>
                        <div class="flex gap-2 ml-4">
                            <button onclick="editService(\${service.id})" 
                                    class="bg-yellow-500 text-white px-3 py-1 rounded text-sm hover:bg-yellow-600">
                                Edit
                            </button>
                            <button onclick="deleteService(\${service.id})" 
                                    class="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600">
                                Hapus
                            </button>
                        </div>
                    </div>
                </div>
            \`).join('');
        }

        // Display pagination
        function displayPagination(pagination) {
            const container = document.getElementById('pagination');
            const { currentPage, totalPages, hasNextPage, hasPrevPage } = pagination;

            let html = '';
            
            if (hasPrevPage) {
                html += \`<button onclick="loadServices(\${currentPage - 1}, document.getElementById('searchInput').value)" 
                                class="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">« Prev</button>\`;
            }
            
            html += \`<span class="px-3 py-2 bg-gray-200 rounded">Page \${currentPage} of \${totalPages}</span>\`;
            
            if (hasNextPage) {
                html += \`<button onclick="loadServices(\${currentPage + 1}, document.getElementById('searchInput').value)" 
                                class="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Next »</button>\`;
            }
            
            container.innerHTML = html;
        }

        // Add service
        document.getElementById('serviceForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const serviceData = {
                name: document.getElementById('serviceName').value,
                price: parseFloat(document.getElementById('servicePrice').value),
                duration_minutes: parseInt(document.getElementById('serviceDuration').value) || null,
                description: document.getElementById('serviceDescription').value || null
            };

            try {
                const response = await fetch('/api/services', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(serviceData)
                });

                const data = await response.json();
                
                if (data.success) {
                    alert('Layanan berhasil ditambahkan!');
                    document.getElementById('serviceForm').reset();
                    loadServices();
                    loadStats();
                } else {
                    alert('Error: ' + data.error);
                }
            } catch (error) {
                alert('Gagal menambahkan layanan');
            }
        });

        // Edit service
        async function editService(id) {
            try {
                const response = await fetch(\`/api/services/\${id}\`);
                const data = await response.json();
                
                if (data.success) {
                    const service = data.service;
                    document.getElementById('editId').value = service.id;
                    document.getElementById('editName').value = service.name;
                    document.getElementById('editPrice').value = service.price;
                    document.getElementById('editDuration').value = service.duration_minutes || '';
                    document.getElementById('editDescription').value = service.description || '';
                    
                    document.getElementById('editModal').classList.remove('hidden');
                    document.getElementById('editModal').classList.add('flex');
                }
            } catch (error) {
                alert('Gagal memuat data layanan');
            }
        }

        // Update service
        document.getElementById('editForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const id = document.getElementById('editId').value;
            const serviceData = {
                name: document.getElementById('editName').value,
                price: parseFloat(document.getElementById('editPrice').value),
                duration_minutes: parseInt(document.getElementById('editDuration').value) || null,
                description: document.getElementById('editDescription').value || null
            };

            try {
                const response = await fetch(\`/api/services/\${id}\`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(serviceData)
                });

                const data = await response.json();
                
                if (data.success) {
                    alert('Layanan berhasil diupdate!');
                    closeEditModal();
                    loadServices(currentPage);
                    loadStats();
                } else {
                    alert('Error: ' + data.error);
                }
            } catch (error) {
                alert('Gagal mengupdate layanan');
            }
        });

        // Delete service
        async function deleteService(id) {
            if (confirm('Yakin ingin menghapus layanan ini?')) {
                try {
                    const response = await fetch(\`/api/services/\${id}\`, {
                        method: 'DELETE'
                    });

                    const data = await response.json();
                    
                    if (data.success) {
                        alert('Layanan berhasil dihapus!');
                        loadServices(currentPage);
                        loadStats();
                    } else {
                        alert('Error: ' + data.error);
                    }
                } catch (error) {
                    alert('Gagal menghapus layanan');
                }
            }
        }

        // Close edit modal
        function closeEditModal() {
            document.getElementById('editModal').classList.add('hidden');
            document.getElementById('editModal').classList.remove('flex');
        }

        // Load stats
        async function loadStats() {
            try {
                const response = await fetch('/api/services/stats');
                const data = await response.json();
                
                if (data.success) {
                    const stats = data.stats;
                    document.getElementById('statsContainer').innerHTML = \`
                        <div class="bg-white rounded-lg shadow-md p-6 text-center">
                            <h3 class="text-lg font-semibold text-gray-700">Total Layanan</h3>
                            <p class="text-3xl font-bold text-blue-600">\${stats.totalServices}</p>
                        </div>
                        <div class="bg-white rounded-lg shadow-md p-6 text-center">
                            <h3 class="text-lg font-semibold text-gray-700">Harga Rata-rata</h3>
                            <p class="text-3xl font-bold text-green-600">Rp \${Math.round(stats.averagePrice).toLocaleString('id-ID')}</p>
                        </div>
                        <div class="bg-white rounded-lg shadow-md p-6 text-center">
                            <h3 class="text-lg font-semibold text-gray-700">Range Harga</h3>
                            <p class="text-lg font-bold text-purple-600">
                                Rp \${stats.priceRange.min.toLocaleString('id-ID')} - 
                                Rp \${stats.priceRange.max.toLocaleString('id-ID')}
                            </p>
                        </div>
                    \`;
                }
            } catch (error) {
                console.error('Error loading stats:', error);
            }
        }

        // Search functionality
        document.getElementById('searchInput').addEventListener('input', (e) => {
            const searchTerm = e.target.value;
            clearTimeout(window.searchTimeout);
            window.searchTimeout = setTimeout(() => {
                loadServices(1, searchTerm);
            }, 500);
        });

        // Initialize app
        document.addEventListener('DOMContentLoaded', () => {
            loadServices();
            loadStats();
        });
    </script>
</body>
</html>
`;

// API Routes (sama seperti sebelumnya)
app.get('/api/services', async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '10');
    const search = c.req.query('search')?.trim() || '';
    const sortBy = c.req.query('sortBy') || 'id';
    const sortOrder = c.req.query('sortOrder') || 'asc';
    
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
    
    const countQuery = `SELECT COUNT(*) as total FROM services ${countWhereClause}`;
    const countResult = await c.env.DB.prepare(countQuery).bind(...countParams).first();
    const total = safeNumber(countResult?.total);
    
    const dataQuery = `
      SELECT id, name, description, price, duration_minutes, created_at 
      FROM services 
      ${whereClause}
      ORDER BY ${sortBy} ${sortOrder.toUpperCase()}
      LIMIT ? OFFSET ?
    `;
    
    params.push(limit, offset);
    const { results } = await c.env.DB.prepare(dataQuery).bind(...params).all();
    
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

app.put('/api/services/:id', async (c) => {
  try {
    const id = validateId(c.req.param('id'));
    const rawData = await c.req.json();
    const serviceData = validateServiceData(rawData);
    
    const existingService = await c.env.DB.prepare(
      'SELECT id FROM services WHERE id = ?'
    ).bind(id).first();
    
    if (!existingService) {
      return c.json({ success: false, error: 'Service not found' }, 404);
    }
    
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

app.delete('/api/services/:id', async (c) => {
  try {
    const id = validateId(c.req.param('id'));
    
    const existingService = await c.env.DB.prepare(
      'SELECT id, name, description, price, duration_minutes FROM services WHERE id = ?'
    ).bind(id).first();
    
    if (!existingService) {
      return c.json({ success: false, error: 'Service not found' }, 404);
    }
    
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

// Health check
app.get('/health', (c) => {
  return c.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '2.0.0 - Full Stack'
  });
});

// Serve Frontend - Route utama untuk halaman web
app.get('/', (c) => {
  return c.html(getHTMLPage());
});

export default app;