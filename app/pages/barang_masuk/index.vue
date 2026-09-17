<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { toast } from 'vue3-toastify'
import { StoreDatas } from '~/store/state_management'

// --- STATE PENGGUNA ---
const username = ref('')
const tipeLembaga = ref('') 
const idSekolah = ref(0)
const wsStatus = ref('Connecting...')

// --- STATE DATA BARANG MASUK ---
const listBarangMasuk = ref<any[]>([])
const isLoading = ref(true)

// --- STATE MODAL & FORM ---
const isModalOpen = ref(false)
const isSaving = ref(false)

const formData = ref({
    nama_barang: '', 
    nama_satuan: '',
    kondisi_barang: '',
    harga_barang: '',
    tahun_pembuatan: '',
    nama_merk: '',
    pabrik: '',          
    nomor: '',
    ukuran: '',
    ruang: '',
    status_ket: '',
    tempat: '',
    pembelian: '',
    asal_barang: '',
    kuantitas: '',       // Menambahkan field kuantitas
    tanggal_masuk: '',
    id_sekolah: 0
})

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
        sendMessageAmbilDataBarangMasuk()
    }

    localWs.onopen = () => {
        wsStatus.value = 'Connected'
        
        localWs?.send(JSON.stringify({
            event: `Subs-${tipeLembaga.value}`,
            tipe_lembaga: tipeLembaga.value
        }))

        sendMessageAmbilDataBarangMasuk()
    }

    localWs.addEventListener('message', loadDataBarangMasuk)

    localWs.onclose = (event) => {
        if (event.code === 1000) return; 
        
        wsStatus.value = 'Reconnecting...'
        if(reconnectTimeout) clearTimeout(reconnectTimeout)
        reconnectTimeout = setTimeout(initWebSocket, 3000)
    }
}

const sendMessageAmbilDataBarangMasuk = () => {
    if(!localWs || localWs.readyState !== WebSocket.OPEN) return;

    localWs.send(JSON.stringify({
        event: `GetDataBarangMasuk-${tipeLembaga.value}`, 
        tipe_lembaga: tipeLembaga.value,
        id_sekolah: idSekolah.value
    }))
}

const loadDataBarangMasuk = (event: MessageEvent) => {
    try {
        const response = JSON.parse(event.data)

        if (response.event === `GetDataBarangMasuk-${tipeLembaga.value}`) {
            listBarangMasuk.value = response.data || []
            isLoading.value = false
        }
    } catch (error) {
        console.log("Gagal memparsing data WS:", error)
    }
}

// --- FUNGSI TAMBAH DATA (REST API) ---
const openModal = () => { 
    isModalOpen.value = true 
}

const closeModal = () => {
    isModalOpen.value = false
    // Reset form
    formData.value = { 
        nama_barang: '', nama_satuan: '', kondisi_barang: '', harga_barang: '',
        tahun_pembuatan: '', nama_merk: '', pabrik: '', nomor: '', ukuran: '',
        ruang: '', status_ket: '', tempat: '', pembelian: '',
        asal_barang: '', kuantitas: '', tanggal_masuk: '',
        id_sekolah: idSekolah.value
    }
}

const saveBarangMasuk = async () => {
    if(!formData.value.nama_barang || !formData.value.tanggal_masuk){
        return toast.warning("Nama Barang & Tanggal Masuk wajib diisi!")
    }

    isSaving.value = true
    try {
        const payload = {
            ...formData.value,
            // Konversi harga, tahun, dan kuantitas ke angka
            harga_barang: formData.value.harga_barang ? Number(formData.value.harga_barang) : 0,
            tahun_pembuatan: formData.value.tahun_pembuatan ? Number(formData.value.tahun_pembuatan) : null,
            kuantitas: formData.value.kuantitas ? Number(formData.value.kuantitas) : 0
        }

        const res = await fetch("http://localhost:4000/api/barang_masuk/tambah", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        })

        const result = await res.json()

        if(result.status === 200 || result.status === 201){
            toast.success(result.message || "Barang masuk berhasil dicatat")
            closeModal()
            sendMessageAmbilDataBarangMasuk() 
        } else {
            toast.error(result.message || "Gagal menyimpan data")
        }
    } catch (error) {
        toast.error("Terjadi kesalahan koneksi ke server")
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

    formData.value.id_sekolah = idSekolah.value

    initWebSocket()
})

