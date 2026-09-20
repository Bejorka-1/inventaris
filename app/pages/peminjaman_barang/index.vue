<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { toast } from 'vue3-toastify'
import Navbar from '~/components/Navbar.vue'

// --- SESUAIKAN URL API ANDA ---
const GOOGLE_SCRIPT_URL = "http://127.0.0.1:8000/api/inventaris"

const dataPeminjaman = ref<any[]>([])
const isLoading = ref(true)

// Inline Edit State
const editingItem = ref<any>(null)
const editForm = ref({
    no_urut: '',
    status_peminjaman: '',
    status_pengembalian: '',
    keterangan: ''
})
const isSavingEdit = ref(false)

// Paginasi
const currentPage = ref(1)
const itemsPerPage = ref(15)

// ==============================================================================
// HELPER TANGGAL (100% TYPE-SAFE)
// ==============================================================================
const getTodayDate = (): string => {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

const formatSimpleDate = (dateVal: any): string => {
    const str = String(dateVal || '').trim();
    if (!str || str === '-' || str === 'undefined' || str === 'null') return '-';
    
    if (str.includes('T')) {
        const parts = str.split('T');
        const datePart = parts[0] || ''; 
        if (datePart) {
            const dateParts = datePart.split('-');
            if (dateParts.length === 3) return `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
        }
    }
    
    if (str.includes('-') && str.length === 10) {
        const parts = str.split('-');
        if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    
    return str;
}

// ==========================================
// 1. FETCH DATA PEMINJAMAN SAJA
// ==========================================
const fetchData = async () => {
    isLoading.value = true
    try {
        const resPeminjaman = await fetch(`${GOOGLE_SCRIPT_URL}?action=peminjaman`, { method: "GET" })
        const resultPeminjaman = await resPeminjaman.json()
        if (resultPeminjaman.status === 200) {
            dataPeminjaman.value = (resultPeminjaman.datas || []).map((v:any, i:number) => ({...v, _tempId: i}))
        }
    } catch (error) {
        toast("Terjadi kesalahan koneksi saat memuat data", { type: "error" })
    } finally {
        isLoading.value = false
    }
}

// ==========================================
// 2. SETUJUI PINJAMAN (Menunggu Konfirmasi -> Dipinjam)
// ==========================================
const approvePeminjaman = async (item: any) => {
    if (!confirm(`Setujui peminjaman ${item.nama_barang} untuk ${item.peminjam}?`)) return

    try {
        const payload = {
            action: "edit_peminjaman",
            no_urut: item.no_urut,
            nama_barang: item.nama_barang,
            ket_merk_ukuran: item.ket_merk_ukuran,
            peminjam: item.peminjam,
            kuantitas: item.kuantitas,
            tanggal_pinjam: item.tanggal_pinjam,
            tanggal_pengembalian: item.tanggal_pengembalian,
            
            // Ubah Status ke Dipinjam
            status_peminjaman: 'Dipinjam',
            status_pengembalian: item.status_pengembalian || 'Belum Kembali',
            keterangan: item.keterangan
        }

        const res = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload)
        })
        const result = await res.json()

        if (result.status === 200) {
            toast("Peminjaman disetujui!", { type: "success" })
            fetchData()
        } else {
            toast(result.message || "Gagal menyetujui", { type: "error" })
        }
    } catch (error) {
        toast("Kesalahan jaringan", { type: "error" })
    }
}

// ==========================================
// 3. KONFIRMASI PENGEMBALIAN (Dipinjam -> Selesai)
// ==========================================
const markAsReturned = async (item: any) => {
    if (!confirm(`Konfirmasi pengembalian barang dari ${item.peminjam} hari ini?`)) return

    try {
        const todayStr = getTodayDate();
        let tgl = `${todayStr.split('-')[2]}/${todayStr.split('-')[1]}/${todayStr.split('-')[0]}`

        const payload = {
            action: "konfirmasi_pengembalian",
            no_urut: item.no_urut,
            tanggal_pengembalian: tgl,
            keterangan: item.keterangan || '',
            status_peminjaman: 'Selesai',
            status_pengembalian: 'Sudah Kembali'
        }

        const res = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload)
        })
        const result = await res.json()

        if (result.status === 200) {
            toast("Pengembalian berhasil dikonfirmasi!", { type: "success" })
            fetchData()
        } else {
            toast(result.message || "Gagal konfirmasi", { type: "error" })
        }
    } catch (error) {
        toast("Kesalahan jaringan", { type: "error" })
    }
}

// ==========================================
// 4. INLINE EDIT DATA (POST)
// ==========================================
const startInlineEdit = (item: any) => {
    editingItem.value = item._tempId
    
    // Fallback status aman
    const sPinjam = String(item.status_peminjaman || '').trim();
    const sKembali = String(item.status_pengembalian || '').trim();
    
    editForm.value = {
        no_urut: item.no_urut,
        status_peminjaman: (sPinjam === '-' || !sPinjam) ? 'Menunggu Konfirmasi' : sPinjam,
        status_pengembalian: (sKembali === '-' || !sKembali) ? 'Belum Kembali' : sKembali,
        keterangan: item.keterangan || ''
    }
}

const cancelInlineEdit = () => {
    editingItem.value = null
    editForm.value = { no_urut:'', status_peminjaman: '', status_pengembalian: '', keterangan: '' }
}

const saveInlineEdit = async (item: any) => {
    isSavingEdit.value = true
    try {
        const payload = {
            action: "edit_peminjaman",
            no_urut: editForm.value.no_urut,
            nama_barang: item.nama_barang,
            ket_merk_ukuran: item.ket_merk_ukuran,
            peminjam: item.peminjam,
            kuantitas: item.kuantitas,
            tanggal_pinjam: item.tanggal_pinjam,
            tanggal_pengembalian: item.tanggal_pengembalian,
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
            cancelInlineEdit()
            fetchData()
        } else {
            toast(result.message || "Gagal memperbarui data", { type: "error" })
        }
    } catch (error) {
        toast("Terjadi kesalahan koneksi", { type: "error" })
    } finally {
        isSavingEdit.value = false
    }
}

// ==========================================
// 5. HAPUS DATA PEMINJAMAN (POST)
// ==========================================
const deleteData = async (item: any) => {
    if (!confirm(`Hapus riwayat peminjaman atas nama ${item.peminjam} secara permanen?`)) return

    try {
        const payload = { action: "delete_peminjaman", no_urut: item.no_urut }

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
        toast("Kesalahan koneksi", { type: "error" })
    }
}

const sortedPeminjaman = computed(() => {
    return [...dataPeminjaman.value].reverse()
})

const totalPages = computed(() => Math.ceil(sortedPeminjaman.value.length / itemsPerPage.value))
const paginatedPeminjaman = computed(() => {
    const start = (currentPage.value - 1) * itemsPerPage.value
    const end = start + itemsPerPage.value
    return sortedPeminjaman.value.slice(start, end)
})

// Fungsi helper status di template
const normalizeStatus = (statusStr: string) => {
    const s = String(statusStr || '').trim().toLowerCase();
    if (s === '-' || s === '') return 'menunggu konfirmasi';
    return s;
}

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
            </div>

            <!-- ============================================== -->
            <!-- TABEL DAFTAR PEMINJAMAN                        -->
            <!-- ============================================== -->
            <div>
                <div v-if="isLoading" class="loading-state">
                    <div class="spinner"></div><p>Memuat Data Peminjaman...</p>
                </div>
                
                <div v-else class="table-section">
                    <div class="table-wrapper">
                        <table class="data-table wide-table">
                            <thead>
                                <tr>
                                    <th style="width: 50px; text-align: center;">No</th>
                                    <th>Peminjam</th>
                                    <th>Nama Barang</th>
                                    <th style="text-align: center;">Qty</th>
                                    <th>Tgl Pinjam</th>
                                    <th>Tgl Kembali</th>
                                    <th style="text-align: center;">Status Pinjam</th>
                                    <th style="text-align: center;">Status Kembali</th>
                                    <th>Catatan</th>
                                    <th style="text-align: center;">Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-if="sortedPeminjaman.length === 0">
                                    <td colspan="10" class="text-center">Belum ada riwayat peminjaman.</td>
                                </tr>
                                
                                <tr v-for="(item, index) in paginatedPeminjaman" :key="item._tempId">
                                    
                                    <!-- JIKA BARIS SEDANG DI-EDIT (INLINE EDIT HANYA STATUS) -->
                                    <template v-if="editingItem === item._tempId">
                                        <td style="text-align: center; color: #94a3b8;">{{ item.no_urut }}</td>
                                        
                                        <!-- KOLOM READ-ONLY -->
                                        <td><strong>{{ item.peminjam }}</strong></td>
                                        <td class="sticky-col">{{ item.nama_barang }} <br> <span class="kode-kecil" v-if="item.gol">{{ item.gol }} {{ item.kel }} {{ item.sub_kel }}</span></td>
                                        <td style="text-align: center;">{{ item.kuantitas }}</td>
                                        <td>{{ formatSimpleDate(item.tanggal_pinjam) }}</td>
                                        <td>{{ formatSimpleDate(item.tanggal_pengembalian) }}</td>
                                        
                                        <!-- KOLOM BISA DIEDIT -->
                                        <td style="text-align: center;">
                                            <select v-model="editForm.status_peminjaman" class="edit-input">
                                                <option value="Menunggu Konfirmasi">Menunggu Konfirmasi</option>
                                                <option value="Dipinjam">Dipinjam</option>
                                                <option value="Selesai">Selesai</option>
                                                <option value="Hilang/Rusak">Hilang/Rusak</option>
                                            </select>
                                        </td>
                                        <td style="text-align: center;">
                                            <select v-model="editForm.status_pengembalian" class="edit-input">
                                                <option value="Belum Kembali">Belum Kembali</option>
                                                <option value="Sudah Kembali">Sudah Kembali</option>
                                                <option value="Terkendala">Terkendala</option>
                                            </select>
                                        </td>
                                        <td>
                                            <input type="text" v-model="editForm.keterangan" class="edit-input" placeholder="Tulis Catatan..." style="min-width: 140px;" />
                                        </td>

                                        <td class="action-cell">
                                            <button @click="saveInlineEdit(item)" :disabled="isSavingEdit" class="btn-icon save-btn" title="Simpan Perubahan">✓</button>
                                            <button @click="cancelInlineEdit" :disabled="isSavingEdit" class="btn-icon cancel-btn" title="Batal Edit">✕</button>
                                        </td>
                                    </template>

                                    <!-- TAMPILAN BARIS NORMAL -->
                                    <template v-else>
                                        <td style="text-align: center; color: #64748b;">{{ item.no_urut }}</td>
                                        <td><strong>{{ item.peminjam }}</strong></td>
                                        <td class="sticky-col">{{ item.nama_barang }} <br> <span class="kode-kecil" v-if="item.gol">{{ item.gol }} {{ item.kel }} {{ item.sub_kel }}</span></td>
                                        <td style="text-align: center;">{{ item.kuantitas }}</td>
                                        
                                        <td>{{ formatSimpleDate(item.tanggal_pinjam) }}</td>
                                        <td>{{ formatSimpleDate(item.tanggal_pengembalian) }}</td>
                                        
                                        <!-- TAMPILAN STATUS TERPISAH -->
                                        <td style="text-align: center;">
                                            <span class="status-badge" :class="{
                                                'success': normalizeStatus(item.status_peminjaman) === 'selesai',
                                                'warning': normalizeStatus(item.status_peminjaman) === 'dipinjam',
                                                'info': normalizeStatus(item.status_peminjaman) === 'menunggu konfirmasi',
                                                'danger': normalizeStatus(item.status_peminjaman) === 'hilang/rusak'
                                            }">
                                                {{ (item.status_peminjaman && item.status_peminjaman !== '-') ? item.status_peminjaman : 'Menunggu Konfirmasi' }}
                                            </span>
                                        </td>
                                        <td style="text-align: center;">
                                            <span class="text-status-kembali">
                                                {{ (item.status_pengembalian && item.status_pengembalian !== '-') ? item.status_pengembalian : 'Belum Kembali' }}
                                            </span>
                                        </td>
                                        <td>
                                            <span v-if="item.keterangan && item.keterangan !== '-'" class="text-catatan">"{{ item.keterangan }}"</span>
                                            <span v-else class="text-catatan">-</span>
                                        </td>
                                        
                                        <!-- TOMBOL AKSI OTOMATIS -->
                                        <td class="action-cell">
                                            
                                            <!-- JIKA MENUNGGU KONFIRMASI (TOMBOL BIRU) -->
                                            <button 
                                                v-if="normalizeStatus(item.status_peminjaman) === 'menunggu konfirmasi'"
                                                @click="approvePeminjaman(item)" 
                                                class="btn-action approve-btn" title="Setujui Pinjaman">
                                                Setujui
                                            </button>

                                            <!-- JIKA SEDANG DIPINJAM (TOMBOL KUNING) -->
                                            <button 
                                                v-else-if="normalizeStatus(item.status_peminjaman) === 'dipinjam'"
                                                @click="markAsReturned(item)" 
                                                class="btn-action return-btn" title="Konfirmasi Pengembalian">
                                                Kembalikan
                                            </button>
                                            
                                            <!-- JIKA SELESAI -->
                                            <span v-else-if="normalizeStatus(item.status_peminjaman) === 'selesai'" class="text-muted" style="margin-right: 10px;">
                                                ✓ Selesai
                                            </span>
                                            
                                            <!-- Tombol Edit & Hapus -->
                                            <button @click="startInlineEdit(item)" class="btn-icon edit-btn" title="Edit Status/Catatan">✎</button>
                                            <button @click="deleteData(item)" class="btn-icon delete-btn" title="Hapus Riwayat">🗑</button>
                                        </td>
                                    </template>
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

/* BADGES UNTUK STATUS */
.status-badge { padding: 5px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; white-space: nowrap;}
.status-badge.info { background: #e0f2fe; color: #0284c7; border: 1px solid #bae6fd;} /* Biru: Menunggu Konfirmasi */
.status-badge.warning { background: #fef3c7; color: #d97706; border: 1px solid #fde68a;} /* Kuning: Dipinjam */
.status-badge.success { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0;} /* Hijau: Selesai */
.status-badge.danger { background: #fee2e2; color: #dc2626; border: 1px solid #fecaca;}  /* Merah: Rusak/Hilang */

.text-status-kembali { font-size: 12px; font-weight: 600; color: #64748b; white-space: nowrap;}
.text-catatan { font-size: 12px; color: #64748b; font-style: italic; }
.text-muted { color: #94a3b8; font-style: italic; font-weight: 600; white-space: nowrap;}

.sticky-col { position: sticky; left: 0; background-color: #fff; z-index: 5; box-shadow: 2px 0 5px rgba(0,0,0,0.05); font-weight: 600; }

/* ACTION BUTTONS */
.action-cell { display: flex; gap: 8px; justify-content: center; align-items: center; }
.btn-action { padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; transition: 0.2s; border: 1px solid transparent; white-space: nowrap;}

/* Tombol Setujui (Biru) */
.approve-btn { background: #eff6ff; color: #3b82f6; border-color: #bfdbfe; }
.approve-btn:hover { background: #3b82f6; color: white; }

/* Tombol Kembalikan (Kuning/Oranye) */
.return-btn { background: #fffbeb; color: #d97706; border-color: #fde68a; }
.return-btn:hover { background: #d97706; color: white; }

.btn-icon { background: none; border: none; font-size: 14px; cursor: pointer; padding: 6px 10px; border-radius: 6px; transition: 0.2s; display: flex; align-items: center; justify-content: center;}
.edit-btn { color: #3b82f6; background-color: #eff6ff; }
.edit-btn:hover { background-color: #3b82f6; color: white; }
.delete-btn { color: #ef4444; background-color: #fef2f2; }
.delete-btn:hover { background-color: #ef4444; color: white; }
.save-btn { color: #10b981; background-color: #ecfdf5; border: 1px solid #a7f3d0; font-weight: bold; }
.save-btn:hover { background-color: #10b981; color: white; }
.cancel-btn { color: #64748b; background-color: #f1f5f9; border: 1px solid #e2e8f0; font-weight: bold;}
.cancel-btn:hover { background-color: #64748b; color: white; }

.edit-input { width: 100%; padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 12px; font-family: inherit; background-color: #f8fafc; outline: none; transition: 0.2s;}
.edit-input:focus { border-color: #3b82f6; background-color: #eff6ff; box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2); }

.form-section { background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); max-width: 800px;}
.form-section h3 { margin: 0; color: #1e293b;}
.form-grid-2-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; } 
.form-group { display: flex; flex-direction: column; gap: 6px; margin-bottom: 15px;}
.form-group label { font-size: 13px; font-weight: 600; color: #475569; }
.input-box { width: 100%; padding: 10px 14px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; outline: none; transition: border-color 0.2s; background: #fff;}
.input-box:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15); }

.btn-submit { background-color: #3b82f6; color: white; border: none; padding: 12px; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; transition: background-color 0.2s;}
.btn-submit:hover:not(:disabled) { background-color: #2563eb; }
.btn-submit:disabled { background-color: #94a3b8; }
.w-full { width: 100%; }

.loading-state { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 40vh; color: #64748b; font-weight: 600;}
.spinner { border: 4px solid #f3f3f3; border-top: 4px solid #3b82f6; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin-bottom: 15px; }
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

.pagination-container { display: flex; justify-content: space-between; align-items: center; margin-top: 20px; padding-top: 15px; border-top: 1px solid #e2e8f0; }
.btn-page { background-color: #ffffff; border: 1px solid #cbd5e1; color: #334155; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
.btn-page:hover:not(:disabled) { background-color: #f1f5f9; border-color: #94a3b8; }
.btn-page:disabled { background-color: #f8fafc; color: #cbd5e1; cursor: not-allowed; border-color: #f1f5f9; }
.page-info { font-size: 13px; color: #64748b; }
</style>