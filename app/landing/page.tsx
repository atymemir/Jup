import { localizeMetadata } from "../i18n/server";
import { LanguageSwitcher } from "../i18n/LocaleProvider";
import { getServerLocale } from "../i18n/server";
import { Brand } from "../ui/Brand";
import type { Metadata } from "next";
import Link from "next/link";
import { Icon, type IconName } from "../ui/Icon";
import { SiteFooter } from "../ui/SiteFooter";
import {
  HeroFinder,
  LandingMenu,
  LessonPreview,
  PartnerPanel,
} from "./LandingExperience";
import st from "./landing.module.css";

const description =
  "Найдите преподавателя под вашу цель, язык и бюджет. Запись, переписка, материалы и домашняя работа — в одном Jup edu.";
const canonical =
  (
    process.env.FINDBUDDY_PUBLIC_URL ||
    "https://findbuddy-kohl.vercel.app/findbuddy"
  ).replace(/\/$/, "") + "/landing";
const metadata: Metadata = {
  title: "Jup edu — свой человек для учёбы",
  description,
  alternates: { canonical },
  openGraph: {
    title: "Jup edu — свой человек для учёбы",
    description,
    url: canonical,
    siteName: "Jup edu",
    type: "website",
    locale: "ru_RU",
  },
};

const benefits: [IconName, string, string][] = [
  [
    "search",
    "Сначала подход. Потом решение.",
    "Посмотрите опыт, язык, формат и цену. Сохраните анкеты, чтобы спокойно сравнить.",
  ],
  [
    "calendar",
    "Время, которое подходит вам.",
    "Выберите опубликованный урок или обсудите с преподавателем свои условия.",
  ],
  [
    "requests",
    "После знакомства не теряетесь.",
    "Переписка, материалы и домашняя работа остаются рядом с вашим занятием.",
  ],
];
const questions = [
  [
    "С чего начать, если не знаю, кого выбрать?",
    "Начните с цели, формата и бюджета. В каталоге можно изучить анкеты без регистрации. Если подходящего варианта пока нет, создайте аккаунт ученика и оставьте заявку с вашей задачей.",
  ],
  [
    "За что нужно платить?",
    "В бесплатном пилоте Jup edu не берёт комиссию платформы. Стоимость урока задаёт преподаватель. Онлайн-платежи не подключены: порядок оплаты согласуйте с преподавателем. При бронировании деньги не списываются.",
  ],
  [
    "Можно сначала задать вопрос?",
    "Да. После входа в аккаунт ученика можно открыть диалог из анкеты преподавателя: уточнить подход, уровень и удобное время до записи на урок.",
  ],
  [
    "Как проверяются преподаватели?",
    "Анкеты публикуются после ручной проверки предоставленных сведений. В профиле можно изучить образование, опыт и подход. Выбирайте преподавателя под свою задачу; при проблеме доступно обращение в модерацию.",
  ],
  [
    "Где проходит занятие?",
    "Онлайн или очно — это указано в анкете. Ссылку на встречу или адрес преподаватель согласует с вами. Материалы и переписка остаются в Jup edu.",
  ],
  [
    "Кто увидит мою учебную анкету?",
    "Она не публикуется в каталоге. Имя, цель и уровень доступны преподавателю после личной заявки или записи, а учебному центру — после записи на его занятие. Дата рождения остаётся личной.",
  ],
];

