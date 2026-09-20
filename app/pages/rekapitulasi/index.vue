<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { toast } from 'vue3-toastify'
import Navbar from '~/components/Navbar.vue'
// Import library html2pdf
import html2pdf from 'html2pdf.js'

// --- PASTIKAN URL INI SAMA DENGAN URL DEPLOY TERBARU ANDA ---
const GOOGLE_SCRIPT_URL = "http://127.0.0.1:8000/api/inventaris"

const dataInventaris = ref<any[]>([])
const isLoading = ref(true)
const selectedLembaga = ref('SMA')

// Referensi untuk area yang akan dicetak ke PDF (mencakup semua data)
const reportRef = ref<HTMLElement | null>(null)
const isGeneratingPDF = ref(false)

// Fungsi format dan parsing
const formatRupiah = (angka: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka)
}

const parsePrice = (priceStr: any) => {
    if (!priceStr) return 0
    const cleanStr = String(priceStr).replace(/[^0-9]/g, '')
    return parseInt(cleanStr, 10) || 0
}

const fetchBukuIndukData = async () => {
    isLoading.value = true
    dataInventaris.value = []
    
    try {
        const res = await fetch(`${GOOGLE_SCRIPT_URL}?action=inventaris&lembaga=${selectedLembaga.value}`, { method: "GET" })
        const result = await res.json()

        if (result.status === 200) {
            dataInventaris.value = result.datas || []
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

watch(selectedLembaga, () => {
    fetchBukuIndukData()
})

onMounted(() => {
    fetchBukuIndukData()
})

// ==============================================================================
// FITUR GENERATE PDF (Diubah ke landscape agar tidak ada kolom terpotong)
// ==============================================================================
const generatePDF = () => {
    if (!reportRef.value) return

    isGeneratingPDF.value = true
    const toastId = toast.loading("Menyiapkan dokumen PDF (Landscape)...")

    const opt = {
        margin:       10, // Margin (mm)
        filename:     `Laporan_Lengkap_Inventaris_${selectedLembaga.value}.pdf`,
        image:        { type: 'jpeg' as const, quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, letterRendering: true }, 
        jsPDF:        { unit: 'mm' as const, format: 'a4' as const, orientation: 'landscape' as const } // Diubah ke landscape
    };

    html2pdf().set(opt).from(reportRef.value).save()
        .then(() => {
            toast.update(toastId, { render: "Berhasil mengunduh PDF!", type: "success", isLoading: false, autoClose: 3000 })
        })
        .catch((err: any) => {
            console.error(err)
            toast.update(toastId, { render: "Gagal memuat PDF", type: "error", isLoading: false, autoClose: 3000 })
        })
        .finally(() => {
            isGeneratingPDF.value = false
        })
}

// ==============================================================================
// FUNGSI HELPER REKAPITULASI DATA (BERDASARKAN MODE: 'aktif' / 'keluar')
// ==============================================================================
const generateRekapByMode = (mode: 'aktif' | 'keluar') => {
    const rekapMap = new Map<string, any>()

    dataInventaris.value.forEach(item => {
        const namaBarang = String(item.namaBarang || item.nama_barang || '').trim().toUpperCase()
        const noUrut = String(item.noUrutBarang || item.no_urut_barang || item.jb_k || '').trim()
        
        const isNotHeader = noUrut !== '' && noUrut !== '-' && noUrut !== '0000' && noUrut !== '000' && noUrut !== '0'
        const isValidName = !namaBarang.includes('BUKU INDUK') && !namaBarang.includes('JAKARTA') && namaBarang !== 'TANAH' && namaBarang !== 'BANGUNAN' && namaBarang !== ''

        if (isNotHeader && isValidName) {
            const status = String(item.status || item.Status || 'aktif').toLowerCase().trim()
            const isAktif = status === 'aktif' || status === 'ada' || status === '' || status === '-'

            if (mode === 'keluar' && isAktif) return; 
            if (mode === 'aktif' && !isAktif) return;

            const rawGol = String(item.gol || item.golongan || '').trim().toUpperCase();
            let golonganNama = String(item.master_golongan || item.golongan || item.gol || 'Tanpa Golongan').trim();
            if (rawGol && golonganNama.charAt(0).toUpperCase() !== rawGol.charAt(0)) {
                golonganNama = rawGol; 
            }

            const fallbackKelompok = namaBarang.split(/[\s\-\/]+/)[0];
            const kelompok = String(item.master_kelompok || item.kelompok || item.kel || fallbackKelompok).trim().toUpperCase();
            
            const key = `${golonganNama} | ${kelompok}`
            
            const qty = 1
            const hargaSatuan = parsePrice(item.harga || item.Harga)
            const totalNilai = qty * hargaSatuan
            const kondisi = String(item.kondisi_barang || item['Kondisi Barang'] || 'baru').toLowerCase()

            const isRusak = kondisi.includes('rusak')
            const isBaik = !isRusak
            
            const isHibah = status.includes('hibah')
            const isLelangMusnah = status.includes('lelang') || status.includes('musnah')
            const isMutasi = status.includes('mutasi')

            if (!rekapMap.has(key)) {
                rekapMap.set(key, {
                    golongan: golonganNama,
                    kelompok: kelompok,
                    total_item: 0,
                    kondisi_baik: 0,
                    kondisi_rusak: 0,
                    status_mutasi: 0,
                    status_hibah: 0,
                    status_lelang_musnah: 0,
                    total_nilai_aset: 0
                })
            }

            const current = rekapMap.get(key)
            current.total_item += qty
            current.total_nilai_aset += totalNilai
            
            if (isBaik) current.kondisi_baik += qty
            if (isRusak) current.kondisi_rusak += qty
            
            if (mode === 'keluar') {
                if (isMutasi) current.status_mutasi += qty
                if (isHibah) current.status_hibah += qty
                if (isLelangMusnah) current.status_lelang_musnah += qty
            }
        }
    })

    return Array.from(rekapMap.values()).sort((a, b) => {
        if (a.golongan === b.golongan) {
            return a.kelompok.localeCompare(b.kelompok)
        }
        return a.golongan.localeCompare(b.golongan)
    })
}

// COMPUTED DATA AKTIF & KELUAR
const rekapDataAktif = computed(() => generateRekapByMode('aktif'))
const rekapDataKeluar = computed(() => generateRekapByMode('keluar'))

const calcGrandTotal = (dataList: any[]) => {
    return dataList.reduce((acc, curr) => {
        acc.total_item += curr.total_item
        acc.kondisi_baik += curr.kondisi_baik
        acc.kondisi_rusak += curr.kondisi_rusak
        acc.status_mutasi += curr.status_mutasi
        acc.status_hibah += curr.status_hibah
        acc.status_lelang_musnah += curr.status_lelang_musnah
        acc.total_nilai_aset += curr.total_nilai_aset
        return acc
    }, {
        total_item: 0, kondisi_baik: 0, kondisi_rusak: 0,
        status_mutasi: 0, status_hibah: 0, status_lelang_musnah: 0, total_nilai_aset: 0
    })
}

const grandTotalAktif = computed(() => calcGrandTotal(rekapDataAktif.value))
const grandTotalKeluar = computed(() => calcGrandTotal(rekapDataKeluar.value))
</script>

<template>
    <div class="app-layout">
        <Navbar />

        <main class="dashboard-container">
            <div class="header-container">
                <div>
                    <h1 class="page-title">
                        Laporan Rekapitulasi Inventaris
                    </h1>
                    <p class="subtitle">
                        Ringkasan total kuantitas, kondisi, dan nilai aset tersedia serta aset keluar berdasarkan Golongan & Kelompok.
                    </p>
                </div>
                
                <div style="display: flex; gap: 15px; align-items: center;">
                    <!-- TOMBOL GENERATE PDF -->
                    <button 
                        @click="generatePDF" 
                        class="btn-export" 
                        :disabled="isLoading || isGeneratingPDF || dataInventaris.length === 0">
                        <svg v-if="!isGeneratingPDF" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        <span v-if="isGeneratingPDF">Memproses...</span>
                        <span v-else>Cetak PDF (Landscape)</span>
                    </button>

                    <div class="filter-group-header">
                        <label for="pilihLembaga">Lembaga:</label>
                        <select id="pilihLembaga" v-model="selectedLembaga" class="select-box highlight-select">
                            <option value="SMA">SMA Budhi Warman II</option>
                            <option value="SMK">SMK Budhi Warman II</option>
                            <option value="YAYASAN">Yayasan Budhi Warman II</option>
                        </select>
                    </div>
                </div>
            </div>

            <div v-if="isLoading" class="loading-state">
                <div class="spinner"></div>
                <h2>Menyusun Laporan Rekapitulasi {{ selectedLembaga }}...</h2>
            </div>

            <!-- CONTAINER UTAMA YANG AKAN DI-RENDER MENJADI PDF -->
            <div v-else ref="reportRef" class="pdf-container">
                
                <!-- HEADER LAPORAN PDF -->
                <div class="pdf-header" style="text-align: center; margin-bottom: 25px;">
                    <h2 style="font-size: 22px; font-weight: 800; color: #0f172a; margin: 0;">LAPORAN REKAPITULASI INVENTARIS ASET</h2>
                    <h3 style="margin-top: 5px; color: #475569; font-size: 16px;">{{ selectedLembaga === 'YAYASAN' ? 'Yayasan' : selectedLembaga }} Budhi Warman II</h3>
                    <hr style="border: none; border-top: 2px solid #0f172a; margin-top: 15px;" />
                </div>

                <!-- ================= SECTION 1: ASET TERSEDIA (AKTIF) ================= -->
                <div class="report-section-block" style="margin-bottom: 40px;">
                    <div class="section-title-badge text-green" style="margin-bottom: 12px; font-weight: 700; font-size: 15px;">
                        A. LAPORAN ASET TERSEDIA (AKTIF)
                    </div>

                    <!-- SUMMARY CARDS AKTIF -->
                    <div class="stats-grid" style="margin-bottom: 15px;">
                        <div class="stat-card teal">
                            <div class="card-info">
                                <span class="card-title">TOTAL ITEM TERSEDIA</span>
                                <h2 class="card-value">{{ grandTotalAktif.total_item }} <span class="unit">Unit</span></h2>
                            </div>
                        </div>
                        <div class="stat-card green">
                            <div class="card-info">
                                <span class="card-title">KONDISI BAIK</span>
                                <h2 class="card-value">{{ grandTotalAktif.kondisi_baik }} <span class="unit">Unit</span></h2>
                            </div>
                        </div>
                        <div class="stat-card red">
                            <div class="card-info">
                                <span class="card-title">KONDISI RUSAK</span>
                                <h2 class="card-value">{{ grandTotalAktif.kondisi_rusak }} <span class="unit">Unit</span></h2>
                            </div>
                        </div>
                    </div>

                    <!-- TABEL AKTIF -->
                    <div class="table-section">
                        <div class="table-wrapper">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th rowspan="2" class="text-center" style="width: 50px;">No</th>
                                        <th rowspan="2" style="width: 180px;">Kategori / Golongan</th>
                                        <th rowspan="2">Kelompok Barang</th>
                                        <th rowspan="2" class="text-center highlight-col" style="width: 110px;">Total<br>Kuantitas</th>
                                        <th colspan="2" class="text-center border-group" style="width: 180px;">Kondisi Fisik</th>
                                        <th rowspan="2" class="text-right" style="width: 180px;">Estimasi Nilai Total (Gross)</th>
                                    </tr>
                                    <tr>
                                        <th class="text-center th-sub">Baik/Baru</th>
                                        <th class="text-center th-sub">Rusak</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-if="rekapDataAktif.length === 0">
                                        <td colspan="7" class="text-center">Tidak ada data aset tersedia.</td>
                                    </tr>
                                    <tr v-for="(item, index) in rekapDataAktif" :key="index">
                                        <td class="text-center" style="color: #94a3b8;">{{ index + 1 }}</td>
                                        <td><strong>{{ item.golongan }}</strong></td>
                                        <td style="color: #334155;">{{ item.kelompok }}</td>
                                        <td class="text-center highlight-col"><strong>{{ item.total_item }}</strong></td>
                                        <td class="text-center text-green">{{ item.kondisi_baik }}</td>
                                        <td class="text-center text-red">{{ item.kondisi_rusak }}</td>
                                        <td class="text-right"><strong>{{ formatRupiah(item.total_nilai_aset) }}</strong></td>
                                    </tr>
                                </tbody>
                                <tfoot>
                                    <tr class="footer-row">
                                        <td colspan="3" class="text-right"><strong>GRAND TOTAL:</strong></td>
                                        <td class="text-center highlight-col"><strong>{{ grandTotalAktif.total_item }}</strong></td>
                                        <td class="text-center"><strong>{{ grandTotalAktif.kondisi_baik }}</strong></td>
                                        <td class="text-center"><strong>{{ grandTotalAktif.kondisi_rusak }}</strong></td>
                                        <td class="text-right"><strong>{{ formatRupiah(grandTotalAktif.total_nilai_aset) }}</strong></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>

                <!-- ================= SECTION 2: ASET KELUAR ================= -->
                <div class="report-section-block">
                    <div class="section-title-badge text-red" style="margin-bottom: 12px; font-weight: 700; font-size: 15px;">
                        B. LAPORAN ASET KELUAR
                    </div>

                    <!-- SUMMARY CARDS KELUAR -->
                    <div class="stats-grid" style="margin-bottom: 15px;">
                        <div class="stat-card teal">
                            <div class="card-info">
                                <span class="card-title">TOTAL ITEM KELUAR</span>
                                <h2 class="card-value">{{ grandTotalKeluar.total_item }} <span class="unit">Unit</span></h2>
                            </div>
                        </div>
                        <div class="stat-card cyan">
                            <div class="card-info">
                                <span class="card-title">DIMUTASI</span>
                                <h2 class="card-value">{{ grandTotalKeluar.status_mutasi }} <span class="unit">Unit</span></h2>
                            </div>
                        </div>
                        <div class="stat-card purple">
                            <div class="card-info">
                                <span class="card-title">DIHIBAHKAN</span>
                                <h2 class="card-value">{{ grandTotalKeluar.status_hibah }} <span class="unit">Unit</span></h2>
                            </div>
                        </div>
                        <div class="stat-card orange">
                            <div class="card-info">
                                <span class="card-title">DILELANG / MUSNAH</span>
                                <h2 class="card-value">{{ grandTotalKeluar.status_lelang_musnah }} <span class="unit">Unit</span></h2>
                            </div>
                        </div>
                    </div>

                    <!-- TABEL KELUAR -->
                    <div class="table-section">
                        <div class="table-wrapper">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th rowspan="2" class="text-center" style="width: 40px;">No</th>
                                        <th rowspan="2" style="width: 150px;">Kategori / Golongan</th>
                                        <th rowspan="2">Kelompok Barang</th>
                                        <th rowspan="2" class="text-center highlight-col" style="width: 90px;">Total<br>Kuantitas</th>
                                        <th colspan="2" class="text-center border-group" style="width: 140px;">Kondisi Fisik</th>
                                        <th colspan="3" class="text-center border-group" style="width: 240px;">Klasifikasi Aset Keluar</th>
                                        <th rowspan="2" class="text-right" style="width: 160px;">Estimasi Nilai Total (Gross)</th>
                                    </tr>
                                    <tr>
                                        <th class="text-center th-sub">Baik/Baru</th>
                                        <th class="text-center th-sub">Rusak</th>
                                        <th class="text-center th-sub">Dimutasi</th>
                                        <th class="text-center th-sub">Dihibahkan</th>
                                        <th class="text-center th-sub">Lelang/Musnah</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-if="rekapDataKeluar.length === 0">
                                        <td colspan="10" class="text-center">Tidak ada data aset keluar.</td>
                                    </tr>
                                    <tr v-for="(item, index) in rekapDataKeluar" :key="index">
                                        <td class="text-center" style="color: #94a3b8;">{{ index + 1 }}</td>
                                        <td><strong>{{ item.golongan }}</strong></td>
                                        <td style="color: #334155;">{{ item.kelompok }}</td>
                                        <td class="text-center highlight-col"><strong>{{ item.total_item }}</strong></td>
                                        <td class="text-center text-green">{{ item.kondisi_baik }}</td>
                                        <td class="text-center text-red">{{ item.kondisi_rusak }}</td>
                                        <td class="text-center text-cyan">{{ item.status_mutasi }}</td>
                                        <td class="text-center text-purple">{{ item.status_hibah }}</td>
                                        <td class="text-center text-red">{{ item.status_lelang_musnah }}</td>
                                        <td class="text-right"><strong>{{ formatRupiah(item.total_nilai_aset) }}</strong></td>
                                    </tr>
                                </tbody>
                                <tfoot>
                                    <tr class="footer-row">
                                        <td colspan="3" class="text-right"><strong>GRAND TOTAL:</strong></td>
                                        <td class="text-center highlight-col"><strong>{{ grandTotalKeluar.total_item }}</strong></td>
                                        <td class="text-center"><strong>{{ grandTotalKeluar.kondisi_baik }}</strong></td>
                                        <td class="text-center"><strong>{{ grandTotalKeluar.kondisi_rusak }}</strong></td>
                                        <td class="text-center text-cyan-light"><strong>{{ grandTotalKeluar.status_mutasi }}</strong></td>
                                        <td class="text-center text-purple-light"><strong>{{ grandTotalKeluar.status_hibah }}</strong></td>
                                        <td class="text-center text-red-light"><strong>{{ grandTotalKeluar.status_lelang_musnah }}</strong></td>
                                        <td class="text-right"><strong>{{ formatRupiah(grandTotalKeluar.total_nilai_aset) }}</strong></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>

            </div>
        </main>
    </div>
</template>

<style scoped>
.app-layout { display: flex; min-height: 100vh; background-color: #f8fafc; }
.dashboard-container { flex: 1; padding: 30px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; width: calc(100% - 250px); overflow-x: hidden; }

.header-container { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 24px; border-bottom: 1px solid #e2e8f0; padding-bottom: 15px; }
.page-title { font-size: 26px; font-weight: 800; color: #0f172a; margin: 0 0 5px 0; }
.subtitle { font-size: 14px; color: #64748b; margin: 0; }

.filter-group-header { display: flex; align-items: center; gap: 10px; background: white; padding: 10px 18px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; }
.filter-group-header label { font-size: 13px; font-weight: 700; color: #475569; }
.highlight-select { font-weight: 700; color: #3b82f6; border: none; background: transparent; padding: 0; outline: none; font-size: 15px; cursor: pointer; }

/* STYLE BUTTON EXPORT */
.btn-export { display: flex; align-items: center; background-color: #0f172a; color: white; border: none; padding: 9px 18px; border-radius: 8px; font-weight: 600; font-size: 13px; cursor: pointer; transition: 0.3s ease; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
.btn-export:hover:not(:disabled) { background-color: #1e293b; transform: translateY(-1px); }
.btn-export:disabled { background-color: #94a3b8; cursor: not-allowed; }

.loading-state { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 40vh; color: #64748b; font-weight: 600; }
.spinner { border: 4px solid #e2e8f0; border-top: 4px solid #3b82f6; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin-bottom: 15px; }
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

.stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 15px; }
.stat-card { background-color: #ffffff; border-radius: 12px; padding: 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); border-left: 5px solid #cbd5e1; display: flex; align-items: center; gap: 10px; }
.stat-card.teal { border-left-color: #14b8a6; }
.stat-card.cyan { border-left-color: #06b6d4; }
.stat-card.orange { border-left-color: #f59e0b; }
.stat-card.purple { border-left-color: #8b5cf6; }
.stat-card.green { border-left-color: #22c55e; }
.stat-card.red { border-left-color: #ef4444; }
.card-info { flex: 1; }
.card-title { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
.card-value { font-size: 22px; font-weight: 800; margin: 4px 0 2px 0; color: #0f172a; }
.unit { font-size: 12px; font-weight: 600; color: #94a3b8; }

.table-section { background-color: #ffffff; border-radius: 12px; padding: 20px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
.table-wrapper { overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 8px; }
.data-table { width: 100%; border-collapse: collapse; text-align: left; font-size: 12px; }
.data-table th, .data-table td { padding: 10px 14px; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;}
.data-table th { background-color: #f8fafc; color: #475569; font-weight: 700; vertical-align: middle; }
.data-table td { color: #334155; vertical-align: middle; }
.data-table tr:hover { background-color: #f1f5f9; }

.border-group { border-bottom: 1px solid #cbd5e1 !important; }
.th-sub { font-size: 10px !important; background-color: #f1f5f9 !important; color: #64748b !important; }
.highlight-col { background-color: #f8fafc; border-left: 2px solid #e2e8f0 !important; border-right: 2px solid #e2e8f0 !important; }

.footer-row { background-color: #1e293b; color: white !important; }
.footer-row td { color: white !important; border-color: #334155; font-size: 13px; padding: 12px 14px; }
.footer-row .highlight-col { background-color: #0f172a; border-color: #334155 !important; }

.text-right { text-align: right; }
.text-center { text-align: center; }
.text-green { color: #16a34a; font-weight: 600; }
.text-red { color: #dc2626; font-weight: 600; }
.text-purple { color: #7c3aed; font-weight: 600; }
.text-cyan { color: #0891b2; font-weight: 600; }

.text-green-light { color: #4ade80 !important; }
.text-red-light { color: #f87171 !important; }
.text-purple-light { color: #c084fc !important; }
.text-cyan-light { color: #22d3ee !important; }
</style>