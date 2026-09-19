<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { toast } from 'vue3-toastify'
import Navbar from '~/components/Navbar.vue'

// --- PASTIKAN URL INI SAMA DENGAN URL DEPLOY TERBARU ANDA ---
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzjvzPhMA9WND064RIbRemeQ4zutDvCGs6oJtWrWjMqm4zyWhKr_yrRlEASBEjZLQ/exec"

const isLoading = ref(true)

// State penampung data dari masing-masing lembaga
const dataSMA = ref<any[]>([])
const dataSMK = ref<any[]>([])
const dataYAYASAN = ref<any[]>([])

// Fungsi untuk konversi string harga ke angka murni (mengabaikan "Rp", titik, dsb)
const parsePrice = (priceStr: any) => {
    if (!priceStr) return 0
    const cleanStr = String(priceStr).replace(/[^0-9]/g, '')
    return parseInt(cleanStr, 10) || 0
}

const parseQty = (qtyStr: any) => {
    if (!qtyStr) return 0
    const cleanStr = String(qtyStr).replace(/[^0-9]/g, '')
    return parseInt(cleanStr, 10) || 1 
}

const formatRupiah = (angka: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka)
}

// Fungsi Fetch Paralel: Tarik data ketiga lembaga sekaligus
const fetchAllData = async () => {
    isLoading.value = true
    try {
        const [resSMA, resSMK, resYAYASAN] = await Promise.all([
            fetch(`${GOOGLE_SCRIPT_URL}?action=inventaris&lembaga=SMA`),
            fetch(`${GOOGLE_SCRIPT_URL}?action=inventaris&lembaga=SMK`),
            fetch(`${GOOGLE_SCRIPT_URL}?action=inventaris&lembaga=YAYASAN`)
        ])

        const [jsonSMA, jsonSMK, jsonYAYASAN] = await Promise.all([
            resSMA.json(), resSMK.json(), resYAYASAN.json()
        ])

        dataSMA.value = jsonSMA.status === 200 ? jsonSMA.datas : []
        dataSMK.value = jsonSMK.status === 200 ? jsonSMK.datas : []
        dataYAYASAN.value = jsonYAYASAN.status === 200 ? jsonYAYASAN.datas : []
        
    } catch (error) {
        console.error("Error fetching data:", error)
        toast("Terjadi kesalahan koneksi saat memuat rekap data", { type: "error" })
    } finally {
        isLoading.value = false
    }
}

onMounted(() => {
    fetchAllData()
})

// FUNGSI KALKULATOR UTAMA PER LEMBAGA
const calculateStats = (dataArray: any[]) => {
    let totalAsetGross = 0
    let totalLelangMusnah = 0
    let totalHibah = 0

    dataArray.forEach(item => {
        const namaBarang = String(item.namaBarang || item.nama_barang || '').trim().toUpperCase()
        const noUrut = String(item.noUrutBarang || item.no_urut_barang || item.jb_k || '').trim()
        
        // Filter agar header kelompok tidak ikut dihitung
        const isNotHeader = noUrut !== '' && noUrut !== '-' && noUrut !== '0000' && noUrut !== '000' && noUrut !== '0'
        const isValidName = !namaBarang.includes('BUKU INDUK') && !namaBarang.includes('JAKARTA') && namaBarang !== 'TANAH' && namaBarang !== 'BANGUNAN' && namaBarang !== ''

        if (isNotHeader && isValidName) {
            const hrg = parsePrice(item.harga || item.Harga)
            const qty = parseQty(item.kuantitas || item.Kuantitas)
            const nilaiItem = hrg * qty

            totalAsetGross += nilaiItem

            // Cek status pemotongan aset
            const status = String(item.status || item.Status || '').toLowerCase().trim()
            if (status.includes('lelang') || status.includes('musnah')) {
                totalLelangMusnah += nilaiItem
            } else if (status.includes('hibah')) {
                totalHibah += nilaiItem
            }
        }
    })

    // Jumlah Total = (Total Aset Keseluruhan) dikurangi (Lelang/Musnah + Hibah)
    const jumlahTotalNet = totalAsetGross - totalLelangMusnah - totalHibah

    return {
        lelangMusnah: totalLelangMusnah,
        hibah: totalHibah,
        totalAset: totalAsetGross,
        jumlahTotal: jumlahTotalNet
    }
}

