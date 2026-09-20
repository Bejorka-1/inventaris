<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { toast } from 'vue3-toastify'
import Navbar from '~/components/Navbar.vue'

// --- GANTI URL INI DENGAN URL DEPLOY ANDA YANG PALING BARU! ---
const GOOGLE_SCRIPT_URL = "http://127.0.0.1:8000/api/inventaris"

const dataInventaris = ref<any[]>([])
const dataMasterBarang = ref<any[]>([])
const isLoading = ref(true)
const isSubmitting = ref(false)

const showModal = ref(false)
const selectedLembaga = ref('SMA') 
const fetchSource = ref<'bun' | 'gas'>('gas')
const selectedFilter = ref('all') 
const selectedNamaBarang = ref('all') 

// State inline edit
const editingItem = ref<any>(null)
const editForm = ref<any>({})
const isSavingEdit = ref(false)

const getTodayDate = () => {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

const formData = ref({
    tanggal_pembukuan: getTodayDate(), 
    nama_barang: '', ket_merk_ukuran: '', kuantitas: '1', nama_satuan: 'buah',
    tahun_pembuatan: '', asal_barang: 'YBW II', tgl_penyerahan: '', 
    kondisi_barang: 'baru', harga: '', ruang: '', status: 'Aktif', tempat: '', pembelian: ''
})

const currentPage = ref(1)
const itemsPerPage = ref(15) 

const fetchBukuIndukData = async () => {
    isLoading.value = true
    dataInventaris.value = [] 
    
    try {
        const GAS_URL = `${GOOGLE_SCRIPT_URL}?action=inventaris&lembaga=${selectedLembaga.value}`
        const res = await fetch(GAS_URL, { method: "GET" })
        const result = await res.json()

        const MASTER_URL = `${GOOGLE_SCRIPT_URL}?action=kode_barang`
        const resMaster = await fetch(MASTER_URL, { method: "GET" })
        const resultMaster = await resMaster.json()

        if (result.status && result.status !== 200) {
            toast(result.message || "Gagal memuat data", { type: "error" })
            return
        }

        dataInventaris.value = (result.datas || []).map((v: any, i: number) => ({ ...v, _tempId: i }))
        
        if (resultMaster.status === 200 && resultMaster.datas) {
            dataMasterBarang.value = resultMaster.datas.filter((item: any) => {
                const nama = item["Nama Barang"] || item["nama_barang"] || item["namaBarang"]
                return nama && String(nama).trim() !== ""
            })
        }
    } catch (error) {
        console.error("Error fetching data:", error)
        toast("Terjadi kesalahan koneksi", { type: "error" })
    } finally {
        isLoading.value = false
    }
}

const submitForm = async () => {
    if (!formData.value.nama_barang) return toast("Nama Barang wajib diisi!", { type: "warning" })

    isSubmitting.value = true
    try {
        let tglP = formData.value.tanggal_pembukuan
        if (tglP && tglP.includes('-')) tglP = `${tglP.split('-')[2]}/${tglP.split('-')[1]}/${tglP.split('-')[0]}`

        let tglS = formData.value.tgl_penyerahan
        if (tglS && tglS.includes('-')) tglS = `${tglS.split('-')[2]}/${tglS.split('-')[1]}/${tglS.split('-')[0]}`

        // Cari relasi Gol, Kel, Sub dari Master Data agar kolom tidak bergeser dan baris akurat
        const selectedNama = String(formData.value.nama_barang).toUpperCase().trim()
        let foundGol = "", foundKel = "", foundSub = ""

        const match = dataMasterBarang.value.find(m => {
            const mNama = String(m["Nama Barang"] || m["nama_barang"] || m["namaBarang"] || "").toUpperCase().trim()
            return mNama === selectedNama
        })

        if (match) {
            foundGol = String(match.Gol || match.Golongan || "").trim().charAt(0).toUpperCase()
            foundKel = String(match.Kel || match.Kelompok || "").trim().padStart(2, '0')
            foundSub = String(match["Sub-kel"] || match.sub_kel || match.jb_k || "").trim().padStart(2, '0')
        }

        const payload = {
            action: "tambah_inventaris",
            lembaga: selectedLembaga.value,
            tanggal_pembukuan: tglP,
            gol: foundGol,
            kel: foundKel,
            jb_k: foundSub,
            nama_barang: formData.value.nama_barang,
            ket_merk_ukuran: formData.value.ket_merk_ukuran,
            kuantitas: formData.value.kuantitas,
            nama_satuan: formData.value.nama_satuan,
            tahun_pembuatan: formData.value.tahun_pembuatan,
            asal_barang: formData.value.asal_barang,
            tgl_penyerahan: tglS,
            kondisi_barang: formData.value.kondisi_barang,
            harga: formData.value.harga,
            ruang: formData.value.ruang,
            status: formData.value.status || 'Aktif',
            tempat: formData.value.tempat,
            pembelian: formData.value.pembelian
        }

        const res = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(payload)
        })
        const result = await res.json()

        if (result.status === 200) {
            toast(`Sukses! Diinput sebagai nomor urut: ${result.data_baru?.no_urut_barang || 'terakhir'}`, { type: "success" })
            formData.value = {
                tanggal_pembukuan: getTodayDate(), nama_barang: '', ket_merk_ukuran: '', kuantitas: '1', nama_satuan: 'buah',
                tahun_pembuatan: '', asal_barang: 'YBW II', tgl_penyerahan: '', kondisi_barang: 'baru', harga: '', 
                ruang: '', status: 'Aktif', tempat: '', pembelian: ''
            }
            showModal.value = false 
            fetchBukuIndukData() 
        } else {
            toast(result.message || "Gagal menyimpan data", { type: "error" })
        }
    } catch (error) {
        toast("Terjadi kesalahan koneksi saat mengirim data", { type: "error" })
    } finally {
        isSubmitting.value = false
    }
}

