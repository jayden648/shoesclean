<template>
  <div class="service-list">
    <!-- Header dengan Search dan Controls -->
    <div class="service-list-header">
      <div class="header-left">
        <h2>Daftar Layanan</h2>
        <div class="service-count" v-if="pagination.totalItems > 0">
          {{ pagination.totalItems }} layanan ditemukan
        </div>
      </div>
      
      <div class="header-right">
        <button @click="refreshServices" :disabled="loading" class="btn btn-refresh">
          <span :class="{ 'spinning': loading }">🔄</span>
          Refresh
        </button>
      </div>
    </div>

    <!-- Search dan Filter Controls -->
    <div class="controls-section">
      <div class="search-section">
        <div class="search-input-group">
          <input
            v-model="searchQuery"
            @input="handleSearchInput"
            type="text"
            placeholder="Cari layanan..."
            class="search-input"
          />
          <button v-if="searchQuery" @click="clearSearch" class="clear-search-btn">
            ✕
          </button>
        </div>
      </div>

      <div class="filter-section">
        <select v-model="sortBy" @change="handleSortChange" class="sort-select">
          <option value="id">Urutkan: ID</option>
          <option value="name">Urutkan: Nama</option>
          <option value="price">Urutkan: Harga</option>
          <option value="duration_minutes">Urutkan: Durasi</option>
          <option value="created_at">Urutkan: Tanggal</option>
        </select>
        
        <button @click="toggleSortOrder" class="sort-order-btn">
          {{ sortOrder === 'asc' ? '↑' : '↓' }}
        </button>

        <select v-model="itemsPerPage" @change="handleItemsPerPageChange" class="items-per-page-select">
          <option value="5">5 per halaman</option>
          <option value="10">10 per halaman</option>
          <option value="20">20 per halaman</option>
          <option value="50">50 per halaman</option>
        </select>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading">
      <div class="loading-spinner"></div>
      <p>Memuat layanan...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-message">
      <h3>❌ Gagal memuat layanan</h3>
      <p>{{ error }}</p>
      <div class="error-help">
        <strong>Pastikan:</strong>
        <ul>
          <li>Server Cloudflare Workers berjalan (<code>wrangler dev</code>)</li>
          <li>Database D1 sudah dibuat dan termigrasi</li>
          <li>URL API sudah benar</li>
        </ul>
      </div>
      <button @click="refreshServices" class="btn btn-retry">Coba Lagi</button>
    </div>

    <!-- Empty State -->
    <div v-else-if="services.length === 0" class="empty-state">
      <div class="empty-icon">{{ searchQuery ? '🔍' : '📝' }}</div>
      <h3>{{ searchQuery ? 'Tidak ditemukan' : 'Belum ada layanan' }}</h3>
      <p>
        {{ searchQuery 
          ? `Tidak ada layanan yang cocok dengan "${searchQuery}"` 
          : 'Tambahkan layanan pertama Anda!' 
        }}
      </p>
      <button v-if="searchQuery" @click="clearSearch" class="btn btn-secondary">
        Bersihkan Pencarian
      </button>
    </div>

    <!-- Services Grid -->
    <div v-else class="services-grid">
      <div
        v-for="service in services"
        :key="service.id"
        class="service-card"
        @click="selectService(service)"
      >
        <div class="service-card-header">
          <h3>{{ service.name }}</h3>
          <div class="service-id">#{{ service.id }}</div>
        </div>
        
        <p class="service-description">
          {{ service.description || 'Tidak ada deskripsi' }}
        </p>
        
        <div class="service-details">
          <div class="service-price">
            {{ formatCurrency(service.price) }}
          </div>
          <div class="service-duration">
            ⏱️ {{ formatDuration(service.duration_minutes) }}
          </div>
        </div>

        <div class="service-footer">
          <div class="service-date">
            📅 {{ formatDate(service.created_at) }}
          </div>
          <div class="service-actions">
            <button @click.stop="editService(service)" class="btn btn-sm btn-edit">
              ✏️
            </button>
            <button @click.stop="confirmDeleteService(service)" class="btn btn-sm btn-delete">
              🗑️
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="pagination.totalPages > 1" class="pagination">
      <div class="pagination-info">
        Halaman {{ pagination.currentPage }} dari {{ pagination.totalPages }}
        ({{ ((pagination.currentPage - 1) * pagination.itemsPerPage) + 1 }}-{{ 
          Math.min(pagination.currentPage * pagination.itemsPerPage, pagination.totalItems) 
        }} dari {{ pagination.totalItems }} layanan)
      </div>
      
      <div class="pagination-controls">
        <button 
          @click="goToPage(1)" 
          :disabled="!pagination.hasPrevPage"
          class="btn btn-pagination"
        >
          ⏮️
        </button>
        
        <button 
          @click="goToPage(pagination.currentPage - 1)" 
          :disabled="!pagination.hasPrevPage"
          class="btn btn-pagination"
        >
          ◀️
        </button>
        
        <!-- Page Numbers -->
        <button
          v-for="page in visiblePages"
          :key="page"
          @click="goToPage(page)"
          :class="['btn', 'btn-pagination', { 'active': page === pagination.currentPage }]"
        >
          {{ page }}
        </button>
        
        <button 
          @click="goToPage(pagination.currentPage + 1)" 
          :disabled="!pagination.hasNextPage"
          class="btn btn-pagination"
        >
          ▶️
        </button>
        
        <button 
          @click="goToPage(pagination.totalPages)" 
          :disabled="!pagination.hasNextPage"
          class="btn btn-pagination"
        >
          ⏭️
        </button>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div v-if="showDeleteModal" class="modal-overlay" @click="cancelDelete">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h3>⚠️ Konfirmasi Hapus</h3>
        </div>
        <div class="modal-body">
          <p>Yakin ingin menghapus layanan?</p>
          <div class="service-to-delete">
            <strong>{{ serviceToDelete?.name }}</strong>
            <br>
            <span class="price">{{ formatCurrency(serviceToDelete?.price) }}</span>
          </div>
          <p class="warning-text">Tindakan ini tidak dapat dibatalkan!</p>
        </div>
        <div class="modal-actions">
          <button @click="cancelDelete" class="btn btn-secondary">
            Batal
          </button>
          <button @click="deleteService" :disabled="deleting" class="btn btn-danger">
            <span v-if="deleting">⏳</span>
            <span v-else>🗑️</span>
            {{ deleting ? 'Menghapus...' : 'Hapus' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import apiService from '@/services/api.js';

export default {
  name: 'ServiceList',
  data() {
    return {
      services: [],
      loading: false,
      error: null,
      searchQuery: '',
      searchTimeout: null,
      sortBy: 'id',
      sortOrder: 'asc',
      currentPage: 1,
      itemsPerPage: 10,
      pagination: {
        currentPage: 1,
        totalPages: 1,
        totalItems: 0,
        itemsPerPage: 10,
        hasNextPage: false,
        hasPrevPage: false
      },
      showDeleteModal: false,
      serviceToDelete: null,
      deleting: false,
    };
  },
  computed: {
    visiblePages() {
      const total = this.pagination.totalPages;
      const current = this.pagination.currentPage;
      const pages = [];
      
      if (total <= 7) {
        // Show all pages if total <= 7
        for (let i = 1; i <= total; i++) {
          pages.push(i);
        }
      } else {
        // Always show first page
        pages.push(1);
        
        if (current > 4) {
          pages.push('...');
        }
        
        // Show pages around current page
        const start = Math.max(2, current - 1);
        const end = Math.min(total - 1, current + 1);
        
        for (let i = start; i <= end; i++) {
          if (!pages.includes(i)) {
            pages.push(i);
          }
        }
        
        if (current < total - 3) {
          pages.push('...');
        }
        
        // Always show last page
        if (!pages.includes(total)) {
          pages.push(total);
        }
      }
      
      return pages.filter(page => page !== '...' || pages.indexOf(page) !== pages.lastIndexOf(page));
    }
  },
  async mounted() {
    await this.loadServices();
  },
  methods: {
    async loadServices() {
      this.loading = true;
      this.error = null;
      
      try {
        const response = await apiService.getServices({
          page: this.currentPage,
          limit: this.itemsPerPage,
          search: this.searchQuery,
          sortBy: this.sortBy,
          sortOrder: this.sortOrder
        });
        
        this.services = response.services || [];
        this.pagination = response.pagination || {};
        
      } catch (error) {
        this.error = error.message;
        console.error('Error loading services:', error);
      } finally {
        this.loading = false;
      }
    },

    async refreshServices() {
      await this.loadServices();
    },

    handleSearchInput() {
      // Debounce search
      clearTimeout(this.searchTimeout);
      this.searchTimeout = setTimeout(() => {
        this.currentPage = 1; // Reset to first page when searching
        this.loadServices();
      }, 500);
    },

    clearSearch() {
      this.searchQuery = '';
      this.currentPage = 1;
      this.loadServices();
    },

    handleSortChange() {
      this.currentPage = 1;
      this.loadServices();
    },

    toggleSortOrder() {
      this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
      this.loadServices();
    },

    handleItemsPerPageChange() {
      this.currentPage = 1;
      this.loadServices();
    },

    goToPage(page) {
      if (page !== '...' && page >= 1 && page <= this.pagination.totalPages) {
        this.currentPage = page;
        this.loadServices();
      }
    },

    selectService(service) {
      this.$emit('service-selected', service);
    },

    editService(service) {
      this.$emit('edit-service', service);
    },

    confirmDeleteService(service) {
      this.serviceToDelete = service;
      this.showDeleteModal = true;
    },

    cancelDelete() {
      this.showDeleteModal = false;
      this.serviceToDelete = null;
      this.deleting = false;
    },

    async deleteService() {
      if (!this.serviceToDelete) return;
      
      this.deleting = true;
      
      try {
        await apiService.deleteService(this.serviceToDelete.id);
        
        this.showDeleteModal = false;
        this.$emit('service-deleted', this.serviceToDelete);
        
        // Refresh current page or go to previous page if current page becomes empty
        if (this.services.length === 1 && this.currentPage > 1) {
          this.currentPage--;
        }
        
        await this.loadServices();
        
      } catch (error) {
        this.error = `Gagal menghapus layanan: ${error.message}`;
        console.error('Error deleting service:', error);
      } finally {
        this.deleting = false;
        this.serviceToDelete = null;
      }
    },

    // Utility methods for formatting
    formatCurrency(amount) {
      if (!amount && amount !== 0) return 'Rp 0';
      return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(amount);
    },

    formatDuration(minutes) {
      if (!minutes) return '0 menit';
      
      if (minutes < 60) {
        return `${minutes} menit`;
      }
      
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      
      if (remainingMinutes === 0) {
        return `${hours} jam`;
      }
      
      return `${hours} jam ${remainingMinutes} menit`;
    },

    formatDate(dateString) {
      if (!dateString) return '-';
      
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('id-ID', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    }
  },

  // Cleanup timeout on component destroy
  beforeUnmount() {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
  }
};
</script>

<style scoped>
.service-list {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

/* Header Styles */
.service-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 2px solid #e0e0e0;
}

.header-left h2 {
  margin: 0 0 5px 0;
  color: #333;
  font-size: 24px;
}

.service-count {
  color: #666;
  font-size: 14px;
}

.btn-refresh {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: #4CAF50;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.btn-refresh:hover:not(:disabled) {
  background: #45a049;
}

.btn-refresh:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Controls Section */
.controls-section {
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
  margin-bottom: 20px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 8px;
}

.search-section {
  flex: 1;
  min-width: 300px;
}

.search-input-group {
  position: relative;
  display: flex;
  align-items: center;
}

.search-input {
  width: 100%;
  padding: 10px 40px 10px 12px;
  border: 2px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.3s;
}

.search-input:focus {
  outline: none;
  border-color: #4CAF50;
}

.clear-search-btn {
  position: absolute;
  right: 8px;
  background: none;
  border: none;
  color: #999;
  cursor: pointer;
  font-size: 16px;
  padding: 4px;
  border-radius: 50%;
  transition: background-color 0.3s;
}

.clear-search-btn:hover {
  background: #f0f0f0;
}

.filter-section {
  display: flex;
  gap: 10px;
  align-items: center;
}

.sort-select, .items-per-page-select {
  padding: 8px 12px;
  border: 2px solid #ddd;
  border-radius: 6px;
  background: white;
  font-size: 14px;
}

.sort-order-btn {
  padding: 8px 12px;
  background: #2196F3;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 16px;
  transition: background-color 0.3s;
}

.sort-order-btn:hover {
  background: #1976D2;
}

/* Loading and Error States */
.loading {
  text-align: center;
  padding: 40px;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #4CAF50;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 15px;
}

.error-message {
  text-align: center;
  padding: 40px;
  color: #d32f2f;
}

.error-message h3 {
  margin-bottom: 10px;
}

.error-help {
  background: #ffebee;
  padding: 15px;
  border-radius: 6px;
  margin: 15px 0;
  text-align: left;
  max-width: 500px;
  margin-left: auto;
  margin-right: auto;
}

.error-help ul {
  margin: 10px 0 0 20px;
}

.error-help code {
  background: #f5f5f5;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: monospace;
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #666;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 15px;
}

.empty-state h3 {
  margin: 0 0 10px 0;
  color: #333;
}

/* Services Grid */
.services-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.service-card {
  background: white;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.service-card:hover {
  border-color: #4CAF50;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

.service-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.service-card-header h3 {
  margin: 0;
  color: #333;
  font-size: 18px;
  flex: 1;
}

.service-id {
  background: #e3f2fd;
  color: #1976d2;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
}

.service-description {
  margin: 0 0 15px 0;
  color: #666;
  line-height: 1.4;
  font-size: 14px;
}

.service-details {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  padding: 10px 0;
  border-top: 1px solid #f0f0f0;
  border-bottom: 1px solid #f0f0f0;
}

.service-price {
  font-size: 18px;
  font-weight: bold;
  color: #4CAF50;
}

.service-duration {
  color: #666;
  font-size: 14px;
}

.service-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.service-date {
  color: #999;
  font-size: 12px;
}

.service-actions {
  display: flex;
  gap: 8px;
}

/* Button Styles */
.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.btn-sm {
  padding: 6px 10px;
  font-size: 12px;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background: #5a6268;
}

.btn-edit {
  background: #2196F3;
  color: white;
}

.btn-edit:hover {
  background: #1976D2;
}

.btn-delete {
  background: #f44336;
  color: white;
}

.btn-delete:hover {
  background: #d32f2f;
}

.btn-retry {
  background: #FF9800;
  color: white;
}

.btn-retry:hover {
  background: #F57C00;
}

.btn-danger {
  background: #f44336;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #d32f2f;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Pagination */
.pagination {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
  margin-top: 30px;
}

.pagination-info {
  color: #666;
  font-size: 14px;
}

.pagination-controls {
  display: flex;
  gap: 5px;
  align-items: center;
}

.btn-pagination {
  min-width: 40px;
  height: 40px;
  padding: 8px;
  background: white;
  border: 2px solid #ddd;
  color: #333;
}

.btn-pagination:hover:not(:disabled) {
  background: #f5f5f5;
  border-color: #4CAF50;
}

.btn-pagination.active {
  background: #4CAF50;
  color: white;
  border-color: #4CAF50;
}

.btn-pagination:disabled {
  background: #f5f5f5;
  color: #ccc;
  border-color: #eee;
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: white;
  border-radius: 12px;
  min-width: 400px;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
}

.modal-header {
  padding: 20px 20px 0;
  border-bottom: 1px solid #eee;
}

.modal-header h3 {
  margin: 0 0 15px 0;
  color: #333;
}

.modal-body {
  padding: 20px;
}

.service-to-delete {
  background: #f8f9fa;
  padding: 15px;
  border-radius: 6px;
  margin: 15px 0;
  text-align: center;
}

.service-to-delete .price {
  color: #4CAF50;
  font-weight: bold;
}

.warning-text {
  color: #f44336;
  font-weight: bold;
  text-align: center;
  margin: 15px 0 0 0;
}

.modal-actions {
  padding: 0 20px 20px;
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

/* Responsive Design */
@media (max-width: 768px) {
  .service-list {
    padding: 10px;
  }
  
  .service-list-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 15px;
  }
  
  .controls-section {
    flex-direction: column;
    gap: 10px;
  }
  
  .search-section {
    min-width: auto;
  }
  
  .filter-section {
    flex-wrap: wrap;
  }
  
  .services-grid {
    grid-template-columns: 1fr;
    gap: 15px;
  }
  
  .pagination-controls {
    flex-wrap: wrap;
    justify-content: center;
  }
  
  .modal {
    min-width: auto;
    margin: 20px;
  }
}

@media (max-width: 480px) {
  .service-card-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  
  .service-details {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  
  .service-footer {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }
}
</style>