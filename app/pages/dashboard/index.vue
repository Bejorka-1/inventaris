<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { StoreDatas } from '~/store/state_management'

// --- STATE PENGGUNA ---
const username = ref('')
const tipeLembaga = ref('') 
const idSekolah = ref(0)

// --- STATE WEBSOCKET & DATA ---
const wsStatus = ref('Reconnecting...')
const totalInventaris = ref(0)
const totalBarangMasuk = ref(0)
const totalBarangKeluar = ref(0)
const totalPeminjamanBarang = ref(0)
const inventarisList = ref<any[]>([])
const isLoading = ref(true)

// --- STATE FILTERING ---
const searchQuery = ref('')
const statusFilter = ref('')

let ws: WebSocket | null = null;

const initWebSocket = () => {
    // 1. Inisialisasi Koneksi
    ws = new WebSocket(`ws://localhost:4000/ws/connection/${username.value}`)

    StoreDatas().SetDatasWebsocket(ws)

    // 2. Event On Open (Saat berhasil terhubung)
    ws.onopen = () => {
        wsStatus.value = 'Connected'
        console.log(`[WS] Terhubung sebagai ${username.value}`)

        // A. Subscribe ke channel/room tipe lembaga
        ws?.send(JSON.stringify({
            event: `Subs-${tipeLembaga.value}`,
            tipe_lembaga: tipeLembaga.value
        }))

        // B. Minta data saat pertama kali load
        ws?.send(JSON.stringify({
            event: `GetDataInventory-${tipeLembaga.value}`,
            tipe_lembaga: tipeLembaga.value,
            id_sekolah: idSekolah.value
        }))
        
        ws?.send(JSON.stringify({
            event: `GetDataBarangMasuk-${tipeLembaga.value}`,
            tipe_lembaga: tipeLembaga.value,
            id_sekolah: idSekolah.value
        }))
        
        ws?.send(JSON.stringify({
            event: `GetDataBarangKeluar-${tipeLembaga.value}`,
            tipe_lembaga: tipeLembaga.value,
            id_sekolah: idSekolah.value
        }))
        
        ws?.send(JSON.stringify({
            event: `GetDataPeminjamanBarang-${tipeLembaga.value}`,
            tipe_lembaga: tipeLembaga.value,
            id_sekolah: idSekolah.value
        }))
    }

    // 3. Event On Message (Saat menerima data dari server)
    ws.onmessage = (event) => {
        const response = JSON.parse(event.data)
        
        // Tangkap event khusus untuk masing-masing data
        if (response.event === `GetDataInventory-${tipeLembaga.value}`) {
            inventarisList.value = response.data || []
            totalInventaris.value = inventarisList.value.length
            isLoading.value = false
        } else if(response.event === `GetDataBarangMasuk-${tipeLembaga.value}`) {
            totalBarangMasuk.value = response.data.length
        } else if(response.event === `GetDataBarangKeluar-${tipeLembaga.value}`) {
            totalBarangKeluar.value = response.data.length
        } else if(response.event === `GetDataPeminjamanBarang-${tipeLembaga.value}`) {
            totalPeminjamanBarang.value = response.data.length
        }
    }

    // 4. Event On Close & Error
    ws.onclose = () => {
        wsStatus.value = 'Reconnecting...'
        console.log('[WS] Koneksi terputus. Mencoba menghubungkan kembali...')
        setTimeout(initWebSocket, 3000)
    }

    ws.onerror = (error) => {
        console.error("[WS] Terjadi Kesalahan:", error)
    }
}

onMounted(() => {
    const cookieUser = useCookie("username").value
    const cookieTipeLembaga = useCookie("tipe_lembaga").value
    const cookieIdSekolah = useCookie("id_sekolah").value

    // Jika tidak ada user, tendang ke halaman login
    if(!cookieUser) return useRouter().push("/")

    if (cookieUser) username.value = cookieUser
    if (cookieTipeLembaga) tipeLembaga.value = cookieTipeLembaga
    if (cookieIdSekolah) idSekolah.value = Number(cookieIdSekolah)

    initWebSocket()
})

// onUnmounted(() => {
//     const ws = StoreDatas().GetDatasWebsocket()
    
//     ws?.close()
//     StoreDatas().DeleteDatasWebsocket()
// })
</script>

