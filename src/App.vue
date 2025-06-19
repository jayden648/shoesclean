<script setup>
import { RouterLink, RouterView } from 'vue-router'
import { ref, onMounted } from 'vue'

// Animasi untuk header
const isLoaded = ref(false)

onMounted(() => {
  setTimeout(() => {
    isLoaded.value = true
  }, 100)
})
</script>

<template>
  <div id="app">
    <div class="container">
      <!-- Header -->
      <header class="app-header">
        <h1>🦶 Shoesclean</h1>
        <p>Layanan Cuci Sepatu Profesional</p>
        <div class="api-status">
          <span :class="['status-indicator', apiConnected ? 'connected' : 'disconnected']"></span>
          API {{ apiConnected ? 'Connected' : 'Disconnected' }}
        </div>
      </header>

      <!-- Main Content -->
      <main class="app-main">
        <!-- Add Service Form -->
        <section class="add-service-section">
          <h2>Tambah Layanan Baru</h2>
          <form @submit.prevent="handleAddService" class="service-form">
            <div class="form-row">
              <div class="form-group">
                <label for="name">Nama Layanan *</label>
                <input
                  id="name"
                  v-model="form.name"
                  type="text"
                  required
                  placeholder="Contoh: Cuci Sepatu Premium"
                />
              </div>
              
              <div class="form-group">
                <label for="price">Harga (Rp) *</label>
                <input
                  id="price"
                  v-model.number="form.price"
                  type="number"
                  required
                  min="0"
                  placeholder="50000"
                />
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label for="description">Deskripsi</label>
                <textarea
                  id="description"
                  v-model="form.description"
                  rows="3"
                  placeholder="Deskripsi layanan..."
                ></textarea>
              </div>
              
              <div class="form-group">
                <label for="duration">Durasi (menit)</label>
                <input
                  id="duration"
                  v-model.number="form.duration_minutes"
                  type="number"
                  min="0"
                  placeholder="90"
                />
              </div>
            </div>

            <div class="form-actions">
              <button type="submit" :disabled="isSubmitting" class="btn btn-primary">
                <span v-if="isSubmitting">⏳</span>
                <span v-else">➕</span>
                {{ isSubmitting ? 'Menambahkan...' : 'Tambah Layanan' }}
              </button>
              
              <button type="button" @click="resetForm" class="btn btn-secondary">
                🔄 Reset
              </button>
            </div>
          </form>
        </section>

        <!-- Status Messages -->
        <div v-if="statusMessage" :class="['status-message', statusMessage.type]">
          {{ statusMessage.text }}
        </div>

        <!-- Service List -->
        <section class="services-section">
          <ServiceList
            ref="serviceList"
            @service-selected="handleServiceSelected"
            @edit-service="handleEditService"
            @service-deleted="handleServiceDeleted"
          />
        </section>
      </main>
    </div>
  </div>
</template>

<script>
import ServiceList from '@/components/ServiceList.vue';
import apiService from '@/services/api.js';

