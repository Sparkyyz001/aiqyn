import type { MetadataRoute } from "next";

// Установка как приложение: иконка на главном экране, запуск без адресной строки браузера
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AIQYN — прозрачность городских обращений Актау",
    short_name: "AIQYN",
    description: "Сообщайте о проблемах города, следите за честным сроком и решением. Актау.",
    lang: "ru",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#053e42",
    theme_color: "#053e42",
    categories: ["government", "utilities", "social"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Сообщить о проблеме", short_name: "Сообщить", url: "/report/new", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Карта обращений", short_name: "Карта", url: "/map", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
