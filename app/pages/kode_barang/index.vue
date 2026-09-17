<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { toast } from 'vue3-toastify'
import { StoreDatas } from '~/store/state_management'

// --- STATE PENGGUNA ---
const username = ref('')
const tipeLembaga = ref('') 
const idSekolah = ref(0)
const wsStatus = ref('Connecting...')

// --- STATE DATA KODE BARANG ---
const listKodeBarang = ref<any[]>([])
const isLoading = ref(true)

// --- STATE MODAL & FORM ---
const isModalOpen = ref(false)
const isSaving = ref(false)
const formData = ref({
    golongan: '',
    kelompok: '',
    sub_kelompok: '',
    nama_barang: ''
})

// Menyimpan WS murni (Native) untuk menghindari bug Proxy dari useState
let localWs: WebSocket | null = null;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

// --- FUNGSI WEBSOCKET ---
const initWebSocket = () => {
    if (!username.value) return;

    // Ambil dari store
    let ws = StoreDatas().GetDatasWebsocket() as WebSocket

    // Jika koneksi hilang (karena refresh halaman) atau rusak karena Proxy, buat baru!
    if(!ws || ws.readyState !== WebSocket.OPEN) {
        console.log("[WS] Membuat koneksi baru dari halaman Kode Barang...");
        ws = new WebSocket(`ws://localhost:4000/ws/connection/${username.value}`)
        StoreDatas().SetDatasWebsocket(ws)
    }
    
    localWs = ws;

    // Jika koneksi sudah terbuka dari halaman sebelumnya
    if (localWs.readyState === WebSocket.OPEN) {
        wsStatus.value = 'Connected'
        sendMessageAmbilDataKodeBarang()
    }

    localWs.onopen = () => {
        wsStatus.value = 'Connected'
        console.log(`[WS] Terhubung sebagai ${username.value}`)

        // Wajib subscribe ulang ke channel tipe_lembaga
        localWs?.send(JSON.stringify({
            event: `Subs-${tipeLembaga.value}`,
            tipe_lembaga: tipeLembaga.value
        }))

        sendMessageAmbilDataKodeBarang()
    }

    // Daftarkan listener
    localWs.addEventListener('message', loadDataKodeBarang)

    localWs.onclose = (event) => {
        if (event.code === 1000) return; // Abaikan jika sengaja di-logout
        
        wsStatus.value = 'Reconnecting...'
        if(reconnectTimeout) clearTimeout(reconnectTimeout)
        reconnectTimeout = setTimeout(initWebSocket, 3000)
    }
}

const sendMessageAmbilDataKodeBarang = () => {
    if(!localWs || localWs.readyState !== WebSocket.OPEN) return;

    console.log("[WS] Meminta Data Kode Barang...");
    localWs.send(JSON.stringify({
        event: `GetDataKodeBarang`, // Harus persis dengan case di backend
        tipe_lembaga: tipeLembaga.value
    }))
}

const loadDataKodeBarang = (event: MessageEvent) => {
    try {
        const response = JSON.parse(event.data)

        // Filter event khusus Kode Barang untuk lembaga ini
        if (response.event === `GetDataKodeBarang-${tipeLembaga.value}`) {
            console.log("[WS] Data Kode Barang Berhasil Diterima:", response)
            listKodeBarang.value = response.data || []
            isLoading.value = false
        }
    } catch (error) {
        console.log("Gagal memparsing data WS:", error)
    }
}

// --- FUNGSI TAMBAH DATA (REST API) ---
const openModal = () => { isModalOpen.value = true }
const closeModal = () => {
    isModalOpen.value = false
    formData.value = { golongan: '', kelompok: '', sub_kelompok: '', nama_barang: '' }
}