const startEdit = (item: any) => {
    editingItem.value = item._tempId
    editForm.value = { 
        ...item,
        nama_barang_lama: item.nama_barang || item.namaBarang, 
        no_urut_barang: item.no_urut_barang || item.noUrutBarang || item.jb_k
    }
}

const cancelEdit = () => {
    editingItem.value = null
    editForm.value = {}
}

const saveEdit = async () => {
    isSavingEdit.value = true
    try {
        const payload = {
            action: "edit_inventaris",
            lembaga: selectedLembaga.value,
            no_urut_barang: editForm.value.no_urut_barang,
            nama_barang_lama: editForm.value.nama_barang_lama, 
            tanggal_pembukuan: editForm.value.tgl_pembukuan || editForm.value.tanggal_pembukuan,
            nama_barang: editForm.value.nama_barang,
            ket_merk_ukuran: editForm.value.ket_merk || editForm.value.ket_merk_ukuran,
            kuantitas: editForm.value.kuantitas,
            nama_satuan: editForm.value.satuan || editForm.value.nama_satuan,
            tahun_pembuatan: editForm.value.tahun || editForm.value.tahun_pembuatan,
            asal_barang: editForm.value.asal || editForm.value.asal_barang,
            tgl_penyerahan: editForm.value.tgl_penyerahan,
            kondisi_barang: editForm.value.kondisi || editForm.value.kondisi_barang,
            harga: editForm.value.harga,
            ruang: editForm.value.ruang,
            status: editForm.value.status,
            tempat: editForm.value.tempat,
            pembelian: editForm.value.pembelian
        }

        const res = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(payload)
        })
        const result = await res.json()

        if (result.status === 200) {
            toast("Data berhasil diperbarui!", { type: "success" })
            cancelEdit()
            fetchBukuIndukData()
        } else {
            toast(result.message || "Gagal mengupdate data", { type: "error" })
        }
    } catch (error) {
        toast("Terjadi kesalahan koneksi", { type: "error" })
    } finally {
        isSavingEdit.value = false
    }
}

const deleteItem = async (item: any) => {
    const namaTarget = item.nama_barang || item.namaBarang
    if (!confirm(`Apakah Anda yakin ingin menghapus data "${namaTarget}" secara permanen?`)) return

    try {
        const payload = {
            action: "delete_inventaris",
            lembaga: selectedLembaga.value,
            no_urut_barang: item.no_urut_barang || item.noUrutBarang || item.jb_k,
            nama_barang: namaTarget
        }

        const res = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(payload)
        })
        const result = await res.json()

        if (result.status === 200) {
            toast("Data berhasil dihapus!", { type: "success" })
            fetchBukuIndukData()
        } else {
            toast(result.message || "Gagal menghapus data", { type: "error" })
        }
    } catch (error) {
        toast("Terjadi kesalahan koneksi", { type: "error" })
    }
}

watch([fetchSource, selectedLembaga], () => {
    selectedNamaBarang.value = 'all'
    currentPage.value = 1
    fetchBukuIndukData()
})

