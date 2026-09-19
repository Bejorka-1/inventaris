<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { toast } from 'vue3-toastify'
import Navbar from '~/components/Navbar.vue'

// --- SESUAIKAN URL API ANDA ---
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzjvzPhMA9WND064RIbRemeQ4zutDvCGs6oJtWrWjMqm4zyWhKr_yrRlEASBEjZLQ/exec"

const dataPeminjaman = ref<any[]>([])
const dataMasterKode = ref<any[]>([])
const isLoading = ref(true)
const isSubmitting = ref(false)

const activeTab = ref('daftar') // 'daftar' atau 'form'

// Modal Pengembalian
const showReturnModal = ref(false)
const returnForm = ref({
    no_urut: '',
    nama_barang: '',
    peminjam: '',
    tanggal_pengembalian: '',
    keterangan: '',
    status_peminjaman: 'Selesai',
    status_pengembalian: 'Sudah Kembali'
})

// Modal Edit
const showEditModal = ref(false)
const editForm = ref({
    no_urut: '',
    nama_barang: '',
    ket_merk_ukuran: '',
    peminjam: '',
    kuantitas: 1,
    tanggal_pinjam: '',
    status_peminjaman: '',
    status_pengembalian: '',
    keterangan: ''
})

// Paginasi
const currentPage = ref(1)
const itemsPerPage = ref(15)

// Helper Tanggal
const getTodayDate = () => {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

const formatDateForInput = (dateStr: string) => {
    if (!dateStr || dateStr === '-') return '';
    const parts = dateStr.split('/');
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    return dateStr; 
}

const formPinjam = ref({
    nama_barang: '',
    selected_barang: null as any,
    ket_merk_ukuran: '',
    peminjam: '',
    kuantitas: 1,
    tanggal_pinjam: getTodayDate(),
    keterangan: ''
})

// ==========================================
// 1. FETCH DATA
// ==========================================
const fetchData = async () => {
    isLoading.value = true
    try {
        const resPeminjaman = await fetch(`${GOOGLE_SCRIPT_URL}?action=peminjaman`, { method: "GET" })
        const resultPeminjaman = await resPeminjaman.json()
        if (resultPeminjaman.status === 200) {
            dataPeminjaman.value = resultPeminjaman.datas || []
        }

        const resMaster = await fetch(`${GOOGLE_SCRIPT_URL}?action=kode_barang`, { method: "GET" })
        const resultMaster = await resMaster.json()
        if (resultMaster.status === 200 && resultMaster.datas) {
             dataMasterKode.value = resultMaster.datas.filter((item: any) => {
                 const nama = item["Nama Barang"] || item["nama_barang"];
                 return nama && String(nama).trim() !== ""
             }).map((item:any) => ({
                 gol: item.Gol || item.gol,
                 kel: String(item.Kel || item.kel || '00').padStart(2, '0'),
                 sub: String(item['Sub-kel'] || item.sub_kel || item.jb_k || '00').padStart(2, '0'),
                 nama_barang: item["Nama Barang"] || item.nama_barang
             }))
        }
    } catch (error) {
        toast("Terjadi kesalahan koneksi", { type: "error" })
    } finally {
        isLoading.value = false
    }
}

const handlePilihBarang = () => {
    const selected = dataMasterKode.value.find(b => String(b.nama_barang).toUpperCase() === String(formPinjam.value.nama_barang).toUpperCase());
    if (selected) {
        formPinjam.value.selected_barang = selected;
    } else {
        formPinjam.value.selected_barang = null;
    }
}

// ==========================================
// 2. SUBMIT PEMINJAMAN BARU (POST)
// ==========================================
const submitPeminjaman = async () => {
    if (!formPinjam.value.peminjam || !formPinjam.value.nama_barang) {
        return toast("Harap isi Nama Peminjam dan Nama Barang!", { type: "warning" })
    }

    isSubmitting.value = true
    try {
        const b = formPinjam.value.selected_barang || {}
        let tgl = formPinjam.value.tanggal_pinjam
        if (tgl && tgl.includes('-')) tgl = `${tgl.split('-')[2]}/${tgl.split('-')[1]}/${tgl.split('-')[0]}`

        const payload = {
            action: "tambah_peminjaman",
            gol: b.gol || "",
            kel: b.kel || "",
            sub_kel: b.sub || "",
            nama_barang: formPinjam.value.nama_barang,
            ket_merk_ukuran: formPinjam.value.ket_merk_ukuran,
            peminjam: formPinjam.value.peminjam,
            kuantitas: formPinjam.value.kuantitas,
            tanggal_pinjam: tgl,
            keterangan: formPinjam.value.keterangan
        }

        const res = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload)
        })
        const result = await res.json()

        if (result.status === 200) {
            toast("Peminjaman berhasil dicatat!", { type: "success" })
            formPinjam.value = {
                nama_barang: '', selected_barang: null, ket_merk_ukuran: '',
                peminjam: '', kuantitas: 1, tanggal_pinjam: getTodayDate(), keterangan: ''
            }
            activeTab.value = 'daftar'
            fetchData() 
        } else {
            toast(result.message || "Gagal menyimpan", { type: "error" })
        }
    } catch (error) {
        toast("Kesalahan jaringan", { type: "error" })
    } finally {
        isSubmitting.value = false
    }
}

