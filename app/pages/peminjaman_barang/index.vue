<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { toast } from 'vue3-toastify'
import { StoreDatas } from '~/store/state_management'

// --- STATE PENGGUNA ---
const username = ref('')
const tipeLembaga = ref('') 
const idSekolah = ref(0)
const wsStatus = ref('Connecting...')

// --- STATE DATA PEMINJAMAN ---
const listPeminjaman = ref<any[]>([])
const isLoading = ref(true)

// --- STATE MODAL KONFIRMASI ---
const isConfirmModalOpen = ref(false)
const listRequest = ref<any[]>([])
const isLoadingRequest = ref(false)
const isConfirming = ref(false)

// Menyimpan WS lokal
let localWs: WebSocket | null = null;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

// --- FUNGSI WEBSOCKET ---
const initWebSocket = () => {
    if (!username.value) return;

    let ws = StoreDatas().GetDatasWebsocket() as WebSocket

    if(!ws || ws.readyState !== WebSocket.OPEN) {
        ws = new WebSocket(`ws://localhost:4000/ws/connection/${username.value}`)
        StoreDatas().SetDatasWebsocket(ws)
    }
    
    localWs = ws;

    if (localWs.readyState === WebSocket.OPEN) {
        wsStatus.value = 'Connected'
        sendMessageAmbilDataPeminjaman()
    }

    localWs.onopen = () => {
        wsStatus.value = 'Connected'
        
        localWs?.send(JSON.stringify({
            event: `Subs-${tipeLembaga.value}`,
            tipe_lembaga: tipeLembaga.value
        }))

        sendMessageAmbilDataPeminjaman()
    }

    localWs.addEventListener('message', loadDataPeminjaman)

    localWs.onclose = (event) => {
        if (event.code === 1000) return; 
        
        wsStatus.value = 'Reconnecting...'
        if(reconnectTimeout) clearTimeout(reconnectTimeout)
        reconnectTimeout = setTimeout(initWebSocket, 3000)
    }
}

const sendMessageAmbilDataPeminjaman = () => {
    if(!localWs || localWs.readyState !== WebSocket.OPEN) return;

    localWs.send(JSON.stringify({
        event: `GetDataPeminjamanBarang-${tipeLembaga.value}`, 
        tipe_lembaga: tipeLembaga.value,
        id_sekolah: idSekolah.value
    }))
}

const loadDataPeminjaman = (event: MessageEvent) => {
    try {
        const response = JSON.parse(event.data)

        if (response.event === `GetDataPeminjamanBarang-${tipeLembaga.value}`) {
            listPeminjaman.value = response.data || []
            isLoading.value = false
        }

    } catch (error) {
        console.log("Gagal memparsing data WS:", error)
    }
}

// --- FUNGSI KONFIRMASI REQUEST (REST API) ---
const openConfirmModal = async () => {
    isConfirmModalOpen.value = true
    isLoadingRequest.value = true
    listRequest.value = []

    try {
        const res = await fetch(`http://localhost:4000/api/peminjaman_barang/ambil_request/${tipeLembaga.value}`)
        const result = await res.json()
        if(result.status === 200){
            listRequest.value = result.datas || []
        }
    } catch (error) {
        toast.error("Gagal mengambil data request peminjaman")
    } finally {
        isLoadingRequest.value = false
    }
}

const closeConfirmModal = () => {
    isConfirmModalOpen.value = false
}

const confirmRequest = async (item: any) => {
    isConfirming.value = true
    try {
        const payload = {
            id_peminjaman: item.id_peminjaman,
            id_barang: item.id_barang,
            tanggal_pinjam: item.tanggal_pinjam,
            status_peminjaman: 'Disetujui' // Mengubah status menjadi Disetujui
        }

        const res = await fetch("http://localhost:4000/api/peminjaman_barang/konfirmasi_request", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        })

        const result = await res.json()

        if(result.status === 200){
            toast.success("Berhasil mengonfirmasi peminjaman")
            // Hapus dari list modal secara lokal agar UI cepat responsif
            listRequest.value = listRequest.value.filter((req) => req.id_peminjaman !== item.id_peminjaman)
            
            // Refresh data utama via WS agar tabel terupdate
            sendMessageAmbilDataPeminjaman() 
        } else {
            toast.error(result.message || "Gagal mengonfirmasi")
        }
    } catch (error) {
        toast.error("Terjadi kesalahan koneksi")
    } finally {
        isConfirming.value = false
    }
}

