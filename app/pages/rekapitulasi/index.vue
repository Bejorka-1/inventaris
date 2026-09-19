<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { toast } from 'vue3-toastify'
import Navbar from '~/components/Navbar.vue'

// --- PASTIKAN URL INI SAMA DENGAN URL DEPLOY TERBARU ANDA ---
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzjvzPhMA9WND064RIbRemeQ4zutDvCGs6oJtWrWjMqm4zyWhKr_yrRlEASBEjZLQ/exec"

const dataInventaris = ref<any[]>([])
const isLoading = ref(true)
const selectedLembaga = ref('SMA')

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
// MENGELOMPOKKAN DATA (REKAPITULASI KLASIFIKASI KETAT)
// ==============================================================================
const rekapData = computed(() => {
    const rekapMap = new Map<string, any>()

    dataInventaris.value.forEach(item => {
        const namaBarang = String(item.namaBarang || item.nama_barang || '').trim().toUpperCase()
        const noUrut = String(item.noUrutBarang || item.no_urut_barang || item.jb_k || '').trim()
        
        // Filter baris yang bukan barang valid (Header/Judul)
        const isNotHeader = noUrut !== '' && noUrut !== '-' && noUrut !== '0000' && noUrut !== '000' && noUrut !== '0'
        const isValidName = !namaBarang.includes('BUKU INDUK') && !namaBarang.includes('JAKARTA') && namaBarang !== 'TANAH' && namaBarang !== 'BANGUNAN' && namaBarang !== ''

        if (isNotHeader && isValidName) {
            // Ambil DNA Golongan yang MURNI DARI SHEET
            const rawGol = String(item.gol || item.golongan || '').trim().toUpperCase();
            
            // Tentukan Golongan dan Kelompok secara Presisi
            let golonganNama = String(item.master_golongan || item.golongan || item.gol || 'Tanpa Golongan').trim();
            // Cegah kebocoran: Pastikan huruf awal golongan cocok dengan kode dari sheet
            if (rawGol && golonganNama.charAt(0).toUpperCase() !== rawGol.charAt(0)) {
                golonganNama = rawGol; // Kembalikan ke kode aslinya jika tidak cocok
            }

            // Gunakan master_kelompok jika tersedia, jika tidak ambil kata pertama dari nama barang
            const fallbackKelompok = namaBarang.split(/[\s\-\/]+/)[0];
            const kelompok = String(item.master_kelompok || item.kelompok || item.kel || fallbackKelompok).trim().toUpperCase();
            
            // Kunci pengelompokan menggunakan Golongan dan Kelompok
            const key = `${golonganNama} | ${kelompok}`
            
            // SETIAP BARIS DIHITUNG SEBAGAI 1 ITEM FISIK
            const qty = 1
            const hargaSatuan = parsePrice(item.harga || item.Harga)
            const totalNilai = qty * hargaSatuan
            
            const kondisi = String(item.kondisi_barang || item['Kondisi Barang'] || 'baru').toLowerCase()
            const status = String(item.status || item.Status || 'aktif').toLowerCase().trim()

            // --- KLASIFIKASI KONDISI FISIK ---
            const isRusak = kondisi.includes('rusak')
            const isBaik = !isRusak
            
            // --- KLASIFIKASI 4 KATEGORI UTAMA ---
            const isHibah = status.includes('hibah')
            const isLelangMusnah = status.includes('lelang') || status.includes('musnah')
            const isMutasi = status.includes('mutasi')
            const isMasihAda = !isHibah && !isLelangMusnah && !isMutasi // Aktif/Baru

            if (!rekapMap.has(key)) {
                rekapMap.set(key, {
                    golongan: golonganNama,
                    kelompok: kelompok,
                    total_item: 0,
                    kondisi_baik: 0,
                    kondisi_rusak: 0,
                    status_masih_ada: 0,
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
            
            if (isMasihAda) current.status_masih_ada += qty
            if (isMutasi) current.status_mutasi += qty
            if (isHibah) current.status_hibah += qty
            if (isLelangMusnah) current.status_lelang_musnah += qty
        }
    })

    // Konversi Map ke Array dan urutkan berdasarkan abjad Golongan, lalu abjad Kelompok
    return Array.from(rekapMap.values()).sort((a, b) => {
        if (a.golongan === b.golongan) {
            return a.kelompok.localeCompare(b.kelompok)
        }
        return a.golongan.localeCompare(b.golongan)
    })
})

// MENGHITUNG GRAND TOTAL UNTUK FOOTER TABEL DAN KARTU STATISTIK
const grandTotal = computed(() => {
    return rekapData.value.reduce((acc, curr) => {
        acc.total_item += curr.total_item
        acc.kondisi_baik += curr.kondisi_baik
        acc.kondisi_rusak += curr.kondisi_rusak
        acc.status_masih_ada += curr.status_masih_ada
        acc.status_mutasi += curr.status_mutasi
        acc.status_hibah += curr.status_hibah
        acc.status_lelang_musnah += curr.status_lelang_musnah
        acc.total_nilai_aset += curr.total_nilai_aset
        return acc
    }, {
        total_item: 0, kondisi_baik: 0, kondisi_rusak: 0,
        status_masih_ada: 0, status_mutasi: 0, status_hibah: 0, status_lelang_musnah: 0, total_nilai_aset: 0
    })
})
</script>

<template>
    <div class="app-layout">
        <Navbar />

        <main class="dashboard-container">
            <div class="header-container">
                <div>
                    <h1 class="page-title">Laporan Rekapitulasi</h1>
                    <p class="subtitle">Ringkasan total kuantitas, kondisi, dan klasifikasi aset berdasarkan Golongan & Kelompok barang.</p>
                </div>
                <div class="filter-group-header">
                    <label for="pilihLembaga">Lembaga:</label>
                    <select id="pilihLembaga" v-model="selectedLembaga" class="select-box highlight-select">
                        <option value="SMA">SMA Budhi Warman II</option>
                        <option value="SMK">SMK Budhi Warman II</option>
                        <option value="YAYASAN">Yayasan Budhi Warman II</option>
                    </select>
                </div>
            </div>

            <div v-if="isLoading" class="loading-state">
                <div class="spinner"></div>
                <h2>Menyusun Laporan Rekapitulasi {{ selectedLembaga }}...</h2>
            </div>

            <div v-else>
                <!-- SUMMARY CARDS -->
                <div class="stats-grid">
                    <div class="stat-card teal">
                        <div class="card-info">
                            <span class="card-title">TOTAL ITEM FISIK</span>
                            <h2 class="card-value">{{ grandTotal.total_item }} <span class="unit">Unit</span></h2>
                        </div>
                    </div>
                    <div class="stat-card blue">
                        <div class="card-info">
                            <span class="card-title">MASIH ADA / AKTIF</span>
                            <h2 class="card-value">{{ grandTotal.status_masih_ada }} <span class="unit">Unit</span></h2>
                        </div>
                    </div>
                    <div class="stat-card cyan">
                        <div class="card-info">
                            <span class="card-title">DIMUTASI</span>
                            <h2 class="card-value">{{ grandTotal.status_mutasi }} <span class="unit">Unit</span></h2>
                        </div>
                    </div>
                    <div class="stat-card purple">
                        <div class="card-info">
                            <span class="card-title">DIHIBAHKAN</span>
                            <h2 class="card-value">{{ grandTotal.status_hibah }} <span class="unit">Unit</span></h2>
                        </div>
                    </div>
                    <div class="stat-card orange">
                        <div class="card-info">
                            <span class="card-title">DILELANG / MUSNAH</span>
                            <h2 class="card-value">{{ grandTotal.status_lelang_musnah }} <span class="unit">Unit</span></h2>
                        </div>
                    </div>
                </div>

                <!-- TABEL REKAPITULASI -->
                <div class="table-section">
                    <div class="table-info" style="margin-bottom: 20px;">
                        <h3>Buku Rekapitulasi Inventaris - {{ selectedLembaga }}</h3>
                    </div>

                    <div class="table-wrapper">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th rowspan="2" class="text-center">No</th>
                                    <th rowspan="2">Kategori / Golongan</th>
                                    <th rowspan="2">Kelompok Barang</th>
                                    <th rowspan="2" class="text-center highlight-col">Total<br>Kuantitas</th>
                                    <th colspan="2" class="text-center border-group">Kondisi Fisik</th>
                                    <th colspan="4" class="text-center border-group">Klasifikasi Aset (Status)</th>
                                    <th rowspan="2" class="text-right">Estimasi Nilai Total (Gross)</th>
                                </tr>
                                <tr>
                                    <th class="text-center th-sub">Baik/Baru</th>
                                    <th class="text-center th-sub">Rusak</th>
                                    <th class="text-center th-sub">Masih Ada</th>
                                    <th class="text-center th-sub">Dimutasi</th>
                                    <th class="text-center th-sub">Dihibahkan</th>
                                    <th class="text-center th-sub">Lelang/Musnah</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-if="rekapData.length === 0">
                                    <td colspan="11" class="text-center">Tidak ada data untuk direkapitulasi.</td>
                                </tr>
                                <tr v-for="(item, index) in rekapData" :key="index">
                                    <td class="text-center" style="color: #94a3b8;">{{ index + 1 }}</td>
                                    <td><strong>{{ item.golongan }}</strong></td>
                                    <td style="color: #334155;">{{ item.kelompok }}</td>
                                    <td class="text-center highlight-col"><strong>{{ item.total_item }}</strong></td>
                                    <td class="text-center text-green">{{ item.kondisi_baik }}</td>
                                    <td class="text-center text-red">{{ item.kondisi_rusak }}</td>
                                    <td class="text-center text-green">{{ item.status_masih_ada }}</td>
                                    <td class="text-center text-cyan">{{ item.status_mutasi }}</td>
                                    <td class="text-center text-purple">{{ item.status_hibah }}</td>
                                    <td class="text-center text-red">{{ item.status_lelang_musnah }}</td>
                                    <td class="text-right"><strong>{{ formatRupiah(item.total_nilai_aset) }}</strong></td>
                                </tr>
                            </tbody>
                            <tfoot>
                                <tr class="footer-row">
                                    <td colspan="3" class="text-right"><strong>GRAND TOTAL:</strong></td>
                                    <td class="text-center highlight-col" style="font-size: 16px;"><strong>{{ grandTotal.total_item }}</strong></td>
                                    <td class="text-center"><strong>{{ grandTotal.kondisi_baik }}</strong></td>
                                    <td class="text-center"><strong>{{ grandTotal.kondisi_rusak }}</strong></td>
                                    <td class="text-center text-green-light"><strong>{{ grandTotal.status_masih_ada }}</strong></td>
                                    <td class="text-center text-cyan-light"><strong>{{ grandTotal.status_mutasi }}</strong></td>
                                    <td class="text-center text-purple-light"><strong>{{ grandTotal.status_hibah }}</strong></td>
                                    <td class="text-center text-red-light"><strong>{{ grandTotal.status_lelang_musnah }}</strong></td>
                                    <td class="text-right" style="font-size: 16px;"><strong>{{ formatRupiah(grandTotal.total_nilai_aset) }}</strong></td>
                                </tr>
                            </tfoot>
                        </table>
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

.loading-state { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 40vh; color: #64748b; font-weight: 600; }
.spinner { border: 4px solid #e2e8f0; border-top: 4px solid #3b82f6; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin-bottom: 15px; }
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

/* STATS GRID */
.stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px; margin-bottom: 30px; }
.stat-card { background-color: #ffffff; border-radius: 12px; padding: 18px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); border-left: 5px solid #cbd5e1; display: flex; align-items: center; gap: 10px; transition: transform 0.2s ease; }
.stat-card:hover { transform: translateY(-3px); }
.stat-card.blue { border-left-color: #3b82f6; }
.stat-card.teal { border-left-color: #14b8a6; }
.stat-card.cyan { border-left-color: #06b6d4; }
.stat-card.orange { border-left-color: #f59e0b; }
.stat-card.purple { border-left-color: #8b5cf6; }
.card-info { flex: 1; }
.card-title { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
.card-value { font-size: 24px; font-weight: 800; margin: 6px 0 2px 0; color: #0f172a; }
.unit { font-size: 12px; font-weight: 600; color: #94a3b8; }

/* TABLE SECTION */
.table-section { background-color: #ffffff; border-radius: 12px; padding: 24px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
.table-info h3 { font-size: 18px; font-weight: 800; color: #1e293b; margin: 0; text-transform: uppercase; letter-spacing: 0.5px;}

.table-wrapper { overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 8px; }
.data-table { width: 100%; border-collapse: collapse; text-align: left; font-size: 13px; }
.data-table th, .data-table td { padding: 12px 16px; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;}
.data-table th { background-color: #f8fafc; color: #475569; font-weight: 700; font-size: 12px; vertical-align: middle; }
.data-table td { color: #334155; vertical-align: middle; }
.data-table tr:hover { background-color: #f1f5f9; }

.border-group { border-bottom: 1px solid #cbd5e1 !important; }
.th-sub { font-size: 11px !important; background-color: #f1f5f9 !important; color: #64748b !important; }
.highlight-col { background-color: #f8fafc; border-left: 2px solid #e2e8f0 !important; border-right: 2px solid #e2e8f0 !important; }

.footer-row { background-color: #1e293b; color: white !important; }
.footer-row td { color: white !important; border-color: #334155; font-size: 14px; padding: 16px; }
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