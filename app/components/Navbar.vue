<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const tipeLembaga = ref('SMK')

// State untuk mengontrol buka/tutup accordion menu Buku Induk
const isBukuIndukOpen = ref(false)

onMounted(() => {
    // Ambil data tipe lembaga dari cookie jika diperlukan untuk logika lain
    const cookieTipeLembaga = useCookie("tipe_lembaga").value
    if (cookieTipeLembaga) {
        tipeLembaga.value = cookieTipeLembaga
    }

    // Buka menu Buku Induk otomatis jika URL saat ini cocok dengan salah satu sub-menunya
    const bukuIndukRoutes = ['/', '/mutasi', '/dihibahkan', '/lelang_musnahkan']
    if (bukuIndukRoutes.includes(route.path)) {
        isBukuIndukOpen.value = true
    }
})
</script>

<template>
    <aside class="sidebar-light">
        <!-- BRANDING / LOGO -->
        <div class="brand-section">
            <h2 class="app-title">Buku Induk Barang</h2>
        </div>

        <!-- NAVIGATION MENU -->
        <nav class="nav-menu">
            
            <!-- GROUP: BUKU INDUK (Memiliki Sub-Menu) -->
            <div class="nav-group">
                <!-- Tombol Induk -->
                <button 
                    class="nav-link parent-btn" 
                    :class="{ 'active-parent': isBukuIndukOpen }" 
                    @click="isBukuIndukOpen = !isBukuIndukOpen"
                >
                    <div class="nav-left">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="nav-icon">
                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                            <polyline points="9 22 9 12 15 12 15 22"></polyline>
                        </svg>
                        Buku Induk
                    </div>
                    <!-- Icon Panah (Chevron) -->
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="chevron-icon" :class="{ 'rotate': isBukuIndukOpen }">
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                </button>

                <!-- Daftar Sub-Menu -->
                <div v-show="isBukuIndukOpen" class="sub-menu">
                    <!-- 1. Daftar Inventaris (Menu Utama /) -->
                    <NuxtLink to="/" class="sub-link" exact-active-class="active-sub-link">
                        <span class="sub-dot"></span>
                        Daftar Inventaris
                    </NuxtLink>

                    <!-- <NuxtLink to="/total_aset" class="sub-link" active-class="active-sub-link">
                        <span class="sub-dot"></span>
                        Total Aset
                    </NuxtLink> -->

                    <NuxtLink to="/rekapitulasi" class="sub-link" active-class="active-sub-link">
                        <span class="sub-dot"></span>
                        Rekapitulasi
                    </NuxtLink>

                    <NuxtLink to="/Master_Barang" class="sub-link" active-class="active-sub-link">
                        <span class="sub-dot"></span>
                        Kode Barang
                    </NuxtLink>

                    <!-- <NuxtLink to="/update_data_barang" class="sub-link" active-class="active-sub-link">
                        <span class="sub-dot"></span>
                        Update Data Barang
                    </NuxtLink> -->

                    <!-- 4. Barang Keluar / Lelang
                    <NuxtLink to="/lelang_musnahkan" class="sub-link" active-class="active-sub-link">
                        <span class="sub-dot"></span>
                        Lelang/Musnahkan
                    </NuxtLink> -->
                </div>
            </div>

            <!-- MENU BERDIRI SENDIRI: Peminjaman Barang -->
            <NuxtLink to="/peminjaman_barang" class="nav-link" active-class="active-link">
                <div class="nav-left">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="nav-icon">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                        <polyline points="10 9 9 9 8 9"></polyline>
                    </svg>
                    Peminjaman Barang
                </div>
            </NuxtLink>

        </nav>
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

.nav-group {
    display: flex;
    flex-direction: column;
}

/* STYLING LINK & TOMBOL NAVIGASI DEFAULT */
.nav-link {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    border-radius: 8px;
    text-decoration: none;
    color: #4b5563; 
    font-size: 14px;
    font-weight: 500;
    transition: all 0.2s ease-in-out;
}

.nav-left {
    display: flex;
    align-items: center;
    gap: 12px;
}

/* RESET BUTTON STYLES UNTUK MENU INDUK */
.parent-btn {
    width: 100%;
    background: transparent;
    border: none;
    cursor: pointer;
}

.nav-link:hover, .parent-btn:hover {
    background-color: #f3f4f6; 
}

/* STYLE KETIKA MENU UTAMA AKTIF (TEMA TERANG) */
.active-link {
    background-color: #eff6ff !important; 
    color: #2563eb !important; 
}

.active-link .nav-icon {
    color: #2563eb;
}

/* STYLE ICON CHEVRON PADA MENU INDUK */
.chevron-icon {
    transition: transform 0.3s ease;
    color: #9ca3af;
}

.chevron-icon.rotate {
    transform: rotate(180deg);
}

/* --- STYLING SUB-MENU --- */
.sub-menu {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding-left: 32px; /* Indentasi submenu masuk ke dalam */
    margin-top: 4px;
}

.sub-link {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    font-size: 13.5px;
    color: #6b7280;
    text-decoration: none;
    border-radius: 6px;
    transition: all 0.2s ease;
}

.sub-link:hover {
    color: #111827;
    background-color: #f9fafb;
}

/* Bulat Kecil / Dot untuk Sub Menu */
.sub-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background-color: #9ca3af;
    transition: all 0.2s ease;
}

/* Style Sub Menu Jika Sedang Aktif */
.active-sub-link {
    color: #2563eb;
    font-weight: 600;
    background-color: #eff6ff;
}

.active-sub-link .sub-dot {
    background-color: #2563eb;
    transform: scale(1.3);
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