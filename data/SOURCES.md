# Источники данных AIQYN

Все датасеты — из открытых источников. Синтетика есть только в демо-подложке потока обращений
(`lib/demo-baseline.ts`), и она посажена на реальную географию и реальные службы из этой папки.

| Файл | Что | Источник | Лицензия | Как получено |
|---|---|---|---|---|
| `districts.json` | 125 микрорайонов, кварталов, сёл (≈85 с полигонами границ) | OpenStreetMap, Overpass API | ODbL 1.0 | `node scripts/fetch-osm.mjs` |
| `admin_boundaries.json` | Административные границы (Ақтау қалалық әкімдігі, Өмірзақ) | OpenStreetMap | ODbL 1.0 | `fetch-osm.mjs` |
| `road_segments.json` | 5 499 дорожных сегментов с геометрией (primary…service) | OpenStreetMap | ODbL 1.0 | `fetch-osm.mjs` |
| `lighting_points.json` | Фонари `highway=street_lamp` — **в OSM по Актау их 0** | OpenStreetMap | ODbL 1.0 | `fetch-osm.mjs` |
| `poi_social.json` | 44 школы, 39 садиков, 8 больниц, 12 поликлиник и др. | OpenStreetMap | ODbL 1.0 | `fetch-osm.mjs` |
| `transit_stops.json` / `transit_routes.json` | 110 остановок, маршруты | OpenStreetMap | ODbL 1.0 | `fetch-osm.mjs` |
| `beaches.json` / `coastline.json` | Пляжи, береговая линия Каспия | OpenStreetMap | ODbL 1.0 | `fetch-osm.mjs` |
| `industrial.json` | Порт, МАЭК, ТЭЦ-1/3, КазАзот, промзоны | OpenStreetMap | ODbL 1.0 | `fetch-osm.mjs` |
| `addresses.json` | 18 036 адресных точек (для ярлыков «3 мкр, дом 111») | OpenStreetMap | ODbL 1.0 | `fetch-osm.mjs` |
| `weather_history.json` | Почасовой ветер и температура за 90 дней | Open-Meteo Historical API | CC BY 4.0 | `node scripts/fetch-weather.mjs` |
| `weather_daily.json` | Суточные min/max за 3 года (переходы через 0 °C) | Open-Meteo Historical API | CC BY 4.0 | `fetch-weather.mjs` |
| `services.json` | Реестр ответственных организаций | goszakup.gov.kz (реестр поставщиков), mrek.kz, lada.kz, 2ГИС | факты | вручную, ссылка у каждой записи |
| `press_cases.json` | Реальные кейсы из СМИ | lada.kz, inaktau.kz, newsroom.kz, tengrinews.kz, time.kz, zakon.kz | цитирование со ссылкой | вручную, ссылка у каждой записи |
| `procurements.json` | Контракты по благоустройству | goszakup.gov.kz | — | **ожидает выгрузки** (см. ниже) |

Координаты фильтруются по bbox Актау: широта 43.55–43.72, долгота 51.10–51.30.
Дата выгрузки — поле `fetched_at` внутри каждого файла.

## Оговорки (честно)

- **Фонари.** В OSM по Актау нет ни одной точки `highway=street_lamp`. Модуль «Тёмные зоны»
  строится по обращениям категории `lighting` и дорожным сегментам, а не по реестру фонарей.
- **Электроснабжение.** В ТЗ было «городские электросети» одной записью. По открытым источникам
  это две организации: АО «МРЭК» (распределение, с 01.01.2025) и ГКП «АУЭС» (городские сети,
  уличное освещение). В реестре обе.
- **Вывоз мусора.** С 01.01.2026 единственный оператор — ТОО «Zero Waste Ақтау».
- **verified=false** в `services.json` — организация указана по открытым источникам
  и требует уточнения у акимата. Телефоны и email не выдумываются: `null`, если их нет в первоисточнике.
- **Госзакупки.** OWS v2/v3 (`ows.goszakup.gov.kz`) требует токен Минфина (без него 401).
  Интеграция реализована, токен выдаётся по заявке. На демо работаем на реальной ручной выгрузке с портала.
- **OSM.** В данных OSM есть ошибки: например, у полигона «13 шағын аудан» тег `name:ru` = «15 шағын аудан».
  Русские названия нумерованных микрорайонов нормализуются правилом «N шағын аудан» → «N мкр».
- **Каналы подачи жалоб, которые уже есть в Актау:** контакт-центр 109 (24/7), сайт aktau109.kz,
  приложение «Smart Aktau», мессенджеры
  ([lada.kz](https://www.lada.kz/society/society/93427-v-aktau-zarabotal-edinyy-kontakt-centr-109-po-voprosam-zhizneobespecheniya-naseleniya.html)).
  AIQYN их не заменяет, а добавляет к ним публичность, SLA и подтверждение выполнения жителями.

## Иллюстрации лендинга

- `public/landing/pothole*.webp` — фото ямы, Miguel Tremblay, Wikimedia Commons, **общественное достояние (Public domain)**: https://commons.wikimedia.org/wiki/File:Pothole.jpg

- `public/landing/role-citizens.webp` — «Residential apartment block in Aktau, Kazakhstan, illustrating the city’s unique address system.jpg», автор: IvarT, лицензия **CC0**, Wikimedia Commons: https://commons.wikimedia.org/wiki/File%3AResidential_apartment_block_in_Aktau%2C_Kazakhstan%2C_illustrating_the_city%E2%80%99s_unique_address_system.jpg
- `public/landing/role-services.webp` — «Tusayan Greenway Paving Aug 10 - Sept 10, 2016 0558 (28389055513).jpg», автор: Grand Canyon National Park, лицензия **CC BY 2.0**, Wikimedia Commons: https://commons.wikimedia.org/wiki/File%3ATusayan_Greenway_Paving_Aug_10_-_Sept_10%2C_2016_0558_%2828389055513%29.jpg
- `public/landing/role-akimat.webp` — «Aktau panorama at day.jpg», автор: Vita86, лицензия **CC BY-SA 3.0**, Wikimedia Commons: https://commons.wikimedia.org/wiki/File%3AAktau_panorama_at_day.jpg