onUnmounted(() => {
    if (localWs) {
        localWs.removeEventListener('message', loadDataBarangMasuk)
    }
    if (reconnectTimeout) clearTimeout(reconnectTimeout)
})
</script>

<template>
    <div class="layout-container">
        <Navbar/>

        <main class="main-content">
            <header class="topbar">
                <h1 class="page-title">Data Barang Masuk</h1>
                
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

            <div class="page-wrapper">
                <div class="content-card">
                    <div class="card-header">
                        <h2 class="card-title">Daftar Barang Masuk</h2>
                        <button @click="openModal" class="btn-primary btn-green">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                            Tambah Barang Masuk
                        </button>
                    </div>

                    <div v-if="isLoading" class="empty-state">
                        <p>Memuat data barang masuk...</p>
                    </div>
                    <div v-else-if="listBarangMasuk.length === 0" class="empty-state">
                        <p>Belum ada data barang masuk.</p>
                    </div>
                    <div v-else class="data-table-wrapper">
                        <div class="table-scroll">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Nama Barang</th>
                                        <th>Gol / Kelompok</th>
                                        <th>Sub Kelompok</th>
                                        <th>Satuan</th>
                                        <th>Merk / Pabrik / No / Ukuran</th>
                                        <th>Kondisi</th>
                                        <th>Harga</th>
                                        <th>Kuantitas</th> <!-- Tambahan Header Kuantitas -->
                                        <th>Ruang</th>
                                        <th>Asal Barang</th>
                                        <th>Tanggal Masuk</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="(item, index) in listBarangMasuk" :key="index">
                                        <td>{{ item.id_barang_masuk || item.id_barang }}</td>
                                        <td>{{ item.nama_barang || '-' }}</td>
                                        <td>{{ item.golongan || '-' }} / {{ item.kelompok || '-' }}</td>
                                        <td>{{ item.sub_kelompok || '-' }}</td>
                                        <td>{{ item.nama_satuan || '-' }}</td>
                                        <td>
                                            {{ item.nama_merk || '-' }} / 
                                            {{ item.pabrik || '-' }} / 
                                            {{ item.nomor || 'nill' }} / 
                                            {{ item.ukuran || '-' }}
                                        </td>
                                        <td>{{ item.kondisi_barang || '-' }}</td>
                                        <td style="white-space: nowrap;">
                                            {{ item.harga_barang ? 'Rp ' + Number(item.harga_barang).toLocaleString('id-ID') : '-' }}
                                        </td>
                                        <!-- Menampilkan nilai kuantitas dari database -->
                                        <td>{{ item.kuantitas || '0' }}</td>
                                        <td>{{ item.ruang || '-' }}</td>
                                        <td>{{ item.asal_barang || '-' }}</td>
                                        <td>{{ item.tanggal_masuk ? item.tanggal_masuk.split('T')[0] : '-' }}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </main>

        <!-- MODAL TAMBAH DATA -->
        <div v-if="isModalOpen" class="modal-overlay" @click.self="closeModal">
            <div class="modal-card large-modal">
                <div class="modal-header">
                    <h3>Tambah Data Barang Masuk</h3>
                    <button @click="closeModal" class="btn-close">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>

                <div class="modal-body scrollable-body">
                    <div class="form-group mb-16">
                        <label>Nama Barang / Tipe</label>
                        <input v-model="formData.nama_barang" type="text" class="form-control" placeholder="Laptop">
                    </div>

                    <div class="form-grid">
                        <div class="form-group">
                            <label>Nama Satuan</label>
                            <input v-model="formData.nama_satuan" type="text" class="form-control" placeholder="Pcs / Unit">
                        </div>
                        <div class="form-group">
                            <label>Kondisi Barang</label>
                            <input v-model="formData.kondisi_barang" type="text" class="form-control" placeholder="Baik / Rusak">
                        </div>

                        <div class="form-group">
                            <label>Harga Barang (Rp)</label>
                            <input v-model="formData.harga_barang" type="number" class="form-control" placeholder="0">
                        </div>
                        <div class="form-group">
                            <label>Kuantitas Barang</label>
                            <!-- Input khusus untuk Kuantitas -->
                            <input v-model="formData.kuantitas" type="number" class="form-control" placeholder="0" min="1">
                        </div>

                        <div class="form-group">
                            <label>Nama Merk</label>
                            <input v-model="formData.nama_merk" type="text" class="form-control" placeholder="">
                        </div>
                        <div class="form-group">
                            <label>Pabrik</label>
                            <input v-model="formData.pabrik" type="text" class="form-control" placeholder="">
                        </div>

                        <div class="form-group">
                            <label>Nomor Merk/Seri</label>
                            <input v-model="formData.nomor" type="text" class="form-control" placeholder="">
                        </div>
                        <div class="form-group">
                            <label>Ukuran</label>
                            <input v-model="formData.ukuran" type="text" class="form-control" placeholder="">
                        </div>

                        <div class="form-group">
                            <label>Tahun Pembuatan</label>
                            <input v-model="formData.tahun_pembuatan" type="number" class="form-control" placeholder="2026">
                        </div>
                        <div class="form-group">
                            <label>Ruang</label>
                            <input v-model="formData.ruang" type="text" class="form-control" placeholder="Kelas SMA">
                        </div>

                        <div class="form-group">
                            <label>Status Keterangan</label>
                            <input v-model="formData.status_ket" type="text" class="form-control" placeholder="Dihibahkan/Mutasi">
                        </div>
                        <div class="form-group">
                            <label>Tempat</label>
                            <input v-model="formData.tempat" type="text" class="form-control" placeholder="TU">
                        </div>

                        <div class="form-group">
                            <label>Pembelian Dari</label>
                            <input v-model="formData.pembelian" type="text" class="form-control" placeholder="">
                        </div>
                        <div class="form-group">
                            <label>Asal Barang</label>
                            <input v-model="formData.asal_barang" type="text" class="form-control" placeholder="Bantuan / Beli">
                        </div>

                        <div class="form-group">
                            <label>Tanggal Masuk</label>
                            <input v-model="formData.tanggal_masuk" type="date" class="form-control">
                        </div>
                    </div>
                </div>

                <div class="modal-footer">
                    <button @click="closeModal" class="btn-outline">Batal</button>
                    <button @click="saveBarangMasuk" class="btn-primary" :disabled="isSaving">
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