// ==========================================
// 3. KONFIRMASI PENGEMBALIAN (POST)
// ==========================================
const openReturnModal = (item: any) => {
    returnForm.value = {
        no_urut: item.no_urut,
        nama_barang: item.nama_barang,
        peminjam: item.peminjam,
        tanggal_pengembalian: getTodayDate(),
        keterangan: item.keterangan || '',
        status_peminjaman: 'Selesai',
        status_pengembalian: 'Sudah Kembali'
    }
    showReturnModal.value = true
}

const submitPengembalian = async () => {
    isSubmitting.value = true
    try {
        let tgl = returnForm.value.tanggal_pengembalian
        if (tgl && tgl.includes('-')) tgl = `${tgl.split('-')[2]}/${tgl.split('-')[1]}/${tgl.split('-')[0]}`

        const payload = {
            action: "konfirmasi_pengembalian",
            no_urut: returnForm.value.no_urut,
            tanggal_pengembalian: tgl,
            keterangan: returnForm.value.keterangan,
            status_peminjaman: returnForm.value.status_peminjaman,
            status_pengembalian: returnForm.value.status_pengembalian
        }

        const res = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload)
        })
        const result = await res.json()

        if (result.status === 200) {
            toast("Pengembalian berhasil dikonfirmasi!", { type: "success" })
            showReturnModal.value = false
            fetchData()
        } else {
            toast(result.message || "Gagal konfirmasi", { type: "error" })
        }
    } catch (error) {
        toast("Kesalahan jaringan", { type: "error" })
    } finally {
        isSubmitting.value = false
    }
}

// ==========================================
// 4. EDIT DATA PEMINJAMAN (POST)
// ==========================================
const openEditModal = (item: any) => {
    editForm.value = {
        no_urut: item.no_urut,
        nama_barang: item.nama_barang,
        ket_merk_ukuran: item.ket_merk_ukuran || '',
        peminjam: item.peminjam,
        kuantitas: item.kuantitas,
        tanggal_pinjam: formatDateForInput(item.tanggal_pinjam),
        status_peminjaman: item.status_peminjaman || 'Dipinjam',
        status_pengembalian: item.status_pengembalian || 'Belum Kembali',
        keterangan: item.keterangan || ''
    }
    showEditModal.value = true
}

const submitEditPeminjaman = async () => {
    isSubmitting.value = true
    try {
        let tglPinjam = editForm.value.tanggal_pinjam
        if (tglPinjam && tglPinjam.includes('-')) tglPinjam = `${tglPinjam.split('-')[2]}/${tglPinjam.split('-')[1]}/${tglPinjam.split('-')[0]}`

        const payload = {
            action: "edit_peminjaman",
            no_urut: editForm.value.no_urut,
            nama_barang: editForm.value.nama_barang,
            ket_merk_ukuran: editForm.value.ket_merk_ukuran,
            peminjam: editForm.value.peminjam,
            kuantitas: editForm.value.kuantitas,
            tanggal_pinjam: tglPinjam,
            status_peminjaman: editForm.value.status_peminjaman,
            status_pengembalian: editForm.value.status_pengembalian,
            keterangan: editForm.value.keterangan
        }

        const res = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload)
        })
        const result = await res.json()

        if (result.status === 200) {
            toast("Data berhasil diperbarui!", { type: "success" })
            showEditModal.value = false
            fetchData()
        } else {
            toast(result.message || "Gagal memperbarui data", { type: "error" })
        }
    } catch (error) {
        toast("Kesalahan jaringan", { type: "error" })
    } finally {
        isSubmitting.value = false
    }
}