const saveKodeBarang = async () => {
    if(!formData.value.golongan || !formData.value.kelompok || !formData.value.sub_kelompok || !formData.value.nama_barang){
        return toast.warning("Semua kolom harus diisi!")
    }

    isSaving.value = true
    try {
        const res = await fetch("http://localhost:4000/api/kode_barang/tambah", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData.value)
        })

        const result = await res.json()

        if(result.status === 200){
            toast.success(result.message)
            closeModal()
            // Ambil ulang data (Refresh tabel)
            sendMessageAmbilDataKodeBarang()
        } else {
            toast.error(result.message || "Gagal menyimpan data")
        }
    } catch (error) {
        toast.error("Terjadi kesalahan pada server")
    } finally {
        isSaving.value = false
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
        localWs.removeEventListener('message', loadDataKodeBarang)
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
                <h1 class="page-title">Data Kode Barang</h1>
                
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
                
                <!-- KOTAK TABEL -->
                <div class="content-card">
                    <div class="card-header">
                        <h2 class="card-title">Data Kode Barang</h2>
                        <button @click="openModal" class="btn-primary">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                            Tambah Kode Barang
                        </button>
                    </div>

                    <!-- TABEL DATA -->
                    <div v-if="isLoading" class="empty-state">
                        <p>Memuat data kode barang...</p>
                    </div>
                    <div v-else-if="listKodeBarang.length === 0" class="empty-state">
                        <p>Belum ada data kode barang.</p>
                    </div>
                    <div v-else class="data-table-wrapper">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Golongan</th>
                                    <th>Kelompok</th>
                                    <th>Sub Kelompok</th>
                                    <th>Nama Barang</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="(item, index) in listKodeBarang" :key="index">
                                    <td>{{ item.id_kode }}</td>
                                    <td>{{ item.golongan || '-' }}</td>
                                    <td>{{ item.kelompok || '-' }}</td>
                                    <td>{{ item.sub_kelompok || '-' }}</td>
                                    <td>{{ item.nama_barang || '-' }}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </main>

        <!-- MODAL TAMBAH DATA (OVERLAY) -->
        <div v-if="isModalOpen" class="modal-overlay" @click.self="closeModal">
            <div class="modal-card">
                <!-- Modal Header -->
                <div class="modal-header">
                    <h3>Tambah Data Kode Barang</h3>
                    <button @click="closeModal" class="btn-close">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>

                <!-- Modal Body (Form Input Grid) -->
                <div class="modal-body">
                    <div class="form-grid">
                        <div class="form-group">
                            <label>Golongan</label>
                            <input v-model="formData.golongan" type="text" class="form-control" placeholder="Contoh: B">
                        </div>
                        <div class="form-group">
                            <label>Kelompok</label>
                            <input v-model="formData.kelompok" type="text" class="form-control" placeholder="Contoh: 3">
                        </div>
                        <div class="form-group">
                            <label>Sub Kelompok</label>
                            <input v-model="formData.sub_kelompok" type="text" class="form-control" placeholder="Contoh: 3">
                        </div>
                        <div class="form-group">
                            <label>Nama Barang</label>
                            <input v-model="formData.nama_barang" type="text" class="form-control" placeholder="Contoh: Lemari Kayu">
                        </div>
                    </div>
                </div>

                <!-- Modal Footer -->
                <div class="modal-footer">
                    <button @click="closeModal" class="btn-outline">Batal</button>
                    <button @click="saveKodeBarang" class="btn-primary" :disabled="isSaving">
                        {{ isSaving ? 'Menyimpan...' : 'Simpan Data' }}
                    </button>
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
}

.card-title {
    font-size: 18px;
    font-weight: 600;
    color: #111827;
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

.btn-outline {
    background-color: transparent;
    color: #4b5563;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    padding: 10px 16px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-outline:hover { background-color: #f3f4f6; }

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
    border-bottom: 1px solid #f3f4f6;
}

.data-table th {
    color: #374151;
    font-weight: 600;
}

.data-table td {
    color: #111827;
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
    max-width: 600px;
    border-radius: 12px;
    box-shadow: 0 10px 25px rgba(0,0,0,0.1);
    animation: modalPop 0.2s ease-out;
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
}

.modal-header h3 {
    margin: 0;
    font-size: 18px;
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

/* MODAL BODY (GRID FORM) */
.modal-body {
    padding: 0 24px 20px 24px;
}

.form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
}

.form-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.form-group label {
    font-size: 13px;
    font-weight: 500;
    color: #374151;
}

.form-control {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 14px;
    color: #111827;
    outline: none;
    transition: border-color 0.2s;
}

.form-control:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.modal-footer {
    padding: 20px 24px;
    display: flex;
    justify-content: flex-end;
    gap: 12px;
}
</style>