// MENGHITUNG STATISTIK MASING-MASING LEMBAGA
const statsSMA = computed(() => calculateStats(dataSMA.value))
const statsSMK = computed(() => calculateStats(dataSMK.value))
const statsYAYASAN = computed(() => calculateStats(dataYAYASAN.value))

// MENGHITUNG GRAND TOTAL GLOBAL
const grandTotalRealTime = computed(() => statsSMA.value.jumlahTotal + statsSMK.value.jumlahTotal + statsYAYASAN.value.jumlahTotal)
const grandTotalAset = computed(() => statsSMA.value.totalAset + statsSMK.value.totalAset + statsYAYASAN.value.totalAset)

</script>

<template>
    <div class="app-layout">
        <Navbar />

        <main class="dashboard-container">
            <div class="header-container">
                <h1 class="page-title text-center" style="width: 100%; text-transform: uppercase; letter-spacing: 1px;">Total Aset Budhi Warman II</h1>
            </div>

            <div v-if="isLoading" class="loading-state">
                <div class="spinner"></div>
                <h2>Mengkalkulasi Nilai Aset SMA, SMK, dan Yayasan...</h2>
            </div>

            <div v-else class="content-wrapper">
                
                <!-- GRID 3 KOLOM UNTUK SMA, SMK, YAYASAN -->
                <div class="summary-grid-3">
                    
                    <!-- KARTU SMA -->
                    <div class="summary-card">
                        <div class="card-header header-sma">SMA BW II</div>
                        <table class="summary-table">
                            <tbody>
                                <tr>
                                    <td>Lelang/Musnahkan</td>
                                    <td class="text-right">{{ formatRupiah(statsSMA.lelangMusnah) }}</td>
                                </tr>
                                <tr>
                                    <td>Dihibahkan</td>
                                    <td class="text-right">{{ formatRupiah(statsSMA.hibah) }}</td>
                                </tr>
                                <tr class="row-total-aset bg-cyan">
                                    <td>Total Aset</td>
                                    <td class="text-right"><strong>{{ formatRupiah(statsSMA.totalAset) }}</strong></td>
                                </tr>
                                <tr class="row-jumlah-total bg-yellow">
                                    <td><strong>JUMLAH TOTAL</strong></td>
                                    <td class="text-right"><strong>{{ formatRupiah(statsSMA.jumlahTotal) }}</strong></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <!-- KARTU SMK -->
                    <div class="summary-card">
                        <div class="card-header header-smk">SMK BW II</div>
                        <table class="summary-table">
                            <tbody>
                                <tr>
                                    <td>Lelang/Musnahkan</td>
                                    <td class="text-right">{{ formatRupiah(statsSMK.lelangMusnah) }}</td>
                                </tr>
                                <tr>
                                    <td>Dihibahkan</td>
                                    <td class="text-right">{{ formatRupiah(statsSMK.hibah) }}</td>
                                </tr>
                                <tr class="row-total-aset bg-cyan">
                                    <td>Total Aset</td>
                                    <td class="text-right"><strong>{{ formatRupiah(statsSMK.totalAset) }}</strong></td>
                                </tr>
                                <tr class="row-jumlah-total bg-yellow">
                                    <td><strong>JUMLAH TOTAL</strong></td>
                                    <td class="text-right"><strong>{{ formatRupiah(statsSMK.jumlahTotal) }}</strong></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <!-- KARTU YAYASAN -->
                    <div class="summary-card">
                        <div class="card-header header-yayasan">YAYASAN BW II</div>
                        <table class="summary-table">
                            <tbody>
                                <tr>
                                    <td>Lelang/Musnahkan</td>
                                    <td class="text-right">{{ formatRupiah(statsYAYASAN.lelangMusnah) }}</td>
                                </tr>
                                <tr>
                                    <td>Dihibahkan</td>
                                    <td class="text-right">{{ formatRupiah(statsYAYASAN.hibah) }}</td>
                                </tr>
                                <tr class="row-total-aset bg-cyan">
                                    <td>Total Aset</td>
                                    <td class="text-right"><strong>{{ formatRupiah(statsYAYASAN.totalAset) }}</strong></td>
                                </tr>
                                <tr class="row-jumlah-total bg-yellow">
                                    <td><strong>JUMLAH TOTAL</strong></td>
                                    <td class="text-right"><strong>{{ formatRupiah(statsYAYASAN.jumlahTotal) }}</strong></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                </div>

                <!-- GRAND TOTAL SECTION (MENGIKUTI DESAIN SPREADSHEET) -->
                <div class="grand-total-section">
                    
                    <div class="grand-total-box">
                        <div class="gt-header bg-yellow">
                            <h3>TOTAL ASET REAL TIME</h3>
                        </div>
                        <div class="gt-body">
                            <h1>{{ formatRupiah(grandTotalRealTime) }}</h1>
                        </div>
                    </div>

                    <div class="grand-total-box mt-4">
                        <div class="gt-header bg-cyan">
                            <h3>TOTAL ASET</h3>
                        </div>
                        <div class="gt-body">
                            <h1>{{ formatRupiah(grandTotalAset) }}</h1>
                        </div>
                    </div>

                </div>

            </div>
        </main>
    </div>
