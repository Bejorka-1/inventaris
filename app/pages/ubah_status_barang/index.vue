<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { toast } from 'vue3-toastify'
import Navbar from '~/components/Navbar.vue'

// PASTIKAN URL INI SAMA DENGAN DEPLOY TERBARU ANDA
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzumAO9oya0sXGww-r73arn6t5-BqmKLmbda2Lpg_XSs2fqMQtiDh_ZOy5_ZfROO8H8/exec"

const dataInventaris = ref<any[]>([])
const isLoading = ref(true)
const isSubmitting = ref(false)
const selectedLembaga = ref('SMA') 

// State Form Mutasi
const formData = ref({
    selectedItemObj: null as any, // Menyimpan objek barang utuh saat dipilih
    status_baru: 'Dimutasi',
    tempat_baru: ''
})

// Mengambil Data Inventaris yang MASIH AKTIF
const fetchBukuIndukData = async () => {
    isLoading.value = true
    dataInventaris.value = [] 
    formData.value.selectedItemObj = null // Reset pilihan
    
    try {
        const res = await fetch(`${GOOGLE_SCRIPT_URL}?action=inventaris&lembaga=${selectedLembaga.value}`, { method: "GET" })
        const result = await res.json()

        if (result.status === 200) {
            // Hanya ambil barang yang statusnya Aktif/Kosong dan bukan header Kategori (bukan no urut 0000)
            dataInventaris.value = (result.datas || []).filter((item: any) => {
                const status = String(item.status || '').toLowerCase().trim()
                const isActive = status === '' || status === '-' || status === 'aktif' || status === 'ada'
                
                const noUrut = String(item.noUrutBarang || item.no_urut_barang || item.jb_k || '').trim()
                const isNotHeader = noUrut !== '' && noUrut !== '-' && noUrut !== '0000' && noUrut !== '000' && noUrut !== '0'
                
                const nama = String(item.namaBarang || item.nama_barang || '').toUpperCase()
                const isValidName = !nama.includes('BUKU INDUK') && !nama.includes('JAKARTA') && nama !== 'TANAH' && nama !== 'BANGUNAN'

                return isActive && isNotHeader && isValidName
            })
        } else {
            toast(result.message || "Gagal memuat data", { type: "error" })
        }
    } catch (error) {
        console.error("Error fetching data:", error)
        toast("Terjadi kesalahan koneksi", { type: "error" })
    } finally {
        isLoading.value = false
    }
}

// Fungsi Submit Mutasi
const submitMutasi = async () => {
    if (!formData.value.selectedItemObj) {
        toast("Silakan pilih barang yang akan dimutasi!", { type: "warning" })
        return
    }
    if (!formData.value.tempat_baru && formData.value.status_baru === 'Dimutasi') {
        toast("Tempat tujuan mutasi wajib diisi!", { type: "warning" })
        return
    }

    isSubmitting.value = true
    try {
        const payload = {
            action: "mutasi_barang",
            lembaga: selectedLembaga.value,
            no_urut_barang: formData.value.selectedItemObj.noUrutBarang || formData.value.selectedItemObj.jb_k,
            nama_barang: formData.value.selectedItemObj.namaBarang || formData.value.selectedItemObj.nama_barang,
            status: formData.value.status_baru,
            tempat: formData.value.tempat_baru
        }

        const res = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(payload)
        })
        
        const result = await res.json()

        if (result.status === 200) {
            toast(`Berhasil! Barang telah ${formData.value.status_baru.toLowerCase()}.`, { type: "success" })
            formData.value.selectedItemObj = null
            formData.value.tempat_baru = ''
            fetchBukuIndukData() // Refresh tabel data
        } else {
            toast(result.message || "Gagal memutasi barang", { type: "error" })
        }
    } catch (error) {
        console.error("Error submitting form:", error)
        toast("Terjadi kesalahan saat mengirim data", { type: "error" })
    } finally {
        isSubmitting.value = false
    }
}