const validInventaris = computed(() => {
    return dataInventaris.value.filter(item => {
        const namaBarang = String(item.namaBarang || item.nama_barang || '').trim()
        const upperNama = namaBarang.toUpperCase()
        
        if (upperNama.includes('BUKU INDUK') || upperNama.includes('JAKARTA') || upperNama === 'NAMA BARANG / BENDA') return false
        if (upperNama.includes('TANAH DAN BANGUNAN') || upperNama === 'TANAH' || upperNama === 'BANGUNAN') return false
        if (namaBarang === "" || namaBarang === "-") return false
        
        const noUrutBrg = String(item.noUrutBarang || item.no_urut_barang || item.no_urut || item.noUrut || item.jb_k || '').trim()
        if (noUrutBrg === '' || noUrutBrg === '-' || noUrutBrg === '0000' || noUrutBrg === '000' || noUrutBrg === '00' || noUrutBrg === '0') return false
        
        return true
    }).map(item => {
        const rawGol = String(item.gol || item.golongan || '').trim().charAt(0).toUpperCase()
        const rawKel = String(item.kel || item.kelompok || '').trim().padStart(2, '0')
        const rawSub = String(item.jb_k || item.kode_kelompok || item.sub_kel || '').trim().padStart(2, '0')

        return {
            ...item,
            tgl_pembukuan: item.tanggal_pembukuan || item['Tanggal Pembukuan'] || '-',
            golongan: rawGol || '-',
            kelompok: rawKel !== '00' ? rawKel : '-',
            kode_kelompok: rawSub !== '00' ? rawSub : '-',
            sort_key: `${rawGol} ${rawKel} ${rawSub}`,
            no_urut_barang: item.noUrutBarang || item.no_urut_barang || item.jb_k || '-',
            nama_barang: item.namaBarang || item.nama_barang || '-',
            ket_merk: item.ket_merk_ukuran || item['Ket Merk, Nomor , Ukuran'] || '-',
            kuantitas: item.kuantitas || item.Kuantitas || '-',
            satuan: item.nama_satuan || item['Nama Satuan'] || '-',
            tahun: item.tahun_pembuatan || item['Tahun Pembuatan'] || '-',
            asal: item.asal_barang || item['Asal Barang'] || '-',
            tgl_penyerahan: item.tgl_penyerahan || item['Tgl Penyerahan/ Perolehan'] || '-',
            kondisi: item.kondisi_barang || item['Kondisi Barang'] || '-',
            harga: item.harga || item.Harga || '-',
            ruang: item.ruang || item.Ruang || '-',
            status: item.status || item.Status || 'Aktif',
            tempat: item.tempat || item.Tempat || '-',
            pembelian: item.pembelian || item.Pembelian || '-'
        }
    })
})

const uniqueNamaBarangList = computed(() => {
    if (dataMasterBarang.value.length === 0) {
        let listPerwakilan = dataInventaris.value.filter(item => {
            const noUrutBrg = String(item.noUrutBarang || item.no_urut_barang || item.no_urut || item.noUrut || item.jb_k || '').trim()
            return noUrutBrg === '0000' || noUrutBrg === '000' || noUrutBrg === '00' || noUrutBrg === '0'
        })
        if (listPerwakilan.length === 0) listPerwakilan = validInventaris.value
        
        const names = listPerwakilan.map(item => String(item.nama_barang || item.namaBarang).trim())
        return [...new Set(names)].filter(name => {
            const upper = name.toUpperCase()
            if (name === "" || name === "-") return false
            if (upper.includes('BUKU INDUK') || upper.includes('JAKARTA') || upper.includes('NAMA BARANG')) return false
            if (upper.includes('TANAH DAN BANGUNAN') || upper === 'TANAH' || upper === 'BANGUNAN') return false
            return true
        }).sort((a, b) => a.localeCompare(b))
    }

    const names = dataMasterBarang.value.map(item => {
        const nama = item["Nama Barang"] || item["nama_barang"] || item["namaBarang"] || ""
        return String(nama).trim().toUpperCase()
    })
    
    return [...new Set(names)].filter(name => name !== "").sort((a, b) => a.localeCompare(b))
})

const totalInventaris = computed(() => validInventaris.value.length)
const totalMasihAda = computed(() => validInventaris.value.filter(item => ['','-','aktif','ada'].includes(String(item.status).toLowerCase().trim())).length)
const totalMutasi = computed(() => validInventaris.value.filter(item => String(item.status).toLowerCase().includes('mutasi')).length)
const totalHibah = computed(() => validInventaris.value.filter(item => String(item.status).toLowerCase().includes('hibah')).length)
const totalLelangMusnah = computed(() => validInventaris.value.filter(item => {
    const s = String(item.status).toLowerCase()
    return s.includes('lelang') || s.includes('musnah')
}).length)
const totalUpgrade = computed(() => validInventaris.value.filter(item => {
    const s = String(item.status).toLowerCase()
    return s.includes('upgrade')
}).length)