</template>

<style scoped>
.app-layout { display: flex; min-height: 100vh; background-color: #f1f5f9; }
.dashboard-container { flex: 1; padding: 40px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; width: calc(100% - 250px); overflow-x: hidden; }

.header-container { margin-bottom: 40px; }
.page-title { font-size: 28px; font-weight: 900; color: #1e293b; margin: 0; text-align: center; }

.text-center { text-align: center; }
.text-right { text-align: right; }
.mt-4 { margin-top: 30px; }

.loading-state { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 50vh; color: #64748b; font-weight: 600; }
.spinner { border: 5px solid #e2e8f0; border-top: 5px solid #3b82f6; border-radius: 50%; width: 50px; height: 50px; animation: spin 1s linear infinite; margin-bottom: 20px; }
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

/* GRID 3 KOLOM */
.summary-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 50px; }
@media (max-width: 1100px) { .summary-grid-3 { grid-template-columns: 1fr; } }

.summary-card { background: white; border: 1px solid #000; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }

.card-header { padding: 12px; text-align: center; font-weight: bold; border-bottom: 1px solid #000; font-size: 15px; }
.header-sma { background-color: #22c55e; color: black; } /* Hijau */
.header-smk { background-color: #ef4444; color: white; } /* Merah */
.header-yayasan { background-color: #3b82f6; color: white; } /* Biru */

.summary-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.summary-table td { padding: 10px 15px; border: 1px solid #000; color: #000; }

/* WARNA HIGHLIGHT SEPERTI DI EXCEL */
.bg-cyan { background-color: #06b6d4 !important; color: black !important; }
.bg-yellow { background-color: #fde047 !important; color: black !important; }

/* GRAND TOTAL BOXES */
.grand-total-section { display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; }

.grand-total-box { width: 100%; max-width: 500px; border: 2px solid #000; background: white; text-align: center; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); }
.gt-header { padding: 12px; border-bottom: 2px solid #000; }
.gt-header h3 { margin: 0; font-size: 18px; font-weight: 800; letter-spacing: 0.5px; }
.gt-body { padding: 25px 20px; background-color: #f8fafc; }
.gt-body h1 { margin: 0; font-size: 32px; font-weight: 900; color: #000; }
</style>