.btn-green {
    background-color: #10b981; 
}
.btn-green:hover:not(:disabled) { background-color: #059669; }

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
    max-width: 100%;
}

.table-scroll {
    overflow-x: auto;
    padding-bottom: 15px; 
}
.table-scroll::-webkit-scrollbar { height: 10px; }
.table-scroll::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 4px; }
.table-scroll::-webkit-scrollbar-thumb { background: #9ca3af; border-radius: 4px; }
.table-scroll::-webkit-scrollbar-thumb:hover { background: #6b7280; }

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

.modal-card.large-modal {
    background-color: #ffffff;
    width: 100%;
    max-width: 700px;
    border-radius: 12px;
    box-shadow: 0 10px 25px rgba(0,0,0,0.1);
    animation: modalPop 0.2s ease-out;
    display: flex;
    flex-direction: column;
    max-height: 90vh; 
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

.scrollable-body {
    overflow-y: auto;
    padding: 20px 24px;
}

.scrollable-body::-webkit-scrollbar { width: 8px; }
.scrollable-body::-webkit-scrollbar-track { background: transparent; }
.scrollable-body::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 4px; }
.scrollable-body::-webkit-scrollbar-thumb:hover { background: #9ca3af; }

.mb-16 {
    margin-bottom: 16px;
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
    border-top: 1px solid #f3f4f6;
}
</style>