// ==========================================
// 5. HAPUS DATA PEMINJAMAN (POST)
// ==========================================
const deleteData = async (item: any) => {
    if (!confirm(`Hapus data peminjaman atas nama ${item.peminjam} untuk barang ${item.nama_barang}?`)) return

    try {
        const payload = {
            action: "delete_peminjaman",
            no_urut: item.no_urut
        }

        const res = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload)
        })
        const result = await res.json()

        if (result.status === 200) {
            toast("Data berhasil dihapus!", { type: "success" })
            fetchData()
        } else {
            toast(result.message || "Gagal menghapus data", { type: "error" })
        }
    } catch (error) {
        toast("Terjadi kesalahan koneksi", { type: "error" })
    }
}


const uniqueBarangList = computed(() => {
    const names = dataMasterKode.value.map(item => String(item.nama_barang).toUpperCase().trim())
    return [...new Set(names)].sort()
})

const sortedPeminjaman = computed(() => {
    // Urutkan dari yang terbaru dipinjam
    return [...dataPeminjaman.value].reverse()
})

const totalPages = computed(() => Math.ceil(sortedPeminjaman.value.length / itemsPerPage.value))
const paginatedPeminjaman = computed(() => {
    const start = (currentPage.value - 1) * itemsPerPage.value
    const end = start + itemsPerPage.value
    return sortedPeminjaman.value.slice(start, end)
})

onMounted(() => { fetchData() })
</script>