// Watcher untuk mereload data saat ganti tab lembaga
watch(selectedLembaga, () => {
    fetchBukuIndukData()
})

onMounted(() => {
    fetchBukuIndukData()
})
</script>

<template>
    <div class="app-layout">
        <Navbar />

        <main class="dashboard-container">
            <div class="header-container">
                <h1 class="page-title">Update Status Barang</h1>
                <p class="subtitle">Pindahkan, hibahkan, atau musnahkan barang dari inventaris.</p>
            </div>

            <div class="content-grid">
                
                <!-- KOLOM KIRI: FORM MUTASI -->
                <div class="form-card">
                    <div class="form-header">
                        <h3>Formulir Perubahan Status Barang</h3>
                        <select v-model="selectedLembaga" class="select-lembaga">
                            <option value="SMA">Data SMA</option>
                            <option value="SMK">Data SMK</option>
                            <option value="YAYASAN">Data YAYASAN</option>
                        </select>
                    </div>

                    <div v-if="isLoading" class="loading-state">Memuat daftar barang yang tersedia...</div>
                    
                    <form v-else @submit.prevent="submitMutasi" class="mutasi-form">
                        
                        <div class="form-group">
                            <label>Pilih Barang (Hanya yang Aktif)</label>
                            <select v-model="formData.selectedItemObj" required class="input-box select-barang">
                                <option :value="null" disabled>-- Cari dan Pilih Barang --</option>
                                <option v-for="(item, idx) in dataInventaris" :key="idx" :value="item">
                                    [{{ item.master_kodeBarang }} / {{ item.noUrutBarang || item.jb_k }}] - {{ item.namaBarang || item.nama_barang }} (Ruang: {{ item.ruang || '-' }})
                                </option>
                            </select>
                        </div>

                        <!-- KOTAK INFO BARANG YANG DIPILIH -->
                        <div class="item-preview" v-if="formData.selectedItemObj">
                            <div class="preview-row">
                                <span class="label">Kode Barang:</span>
                                <strong>{{ formData.selectedItemObj.master_kodeBarang }}</strong>
                            </div>
                            <div class="preview-row">
                                <span class="label">No Urut:</span>
                                <strong>{{ formData.selectedItemObj.noUrutBarang || formData.selectedItemObj.jb_k }}</strong>
                            </div>
                            <div class="preview-row">
                                <span class="label">Nama:</span>
                                <strong>{{ formData.selectedItemObj.namaBarang || formData.selectedItemObj.nama_barang }}</strong>
                            </div>
                            <div class="preview-row">
                                <span class="label">Lokasi Saat Ini:</span>
                                <strong>{{ formData.selectedItemObj.ruang || formData.selectedItemObj.tempat || 'Belum ada data ruang' }}</strong>
                            </div>
                            <div class="preview-row">
                                <span class="label">Status Saat Ini:</span>
                                <strong>{{ formData.selectedItemObj.status || formData.selectedItemObj.Status || 'Aktif' }}</strong>
                            </div>
                        </div>

                        <div class="form-group mt-4">
                            <label>Ubah Status Menjadi</label>
                            <select v-model="formData.status_baru" class="input-box">
                                <option value="Dimutasi">Dimutasi (Dipindah Ruangan/Lembaga)</option>
                                <option value="Dihibahkan">Dihibahkan</option>
                                <option value="Lelang/Musnah">Lelang / Musnahkan</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label>Keterangan Tempat / Tujuan Baru</label>
                            <input type="text" v-model="formData.tempat_baru" 
                                   :placeholder="formData.status_baru === 'Dimutasi' ? 'Contoh: Pindah ke Ruang Lab / SMK' : 'Contoh: Diserahkan ke Pihak ke-3'" 
                                   :required="formData.status_baru === 'Dimutasi'"
                                   class="input-box" />
                        </div>

                        <button type="submit" class="btn-submit mt-4" :disabled="isSubmitting || !formData.selectedItemObj">
                            <span v-if="isSubmitting">Memproses Update...</span>
                            <span v-else>Konfirmasi Mutasi</span>
                        </button>
                    </form>
                </div>

                <!-- KOLOM KANAN: PETUNJUK -->
                <div class="info-card">
                    <h3>Aturan Ubah Status</h3>
                    <ul class="info-list">
                        <li>Hanya barang dengan status <strong>Aktif / Ada</strong> yang akan muncul di formulir ini.</li>
                        <li><strong>Dimutasi:</strong> Gunakan ini jika barang fisik dipindahkan ke ruangan atau lembaga lain (Misal: dari SMA ke SMK). Pastikan mengisi tempat tujuan.</li>
                        <li><strong>Dihibahkan:</strong> Gunakan jika barang diberikan ke pihak luar yayasan.</li>
                        <li><strong>Lelang/Musnah:</strong> Gunakan jika barang sudah tidak layak pakai dan dihapus dari aset fisik.</li>
                        <li>Barang yang telah dimutasi tidak akan dihapus dari *Spreadsheet*, namun statusnya akan berubah sehingga tidak muncul sebagai aset aktif di dashboard utama.</li>
                    </ul>
                </div>

            </div>
        </main>
    </div>