const filteredInventaris = computed(() => {
    let result = validInventaris.value
    
    if (selectedFilter.value === 'masih_ada') {
        result = result.filter(item => ['','-','aktif','ada'].includes(String(item.status).toLowerCase().trim()))
    } else if (selectedFilter.value === 'mutasi') {
        result = result.filter(item => String(item.status).toLowerCase().includes('mutasi'))
    } else if (selectedFilter.value === 'hibah') {
        result = result.filter(item => String(item.status).toLowerCase().includes('hibah'))
    } else if (selectedFilter.value === 'lelang_musnah') {
        result = result.filter(item => {
            const s = String(item.status).toLowerCase()
            return s.includes('lelang') || s.includes('musnah')
        })
    } else if (selectedFilter.value === 'upgrade') {
        result = result.filter(item => {
            const s = String(item.status).toLowerCase()
            return s.includes('upgrade')
        })
    }

    if (selectedNamaBarang.value !== 'all') {
        const selectedStr = String(selectedNamaBarang.value).toUpperCase().trim()
        
        const masterRef = dataMasterBarang.value.find(m => {
            const n = String(m["Nama Barang"] || m["nama_barang"] || m["namaBarang"] || "").toUpperCase().trim()
            return n === selectedStr
        })

        let masterGol = "", masterKel = "", masterSub = ""
        if (masterRef) {
            masterGol = String(masterRef.Gol || masterRef.Golongan || "").trim().charAt(0).toUpperCase()
            masterKel = String(masterRef.Kel || masterRef.Kelompok || "").trim().padStart(2, '0')
            masterSub = String(masterRef["Sub-kel"] || masterRef.sub_kel || masterRef.jb_k || "").trim().padStart(2, '0')
        }

        result = result.filter(item => {
            const iGol = item.golongan
            const iKel = item.kelompok
            const iSub = item.kode_kelompok
            const cleanItemName = String(item.nama_barang || '').toUpperCase().trim()

            if (cleanItemName === selectedStr) return true

            const isMasterCodeValid = masterGol !== "" && masterKel !== "00" && masterSub !== "00"
            const isItemCodeValid = iGol !== "-" && iKel !== "-" && iSub !== "-"

            if (isMasterCodeValid && isItemCodeValid) {
                if (iGol === masterGol && iKel === masterKel && iSub === masterSub) {
                    return true
                }
            }

            if (iGol !== "-" && masterGol !== "" && iGol !== masterGol) {
                return false
            }

            const getAlphanumeric = (str: string) => str.replace(/[^A-Z0-9]/g, '')
            const selectedAlpha = getAlphanumeric(selectedStr)
            const itemAlpha = getAlphanumeric(cleanItemName)

            if (itemAlpha !== "" && selectedAlpha !== "") {
                if (itemAlpha === selectedAlpha) return true

                const lenDiff = Math.abs(itemAlpha.length - selectedAlpha.length)
                if (lenDiff <= 2) {
                    const itemSkeleton = itemAlpha.replace(/[AEIOU]/g, '')
                    const selectedSkeleton = selectedAlpha.replace(/[AEIOU]/g, '')
                    
                    if (itemSkeleton === selectedSkeleton) return true
                    if (itemSkeleton.includes(selectedSkeleton) || selectedSkeleton.includes(itemSkeleton)) {
                        return true
                    }
                }
            }

            return false
        })
    }
    
    return result.sort((a, b) => String(a.sort_key || '').localeCompare(String(b.sort_key || '')))
})

const totalPages = computed(() => Math.ceil(filteredInventaris.value.length / itemsPerPage.value))
const paginatedInventaris = computed(() => filteredInventaris.value.slice((currentPage.value - 1) * itemsPerPage.value, currentPage.value * itemsPerPage.value))

watch([selectedFilter, selectedNamaBarang], () => { currentPage.value = 1 })
onMounted(() => { fetchBukuIndukData() })
</script>

