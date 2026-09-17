<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { StoreDatas } from '~/store/state_management'

const tipeLembaga = ref('SMK')

onMounted(() => {
    // Ambil data tipe lembaga dari cookie jika diperlukan untuk logika lain
    const cookieTipeLembaga = useCookie("tipe_lembaga").value
    if (cookieTipeLembaga) {
        tipeLembaga.value = cookieTipeLembaga
    }
})

const onLogout = () => {
    // 1. Hapus semua cookie sesi
    useCookie("username").value = null
    useCookie("tipe_lembaga").value = null
    useCookie("id_sekolah").value = null

    // 2. Ambil instance WebSocket dari State Management
    const ws = StoreDatas().GetDatasWebsocket()

    // 3. Putuskan koneksi HANYA jika ws ada dan koneksinya sedang terbuka
    if (ws && ws.readyState === WebSocket.OPEN) {
        // Gunakan kode 1000 (Normal Closure) agar sistem tahu ini disengaja
        ws.close()
        console.log("Koneksi WebSocket berhasil ditutup secara normal")
    }

    // 4. Bersihkan data di State Management
    StoreDatas().DeleteDatasWebsocket()

    // 5. Arahkan kembali ke halaman awal (login)
    useRouter().push("/")
}
</script>

<template>
    <aside class="sidebar-light">
        <!-- BRANDING / LOGO -->
        <div class="brand-section">
            <h2 class="app-title">Peminjaman Barang</h2>
        </div>

        <!-- NAVIGATION MENU -->
        <nav class="nav-menu">
            <!-- 1. Dashboard -->
            <NuxtLink to="/dashboard" class="nav-link" active-class="active-link">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="nav-icon">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                    <polyline points="9 22 9 12 15 12 15 22"></polyline>
                </svg>
                Dashboard
            </NuxtLink>

            <!-- 2. Kode Barang -->
            <NuxtLink to="/kode_barang" class="nav-link" active-class="active-link">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="nav-icon">
                    <path d="M3 5v14"></path><path d="M8 5v14"></path><path d="M12 5v14"></path><path d="M17 5v14"></path><path d="M21 5v14"></path>
                </svg>
                Kode Barang
            </NuxtLink>

            <!-- 3. Barang Masuk -->
            <NuxtLink to="/barang_masuk" class="nav-link" active-class="active-link">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="nav-icon">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <polyline points="19 12 12 19 5 12"></polyline>
                </svg>
                Barang Masuk
            </NuxtLink>

            <!-- 4. Barang Keluar -->
            <NuxtLink to="/barang_keluar" class="nav-link" active-class="active-link">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="nav-icon">
                    <line x1="12" y1="19" x2="12" y2="5"></line>
                    <polyline points="5 12 12 5 19 12"></polyline>
                </svg>
                Barang Keluar
            </NuxtLink>

            <!-- 5. Peminjaman Barang -->
            <NuxtLink to="/peminjaman_barang" class="nav-link" active-class="active-link">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="nav-icon">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
                Peminjaman Barang
            </NuxtLink>
        </nav>

        <!-- BOTTOM / LOGOUT -->
        <div class="bottom-section">
            <button @click="onLogout" class="logout-btn">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="nav-icon">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                    <polyline points="16 17 21 12 16 7"></polyline>
                    <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
                Logout
            </button>
        </div>
    </aside>
</template>

<style scoped>
/* RESET DASAR */
* {
    box-sizing: border-box;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}

/* SIDEBAR LAYOUT (TEMA TERANG) */
.sidebar-light {
    width: 250px;
    background-color: #ffffff;
    border-right: 1px solid #e5e7eb;
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    padding: 24px 16px;
}

/* BRANDING SECTION */
.brand-section {
    margin-bottom: 24px;
    padding-left: 12px;
}

.app-title {
    margin: 0;
    font-size: 16px;
    font-weight: 700;
    color: #111827; 
}

/* NAVIGATION MENU */
.nav-menu {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 1; 
}

/* STYLING LINK NAVIGASI DEFAULT */
.nav-link {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border-radius: 8px;
    text-decoration: none;
    color: #4b5563; 
    font-size: 14px;
    font-weight: 500;
    transition: all 0.2s ease-in-out;
}

.nav-link:hover {
    background-color: #f3f4f6; 
}

/* STYLE KETIKA ROUTE AKTIF (TEMA TERANG) */
.active-link {
    background-color: #eff6ff !important; 
    color: #2563eb !important; 
}

.active-link .nav-icon {
    color: #2563eb;
}

/* LOGOUT SECTION */
.bottom-section {
    margin-top: auto; 
}

.logout-btn {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    background: transparent;
    border: none;
    padding: 10px 12px;
    border-radius: 8px;
    color: #ef4444; 
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.2s;
}

.logout-btn:hover {
    background-color: #fef2f2;
}
</style>