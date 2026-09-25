"""Сбор РЕАЛЬНЫХ лотов госзакупок Актау из открытого реестра лотов (без авторизации).

Источник: https://old.goszakup.gov.kz/ru/search/lots — публичная страница портала госзакупок РК.
Берём лоты городских заказчиков Актау (отделы ЖКХ, дорог, строительства, «Ақтау тұрғын үй»,
электросети, «Каспий жылу, су арнасы»), только со статусом «Закупка состоялась» и только работы
по темам жалоб жителей. Дату публикации берём со страницы объявления.

Запуск: python scripts/goszakup/fetch_lots.py  →  data/goszakup-lots.json
Бережно к порталу: пауза между запросами, не больше 12 страниц на заказчика.
"""

import html
import json
import re
import time
import urllib.parse
import urllib.request

BASE = "https://old.goszakup.gov.kz"
OUT = "data/goszakup-lots.json"
UA = {"User-Agent": "Mozilla/5.0 (AIQYN civic-tech research)"}

# поиск по заказчику (подстрока) — и строгий фильтр по полному названию ниже
CUSTOMER_QUERIES = [
    "Актауский городской отдел жилищно-коммунального",
    "Актауский городской отдел пассажирского транспорта",
    "Актауский городской отдел строительства",
    "Ақтау тұрғын үй",
    "Актауское управление электрических сетей",
    "Аппарат акима города Актау",
    "Каспий жылу",
    "Ақбота",
]
CUSTOMERS = [
    "Актауский городской отдел жилищно-коммунального хозяйства",
    "Актауский городской отдел пассажирского транспорта и автомобильных дорог",
    "Актауский городской отдел строительства",
    'Ақтау тұрғын үй" на праве хозяйственного ведения акимата города Актау',
    "Актауское управление электрических сетей",
    "Актауского городского отдела жилищно-коммунального хозяйства",
    "Каспий жылу, су арнасы",
    "Аппарат акима города Актау",
]
# тема лота → категория жалоб (первое совпадение)
CATEGORIES = [
    ("road_pit", r"дорог|асфальт|тротуар|ямочн|бордюр|проезд|автодорог|дорожн"),
    ("lighting", r"освещ|светильн|фонар"),
    ("sewage", r"канализ|ливнев|водоотвод|откачк|стоков"),
    ("water_outage", r"водопровод|водоснаб|трубопровод|питьев|технической вод"),
    ("heating", r"теплос|отоплен|теплотрасс"),
    ("power_outage", r"электр|кабел|трансформат|подстанц|ЛЭП|КТП"),
    ("yard", r"благоустр|двор|площадк|сквер|парк|озелен|полив|малых архитектурных|скамейк|фонтан|аллея"),
    ("garbage", r"мусор|ТБО|санитарн|контейнер|вывоз|отход|уборк"),
    ("transport", r"остановк|пассажирск|автобус|перевоз"),
    ("beach", r"пляж|набережн|берег"),
]


def get(url: str) -> str:
    req = urllib.request.Request(url, headers=UA)
    return urllib.request.urlopen(req, timeout=40).read().decode("utf-8", "replace")


def clean(x: str) -> str:
    return html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", x))).strip()


def search(customer: str) -> list[dict]:
    found = []
    for page in range(1, 13):
        q = urllib.parse.urlencode({"filter[customer]": customer, "count_record": 50, "page": page})
        tables = [t for t in re.findall(r"<table[^>]*>(.*?)</table>", get(f"{BASE}/ru/search/lots?{q}"), re.S) if "/announce/index/" in t]
        if not tables:
            break
        n = 0
        for row in re.findall(r"<tr[^>]*>(.*?)</tr>", tables[0], re.S):
            c = [clean(x) for x in re.findall(r"<td[^>]*>(.*?)</td>", row, re.S)]
            m = re.match(r"(\S+)\s+(\d+-\d+)\s+(.*?)\s+Заказчик:\s*(.*)$", c[0]) if len(c) >= 6 else None
            if not m:
                continue
            lot_no, announce, title, cust = m.groups()
            aid = re.search(r"/announce/index/(\d+)", row)
            found.append(
                dict(
                    lot_no=lot_no, announce=announce, title=title, customer=cust,
                    lot=re.sub(r"\s*История$", "", c[1]),
                    amount=float(c[3].replace(" ", "").replace(",", ".") or 0),
                    method=c[4], status=c[5],
                    url=f"{BASE}/ru/announce/index/{aid.group(1)}" if aid else None,
                )
            )
            n += 1
        time.sleep(1.2)
        if n < 50:
            break
    return found


def main() -> None:
    lots: dict[str, dict] = {}
    for q in CUSTOMER_QUERIES:
        for lot in search(q):
            lots[lot["lot_no"]] = lot
    selected = []
    for lot in lots.values():
        if lot["status"] != "Закупка состоялась" or not any(c in lot["customer"] for c in CUSTOMERS):
            continue
        text = f"{lot['title']} {lot['lot']}"
        cat = next((c for c, rx in CATEGORIES if re.search(rx, text, re.I)), None)
        if cat:
            selected.append({**lot, "cat": cat})
    dates: dict[str, str | None] = {}
    for url in sorted({x["url"] for x in selected if x["url"]}):
        try:
            m = re.search(r"Дата публикации объявления</label>.*?value=\"([^\"]+)\"", get(url), re.S)
            dates[url] = m.group(1)[:10] if m else None
        except Exception:
            dates[url] = None
        time.sleep(0.8)
    for x in selected:
        x["published"] = dates.get(x["url"])
    selected.sort(key=lambda x: -x["amount"])
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(selected, f, ensure_ascii=False, indent=1)
    print(f"лотов: {len(selected)}, сумма: {sum(x['amount'] for x in selected) / 1e9:.1f} млрд тенге")


if __name__ == "__main__":
    main()