<template>
    <div class="layout-container">
        
        <!-- PANGGIL KOMPONEN NAVBAR/SIDEBAR -->
        <Navbar/>

        <!-- MAIN CONTENT AREA -->
        <main class="main-content">
            <!-- TOPBAR / HEADER -->
            <header class="topbar">
                <h1 class="page-title">Dashboard</h1>
                
                <div class="topbar-right">
                    <span :class="['status-text', wsStatus === 'Connected' ? 'status-green' : 'status-orange']">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.59-11.45l5.25 5.25"></path></svg>
                        {{ wsStatus }}
                    </span>
                    <div class="user-profile">
                        <div class="avatar">{{ username.charAt(0).toUpperCase() }}</div>
                        <div class="user-info">
                            <span class="username">{{ username }}</span>
                            <span class="role">{{ tipeLembaga }}</span>
                        </div>
                    </div>
                </div>
            </header>

            <!-- PAGE CONTENT -->
            <div class="page-wrapper">
                
                <!-- CARDS GRID (4 Kotak Ringkasan) -->
                <div class="cards-grid">
                    <!-- Card 1: Inventaris -->
                    <div class="summary-card">
                        <div class="card-icon-box bg-blue">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                        </div>
                        <div class="card-details">
                            <h2 class="card-number">{{ totalInventaris }}</h2>
                            <p class="card-label">Total Inventaris</p>
                        </div>
                    </div>

                    <!-- Card 2: Barang Masuk -->
                    <div class="summary-card">
                        <div class="card-icon-box bg-green">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>
                        </div>
                        <div class="card-details">
                            <h2 class="card-number">{{ totalBarangMasuk }}</h2>
                            <p class="card-label">Barang Masuk</p>
                        </div>
                    </div>

                    <!-- Card 3: Barang Keluar -->
                    <div class="summary-card">
                        <div class="card-icon-box bg-orange">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>
                        </div>
                        <div class="card-details">
                            <h2 class="card-number">{{ totalBarangKeluar }}</h2>
                            <p class="card-label">Barang Keluar</p>
                        </div>
                    </div>

                    <!-- Card 4: Peminjaman -->
                    <div class="summary-card">
                        <div class="card-icon-box bg-purple">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                        </div>
                        <div class="card-details">
                            <h2 class="card-number">{{ totalPeminjamanBarang }}</h2>
                            <p class="card-label">Peminjaman</p>
                        </div>
                    </div>
                </div>

                <!-- INVENTORY SECTION -->
                <div class="inventory-section">
                    <h3 class="section-title">Data Inventaris Utama</h3>
                    <div class="content-card">
                        
                        <!-- FILTERS -->
                        <div class="filters-row">
                            <!-- Input Pencarian -->
                            <div class="search-box">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="search-icon"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                <input v-model="searchQuery" type="text" placeholder="Cari barang..." class="input-search">
                            </div>
                            
                            <!-- Filter Ketersediaan Tunggal -->
                            <div class="select-group">
                                <select v-model="statusFilter" class="filter-select">
                                    <option value="">Semua Status</option>
                                    <option value="Tersedia">Tersedia</option>
                                    <option value="Tidak">Tidak Tersedia</option>
                                </select>
                            </div>
                        </div>

                        <!-- DATA STATE / TABLE -->
                        <div v-if="isLoading" class="empty-state">
                            <p>Memuat data inventaris...</p>
                        </div>
                        <div v-else-if="inventarisList.length === 0" class="empty-state">
                            <p>Belum ada data inventaris.</p>
                        </div>
                        <div v-else class="data-table-wrapper">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>No</th>
                                        <th>Nama Barang</th>
                                        <th>Merk / Tipe</th>
                                        <th>Ruang / Tempat</th>
                                        <th>Kondisi</th>
                                        <th>Status Pembelian</th>
                                        <th>Status Ketersediaan</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <!-- Render data yang disesuaikan dengan response RepoGetInventory -->
                                    <tr v-for="(item, index) in inventarisList" :key="index">
                                        <td>{{ index + 1 }}</td>
                                        <td>
                                            <div class="font-medium text-dark">{{ item.nama_barang || '-' }}</div>
                                            <div class="text-small text-gray">{{ item.nama_satuan || '' }}</div>
                                        </td>
                                        <td>
                                            <div>{{ item.nama_merk || '-' }}</div>
                                            <div class="text-small text-gray">{{ item.tipe_barang || '' }}</div>
                                        </td>
                                        <td>
                                            <div>{{ item.ruang || '-' }}</div>
                                            <div class="text-small text-gray">{{ item.tempat || '' }}</div>
                                        </td>
                                        <td>
                                            <!-- Menggunakan kondisi_barang dari backend -->
                                            <span class="badge badge-kondisi">{{ item.kondisi_barang || '-' }}</span>
                                        </td>
                                        <td>
                                            <!-- Menggunakan status_keterangan dari backend -->
                                            <span class="badge badge-status">{{ item.status_keterangan || '-' }}</span>
                                        </td>
                                        <td>
                                            <!-- Menggunakan status_keterangan dari backend -->
                                            <span class="badge badge-status">{{ item.status_ketersediaan || '-' }}</span>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                    </div>
                </div>

            </div>
        </main>
    </div>
