// Словарь интерфейса ru / kz. Госпродукт — двуязычность обязательна (ТЗ, раздел 9).
// Язык хранится в cookie `lang` (настройка интерфейса, не данные).

export type Lang = "ru" | "kz";
export const LANGS: Lang[] = ["ru", "kz"];

const ru = {
  brand: "AIQYN",
  tagline: "Прозрачность городских проблем Актау",
  nav: {
    map: "Карта",
    report: "Сообщить о проблеме",
    incidents: "Аварии",
    openData: "Открытые данные",
    me: "Мои обращения",
    service: "Очередь службы",
    akimat: "Аналитика акимата",
    operator: "Оператор 109",
    login: "Войти",
    logout: "Выйти",
    menu: "Меню",
  },
  roles: { citizen: "Житель", service: "Служба", akimat: "Акимат", operator: "Оператор" },
  auth: {
    title: "Вход в AIQYN",
    signupTitle: "Регистрация",
    email: "Email",
    password: "Пароль",
    fullName: "Имя и фамилия",
    submit: "Войти",
    signup: "Зарегистрироваться",
    noAccount: "Нет аккаунта?",
    haveAccount: "Уже есть аккаунт?",
    demo: "Тестовые аккаунты для жюри",
    demoHint: "Пароль у всех: aiqyn2026",
    error: "Неверный email или пароль",
  },
  status: {
    new: "Новое",
    routed: "Передано службе",
    accepted: "Принято",
    in_progress: "В работе",
    awaiting_confirmation: "Ждёт подтверждения жителей",
    resolved: "Решено",
    rejected: "Отклонено",
    reopened: "Переоткрыто",
  },
  common: {
    lang: "Қазақша",
    theme: "Тема",
    loading: "Загрузка…",
    save: "Сохранить",
    cancel: "Отмена",
    back: "Назад",
    all: "Все",
    source: "Источник",
  },
};

type Dict = typeof ru;

const kz: Dict = {
  brand: "AIQYN",
  tagline: "Ақтау қаласы мәселелерінің айқындығы",
  nav: {
    map: "Карта",
    report: "Мәселе туралы хабарлау",
    incidents: "Апаттар",
    openData: "Ашық деректер",
    me: "Менің өтініштерім",
    service: "Қызмет кезегі",
    akimat: "Әкімдік аналитикасы",
    operator: "109 операторы",
    login: "Кіру",
    logout: "Шығу",
    menu: "Мәзір",
  },
  roles: { citizen: "Тұрғын", service: "Қызмет", akimat: "Әкімдік", operator: "Оператор" },
  auth: {
    title: "AIQYN жүйесіне кіру",
    signupTitle: "Тіркелу",
    email: "Email",
    password: "Құпиясөз",
    fullName: "Аты-жөні",
    submit: "Кіру",
    signup: "Тіркелу",
    noAccount: "Аккаунт жоқ па?",
    haveAccount: "Аккаунт бар ма?",
    demo: "Қазылар алқасына арналған тест аккаунттары",
    demoHint: "Барлығының құпиясөзі: aiqyn2026",
    error: "Email немесе құпиясөз қате",
  },
  status: {
    new: "Жаңа",
    routed: "Қызметке жіберілді",
    accepted: "Қабылданды",
    in_progress: "Орындалуда",
    awaiting_confirmation: "Тұрғындардың растауын күтуде",
    resolved: "Шешілді",
    rejected: "Қабылданбады",
    reopened: "Қайта ашылды",
  },
  common: {
    lang: "Русский",
    theme: "Тақырып",
    loading: "Жүктелуде…",
    save: "Сақтау",
    cancel: "Бас тарту",
    back: "Артқа",
    all: "Барлығы",
    source: "Дереккөз",
  },
};

export const DICTS: Record<Lang, Dict> = { ru, kz };
export type { Dict };

// Название сущности из справочника в нужной локали
export const nameOf = (x: { name_ru: string; name_kz: string }, lang: Lang) =>
  lang === "kz" ? x.name_kz : x.name_ru;
