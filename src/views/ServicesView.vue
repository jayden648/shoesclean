<template>
  <div class="services-page">
    <ServiceList />
  </div>
</template>

<script setup>
import ServiceList from '@/components/ServiceList.vue'; // Pastikan path ini benar
async function fetchServices() {
  console.log('Attempting to fetch services...'); // Tambahkan ini untuk debugging
  loading.value = true;
  // ... sisa kode
}
</script>

<style scoped>
/* Anda bisa menambahkan gaya khusus untuk halaman ini jika perlu */
</style>