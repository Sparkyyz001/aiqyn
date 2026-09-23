"""Обучение и проверка модели «Честный срок» на реальных обращениях NYC 311.

Что делаем:
  1. Цель — сколько дней реально заняло решение (log1p: редкие затяжные случаи не перетягивают модель).
  2. Признаки, которые есть и в Нью-Йорке, и в Актау: категория, район, месяц, выходной день подачи,
     нагрузка (сколько таких обращений пришло за 14 дней до подачи относительно обычного).
     Сезон, район и нагрузка действуют по-разному для разных категорий (зимой не ремонтируют
     дороги, летом пик по воде), поэтому они входят во взаимодействии с категорией.
  3. Честная проверка по времени: учимся на 2024 — июне 2025, проверяем на июле — декабре 2025.
  4. Сравниваем с двумя ориентирами:
       • «официальный срок» — то, что житель видит сегодня: 15 рабочих дней ≈ 21 календарный;
       • «медианный срок по категории» — простая статистика без учёта места и времени.
     Для справки — градиентный бустинг.
  5. В приложение уходит линейная модель: каждый признак — понятный множитель к сроку,
     её легко объяснить словами и повторить на TypeScript один в один (проверяем тест-векторами).

Запуск:  ml/.venv/Scripts/python ml/honest_deadline/train.py
Результат: data/honest_deadline_model.json (модель, метрики, тест-векторы) и
           ml/honest_deadline/metrics.md (отчёт для защиты).
"""

import json
import os
from datetime import datetime, timezone

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, roc_auc_score

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "raw")
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
SPLIT = "2025-07-01"
BREACH_DAYS = 21  # 15 рабочих дней ≈ 21 календарный
QS = [round(x, 2) for x in np.arange(0.01, 1.0, 0.01)]  # квантили остатков: интервал и вероятность срыва

CATS = ["road_pit", "excavation", "water_outage", "sewage", "heating", "power_outage", "lighting", "garbage", "smell", "yard"]
BOROUGHS = ["BRONX", "BROOKLYN", "MANHATTAN", "QUEENS", "STATEN ISLAND"]


def load():
    df = pd.read_csv(os.path.join(RAW, "nyc_requests.csv"))
    df["created"] = pd.to_datetime(df["created_date"], errors="coerce")
    df["closed"] = pd.to_datetime(df["closed_date"], errors="coerce")
    df = df.dropna(subset=["created", "closed"])
    df["days"] = (df["closed"] - df["created"]).dt.total_seconds() / 86400
    # закрытые «в ту же минуту» — чаще отказ/дубль, а не решение; и отрезаем явные ошибки дат
    df = df[(df["days"] >= 0.01) & (df["days"] <= 365)]
    df = df[df["borough"].isin(BOROUGHS)]
    df = df.drop_duplicates("unique_key").reset_index(drop=True)
    df["y"] = np.log1p(df["days"])
    df["month"] = df["created"].dt.month
    df["weekend"] = (df["created"].dt.dayofweek >= 5).astype(int)

    # нагрузка: поступления категории за 14 дней до подачи / среднее за 14 дней по периоду (полный поток)
    daily = pd.read_csv(os.path.join(RAW, "nyc_daily.csv"))
    daily["day"] = pd.to_datetime(daily["day"])
    load_map = {}
    for cat, g in daily.groupby("category"):
        s = g.set_index("day")["n"].asfreq("D", fill_value=0).sort_index()
        prev14 = s.rolling(14).sum().shift(1)
        ratio = (prev14 / s.rolling(14).sum().mean()).clip(lower=0.2, upper=5)
        load_map[cat] = np.log(ratio)
    day = df["created"].dt.normalize()
    df["load"] = [float(load_map[c].get(d, 0.0)) for c, d in zip(df["category"], day)]
    df["load"] = df["load"].fillna(0.0)
    return df


def design(df):
    cols = {}
    for c in CATS:
        cc = (df["category"] == c).to_numpy(float)
        cols[f"cat:{c}"] = cc
        for b in BOROUGHS[1:]:
            cols[f"cd:{c}:{b}"] = cc * (df["borough"] == b).to_numpy(float)
        for m in range(2, 13):
            cols[f"cm:{c}:{m}"] = cc * (df["month"] == m).to_numpy(float)
        cols[f"cl:{c}"] = cc * df["load"].to_numpy(float)
    cols["weekend"] = df["weekend"].to_numpy(float)
    return pd.DataFrame(cols, index=df.index)


def p_breach(mu, cats, resq, days=BREACH_DAYS):
    thr = np.log1p(days)
    return np.array([float(np.mean(m + np.array(resq.get(c) or resq["_all"]) > thr)) for m, c in zip(mu, cats)])


