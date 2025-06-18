import { Hono } from 'hono';

// Definisikan tipe untuk environment bindings Anda jika menggunakan TypeScript
// Ini membantu dengan type safety untuk c.env
type Bindings = {
  Shoesclean: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>();

app.get('/', (c) => {
  return c.text('Halo dari Shoesclean Worker dengan Hono!');
});

// --- Product Routes ---
const productsApi = new Hono<{ Bindings: Bindings }>();

// GET /api/products - List semua produk
productsApi.get('/', async (c) => {
  try {
    const { results } = await c.env.Shoesclean.prepare('SELECT * FROM products').all();
    return c.json(results);
  } catch (e: any) {
    return c.json({ err: e.message }, 500);
  }
});

// GET /api/products/:id - Dapatkan satu produk
productsApi.get('/:id', async (c) => {
  const id = c.req.param('id');
  try {
    const product = await c.env.Shoesclean.prepare('SELECT * FROM products WHERE id = ?').bind(id).first();
    if (product) {
      return c.json(product);
    }
    return c.json({ err: 'Produk tidak ditemukan' }, 404);
  } catch (e: any) {
    return c.json({ err: e.message }, 500);
  }
});

// POST /api/products - Buat produk baru
productsApi.post('/', async (c) => {
  try {
    const { name, description, price } = await c.req.json();
    if (!name || price === undefined) {
      return c.json({ err: 'Nama dan harga diperlukan' }, 400);
    }
    const { success } = await c.env.Shoesclean.prepare(
      'INSERT INTO products (name, description, price) VALUES (?, ?, ?)'
    ).bind(name, description, price).run();

    if (success) {
      return c.json({ message: 'Produk berhasil dibuat' }, 201);
    } else {
      return c.json({ err: 'Gagal membuat produk' }, 500);
    }
  } catch (e: any) {
    return c.json({ err: e.message }, 500);
  }
});

// PUT /api/products/:id - Update produk
productsApi.put('/:id', async (c) => {
  const id = c.req.param('id');
  try {
    const { name, description, price } = await c.req.json();
    // Tambahkan validasi sesuai kebutuhan
    const { success } = await c.env.Shoesclean.prepare(
      'UPDATE products SET name = ?, description = ?, price = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(name, description, price, id).run();

    return success ? c.json({ message: 'Produk berhasil diupdate' }) : c.json({ err: 'Gagal mengupdate produk' }, 500);
  } catch (e: any) {
    return c.json({ err: e.message }, 500);
  }
});

app.route('/api/products', productsApi);

export default {
  fetch: app.fetch,
};
