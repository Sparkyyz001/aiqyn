"""Выгрузка реальных обращений NYC 311 (NYC Open Data, без ключа) для обучения и проверки
модели «Честный срок».

Берём только типы обращений, у которых есть прямой аналог в категориях AIQYN, за 2024–2025 годы,
закрытые. Чтобы месяцы с большим потоком не задавили остальные, из каждого месяца каждого типа
берём не больше CAP случайных записей (Socrata сортирует по :id — это псевдослучайный порядок).

Отдельно для каждого типа выгружаем полное число поступлений по дням — из него считается
признак «нагрузка»: сколько таких обращений пришло за 14 дней до этого, относительно обычного.

Запуск:  ml/.venv/Scripts/python ml/honest_deadline/fetch_nyc.py
Результат: ml/honest_deadline/raw/nyc_requests.csv, raw/nyc_daily.csv
"""

import csv
import json
import os
import time
import urllib.parse
import urllib.request

API = "https://data.cityofnewyork.us/resource/erm2-nwe9.json"
OUT = os.path.join(os.path.dirname(__file__), "raw")
CAP = 1500
YEARS = [2024, 2025]

# Категория AIQYN -> условие на тип (и при необходимости описание) обращения NYC 311
MAPPING = {
    "road_pit": "complaint_type='Street Condition' AND descriptor='Pothole'",
    "excavation": "complaint_type='Street Condition' AND descriptor in('Failed Street Repair','Cave-in')",
    "water_outage": "complaint_type='Water System' AND descriptor in('No Water (WNW)','Low Water Pressure - WLWP','Dirty Water (WE)')",
    "sewage": "complaint_type='Sewer'",
    "heating": "complaint_type='HEAT/HOT WATER'",
    "power_outage": "complaint_type='ELECTRIC'",
    "lighting": "complaint_type='Street Light Condition'",
    "garbage": "complaint_type in('Missed Collection','Dirty Condition','Illegal Dumping')",
    "smell": "complaint_type='Air Quality'",
    "yard": "complaint_type in('Damaged Tree','Overgrown Tree/Branches')",
}


def get(params, tries=5):
    url = API + "?" + urllib.parse.urlencode(params)
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "aiqyn-honest-deadline/1.0"})
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.load(r)
        except Exception as e:  # сеть или лимит — ждём и повторяем
            print("  retry", i + 1, type(e).__name__, str(e)[:80])
            time.sleep(3 * (i + 1))
    raise RuntimeError("не удалось получить " + url[:160])


def month_ranges():
    for y in YEARS:
        for m in range(1, 13):
            a = f"{y}-{m:02d}-01T00:00:00"
            b = f"{y + (m == 12)}-{(m % 12) + 1:02d}-01T00:00:00"
            yield a, b


def main():
    os.makedirs(OUT, exist_ok=True)
    rows_path = os.path.join(OUT, "nyc_requests.csv")
    daily_path = os.path.join(OUT, "nyc_daily.csv")
    fields = ["unique_key", "category", "complaint_type", "descriptor", "agency", "borough", "created_date", "closed_date"]

    with open(rows_path, "w", newline="", encoding="utf8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for cat, cond in MAPPING.items():
            total = 0
            for a, b in month_ranges():
                where = f"({cond}) AND created_date >= '{a}' AND created_date < '{b}' AND closed_date IS NOT NULL AND status='Closed'"
                data = get({"$select": ",".join(fields[:1] + fields[2:]), "$where": where, "$limit": CAP, "$order": ":id"})
                for r in data:
                    r["category"] = cat
                    w.writerow({k: r.get(k, "") for k in fields})
                total += len(data)
            print(f"{cat}: {total} записей")

    # Полный поток по дням — для признака «нагрузка» (без выборки)
    with open(daily_path, "w", newline="", encoding="utf8") as f:
        w = csv.writer(f)
        w.writerow(["category", "day", "n"])
        for cat, cond in MAPPING.items():
            where = f"({cond}) AND created_date >= '2023-12-01T00:00:00' AND created_date < '2026-01-01T00:00:00'"
            data = get({"$select": "date_trunc_ymd(created_date) as day, count(*) as n", "$where": where, "$group": "day", "$order": "day", "$limit": 5000})
            for r in data:
                w.writerow([cat, r["day"][:10], r["n"]])
            print(f"{cat}: поток по {len(data)} дням")


if __name__ == "__main__":
    main()
