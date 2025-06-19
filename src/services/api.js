// src/services/api.js

// Deteksi environment dan set URL yang sesuai
const getApiBaseUrl = () => {
  // Jika di development (localhost)
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:8787';
  }
  
  // Jika di production atau preview, gunakan URL Workers Anda
  return 'https://shoesclean.gabrielirawan64.workers.dev';
};

const API_BASE_URL = getApiBaseUrl();

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
  }

  // Helper method untuk handle HTTP requests
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success === false) {
        throw new Error(data.error || 'API request failed');
      }

      return data;
    } catch (error) {
      console.error('API Request Error:', error);
      throw error;
    }
  }

  // GET - Ambil semua layanan dengan pagination dan search
  async getServices(options = {}) {
    const {
      page = 1,
      limit = 10,
      search = '',
      sortBy = 'id',
      sortOrder = 'asc'
    } = options;

    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      sortBy,
      sortOrder
    });

    if (search.trim()) {
      params.append('search', search.trim());
    }

    return await this.request(`/api/services?${params.toString()}`);
  }

  // GET - Ambil layanan berdasarkan ID
  async getService(id) {
    return await this.request(`/api/services/${id}`);
  }

  // POST - Tambah layanan baru
  async createService(serviceData) {
    return await this.request('/api/services', {
      method: 'POST',
      body: JSON.stringify(serviceData),
    });
  }

  // PUT - Update layanan
  async updateService(id, serviceData) {
    return await this.request(`/api/services/${id}`, {
      method: 'PUT',
      body: JSON.stringify(serviceData),
    });
  }

  // DELETE - Hapus layanan
  async deleteService(id) {
    return await this.request(`/api/services/${id}`, {
      method: 'DELETE',
    });
  }

  // GET - Ambil statistik layanan
  async getStats() {
    return await this.request('/api/services/stats');
  }

  // GET - Test koneksi API
  async testConnection() {
    try {
      const response = await fetch(`${this.baseURL}/health`);
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  // GET - Health check
  async healthCheck() {
    return await this.request('/health');
  }
}

// Export instance tunggal
export default new ApiService();