// --- LIFECYCLE VUE ---
onMounted(() => {
    const cookieUser = useCookie("username").value
    if (!cookieUser) return useRouter().push("/")

    username.value = cookieUser as string
    tipeLembaga.value = useCookie("tipe_lembaga").value as string
    idSekolah.value = Number(useCookie("id_sekolah").value)

    initWebSocket()
})

onUnmounted(() => {
    if (localWs) {
        localWs.removeEventListener('message', loadDataPeminjaman)
    }
    if (reconnectTimeout) clearTimeout(reconnectTimeout)

    // const ws = StoreDatas().GetDatasWebsocket()
    
    // ws?.close()
    // StoreDatas().DeleteDatasWebsocket()
})
</script>

<template>
    <div class="layout-container">
        <!-- SIDEBAR NAVBAR -->
        <Navbar/>

        <!-- MAIN CONTENT AREA -->
        <main class="main-content">
            <!-- TOPBAR / HEADER -->
            <header class="topbar">
                <h1 class="page-title">Peminjaman Barang</h1>
                
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
                
                <div class="content-card">
                    <div class="card-header">
                        <h2 class="card-title">Daftar Peminjaman Barang</h2>
                        
                        <!-- Hanya ada Tombol Konfirmasi Saja (Warna Ungu) -->
                        <div class="header-actions">
                            <button @click="openConfirmModal" class="btn-primary btn-purple">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                Konfirmasi Barang Dipinjamkan
                            </button>
                        </div>
                    </div>

                    <!-- TABEL DATA -->
                    <div v-if="isLoading" class="empty-state">
                        <p>Memuat data peminjaman...</p>
                    </div>
                    <div v-else-if="listPeminjaman.length === 0" class="empty-state">
                        <p>Belum ada data peminjaman terdaftar.</p>
                    </div>
                    <div v-else class="data-table-wrapper">
                        <div class="table-scroll">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>ID Pinjam</th>
                                        <th>ID Barang</th>
                                        <th>Nama Peminjam</th>
                                        <th>Unit Lembaga</th>
                                        <th>Nama Barang</th>
                                        <th>Merk Barang</th>
                                        <th>Tanggal Pinjam</th>
                                        <th>Status Peminjaman</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="(item, index) in listPeminjaman" :key="index">
                                        <td>{{ item.id_peminjaman }}</td>
                                        <td class="text-blue font-medium">{{ item.id_barang }}</td>
                                        <td>{{ item.nama_peminjam || '-' }}</td>
                                        <td>{{ item.unit_lembaga || '-' }}</td>
                                        <td>{{ item.nama_barang || '-' }}</td>
                                        <td>{{ item.nama_merk || '-' }}</td>
                                        <td>{{ item.tanggal_pinjam ? item.tanggal_pinjam.split('T')[0] : '-' }}</td>
                                        <td>
                                            <span :class="['badge', item.status_peminjaman === 'Pending/Tunggu Konfirmasi' ? 'badge-pending' : 'badge-success']">
                                                {{ item.status_peminjaman || '-' }}
                                            </span>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </main>

        <!-- ============================================== -->
        <!-- MODAL KONFIRMASI REQUEST (OVERLAY)             -->
        <!-- ============================================== -->
        <div v-if="isConfirmModalOpen" class="modal-overlay" @click.self="closeConfirmModal">
            <div class="modal-card large-modal">
                <div class="modal-header">
                    <h3>Konfirmasi Request Peminjaman Barang</h3>
                    <button @click="closeConfirmModal" class="btn-close">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
                
                <div class="modal-body">
                    <!-- LOADING STATE -->
                    <div v-if="isLoadingRequest" class="empty-state-modal">
                        <p>Memuat data request...</p>
                    </div>

                    <!-- EMPTY STATE JIKA TIDAK ADA REQUEST -->
                    <div v-else-if="listRequest.length === 0" class="empty-state-modal">
                        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mb-2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                        <p>Tidak ada request peminjaman yang belum dikonfirmasi.</p>
                    </div>

                    <!-- JIKA ADA DATA REQUEST -->
                    <div v-else class="table-scroll">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>ID Pinjam</th>
                                    <th>ID Barang</th>
                                    <th>Nama Barang</th>
                                    <th>Merk Barang</th>
                                    <th>Nama Peminjam</th>
                                    <th>Tgl Pinjam</th>
                                    <th>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="item in listRequest" :key="item.id_peminjaman">
                                    <td>{{ item.id_peminjaman }}</td>
                                    <td class="text-blue font-medium">{{ item.id_barang }}</td>
                                    <td class="text-blue font-medium">{{ item.nama_barang }}</td>
                                    <td class="text-blue font-medium">{{ item.nama_merk }}</td>
                                    <td>{{ item.nama_peminjam }}</td>
                                    <td>{{ item.tanggal_pinjam ? item.tanggal_pinjam.split('T')[0] : '-' }}</td>
                                    <td>
                                        <button @click="confirmRequest(item)" class="btn-primary btn-purple text-small" :disabled="isConfirming">
                                            {{ isConfirming ? 'Proses...' : 'Setujui' }}
                                        </button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>

    </div>