export default {
  name: 'App',
  components: {
    ServiceList,
  },
  data() {
    return {
      apiConnected: false,
      form: {
        name: '',
        description: '',
        price: null,
        duration_minutes: null,
      },
      isSubmitting: false,
      statusMessage: null,
    };
  },
  async mounted() {
    await this.checkApiConnection();
  },
  methods: {
    async checkApiConnection() {
      this.apiConnected = await apiService.testConnection();
    },

    async handleAddService() {
      if (!this.form.name || this.form.price === null) {
        this.showStatus('Nama layanan dan harga wajib diisi!', 'error');
        return;
      }

      this.isSubmitting = true;

      try {
        const serviceData = {
          name: this.form.name,
          description: this.form.description || null,
          price: this.form.price,
          duration_minutes: this.form.duration_minutes || null,
        };

        await apiService.createService(serviceData);
        
        this.showStatus('✅ Layanan berhasil ditambahkan!', 'success');
        this.resetForm();
        
        // Refresh service list
        if (this.$refs.serviceList) {
          await this.$refs.serviceList.refreshServices();
        }
      } catch (error) {
        this.showStatus(`❌ Gagal menambahkan layanan: ${error.message}`, 'error');
      } finally {
        this.isSubmitting = false;
      }
    },

    resetForm() {
      this.form = {
        name: '',
        description: '',
        price: null,
        duration_minutes: null,
      };
    },

    handleServiceSelected(service) {
      console.log('Service selected:', service);
      // Implement service detail view or other actions
    },

    handleEditService(service) {
      // Pre-fill form with service data for editing
      this.form = {
        name: service.name,
        description: service.description || '',
        price: service.price,
        duration_minutes: service.duration_minutes || null,
      };
      
      // Scroll to form
      document.querySelector('.service-form').scrollIntoView({ 
        behavior: 'smooth' 
      });
      
      this.showStatus(`Editing service: ${service.name}`, 'info');
    },

    handleServiceDeleted(service) {
      this.showStatus(`Layanan "${service.name}" berhasil dihapus`, 'success');
    },

    showStatus(text, type = 'info') {
      this.statusMessage = { text, type };
      
      // Auto hide after 5 seconds
      setTimeout(() => {
        this.statusMessage = null;
      }, 5000);
    },
  },
};
</script>

<style>
/* Global Styles */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
}

#app {
  padding: 20px;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  background: white;
  border-radius: 15px;
  box-shadow: 0 20px 40px rgba(0,0,0,0.1);
  overflow: hidden;
}

/* Header */
.app-header {
  background: linear-gradient(135deg, #2196F3, #21CBF3);
  color: white;
  padding: 40px;
  text-align: center;
  position: relative;
}

.app-header h1 {
  font-size: 2.5em;
  margin-bottom: 10px;
  text-shadow: 0 2px 4px rgba(0,0,0,0.3);
}

.app-header p {
  font-size: 1.1em;
  opacity: 0.9;
  margin-bottom: 20px;
}

.api-status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: rgba(255,255,255,0.2);
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 0.9em;
}

.status-indicator {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

.status-indicator.connected {
  background: #4CAF50;
}

.status-indicator.disconnected {
  background: #f44336;
}

@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.5; }
  100% { opacity: 1; }
}

/* Main Content */
.app-main {
  padding: 40px;
}

/* Add Service Section */
.add-service-section {
  margin-bottom: 40px;
}

.add-service-section h2 {
  color: #333;
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 3px solid #2196F3;
  display: inline-block;
}

.service-form {
  background: #f8f9fa;
  padding: 30px;
  border-radius: 12px;
  border: 1px solid #e9ecef;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 20px;
}

@media (max-width: 768px) {
  .form-row {
    grid-template-columns: 1fr;
  }
}

.form-group {
  display: flex;
  flex-direction: column;
}

.form-group label {
  margin-bottom: 8px;
  font-weight: 600;
  color: #555;
}

.form-group input,
.form-group textarea {
  padding: 12px;
  border: 2px solid #ddd;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 0.3s ease;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #2196F3;
  box-shadow: 0 0 0 3px rgba(33, 150, 243, 0.1);
}

.form-actions {
  display: flex;
  gap: 15px;
  justify-content: flex-start;
}

.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.btn-primary {
  background: linear-gradient(135deg, #2196F3, #21CBF3);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(33, 150, 243, 0.3);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background: #5a6268;
  transform: translateY(-2px);
}

/* Status Messages */
.status-message {
  padding: 15px 20px;
  border-radius: 8px;
  margin-bottom: 20px;
  font-weight: 600;
}

.status-message.success {
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.status-message.error {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.status-message.info {
  background: #d1ecf1;
  color: #0c5460;
  border: 1px solid #bee5eb;
}

/* Services Section */
.services-section {
  border-top: 1px solid #e9ecef;
  padding-top: 30px;
}
</style>