</template>

<style scoped>
/* RESET & FONTS */
* {
    box-sizing: border-box;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    margin: 0;
    padding: 0;
}

/* MAIN LAYOUT */
.layout-container {
    display: flex;
    min-height: 100vh;
    background-color: #f3f4f6; 
}

/* MAIN CONTENT (Bagian Kanan) */
.main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow-x: hidden; 
}

/* TOPBAR */
.topbar {
    background-color: #ffffff;
    border-bottom: 1px solid #e5e7eb;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 32px;
}

.page-title {
    font-size: 18px;
    font-weight: 600;
    color: #111827;
}

.topbar-right {
    display: flex;
    align-items: center;
    gap: 24px;
}

.status-text {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 500;
}

.status-orange { color: #f59e0b; }
.status-green { color: #10b981; }

.user-profile {
    display: flex;
    align-items: center;
    gap: 12px;
}

.avatar {
    width: 36px;
    height: 36px;
    background-color: #2563eb;
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 16px;
}

.user-info {
    display: flex;
    flex-direction: column;
}

.username {
    font-size: 14px;
    font-weight: 600;
    color: #111827;
}

.role {
    font-size: 12px;
    color: #6b7280;
}

/* PAGE WRAPPER */
.page-wrapper {
    padding: 32px;
    display: flex;
    flex-direction: column;
    gap: 32px;
}

/* CARDS GRID */
.cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); 
    gap: 20px;
}

.summary-card {
    background-color: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 24px;
    display: flex;
    align-items: center;
    gap: 20px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}

.card-icon-box {
    width: 54px;
    height: 54px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
}

/* Warna-warni Icon Box */
.bg-blue { background-color: #eff6ff; color: #3b82f6; }
.bg-green { background-color: #ecfdf5; color: #10b981; }
.bg-orange { background-color: #fffbeb; color: #f59e0b; }
.bg-purple { background-color: #f5f3ff; color: #8b5cf6; }

.card-details {
    display: flex;
    flex-direction: column;
}

.card-number {
    font-size: 24px;
    font-weight: 700;
    color: #111827;
}

.card-label {
    font-size: 13px;
    color: #6b7280;
    margin-top: 4px;
}

/* INVENTORY SECTION */
.section-title {
    font-size: 16px;
    font-weight: 600;
    color: #111827;
    margin-bottom: 16px;
}

.content-card {
    background-color: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 24px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    min-height: 300px;
}

/* FILTERS ROW */
.filters-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 16px;
    margin-bottom: 24px;
}

.search-box {
    position: relative;
    width: 300px;
}

.search-icon {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
}

.input-search {
    width: 100%;
    padding: 10px 10px 10px 36px;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font-size: 14px;
    outline: none;
    transition: border-color 0.2s;
}

.input-search:focus {
    border-color: #3b82f6;
}

.select-group {
    display: flex;
    gap: 12px;
}

.filter-select {
    padding: 10px 32px 10px 12px;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font-size: 14px;
    color: #374151;
    background-color: #ffffff;
    outline: none;
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 8px center;
    background-size: 16px;
}

.filter-select:focus {
    border-color: #3b82f6;
}

/* STATE TABLE & EMPTY */
.empty-state {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 150px;
    color: #6b7280;
    font-size: 14px;
}

/* Basic Table Styles */
.data-table-wrapper {
    overflow-x: auto;
}

.data-table {
    width: 100%;
    border-collapse: collapse;
    text-align: left;
    font-size: 14px;
}

.data-table th, .data-table td {
    padding: 14px 16px;
    border-bottom: 1px solid #e5e7eb;
}

.data-table th {
    background-color: #f9fafb;
    color: #374151;
    font-weight: 600;
}

.data-table td {
    color: #4b5563;
}

/* Tabel Text Utilities */
.font-medium { font-weight: 500; }
.text-dark { color: #111827; }
.text-small { font-size: 12px; }
.text-gray { color: #6b7280; margin-top: 2px;}

/* Badges */
.badge {
    display: inline-block;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 500;
}

.badge-kondisi {
    background-color: #f3f4f6;
    color: #374151;
    border: 1px solid #d1d5db;
}

.badge-status {
    background-color: #eff6ff;
    color: #1d4ed8;
    border: 1px solid #bfdbfe;
}
</style>