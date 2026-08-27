import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        // En ağır bağımlılıkları GRUPLAR — 3B yığını (three.js) sonuç
        // panelinde her zaman potansiyel olarak görünür olduğu için hâlâ
        // eager kalır, ama kendi paylaşılan/önbelleklenebilir parçasına
        // ayrılır. pdfmake/xlsx AYRICA dinamik import() ile yükleniyor
        // (bkz. ReportButtons.tsx, parseLineList.ts) — bu grup, o async
        // chunk'a bir İSİM verir, eager yapmaz.
        //
        // `react`/`react-dom`/`scheduler` AYRI bir `vendor-react` parçasına
        // çıkarılır — hem vendor-3d (@react-three/fiber) hem vendor-charts
        // (recharts) React'a bağımlı; ikisi de kendi payına React'ı
        // "içeriyormuş" gibi gruplanınca Rollup "Circular chunk: vendor-charts
        // -> vendor-3d -> vendor-charts" uyarısı veriyordu (denendi, doğrulandı)
        // — paylaşılan bağımlılığı üçüncü bir parçaya çıkarmak bunu çözüyor.
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) {
            return "vendor-react";
          }
          if (/[\\/]node_modules[\\/](three|three-stdlib|three-mesh-bvh|three-bvh-csg|@react-three)[\\/]/.test(id)) {
            return "vendor-3d";
          }
          if (/[\\/]node_modules[\\/](pdfmake|xlsx)[\\/]/.test(id)) {
            return "vendor-report";
          }
          if (/[\\/]node_modules[\\/](recharts|victory-vendor|d3|d3-[a-z-]+)[\\/]/.test(id)) {
            return "vendor-charts";
          }
          return undefined;
        },
      },
    },
  },
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
        // (P10 ÖNCESİ: tek parça ~5,6 MB'lık bundle vardı, sınır 8 MB'a
        // çıkarılmıştı.) P10 ile manualChunks (yukarıda) + pdfmake/xlsx
        // dinamik import()'a taşındı — en büyük TEK parça artık
        // `vendor-report` (pdfmake+xlsx, yalnızca rapor alınırken/Excel içe
        // aktarılırken indirilir, ~2,3 MB). `globPatterns` YİNE DE **/*.js
        // eşleştirdiği için bu async chunk'lar dahil TÜMÜ precache'e girer
        // (çevrimdışı çalışma tek parça bundle'daki gibi TAM kapsamlı kalır)
        // — sınır yine varsayılan 2 MiB'nin ÜSTÜNDE tutulmalı ki hiçbir
        // parça dışarıda bırakılmasın, ama artık 8 MB yerine en büyük
        // parçaya (~2,3 MB) makul pay bırakan 4 MB yeterli.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
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
