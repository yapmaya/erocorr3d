import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "EroCorr3D",
        short_name: "EroCorr3D",
        description: "Boru ve vanalarda erozyon/korozyon hasarını hesaplayan mühendislik yazılımı.",
        lang: "tr",
        start_url: "/",
        display: "standalone",
        background_color: "#0a0a0a",
        theme_color: "#0a0a0a",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Sonuç/PDF/Excel/3B ısı haritası dahil TÜM uygulama kabuğu zaten
        // yerel/statik olduğundan ilk ziyaretten SONRA tamamen çevrimdışı
        // çalışır. Tek istisna: drei `<Environment preset="warehouse">`nin
        // yüklediği harici HDRI (bkz. README'nin zaten belirttiği aynı
        // sınırlama; kaynak: node_modules/@react-three/drei/core/
        // useEnvironment.js::CUBEMAP_ROOT = raw.githack.com/pmndrs/
        // drei-assets/.../hdri/) — bu da CacheFirst ile önbelleğe alınır,
        // böylece o da ilk başarılı yüklemeden sonra çevrimdışı çalışır.
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        // Ana bundle (Three.js/@react-three/drei/xlsx/pdfmake dahil) varsayılan
        // 2 MiB önbellekleme sınırını aşıyor (~5.6 MB) — çevrimdışı çalışma
        // TAM UYGULAMA KABUĞUNU kapsaması gerektiğinden (yalnızca bir kısmını
        // değil) sınır büyütülür, bundle DIŞARIDA bırakılmaz.
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url }: { url: URL }) => url.hostname === "raw.githack.com",
            handler: "CacheFirst",
            options: {
              cacheName: "erocorr3d-hdri-cache",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
});
