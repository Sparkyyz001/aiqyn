import "server-only";
import { revalidateTag, updateTag } from "next/cache";

// Тег кеша потока обращений. Сбрасываем при любом изменении обращения (новое, смена статуса,
// ответ службы, голос жителей): новая жалоба на демо сразу видна акимату, а в остальное время
// страницы не ходят в базу за всеми 800+ обращениями на каждый клик.
export const REPORTS_TAG = "reports";

export function touchReports() {
  try {
    updateTag(REPORTS_TAG); // в server action — читающий сразу видит свою запись
  } catch {
    try {
      revalidateTag(REPORTS_TAG, { expire: 0 }); // в обработчиках маршрутов
    } catch {
      /* во время рендера сброс запрещён — кеш сам истечёт через 30 с */
    }
  }
}