</template>

<style scoped>
/* RESET DASAR */
* {
    box-sizing: border-box;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    margin: 0;
    padding: 0;
}

/* LAYOUT UTAMA */
.layout-container {
    display: flex;
    min-height: 100vh;
    background-color: #f3f4f6; 
}

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

/* WRAPPER KONTEN & KOTAK TABEL */
.page-wrapper {
    padding: 32px;
    display: flex;
    flex-direction: column;
}

.content-card {
    background-color: #ffffff;
    border-radius: 12px;
    padding: 24px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}

.card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
    flex-wrap: wrap;
    gap: 16px;
}

.card-title {
    font-size: 18px;
    font-weight: 600;
    color: #111827;
}

.header-actions {
    display: flex;
    gap: 12px;
}

/* BUTTONS */
.btn-primary {
    background-color: #3b82f6;
    color: #ffffff;
    border: none;
    border-radius: 6px;
    padding: 10px 16px;
    font-size: 14px;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    transition: background-color 0.2s;
}
.btn-primary:hover:not(:disabled) { background-color: #2563eb; }
.btn-primary:disabled { opacity: 0.7; cursor: not-allowed; }

/* Warna Ungu Spesifik Sesuai Gambar Konfirmasi */
.btn-purple { background-color: #8b5cf6; }
.btn-purple:hover:not(:disabled) { background-color: #7c3aed; }

/* TABEL DATA */
.empty-state {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 200px;
    color: #6b7280;
    font-size: 14px;
}

.data-table-wrapper {
    max-width: 100%;
}

.table-scroll {
    overflow-x: auto;
    padding-bottom: 15px; 
}

.table-scroll::-webkit-scrollbar { height: 8px; }
.table-scroll::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 4px; }
.table-scroll::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 4px; }
.table-scroll::-webkit-scrollbar-thumb:hover { background: #9ca3af; }

.data-table {
    width: 100%;
    border-collapse: collapse;
    text-align: left;
    font-size: 13px;
}

.data-table th, .data-table td {
    padding: 16px 14px;
    border-bottom: 1px solid #f3f4f6;
    white-space: nowrap; 
}

.data-table th {
    color: #4b5563;
    font-weight: 600;
}

.data-table td {
    color: #1f2937;
}

/* Text Utilities & Badges */
.text-blue { color: #3b82f6; }
.font-medium { font-weight: 500; }
.text-small { font-size: 12px; padding: 6px 10px;}

.badge {
    display: inline-block;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 500;
}
.badge-pending {
    background-color: #fef3c7; /* Kuning Pudar */
    color: #b45309;
}
.badge-success {
    background-color: #d1fae5; /* Hijau Pudar */
    color: #065f46;
}

/* MODAL STYLES */
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.4);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 50;
    padding: 20px;
}

.modal-card {
    background-color: #ffffff;
    width: 100%;
    border-radius: 12px;
    box-shadow: 0 10px 25px rgba(0,0,0,0.1);
    animation: modalPop 0.2s ease-out;
}

.large-modal {
    max-width: 700px;
}

@keyframes modalPop {
    from { transform: scale(0.95); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
}

.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 24px;
    border-bottom: 1px solid #f3f4f6;
}

.modal-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #111827;
}

.btn-close {
    background: transparent;
    border: none;
    color: #9ca3af;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.2s;
}

.btn-close:hover { color: #111827; }

.modal-body {
    padding: 24px;
}

.empty-state-modal {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: 150px;
    color: #6b7280;
    font-size: 14px;
}

.mb-2 {
    margin-bottom: 12px;
}
</style>