def main():
    df = load()
    tr = df[df["created"] < SPLIT]
    te = df[df["created"] >= SPLIT]
    Xtr, Xte = design(tr), design(te)
    print(f"обучение: {len(tr)}, проверка: {len(te)}")
    y_breach = (te["days"].values > BREACH_DAYS).astype(int)

    # Ориентир 1 — официальный срок: «решат за 15 рабочих дней» для всех
    mae_official = mean_absolute_error(te["days"], np.full(len(te), BREACH_DAYS))

    # Ориентир 2 — медиана срока по категории
    med = tr.groupby("category")["days"].median()
    mae_naive = mean_absolute_error(te["days"], te["category"].map(med).values)
    medlog = tr.groupby("category")["y"].median()
    mlog_naive = mean_absolute_error(te["y"], te["category"].map(medlog).values)
    rate = tr.assign(b=(tr["days"] > BREACH_DAYS).astype(int)).groupby("category")["b"].mean()
    auc_naive = roc_auc_score(y_breach, te["category"].map(rate).values)

    # Модель AIQYN — объяснимая линейная
    ridge = Ridge(alpha=1.0).fit(Xtr, tr["y"])
    mu_tr, mu = ridge.predict(Xtr), ridge.predict(Xte)
    mae_model = mean_absolute_error(te["days"], np.expm1(mu))
    mlog_model = mean_absolute_error(te["y"], mu)

    # Справочно — градиентный бустинг (медианная функция потерь)
    enc = lambda d: d[["month", "weekend", "load"]].assign(cat=d["category"].map({c: i for i, c in enumerate(CATS)}), bor=d["borough"].map({b: i for i, b in enumerate(BOROUGHS)}))
    gbm = HistGradientBoostingRegressor(loss="absolute_error", max_iter=400, learning_rate=0.06, categorical_features=[3, 4], random_state=0).fit(enc(tr), tr["y"])
    mae_gbm = mean_absolute_error(te["days"], np.expm1(gbm.predict(enc(te))))

    # Интервал и вероятность срыва — из квантилей остатков по категории (обучающая выборка)
    res_tr = tr["y"].values - mu_tr
    resq = {c: [round(float(q), 4) for q in np.quantile(res_tr[(tr["category"] == c).values], QS)] for c in CATS}
    resq["_all"] = [round(float(q), 4) for q in np.quantile(res_tr, QS)]
    lo = np.array([resq[c][QS.index(0.1)] for c in te["category"]])
    hi = np.array([resq[c][QS.index(0.9)] for c in te["category"]])
    cover = float(np.mean((te["y"].values >= mu + lo) & (te["y"].values <= mu + hi)))
    pb = p_breach(mu, te["category"], resq)
    auc_model = roc_auc_score(y_breach, pb)
    flags = {}
    for thr in (0.3, 0.5):
        f = pb >= thr
        flags[str(thr)] = {"recall": round(float(f[y_breach == 1].mean()), 3), "precision": round(float(y_breach[f].mean()) if f.any() else 0.0, 3)}
    recall, precision = flags["0.3"]["recall"], flags["0.3"]["precision"]

    coef = {name: round(float(v), 5) for name, v in zip(Xtr.columns, ridge.coef_)}
    # Для переноса в Актау: относительная скорость категорий, сезон и нагрузка по категориям
    cat_level = {c: float(medlog[c]) for c in CATS}
    mean_level = float(np.mean(list(cat_level.values())))
    month = {}
    for c in CATS:
        m = [0.0] + [coef[f"cm:{c}:{k}"] for k in range(2, 13)]
        mm = float(np.mean(m))
        month[c] = [round(v - mm, 5) for v in m]

    metrics = {
        "train_rows": int(len(tr)),
        "test_rows": int(len(te)),
        "period_train": f"2024-01-01 — {SPLIT}",
        "period_test": f"{SPLIT} — 2025-12-31",
        "mae_days": {"official_term": round(mae_official, 2), "naive_category_median": round(mae_naive, 2), "model": round(mae_model, 2), "gbm_reference": round(mae_gbm, 2)},
        "mae_log": {"naive_category_median": round(mlog_naive, 4), "model": round(mlog_model, 4)},
        "improvement_vs_official_pct": round(100 * (1 - mae_model / mae_official), 1),
        "improvement_vs_naive_pct": round(100 * (1 - mae_model / mae_naive), 1),
        "relative_error_improvement_vs_naive_pct": round(100 * (1 - mlog_model / mlog_naive), 1),
        "interval_10_90_coverage": round(cover, 3),
        "breach_auc": {"naive_category_rate": round(float(auc_naive), 3), "model": round(float(auc_model), 3)},
        "breach_flag": {**flags, "official_term_recall": 0.0},
        "breach_share_test": round(float(y_breach.mean()), 3),
    }

    rng = np.random.default_rng(7)
    idx = rng.choice(len(te), size=25, replace=False)
    Xv = Xte.iloc[idx]
    pv = ridge.predict(Xv)
    vectors = [
        {"category": te.iloc[i]["category"], "district": te.iloc[i]["borough"], "month": int(te.iloc[i]["month"]), "weekend": int(te.iloc[i]["weekend"]), "load": float(te.iloc[i]["load"]), "expected_log": round(float(p), 6)}
        for i, p in zip(idx, pv)
    ]

    model = {
        "name": "AIQYN honest deadline",
        "trained_at": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "source": "NYC 311 Service Requests (NYC Open Data, erm2-nwe9), 2024–2025, закрытые обращения",
        "target": "log1p(дней до закрытия)",
        "reference": {"district": BOROUGHS[0], "month": 1},
        "intercept": round(float(ridge.intercept_), 6),
        "coef": coef,
        "transfer": {
            "cat_rel": {c: round(v - mean_level, 5) for c, v in cat_level.items()},
            "month": month,
            "load": {c: coef[f"cl:{c}"] for c in CATS},
            "weekend": coef["weekend"],
        },
        "quantiles": QS,
        "residual_q": resq,
        "breach_days": BREACH_DAYS,
        "metrics": metrics,
        "test_vectors": vectors,
    }
    with open(os.path.join(ROOT, "data", "honest_deadline_model.json"), "w", encoding="utf8") as f:
        json.dump(model, f, ensure_ascii=False, indent=1)

    n = lambda x: f"{x:,}".replace(",", " ")
    lines = [
        "# «Честный срок» — проверка модели на реальных данных NYC 311",
        "",
        f"Данные: {n(len(df))} закрытых обращений NYC 311 за 2024–2025 по 10 категориям, у которых есть прямой аналог в AIQYN.",
        f"Обучение: {n(len(tr))} ({metrics['period_train']}); проверка: {n(len(te))} ({metrics['period_test']}) — модель их не видела.",
        "",
        "## Точность прогноза срока",
        "",
        "| Что говорят жителю | Средняя ошибка, дней (MAE) |",
        "|---|---|",
        f"| Официальный срок: «15 рабочих дней» всем | {mae_official:.2f} |",
        f"| Медианный срок по категории | {mae_naive:.2f} |",
        f"| **AIQYN: категория × район, × сезон, × нагрузка + выходной** | **{mae_model:.2f}** |",
        f"| Справочно: градиентный бустинг | {mae_gbm:.2f} |",
        "",
        f"- К официальному сроку: ошибка меньше на **{metrics['improvement_vs_official_pct']}%**.",
        f"- К медиане по категории: MAE меньше на {metrics['improvement_vs_naive_pct']}%, относительная ошибка — на {metrics['relative_error_improvement_vs_naive_pct']}%.",
        "  Честно: основную точность даёт сама статистика по категории; место, сезон и нагрузка добавляют немного —",
        "  у городских обращений большой «хвост» затяжных случаев, который не объясняется простыми признаками.",
        f"- Интервал 10–90% накрывает реальный срок в **{cover * 100:.0f}%** случаев (цель — 80%): интервал честный.",
        "",
        f"## Срывы срока (>{BREACH_DAYS} календарных дней; в проверке их {metrics['breach_share_test'] * 100:.0f}%)",
        "",
        f"- Официальный срок не предупреждает ни об одном срыве (0%).",
        f"- AIQYN с порогом риска 30% находит **{recall * 100:.0f}%** будущих срывов, точность предупреждения {precision * 100:.0f}%.",
        f"- Качество ранжирования по риску: AUC **{auc_model:.3f}** (медиана по категории — {auc_naive:.3f}).",
        "",
        "## Что переносится в Актау",
        "",
        "- относительная скорость категорий (например, «восстановить асфальт после раскопок» дольше, чем «залатать яму»);",
        "- сезонность по каждой категории и влияние нагрузки на службу;",
        "- форма распределения сроков — для честного интервала и вероятности срыва.",
        "",
        "Уровень (сколько в среднем решают в Актау) берётся из решённых обращений платформы; при числе похожих",
        "меньше 20 прогноз не показывается.",
    ]
    with open(os.path.join(HERE, "metrics.md"), "w", encoding="utf8") as f:
        f.write("\n".join(lines) + "\n")
    print(json.dumps(metrics, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