<template>
    <div class="app-layout">
        <Navbar />

        <main class="dashboard-container">
            <div class="header-container">
                <div>
                    <h1 class="page-title">Manajemen Peminjaman Barang</h1>
                    <p class="subtitle">Kelola sirkulasi peminjaman dan pengembalian aset sekolah.</p>
                </div>
                
                <div class="tab-controls">
                    <button class="tab-btn" :class="{ active: activeTab === 'daftar' }" @click="activeTab = 'daftar'">Daftar Peminjaman</button>
                    <button class="tab-btn" :class="{ active: activeTab === 'form' }" @click="activeTab = 'form'">+ Pinjam Barang</button>
                </div>
            </div>

            <!-- ============================================== -->
            <!-- TABEL DAFTAR PEMINJAMAN                        -->
            <!-- ============================================== -->
            <div v-if="activeTab === 'daftar'">
                <div v-if="isLoading" class="loading-state">
                    <div class="spinner"></div><p>Memuat Data Peminjaman...</p>
                </div>
                
                <div v-else class="table-section">
                    <div class="table-wrapper">
                        <table class="data-table wide-table">
                            <thead>
                                <tr>
                                    <th style="width: 50px;">No</th>
                                    <th>Peminjam</th>
                                    <th>Nama Barang</th>
                                    <th>Ket/Merk</th>
                                    <th style="text-align: center;">Qty</th>
                                    <th>Tgl Pinjam</th>
                                    <th>Tgl Kembali</th>
                                    <th style="text-align: center;">Status</th>
                                    <th style="text-align: center;">Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-if="sortedPeminjaman.length === 0">
                                    <td colspan="9" class="text-center">Belum ada riwayat peminjaman.</td>
                                </tr>
                                
                                <tr v-for="(item, index) in paginatedPeminjaman" :key="index">
                                    <td>{{ item.no_urut }}</td>
                                    <td><strong>{{ item.peminjam }}</strong></td>
                                    <td>{{ item.nama_barang }} <br> <span class="kode-kecil" v-if="item.gol">{{ item.gol }} {{ item.kel }} {{ item.sub_kel }}</span></td>
                                    <td>{{ item.ket_merk_ukuran || '-' }}</td>
                                    <td style="text-align: center;">{{ item.kuantitas }}</td>
                                    <td>{{ item.tanggal_pinjam }}</td>
                                    <td>{{ item.tanggal_pengembalian || '-' }}</td>
                                    <td style="text-align: center;">
                                        <span class="status-badge" :class="String(item.status_peminjaman).toLowerCase() === 'selesai' ? 'success' : 'warning'">
                                            {{ item.status_peminjaman || 'Dipinjam' }}
                                        </span>
                                    </td>
                                    <td class="action-cell">
                                        <button 
                                            v-if="String(item.status_peminjaman).toLowerCase() !== 'selesai'"
                                            @click="openReturnModal(item)" 
                                            class="btn-action">
                                            Konfirmasi
                                        </button>
                                        <span v-else class="text-muted" style="margin-right: 10px;">✓ Selesai</span>
                                        
                                        <button @click="openEditModal(item)" class="btn-icon edit-btn" title="Edit Data">✎</button>
                                        <button @click="deleteData(item)" class="btn-icon delete-btn" title="Hapus Data">🗑</button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    
                    <div class="pagination-container" v-if="totalPages > 0">
                        <button class="btn-page" :disabled="currentPage === 1" @click="currentPage--">&laquo; Sebelumnya</button>
                        <span class="page-info">Halaman <strong>{{ currentPage }}</strong> dari {{ totalPages }}</span>
                        <button class="btn-page" :disabled="currentPage === totalPages" @click="currentPage++">Selanjutnya &raquo;</button>
                    </div>
                </div>
            </div>

            <!-- ============================================== -->
            <!-- FORM PEMINJAMAN BARU                           -->
            <!-- ============================================== -->
            <div v-if="activeTab === 'form'" class="form-section">
                <form @submit.prevent="submitPeminjaman" class="data-form">
                    <h3>Form Peminjaman Barang Baru</h3>
                    <div class="form-grid-2-cols mt-4">
                        <div class="input-col">
                            <div class="form-group">
                                <label>Nama Peminjam *</label>
                                <input type="text" v-model="formPinjam.peminjam" placeholder="Nama Guru / Siswa" required class="input-box" />
                            </div>

                            <div class="form-group">
                                <label>Nama Barang *</label>
                                <input type="text" v-model="formPinjam.nama_barang" @change="handlePilihBarang" list="listMaster" placeholder="Pilih barang..." required class="input-box" style="text-transform: uppercase;" />
                                <datalist id="listMaster">
                                    <option v-for="(nama, idx) in uniqueBarangList" :key="idx" :value="nama"></option>
                                </datalist>
                                <small v-if="formPinjam.selected_barang" style="color: #10b981;">Kode: {{ formPinjam.selected_barang.gol }} {{ formPinjam.selected_barang.kel }} {{ formPinjam.selected_barang.sub }}</small>
                            </div>

                            <div class="form-group">
                                <label>Ket / Merk (Opsional)</label>
                                <input type="text" v-model="formPinjam.ket_merk_ukuran" placeholder="Warna, merk, atau nomor seri" class="input-box" />
                            </div>
                        </div>

                        <div class="input-col">
                            <div class="form-group">
                                <label>Tanggal Pinjam *</label>
                                <input type="date" v-model="formPinjam.tanggal_pinjam" required class="input-box" />
                            </div>

                            <div class="form-group">
                                <label>Kuantitas (Jumlah) *</label>
                                <input type="number" v-model="formPinjam.kuantitas" required min="1" class="input-box" />
                            </div>

                            <div class="form-group">
                                <label>Keterangan / Keperluan</label>
                                <input type="text" v-model="formPinjam.keterangan" placeholder="Contoh: Dipinjam untuk lomba" class="input-box" />
                            </div>
                        </div>
                    </div>
                    
                    <div class="form-actions mt-4">
                        <button type="submit" class="btn-submit w-full" :disabled="isSubmitting">
                            <span v-if="isSubmitting">Menyimpan Data...</span>
                            <span v-else>Catat Peminjaman</span>
                        </button>
                    </div>
                </form>
            </div>

            <!-- ============================================== -->
            <!-- MODAL PENGEMBALIAN                             -->
            <!-- ============================================== -->
            <div v-if="showReturnModal" class="modal-overlay" @click.self="showReturnModal = false">
                <div class="modal-content">
                    <div class="form-header">
                        <h3>Konfirmasi Pengembalian</h3>
                        <button @click="showReturnModal = false" class="btn-close" title="Tutup">✕</button>
                    </div>
                    <form @submit.prevent="submitPengembalian" class="data-form">
                        <p class="mb-3" style="line-height: 1.5; color: #475569;">Konfirmasi pengembalian barang <strong>{{ returnForm.nama_barang }}</strong> dari <strong>{{ returnForm.peminjam }}</strong>.</p>
                        
                        <div class="form-group mb-3">
                            <label>Tanggal Pengembalian</label>
                            <input type="date" v-model="returnForm.tanggal_pengembalian" required class="input-box" />
                        </div>
                        
                        <div class="form-group-inline mb-3">
                            <div class="form-group half">
                                <label>Status Peminjaman</label>
                                <select v-model="returnForm.status_peminjaman" class="input-box">
                                    <option value="Selesai">Selesai</option>
                                    <option value="Hilang/Rusak">Hilang/Rusak</option>
                                </select>
                            </div>
                            <div class="form-group half">
                                <label>Status Kembali</label>
                                <select v-model="returnForm.status_pengembalian" class="input-box">
                                    <option value="Sudah Kembali">Sudah Kembali</option>
                                    <option value="Terkendala">Terkendala</option>
                                </select>
                            </div>
                        </div>

                        <div class="form-group mb-4">
                            <label>Catatan Kondisi / Keterangan</label>
                            <input type="text" v-model="returnForm.keterangan" placeholder="Kondisi barang saat dikembalikan..." class="input-box" />
                        </div>

                        <button type="submit" class="btn-submit w-full" :disabled="isSubmitting">
                            <span v-if="isSubmitting">Memproses...</span>
                            <span v-else>Konfirmasi Pengembalian ✓</span>
                        </button>
                    </form>
                </div>
            </div>

            <!-- ============================================== -->
            <!-- MODAL EDIT DATA                                -->
            <!-- ============================================== -->
            <div v-if="showEditModal" class="modal-overlay" @click.self="showEditModal = false">
                <div class="modal-content modal-large">
                    <div class="form-header">
                        <h3>Edit Data Peminjaman</h3>
                        <button @click="showEditModal = false" class="btn-close" title="Tutup">✕</button>
                    </div>
                    <form @submit.prevent="submitEditPeminjaman" class="data-form form-scrollable">
                        <div class="form-grid-2-cols mb-4">
                            <div class="input-col">
                                <div class="form-group">
                                    <label>Nama Peminjam</label>
                                    <input type="text" v-model="editForm.peminjam" required class="input-box" />
                                </div>
                                <div class="form-group">
                                    <label>Nama Barang</label>
                                    <input type="text" v-model="editForm.nama_barang" required class="input-box" />
                                </div>
                                <div class="form-group">
                                    <label>Kuantitas</label>
                                    <input type="number" v-model="editForm.kuantitas" required class="input-box" />
                                </div>
                                <div class="form-group">
                                    <label>Tanggal Pinjam</label>
                                    <input type="date" v-model="editForm.tanggal_pinjam" required class="input-box" />
                                </div>
                            </div>
                            <div class="input-col">
                                <div class="form-group">
                                    <label>Status Peminjaman</label>
                                    <select v-model="editForm.status_peminjaman" class="input-box">
                                        <option value="Dipinjam">Dipinjam</option>
                                        <option value="Selesai">Selesai</option>
                                        <option value="Hilang/Rusak">Hilang/Rusak</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>Status Pengembalian</label>
                                    <select v-model="editForm.status_pengembalian" class="input-box">
                                        <option value="Belum Kembali">Belum Kembali</option>
                                        <option value="Sudah Kembali">Sudah Kembali</option>
                                        <option value="Terkendala">Terkendala</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>Keterangan</label>
                                    <input type="text" v-model="editForm.keterangan" class="input-box" placeholder="Keterangan..." />
                                </div>
                            </div>
                        </div>
                        <button type="submit" class="btn-submit w-full" :disabled="isSubmitting">
                            <span v-if="isSubmitting">Menyimpan Perubahan...</span>
                            <span v-else>Simpan Perubahan</span>
                        </button>
                    </form>
                </div>
            </div>

        </main>
    </div>