<template>
    <div class="app-layout">
        <Navbar />

        <main class="dashboard-container">
            <div class="header-container">
                <h1 class="page-title">Buku Induk Inventaris</h1>
                <button @click="showModal = true" class="btn-submit">+ Tambah Data</button>
            </div>

            <!-- MODAL FORM -->
            <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
                <div class="modal-content modal-large form-section">
                    <div class="form-header">
                        <h3>Tambah Data Cepat ({{ selectedLembaga }})</h3>
                        <button @click="showModal = false" class="btn-close" title="Tutup">✕</button>
                    </div>
                    
                    <form @submit.prevent="submitForm" class="data-form form-scrollable">
                        <div class="form-grid-2-cols">
                            
                            <!-- Kolom Kiri -->
                            <div class="input-col">
                                <div class="form-group">
                                    <label>Nama Barang *</label>
                                    <input type="text" v-model="formData.nama_barang" list="listBarang" placeholder="Pilih / ketik nama barang..." required class="input-box" />
                                    <datalist id="listBarang">
                                        <option v-for="(nama, idx) in uniqueNamaBarangList" :key="idx" :value="nama"></option>
                                    </datalist>
                                </div>

                                <div class="form-group">
                                    <label>Ket / Merk / Nomor / Ukuran</label>
                                    <input type="text" v-model="formData.ket_merk_ukuran" placeholder="dual core ( ASUS H110)  Upgrade 2020" class="input-box" />
                                </div>

                                <div class="form-group-inline">
                                    <div class="form-group half">
                                        <label>Kuantitas</label>
                                        <input type="number" v-model="formData.kuantitas" class="input-box" />
                                    </div>
                                    <div class="form-group half">
                                        <label>Satuan</label>
                                        <input type="text" v-model="formData.nama_satuan" placeholder="buah/unit" class="input-box" />
                                    </div>
                                </div>

                                <div class="form-group">
                                    <label>Tahun Pembuatan</label>
                                    <input type="text" v-model="formData.tahun_pembuatan" placeholder="Contoh: 2023" class="input-box" />
                                </div>

                                <div class="form-group">
                                    <label>Harga (Rp)</label>
                                    <input type="text" v-model="formData.harga" placeholder="Contoh: Rp 150.000" class="input-box" />
                                </div>
                            </div>

                            <!-- Kolom Kanan -->
                            <div class="input-col">
                                <div class="form-group">
                                    <label>Asal Barang</label>
                                    <select v-model="formData.asal_barang" class="input-box">
                                        <option value="YBW II">YBW II</option>
                                        <option value="BOS SMA">BOS SMA</option>
                                        <option value="BOS SMK">BOS SMK</option>
                                    </select>
                                </div>

                                <div class="form-group">
                                    <label>Tgl Penyerahan / Perolehan</label>
                                    <input type="date" v-model="formData.tgl_penyerahan" class="input-box" />
                                </div>

                                <div class="form-group">
                                    <label>Kondisi Barang</label>
                                    <select v-model="formData.kondisi_barang" class="input-box">
                                        <option value="baru">Baru</option>
                                        <option value="baik">Baik</option>
                                        <option value="rusak ringan">Rusak Ringan</option>
                                        <option value="rusak berat">Rusak Berat</option>
                                    </select>
                                </div>

                                <div class="form-group">
                                    <label>Ruang</label>
                                    <input type="text" v-model="formData.ruang" placeholder="Contoh: Ruang Guru" class="input-box" />
                                </div>

                                <div class="form-group">
                                    <label>Tempat (Opsional)</label>
                                    <input type="text" v-model="formData.tempat" placeholder="Lokasi spesifik..." class="input-box" />
                                </div>

                                <div class="form-group">
                                    <label>Sumber Pembelian (Opsional)</label>
                                    <input type="text" v-model="formData.pembelian" placeholder="Contoh: Belanja Langsung" class="input-box" />
                                </div>
                            </div>
                        </div> 

                        <div class="form-actions mt-4">
                            <button type="submit" class="btn-submit" :disabled="isSubmitting" style="width: 100%; padding: 14px; font-size: 16px;">
                                <span v-if="isSubmitting">Memvalidasi & Menyimpan Data...</span>
                                <span v-else>+ Simpan Data Inventaris</span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <div v-if="isLoading" class="loading-state">Memuat data {{ selectedLembaga }}...</div>

            <div v-else>
                <!-- STATISTIK -->
                <div class="stats-grid">
                    <div class="stat-card blue" :class="{ active: selectedFilter === 'all' }" @click="selectedFilter = 'all'">
                        <div class="card-info"><span class="card-title">TOTAL INVENTARIS</span><h2 class="card-value">{{ totalInventaris }}</h2></div>
                    </div>
                    <div class="stat-card teal" :class="{ active: selectedFilter === 'masih_ada' }" @click="selectedFilter = 'masih_ada'">
                        <div class="card-info"><span class="card-title">MASIH ADA / AKTIF</span><h2 class="card-value">{{ totalMasihAda }}</h2></div>
                    </div>
                    <div class="stat-card purple" :class="{ active: selectedFilter === 'mutasi' }" @click="selectedFilter = 'mutasi'">
                        <div class="card-info"><span class="card-title">DIMUTASI</span><h2 class="card-value">{{ totalMutasi }}</h2></div>
                    </div>
                    <div class="stat-card green" :class="{ active: selectedFilter === 'hibah' }" @click="selectedFilter = 'hibah'">
                        <div class="card-info"><span class="card-title">DIHIBAHKAN</span><h2 class="card-value">{{ totalHibah }}</h2></div>
                    </div>
                    <div class="stat-card orange" :class="{ active: selectedFilter === 'lelang_musnah' }" @click="selectedFilter = 'lelang_musnah'">
                        <div class="card-info"><span class="card-title">LELANG / MUSNAHKAN</span><h2 class="card-value">{{ totalLelangMusnah }}</h2></div>
                    </div>
                    <div class="stat-card cyan" :class="{ active: selectedFilter === 'upgrade' }" @click="selectedFilter = 'upgrade'">
                        <div class="card-info"><span class="card-title">DI-UPGRADE</span><h2 class="card-value">{{ totalUpgrade }}</h2></div>
                    </div>
                </div>

                <div class="table-section">
                    <div class="table-controls" style="flex-direction: row; flex-wrap: wrap; align-items: center; justify-content: space-between;">
                        <div style="display: flex; gap: 15px; flex-wrap: wrap;">
                            <div class="filter-group">
                                <label for="pilihLembaga" style="color: #0f172a;">Lembaga:</label>
                                <select id="pilihLembaga" v-model="selectedLembaga" class="select-box" style="min-width: 120px; font-weight: 600;">
                                    <option value="SMA">SMA</option><option value="SMK">SMK</option><option value="YAYASAN">YAYASAN</option>
                                </select>
                            </div>
                            <div class="filter-group">
                                <label for="filterStatus">Status:</label>
                                <select id="filterStatus" v-model="selectedFilter" class="select-box" style="min-width: 150px;">
                                    <option value="all">Semua Status</option>
                                    <option value="masih_ada">Aktif / Masih Ada</option>
                                    <option value="mutasi">Dimutasi</option>
                                    <option value="hibah">Dihibahkan</option>
                                    <option value="upgrade">Di-Upgrade</option>
                                    <option value="lelang_musnah">Lelang/Musnahkan</option>
                                </select>
                            </div>
                            <div class="filter-group">
                                <label for="filterBarang">Pilih Barang:</label>
                                <select id="filterBarang" v-model="selectedNamaBarang" class="select-box">
                                    <option value="all">Semua Barang</option>
                                    <option v-for="(nama, idx) in uniqueNamaBarangList" :key="idx" :value="nama">{{ nama }}</option>
                                </select>
                            </div>
                        </div>
                        <div class="table-info" style="margin-top: 15px; width: 100%;">
                            <h3>Daftar Inventaris <span class="text-capitalize">{{ selectedLembaga }}</span></h3>
                            <span class="badge-count">Menampilkan {{ filteredInventaris.length }} data</span>
                        </div>
                    </div>

                    <div class="table-wrapper">
                        <table class="data-table wide-table">
                            <thead>
                                <tr>
                                    <th>No</th>
                                    <th>Tgl Pembukuan</th>
                                    <th>Gol</th>
                                    <th>Kel</th>
                                    <th>JB-K</th>
                                    <th>No Urut Brg</th>
                                    <th>Nama Barang</th>
                                    <th>Ket Merk/Ukuran</th>
                                    <th>Qty</th>
                                    <th>Satuan</th>
                                    <th>Tahun</th>
                                    <th>Asal</th>
                                    <th>Tgl Perolehan</th>
                                    <th>Kondisi</th>
                                    <th>Harga</th>
                                    <th>Ruang</th>
                                    <th>Status</th>
                                    <th>Tempat</th>
                                    <th>Pembelian</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-if="filteredInventaris.length === 0"><td colspan="20" class="text-center">Tidak ada data.</td></tr>
                                
                                <tr v-for="(item, index) in paginatedInventaris" :key="item._tempId">
                                    <!-- Jika Baris Sedang Di-Edit (INLINE EDIT FORM) -->
                                    <template v-if="editingItem === item._tempId">
                                        <td>{{ item.noUrut || item.no_urut || ((currentPage - 1) * itemsPerPage + index + 1) }}</td>
                                        <td><input type="text" v-model="editForm.tgl_pembukuan" class="edit-input" /></td>
                                        <td class="readonly-text">{{ item.golongan }}</td>
                                        <td class="readonly-text">{{ item.kelompok }}</td>
                                        <td class="readonly-text">{{ item.kode_kelompok }}</td>
                                        <td class="readonly-text"><strong>{{ item.no_urut_barang }}</strong></td>
                                        
                                        <!-- Nama Barang dilock karena ini kunci pencarian/update di Apps Script -->
                                        <td class="sticky-col readonly-text">{{ editForm.nama_barang }}</td> 
                                        
                                        <td><input type="text" v-model="editForm.ket_merk" class="edit-input" /></td>
                                        <td><input type="number" v-model="editForm.kuantitas" class="edit-input small-input" /></td>
                                        <td><input type="text" v-model="editForm.satuan" class="edit-input small-input" /></td>
                                        <td><input type="text" v-model="editForm.tahun" class="edit-input small-input" /></td>
                                        <td><input type="text" v-model="editForm.asal" class="edit-input" /></td>
                                        <td><input type="text" v-model="editForm.tgl_penyerahan" class="edit-input" /></td>
                                        <td>
                                            <select v-model="editForm.kondisi" class="edit-input">
                                                <option value="baru">Baru</option><option value="baik">Baik</option>
                                                <option value="rusak ringan">Rusak Ringan</option><option value="rusak berat">Rusak Berat</option>
                                            </select>
                                        </td>
                                        <td><input type="text" v-model="editForm.harga" class="edit-input" /></td>
                                        <td><input type="text" v-model="editForm.ruang" class="edit-input" /></td>
                                        <td>
                                            <select v-model="editForm.status" class="edit-input">
                                                <option value="Aktif">Aktif</option>
                                                <option value="Dimutasi">Dimutasi</option>
                                                <option value="Dihibahkan">Dihibahkan</option>
                                                <option value="Lelang/Musnahkan">Lelang/Musnahkan</option>
                                                <option value="TerUpgrade">Upgrade</option>
                                            </select>
                                        </td>
                                        <td><input type="text" v-model="editForm.tempat" class="edit-input" /></td>
                                        <td><input type="text" v-model="editForm.pembelian" class="edit-input" /></td>
                                        <td class="action-cell">
                                            <button @click="saveEdit" :disabled="isSavingEdit" class="btn-icon save-btn" title="Simpan">✓</button>
                                            <button @click="cancelEdit" :disabled="isSavingEdit" class="btn-icon cancel-btn" title="Batal">✕</button>
                                        </td>
                                    </template>

                                    <!-- Jika Tampilan Normal -->
                                    <template v-else>
                                        <td>{{ item.noUrut || item.no_urut || ((currentPage - 1) * itemsPerPage + index + 1) }}</td>
                                        <td>{{ item.tgl_pembukuan }}</td>
                                        <td>{{ item.golongan }}</td>
                                        <td>{{ item.kelompok }}</td>
                                        <td>{{ item.kode_kelompok }}</td>
                                        <td><strong>{{ item.no_urut_barang }}</strong></td>
                                        <td class="sticky-col">{{ item.nama_barang }}</td>
                                        <td>{{ item.ket_merk }}</td>
                                        <td>{{ item.kuantitas }}</td>
                                        <td>{{ item.satuan }}</td>
                                        <td>{{ item.tahun }}</td>
                                        <td>{{ item.asal }}</td>
                                        <td>{{ item.tgl_penyerahan }}</td>
                                        <td>{{ item.kondisi }}</td>
                                        <td>{{ item.harga }}</td>
                                        <td>{{ item.ruang }}</td>
                                        <td><span class="status-badge" :class="item.status ? String(item.status).toLowerCase().replace(/[^a-z]/g, '') : 'aktif'">{{ item.status || 'Aktif' }}</span></td>
                                        <td>{{ item.tempat }}</td>
                                        <td>{{ item.pembelian }}</td>
                                        <td class="action-cell">
                                            <button @click="startEdit(item)" class="btn-icon edit-btn" title="Edit">✎</button>
                                            <button @click="deleteItem(item)" class="btn-icon delete-btn" title="Hapus">🗑</button>
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
.header-container { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
.header-container .page-title { font-size: 26px; font-weight: 800; color: #0f172a; margin: 0; }
.loading-state { color: #64748b; font-size: 14px; padding: 20px 0; text-align: center; }

.modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(15, 23, 42, 0.6); display: flex; justify-content: center; align-items: center; z-index: 1000; padding: 20px; backdrop-filter: blur(4px); }
.modal-content { background: #ffffff; width: 100%; max-width: 900px; border-radius: 12px; padding: 24px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1); animation: modalIn 0.3s ease-out; border-top: 4px solid #3b82f6; }
.modal-large { max-width: 800px; max-height: 90vh; display: flex; flex-direction: column; }
@keyframes modalIn { from { opacity: 0; transform: translateY(-30px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
.btn-close { background: none; border: none; font-size: 20px; font-weight: bold; color: #94a3b8; cursor: pointer; transition: color 0.2s; padding: 0 8px; }
.btn-close:hover { color: #ef4444; }

.form-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px; }
.form-header h3 { font-size: 18px; font-weight: 700; color: #1e293b; margin: 0; }
.form-scrollable { overflow-y: auto; padding-right: 10px; } 
.form-grid-2-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; } 
@media (max-width: 768px) { .form-grid-2-cols { grid-template-columns: 1fr; } } 
.input-col { display: flex; flex-direction: column; gap: 16px; }
.form-group { display: flex; flex-direction: column; gap: 6px; }
.form-group-inline { display: flex; gap: 15px; }
.half { width: 50%; }
.form-group label { font-size: 13px; font-weight: 600; color: #475569; }
.input-box { padding: 10px 14px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; color: #334155; outline: none; }
.input-box:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15); }
.mt-4 { margin-top: 1.5rem; }
.btn-submit { background-color: #3b82f6; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: background-color 0.2s; }
.btn-submit:hover:not(:disabled) { background-color: #2563eb; }
.btn-submit:disabled { background-color: #94a3b8; cursor: not-allowed; }

.stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 30px; }
.stat-card { background-color: #ffffff; border-radius: 12px; padding: 18px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); border-left: 5px solid #cbd5e1; cursor: pointer; transition: all 0.2s ease; }
.stat-card:hover { transform: translateY(-2px); }
.stat-card.active { box-shadow: 0 0 0 2px #3b82f6, 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
.stat-card.blue { border-left-color: #3b82f6; }
.stat-card.teal { border-left-color: #14b8a6; }
.stat-card.purple { border-left-color: #8b5cf6; }
.stat-card.green { border-left-color: #10b981; }
.stat-card.orange { border-left-color: #f59e0b; }
.stat-card.cyan { border-left-color: #06b6d4; }
.card-title { font-size: 10px; font-weight: 700; color: #64748b; }
.card-value { font-size: 24px; font-weight: 700; color: #0f172a; margin-top: 8px; }

.table-section { background-color: #ffffff; border-radius: 12px; padding: 24px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
.table-controls { display: flex; flex-direction: column; gap: 16px; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid #e2e8f0; }
.table-info { display: flex; justify-content: space-between; align-items: center; }
.table-info h3 { font-size: 16px; font-weight: 600; color: #1e293b; margin: 0; }
.filter-group { display: flex; align-items: center; gap: 10px; }
.filter-group label { font-size: 13px; font-weight: 600; color: #475569; }
.select-box { padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 6px; background-color: #fff; color: #334155; font-size: 13px; outline: none; cursor: pointer; }
.badge-count { font-size: 12px; background-color: #e2e8f0; color: #475569; padding: 4px 10px; border-radius: 20px; font-weight: 600; }

.table-wrapper { overflow-x: auto; max-width: 100%; border: 1px solid #e2e8f0; border-radius: 8px; }
.data-table { width: max-content; min-width: 100%; border-collapse: collapse; text-align: left; font-size: 12px; }
.data-table th, .data-table td { padding: 12px 14px; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; white-space: nowrap; }
.data-table th { background-color: #f8fafc; color: #475569; font-weight: 700; position: sticky; top: 0; z-index: 10; }
.data-table td { color: #334155; vertical-align: middle; }
.data-table tr:hover { background-color: #f1f5f9; }

.sticky-col { position: sticky; left: 0; background-color: #fff; z-index: 5; box-shadow: 2px 0 5px rgba(0,0,0,0.05); font-weight: 600; }
.data-table th.sticky-col { background-color: #f8fafc; z-index: 15; }

.text-center { text-align: center; color: #94a3b8; padding: 24px !important; }
.text-capitalize { text-transform: capitalize; }

.status-badge { background-color: #f1f5f9; color: #475569; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
.status-badge.aktif { background-color: #dcfce7; color: #166534; }
.status-badge.dimutasi { background-color: #f3e8ff; color: #6b21a8; }
.status-badge.dihibahkan { background-color: #dbeafe; color: #1e40af; }
.status-badge.lelangmusnahkan { background-color: #fee2e2; color: #991b1b; }
.status-badge.terupgrade { background-color: #e0f2fe; color: #0369a1; }

.pagination-container { display: flex; justify-content: space-between; align-items: center; margin-top: 20px; padding-top: 15px; }
.btn-page { background-color: #ffffff; border: 1px solid #cbd5e1; color: #334155; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
.btn-page:hover:not(:disabled) { background-color: #f8fafc; border-color: #94a3b8; }
.btn-page:disabled { background-color: #f8fafc; color: #94a3b8; cursor: not-allowed; border-color: #e2e8f0; }
.page-info { font-size: 13px; color: #475569; }

/* INLINE EDIT STYLES */
.edit-input { width: 100%; min-width: 100px; padding: 6px 8px; border: 1px solid #3b82f6; border-radius: 4px; font-size: 12px; outline: none; background-color: #eff6ff; }
.edit-input:focus { box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2); }
.small-input { min-width: 50px; }
.readonly-text { color: #94a3b8 !important; background-color: #f8fafc !important; }

.action-cell { display: flex; gap: 8px; justify-content: center; }
.btn-icon { background: none; border: none; font-size: 14px; cursor: pointer; padding: 4px 8px; border-radius: 4px; transition: 0.2s; display: flex; align-items: center; justify-content: center;}
.edit-btn { color: #3b82f6; background-color: #eff6ff; }
.edit-btn:hover { background-color: #3b82f6; color: white; }
.delete-btn { color: #ef4444; background-color: #fef2f2; }
.delete-btn:hover { background-color: #ef4444; color: white; }
.save-btn { color: #10b981; background-color: #ecfdf5; font-weight: bold; }
.save-btn:hover { background-color: #10b981; color: white; }
.cancel-btn { color: #64748b; background-color: #f1f5f9; font-weight: bold;}
.cancel-btn:hover { background-color: #64748b; color: white; }
</style>