</template>

<style scoped>
.app-layout { display: flex; min-height: 100vh; background-color: #f8fafc; }
.dashboard-container { flex: 1; padding: 30px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; width: calc(100% - 250px); }
.header-container { margin-bottom: 30px; }
.page-title { font-size: 26px; font-weight: 800; color: #0f172a; margin: 0 0 5px 0; }
.subtitle { color: #64748b; margin: 0; font-size: 14px; }

.content-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 30px; align-items: start; }
@media (max-width: 900px) { .content-grid { grid-template-columns: 1fr; } }

.form-card { background: white; border-radius: 12px; padding: 25px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); border-top: 4px solid #8b5cf6; }
.form-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; padding-bottom: 15px; border-bottom: 1px solid #e2e8f0; }
.form-header h3 { margin: 0; font-size: 18px; color: #1e293b; }
.select-lembaga { padding: 6px 12px; border-radius: 6px; border: 1px solid #cbd5e1; font-weight: bold; color: #3b82f6; outline: none; cursor: pointer; }

.loading-state { text-align: center; padding: 40px; color: #64748b; font-style: italic; }

.mutasi-form { display: flex; flex-direction: column; gap: 18px; }
.form-group { display: flex; flex-direction: column; gap: 8px; }
.form-group label { font-size: 13px; font-weight: 600; color: #475569; }
.input-box { padding: 12px 14px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; color: #334155; outline: none; transition: all 0.2s; }
.input-box:focus { border-color: #8b5cf6; box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.15); }
.select-barang { cursor: pointer; background-color: #f8fafc; }

.item-preview { background-color: #f1f5f9; border-radius: 8px; padding: 15px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; border: 1px dashed #cbd5e1; }
.preview-row { display: flex; flex-direction: column; gap: 4px; }
.preview-row .label { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: 0.5px; }
.preview-row strong { font-size: 13px; color: #0f172a; }

.mt-4 { margin-top: 15px; }
.btn-submit { background-color: #8b5cf6; color: white; border: none; padding: 14px 24px; border-radius: 8px; font-size: 15px; font-weight: bold; cursor: pointer; transition: background-color 0.2s; }
.btn-submit:hover:not(:disabled) { background-color: #7c3aed; }
.btn-submit:disabled { background-color: #cbd5e1; cursor: not-allowed; }

.info-card { background: #f8fafc; border-radius: 12px; padding: 25px; border: 1px solid #e2e8f0; }
.info-card h3 { margin: 0 0 15px 0; font-size: 16px; color: #334155; }
.info-list { margin: 0; padding-left: 20px; color: #475569; font-size: 13px; line-height: 1.6; display: flex; flex-direction: column; gap: 12px; }
.info-list strong { color: #0f172a; }
</style>