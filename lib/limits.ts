// Предельные длины пользовательского текста: защищают базу и уведомления от «простыней»
export const MAX_TITLE = 200;
export const MAX_TEXT = 2000;

/** Обрезанная строка или пустая; нестроковое значение (из подделанного запроса) — пустая */
export const clean = (s: unknown, max = MAX_TEXT) => (typeof s === "string" ? s.trim().slice(0, max) : "");
