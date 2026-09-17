// Gunakan variabel global biasa (di luar lingkup fungsi) khusus untuk tipe objek native
let globalWsConnection: WebSocket | null = null;

export const StoreDatas = () => {
    // --- MANAJEMEN WEBSOCKET ---
    const SetDatasWebsocket = (wsConn: WebSocket) => {
        globalWsConnection = wsConn
    }

    const GetDatasWebsocket = () => {
        return globalWsConnection
    }

    const DeleteDatasWebsocket = () => {
        if(globalWsConnection) {
            globalWsConnection.close()
        }
        globalWsConnection = null
    }

    return {
        SetDatasWebsocket,
        GetDatasWebsocket,
        DeleteDatasWebsocket
    }
}