export default async function LandingPage() {
  const { t: tr } = await getServerLocale();

  return (
    <div className={st.landing}>
      <a className={st.skipLink} href="#landing-main">
        {tr("К содержимому")}
      </a>
      <header className={st.header}>
        <Link
          href="/landing"
          className={st.brand}
          aria-label={tr("Jup edu — о сервисе")}
        >
          <Brand />
        </Link>
        <nav className={st.desktopNav} aria-label={tr("О Jup edu")}>
          <a href="#how-it-works">{tr("Как это работает")}</a>
          <a href="#partners">{tr("Преподавателям и центрам")}</a>
          <a href="#questions">{tr("Вопросы")}</a>
        </nav>
        <div className={st.headerActions}>
          <LanguageSwitcher />
          <Link href="/login">{tr("Войти")}</Link>
          <Link href="/" className={st.headerCta}>
            {tr("Открыть каталог")}
          </Link>
          <LandingMenu />
        </div>
      </header>
      <main id="landing-main">
        <HeroFinder />
        <section className={st.pilotStrip} aria-label={tr("Условия пилота")}>
          <div>
            <Icon name="check" size={18} />
            <span>{tr("Ручная проверка анкет")}</span>
          </div>
          <div>
            <Icon name="calendar" size={18} />
            <span>{tr("Запись без списания денег")}</span>
          </div>
          <div>
            <span className={st.zero}>0%</span>
            <span>{tr("Комиссия платформы в пилоте")}</span>
          </div>
        </section>
        <section className={st.benefits} aria-labelledby="benefits-title">
          <div className={st.sectionIntro}>
            <p className={st.eyebrow}>{tr("Поиск, в котором есть смысл")}</p>
            <h2 id="benefits-title">
              {tr("Выберите. Договоритесь.")}
              <br />
              <span>{tr("Начните заниматься.")}</span>
            </h2>
          </div>
          <div className={st.benefitGrid}>
            {benefits.map(([icon, title, text]) => (
              <article key={title}>
                <span className={st.featureIcon}>
                  <Icon name={icon} size={25} />
                </span>
                <h3>{tr(title)}</h3>
                <p>{tr(text)}</p>
              </article>
            ))}
          </div>
        </section>
        <section
          className={st.journey}
          id="how-it-works"
          aria-labelledby="journey-title"
        >
          <div className={st.journeyCopy}>
            <p className={st.eyebrow}>{tr("Как устроены занятия")}</p>
            <h2 id="journey-title">
              {tr("Первый шаг — найти.")}
              <br />
              {tr("Дальше — ")}
              <span>{tr("учиться.")}</span>
            </h2>
            <p>
              {tr(
                "Вам не нужно собирать учёбу из разных переписок. У каждого занятия есть своё место в Jup edu.",
              )}
            </p>
            <ol className={st.journeySteps}>
              <li>
                <span>1</span>
                <div>
                  <h3>{tr("Выберите своего")}</h3>
                  <p>
                    {tr(
                      "Изучите подход и условия. Напишите, если остались вопросы.",
                    )}
                  </p>
                </div>
              </li>
              <li>
                <span>2</span>
                <div>
                  <h3>{tr("Договоритесь о первом уроке")}</h3>
                  <p>
                    {tr("Выберите свободное время или отправьте свою заявку.")}
                  </p>
                </div>
              </li>
              <li>
                <span>3</span>
                <div>
                  <h3>{tr("Продолжайте с того же места")}</h3>
                  <p>
                    {tr(
                      "Возвращайтесь к материалам, заданиям и переписке внутри занятия.",
                    )}
                  </p>
                </div>
              </li>
            </ol>
            <Link href="/guide" className={st.quietLink}>
              {tr("Посмотреть подробную инструкцию")}
            </Link>
          </div>
          <LessonPreview />
        </section>
        <PartnerPanel />
        <section className={st.telegramPanel} aria-labelledby="telegram-title">
          <div className={st.telegramIcon}>
            <Icon name="send" size={32} />
          </div>
          <div>
            <p className={st.eyebrow}>{tr("Рядом, когда нужно")}</p>
            <h2 id="telegram-title">
              {tr("Ваши занятия. Теперь в Telegram.")}
            </h2>
            <p>
              {tr(
                "Расписание, сообщения и напоминания — в привычном приложении.",
              )}
            </p>
          </div>
          <Link href="/telegram" className="primary">
            {tr("Открыть в Telegram")}
            <Icon name="arrowRight" size={18} />
          </Link>
        </section>
        <section
          className={st.faq}
          id="questions"
          aria-labelledby="questions-title"
        >
          <div>
            <p className={st.eyebrow}>{tr("Без лишних вопросов")}</p>
            <h2 id="questions-title">{tr("Вопросы перед первым уроком")}</h2>
            <p>{tr("Самое важное о выборе, оплате и ваших данных.")}</p>
          </div>
          <div className={st.questionList}>
            {questions.map(([question, answer]) => (
              <details key={question}>
                <summary>
                  {tr(question)}
                  <span aria-hidden="true" />
                </summary>
                <p>{tr(answer)}</p>
              </details>
            ))}
          </div>
        </section>
        <section className={st.finalCta} aria-labelledby="start-title">
          <p className={st.eyebrow}>{tr("Начать обучение")}</p>
          <h2 id="start-title">
            {tr("Выберите преподавателя")}
            <br />
            {tr("и время занятия.")}
          </h2>
          <p>
            {tr(
              "Посмотрите анкеты. Задайте вопрос. Найдите того, с кем хочется продолжать.",
            )}
          </p>
          <Link className="secondary" href="/">
            {tr("Найти преподавателя")}
          </Link>
          <small>{tr("Анкеты можно посмотреть без регистрации.")}</small>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

export async function generateMetadata() {
  const { locale } = await getServerLocale();
  return localizeMetadata(metadata, locale);
}
