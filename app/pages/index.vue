<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { toast } from 'vue3-toastify'
import { StoreDatas } from '~/store/state_management'

const datas = ref({
    username: '',
    password: ""
})
const selectedTipeLembaga = ref()
const allTipeLembaga = ref<any[]>([])

const loadTipeLembaga = async () => {
    try {
        const res = await fetch("http://localhost:4000/api/tipe_lembaga/ambil", {
            method: "GET",
            headers: {
                "Content-Type": "application/json"
            }
        })

        const result = await res.json()

        if(result.status > 200){
            toast(result.message, {
                type: "error",
                theme: "auto",
                position: "top-center"
            })
            return
        }

        allTipeLembaga.value = result.datas
    } catch (error) {
        console.log(error)
    }
}

const onLogin = (e: Event) => {
    e.preventDefault()
    switch (selectedTipeLembaga.value.tipe_lembaga) {
        case "SMK":
            if(datas.value.username !== "AdminSMK" || datas.value.password !== "AdminSMK1"){
                toast("Gagal Login", {
                    type: "error",
                    theme: "auto",
                    position: "top-center"
                })
                return
            }

            toast("Berhasil Login", {
                type: "success",
                theme: "auto",
                position: "top-center"
            })

            const payload = {
                username: datas.value.username,
                id_sekolah: selectedTipeLembaga.value.id_sekolah,
                tipe_lembaga: selectedTipeLembaga.value.tipe_lembaga
            }

            useCookie("username").value = payload.username
            useCookie("tipe_lembaga").value = payload.tipe_lembaga
            useCookie("id_sekolah").value = payload.id_sekolah
            
            useRouter().push("/dashboard")
            break;
        case "SMA":
            if(datas.value.username !== "AdminSMA" || datas.value.password !== "AdminSMA2"){
                toast("Gagal Login", {
                    type: "error",
                    theme: "auto",
                    position: "top-center"
                })
                return
            }

            toast("Berhasil Login", {
                type: "success",
                theme: "auto",
                position: "top-center"
            })

            const payload1 = {
                username: datas.value.username,
                id_sekolah: selectedTipeLembaga.value.id_sekolah,
                tipe_lembaga: selectedTipeLembaga.value.tipe_lembaga
            }

            useCookie("username").value = payload1.username
            useCookie("tipe_lembaga").value = payload1.tipe_lembaga
            useCookie("id_sekolah").value = payload1.id_sekolah
            
            useRouter().push("/dashboard")
            break;
        case "YAYASAN":
            if(datas.value.username !== "AdminYAYASAN" || datas.value.password !== "AdminYAYASAN3"){
                toast("Gagal Login", {
                    type: "error",
                    theme: "auto",
                    position: "top-center"
                })
                return
            }

            toast("Berhasil Login", {
                type: "success",
                theme: "auto",
                position: "top-center"
            })

            const payload2 = {
                username: datas.value.username,
                id_sekolah: selectedTipeLembaga.value.id_sekolah,
                tipe_lembaga: selectedTipeLembaga.value.tipe_lembaga
            }

            useCookie("username").value = payload2.username
            useCookie("tipe_lembaga").value = payload2.tipe_lembaga
            useCookie("id_sekolah").value = payload2.id_sekolah
            
            useRouter().push("/dashboard")
            break;
    }
}

onMounted(() => {
    loadTipeLembaga()
})

onUnmounted(() => {
    const ws = StoreDatas().GetDatasWebsocket()
    
    ws?.close()
    useCookie("username").value = null
    StoreDatas().DeleteDatasWebsocket()
})
</script>

<template>
    <div class="login-wrapper">
        <div class="login-card">
            <div class="login-header">
                <!-- Icon Gedung / Lembaga -->
                <svg xmlns="http://www.w3.org/2000/svg" class="icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2L2 7l2 1v11h16V8l2-1-2-5zm-2 15H6v-6h4v6zm8 0h-4v-6h4v6zm-4-8H8V7h8v2z"/>
                </svg>
                <h2>Pilih Sesi Lembaga</h2>
            </div>
            
            <form @submit="onLogin" class="login-form">
                <div class="form-group">
                    <label>Username / Nama Admin</label>
                    <input 
                        v-model="datas.username" 
                        placeholder="Contoh: admin123" 
                        type="text" 
                        class="form-control"
                        required 
                    />
                </div>

                <div class="form-group">
                    <label>Password</label>
                    <input 
                        v-model="datas.password" 
                        placeholder="*********" 
                        type="password" 
                        class="form-control"
                        required 
                    />
                </div>

                <div class="form-group">
                    <label>Tipe Lembaga</label>
                    <select v-model="selectedTipeLembaga" class="form-control select-control" required>
                        <option value="" disabled selected>-- Pilih Lembaga --</option>
                        <!-- PERBAIKAN DI SINI: Mengambil value dan text dari properti objek 'tipe_lembaga' -->
                        <option v-for="(item, index) in allTipeLembaga" :key="index" :value="item">
                            {{ item.tipe_lembaga }}
                        </option>
                    </select>
                </div>

                <button type="submit" class="btn-login">Login</button>
            </form>
        </div>
    </div>
</template>

<style scoped>
/* Reset dasar untuk font */
* {
    box-sizing: border-box;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}

/* Latar belakang abu-abu penuh */
.login-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    background-color: #696969; 
}

/* Kotak putih form (Card) */
.login-card {
    background-color: #ffffff;
    width: 100%;
    max-width: 420px;
    padding: 30px 40px;
    border-radius: 12px;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
}

/* Bagian Judul dan Ikon */
.login-header {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    margin-bottom: 25px;
}

.login-header h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 700;
    color: #1a202c;
}

.login-header .icon {
    width: 28px;
    height: 28px;
    color: #3b82f6; 
}

/* Pengaturan form */
.login-form {
    display: flex;
    flex-direction: column;
    gap: 18px;
}

.form-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.form-group label {
    font-size: 13px;
    font-weight: 600;
    color: #4a5568;
}

/* Styling Input dan Select */
.form-control {
    width: 100%;
    padding: 10px 14px;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 14px;
    color: #2d3748;
    transition: all 0.2s ease-in-out;
    outline: none;
}

.form-control:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
}

.select-control {
    cursor: pointer;
    background-color: white;
}

/* Tombol Login */
.btn-login {
    margin-top: 10px;
    background-color: #3b82f6;
    color: #ffffff;
    border: none;
    padding: 12px;
    font-size: 15px;
    font-weight: 600;
    border-radius: 6px;
    cursor: pointer;
    transition: background-color 0.2s;
}

.btn-login:hover {
    background-color: #2563eb;
}
</style>