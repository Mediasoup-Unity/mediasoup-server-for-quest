# Mediasoup-JS

Este proyecto es una **aplicación básica de videollamadas** construida con [mediasoup](https://mediasoup.org/), que permite a los usuarios conectarse **a través de navegador y desde Unity y las Oculus Quest 3**


**Importante**: Para ejecutar esta aplicación, es necesario o bien ejecutarlo desde maquina virtual en Windows (por ejemplo VirtualBox) con la opción de red "Conectado a: Adaptador puente" o bien desde Linux nativo.

**Usar en combinación a la aplicación [Unity Project](https://github.com/Mediasoup-Unity/Unity-Project.git)** 

**Al ser un prototipo puede dar bastantes errores**

## Características

- Conexión a salas de videollamada mediante WebRTC y mediasoup.
- Grabación de las videollamadas (audio y video) en archivos locales.
- Interfaz web sencilla para unirse a una sala y compartir audio/video.
- Gestión de múltiples salas y usuarios.

## Instalación

1. Clona este repositorio:
   ```sh
   git clone https://github.com/Mediasoup-Unity/mediasoup-server-for-quest.git
   cd mediasoup-server-for-quest
   ```

2. Instala las dependencias:
   ```sh
   pnpm install
   ```
3. Configura la IP de tu ordenador:
   ```sh
    Ir al archivo backend/server.js -> Línea 423 y 428, sustituir announcedAddress por la IP de Linux.
   ```


3. Inicia el servidor:
   ```sh
   pnpm start
   ```

4. Accede a la aplicación en tu navegador (si estas usando la opción de VirtualBox, es más sencillo acceder desde un navegador en Windows para no tener que configurar nada):
   ```
   https://<IP>:5173
   ```

## Estructura del proyecto

- `backend/server.js`: Servidor principal y lógica de señalización con mediasoup y Socket.IO.
- `backend/mediacodecs.js`: Configuración de codecs soportados por mediasoup.
- `frontend/`: Cliente web de ejemplo construido con React y Vite.

## Requisitos

- Node.js >= 14
- [pnpm](https://pnpm.io/)
- [mediasoup](https://mediasoup.org/) y sus dependencias nativas
