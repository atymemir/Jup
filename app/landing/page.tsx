import type { Metadata } from "next";
import Link from "next/link";
import { Icon, type IconName } from "../ui/Icon";
import { SiteFooter } from "../ui/SiteFooter";
import { HeroFinder, LandingMenu, LessonPreview, PartnerPanel } from "./LandingExperience";
import st from "./landing.module.css";

const description = "Найдите преподавателя под вашу цель, язык и бюджет. Запись, переписка, материалы и домашняя работа — в одном findbuddy.";
export const metadata: Metadata = {
  title: "findbuddy — свой человек для учёбы",
  description,
  alternates: { canonical: "https://tryalga.app/findbuddy/landing" },
  openGraph: {
    title: "findbuddy — свой человек для учёбы",
    description,
    url: "https://tryalga.app/findbuddy/landing",
    siteName: "findbuddy",
    type: "website",
    locale: "ru_RU",
  },
};

const benefits: [IconName, string, string][] = [
  ["search", "Сначала подход. Потом решение.", "Посмотрите опыт, язык, формат и цену. Сохраните анкеты, чтобы спокойно сравнить."],
  ["calendar", "Время, которое подходит вам.", "Выберите опубликованный урок или обсудите с преподавателем свои условия."],
  ["requests", "После знакомства не теряетесь.", "Переписка, материалы и домашняя работа остаются рядом с вашим занятием."],
];
const questions = [
  ["С чего начать, если не знаю, кого выбрать?", "Начните с цели, формата и бюджета. В каталоге можно изучить анкеты без регистрации. Если подходящего варианта пока нет, создайте аккаунт ученика и оставьте заявку с вашей задачей."],
  ["За что нужно платить?", "В бесплатном пилоте findbuddy не берёт комиссию платформы. Стоимость урока задаёт преподаватель. Онлайн-платежи не подключены: порядок оплаты согласуйте с преподавателем. При бронировании деньги не списываются."],
  ["Можно сначала задать вопрос?", "Да. После входа в аккаунт ученика можно открыть диалог из анкеты преподавателя: уточнить подход, уровень и удобное время до записи на урок."],
  ["Как проверяются преподаватели?", "Анкеты публикуются после ручной проверки предоставленных сведений. В профиле можно изучить образование, опыт и подход. Выбирайте преподавателя под свою задачу; при проблеме доступно обращение в модерацию."],
  ["Где проходит занятие?", "Онлайн или очно — это указано в анкете. Ссылку на встречу или адрес преподаватель согласует с вами. Материалы и переписка остаются в findbuddy."],
  ["Кто увидит мою учебную анкету?", "Она не публикуется в каталоге. Имя, цель и уровень доступны преподавателю после личной заявки или записи, а учебному центру — после записи на его занятие. Дата рождения остаётся личной."],
];

export default function LandingPage() {
  return <div className={st.landing}>
    <a className={st.skipLink} href="#landing-main">К содержимому</a>
    <header className={st.header}>
      <Link href="/landing" className={st.brand} aria-label="findbuddy — о сервисе">findbuddy<span>.</span></Link>
      <nav className={st.desktopNav} aria-label="О findbuddy"><a href="#how-it-works">Как это работает</a><a href="#partners">Преподавателям и центрам</a><a href="#questions">Вопросы</a></nav>
      <div className={st.headerActions}><Link href="/login">Войти</Link><Link href="/" className={st.headerCta}>Открыть каталог</Link><LandingMenu /></div>
    </header>
    <main id="landing-main">
      <HeroFinder />
      <section className={st.pilotStrip} aria-label="Условия пилота"><div><Icon name="check" size={18} /><span>Ручная проверка анкет</span></div><div><Icon name="calendar" size={18} /><span>Запись без списания денег</span></div><div><span className={st.zero}>0%</span><span>Комиссия платформы в пилоте</span></div></section>
      <section className={st.benefits} aria-labelledby="benefits-title">
        <div className={st.sectionIntro}><p className={st.eyebrow}>Поиск, в котором есть смысл</p><h2 id="benefits-title">Понятный подход.<br /><span>Спокойный выбор преподавателя.</span></h2></div>
        <div className={st.benefitGrid}>{benefits.map(([icon, title, text]) => <article key={title}><span className={st.featureIcon}><Icon name={icon} size={25} /></span><h3>{title}</h3><p>{text}</p></article>)}</div>
      </section>
      <section className={st.journey} id="how-it-works" aria-labelledby="journey-title">
        <div className={st.journeyCopy}><p className={st.eyebrow}>От «не понимаю» до «получилось»</p><h2 id="journey-title">Первый шаг — найти.<br />Дальше — <span>учиться.</span></h2><p>Вам не нужно собирать учёбу из разных переписок. У каждого занятия есть своё место в findbuddy.</p>
          <ol className={st.journeySteps}><li><span>1</span><div><h3>Выберите своего</h3><p>Изучите подход и условия. Напишите, если остались вопросы.</p></div></li><li><span>2</span><div><h3>Договоритесь о первом уроке</h3><p>Выберите свободное время или отправьте свою заявку.</p></div></li><li><span>3</span><div><h3>Продолжайте с того же места</h3><p>Возвращайтесь к материалам, заданиям и переписке внутри занятия.</p></div></li></ol>
          <Link href="/guide" className={st.quietLink}>Посмотреть подробную инструкцию</Link>
        </div>
        <LessonPreview />
      </section>
      <PartnerPanel />
      <section className={st.faq} id="questions" aria-labelledby="questions-title"><div><p className={st.eyebrow}>Без лишних вопросов</p><h2 id="questions-title">Сначала понятно.<br />Потом — первый урок.</h2><p>Самое важное о выборе, оплате и ваших данных.</p></div><div className={st.questionList}>{questions.map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true" /></summary><p>{answer}</p></details>)}</div></section>
      <section className={st.finalCta} aria-labelledby="start-title"><p className={st.eyebrow}>Начнём с одного знакомства</p><h2 id="start-title">Ваш человек для учёбы<br />может быть <em>здесь.</em></h2><p>Посмотрите анкеты. Задайте вопрос. Найдите того, с кем хочется продолжать.</p><Link className="secondary" href="/">Найти преподавателя</Link><small>Анкеты можно посмотреть без регистрации.</small></section>
    </main>
    <SiteFooter />
  </div>;
}