</template>

<style scoped>
.app-layout { display: flex; min-height: 100vh; background-color: #f8fafc; }
.dashboard-container { flex: 1; padding: 30px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; width: calc(100% - 250px); overflow-x: hidden; }

.header-container { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 24px; border-bottom: 1px solid #e2e8f0; padding-bottom: 15px;}
.page-title { font-size: 26px; font-weight: 800; color: #0f172a; margin: 0 0 5px 0; }
.subtitle { color: #64748b; font-size: 14px; margin: 0; }

.tab-controls { display: flex; gap: 10px; }
.tab-btn { padding: 10px 20px; background: white; border: 1px solid #cbd5e1; border-radius: 8px; font-weight: 600; color: #64748b; cursor: pointer; transition: 0.2s;}
.tab-btn:hover { background: #f1f5f9; }
.tab-btn.active { background: #3b82f6; color: white; border-color: #3b82f6; }

.table-section { background-color: #ffffff; border-radius: 12px; padding: 24px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
.table-wrapper { overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 8px; }
.data-table { width: 100%; border-collapse: collapse; text-align: left; font-size: 13px; }
.data-table th, .data-table td { padding: 14px 16px; border-bottom: 1px solid #e2e8f0; }
.data-table th { background-color: #f8fafc; color: #475569; font-weight: 700; text-transform: uppercase; font-size: 11px; }
.kode-kecil { font-size: 11px; color: #94a3b8; font-family: monospace; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; }
.text-center { text-align: center; }

.status-badge { padding: 5px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
.status-badge.warning { background: #fef3c7; color: #d97706; }
.status-badge.success { background: #dcfce7; color: #166534; }
.text-muted { color: #94a3b8; font-style: italic; font-weight: 600;}

.action-cell { display: flex; gap: 8px; justify-content: center; align-items: center; }
.btn-action { background: #eff6ff; color: #3b82f6; border: 1px solid #bfdbfe; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; transition: 0.2s;}
.btn-action:hover { background: #3b82f6; color: white; }
.btn-icon { background: none; border: none; font-size: 14px; cursor: pointer; padding: 6px 10px; border-radius: 6px; transition: 0.2s; display: flex; align-items: center; justify-content: center;}
.edit-btn { color: #3b82f6; background-color: #eff6ff; }
.edit-btn:hover { background-color: #3b82f6; color: white; }
.delete-btn { color: #ef4444; background-color: #fef2f2; }
.delete-btn:hover { background-color: #ef4444; color: white; }

.form-section { background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); max-width: 800px;}
.form-section h3 { margin: 0; color: #1e293b;}
.form-grid-2-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; } 
.form-group { display: flex; flex-direction: column; gap: 6px; margin-bottom: 15px;}
.form-group-inline { display: flex; gap: 15px; }
.half { width: 50%; }
.form-group label { font-size: 13px; font-weight: 600; color: #475569; }
.input-box { width: 100%; padding: 10px 14px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; outline: none; transition: border-color 0.2s; background: #fff;}
.input-box:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15); }

.btn-submit { background-color: #3b82f6; color: white; border: none; padding: 12px; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; transition: background-color 0.2s;}
.btn-submit:hover:not(:disabled) { background-color: #2563eb; }
.btn-submit:disabled { background-color: #94a3b8; }
.w-full { width: 100%; }

/* MODAL */
.modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(15, 23, 42, 0.6); display: flex; justify-content: center; align-items: center; z-index: 1000; padding: 20px; backdrop-filter: blur(4px);}
.modal-content { background: #ffffff; width: 100%; max-width: 450px; border-radius: 12px; padding: 24px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1); animation: modalIn 0.3s ease-out; }
.modal-large { max-width: 700px; }
.form-scrollable { max-height: 80vh; overflow-y: auto; padding-right: 10px; }
@keyframes modalIn { from { opacity: 0; transform: translateY(-30px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
.form-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px; }
.form-header h3 { font-size: 18px; font-weight: 700; color: #1e293b; margin: 0; }
.btn-close { background: none; border: none; font-size: 20px; color: #94a3b8; cursor: pointer; transition: color 0.2s; }
.btn-close:hover { color: #ef4444; }

.loading-state { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 40vh; color: #64748b; font-weight: 600;}
.spinner { border: 4px solid #f3f3f3; border-top: 4px solid #3b82f6; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin-bottom: 15px; }
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

.pagination-container { display: flex; justify-content: space-between; align-items: center; margin-top: 20px; padding-top: 15px; border-top: 1px solid #e2e8f0; }
.btn-page { background-color: #ffffff; border: 1px solid #cbd5e1; color: #334155; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
.btn-page:hover:not(:disabled) { background-color: #f1f5f9; border-color: #94a3b8; }
.btn-page:disabled { background-color: #f8fafc; color: #cbd5e1; cursor: not-allowed; border-color: #f1f5f9; }
.page-info { font-size: 13px; color: #64748b; }
</style>