"use client";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { Icon } from "../ui/Icon";
import { ChoiceCard } from "../ui/SetupControls";
import { money } from "../lib/findbuddy";
import st from "./landing.module.css";

export function LandingMenu() {
  return <details className={st.mobileMenu}><summary>Меню</summary><nav aria-label="Навигация по лендингу" onClick={(event) => { if ((event.target as HTMLElement).closest("a")) event.currentTarget.closest("details")?.removeAttribute("open"); }}><a href="#how-it-works">Как это работает</a><a href="#partners">Преподавателям и центрам</a><a href="#questions">Вопросы</a><Link href="/">Открыть каталог</Link></nav></details>;
}

export function HeroFinder() {
  const [exam, setExam] = useState("");
  const [format, setFormat] = useState("");
  const [budget, setBudget] = useState(100000);
  const params = new URLSearchParams();
  if (exam) params.set("exam", exam);
  if (format) params.set("city", "Онлайн");
  if (budget < 100000) params.set("budget", String(budget));
  const catalog = "/" + (params.size ? "?" + params : "") + "#tutors";
  return <section className={st.hero} aria-labelledby="hero-title">
    <div className={st.heroCopy}><p className={st.eyebrow}><span className={st.eyebrowLine} />Jup edu · Учиться в паре</p><h1 id="hero-title">Найдите того,<br /><em>с кем понятно.</em></h1><p className={st.heroText}>Преподавателя, с которым можно задавать вопросы, разбирать сложное и двигаться к своей цели.</p><div className={st.heroActions}><Link href={catalog} className="primary">Найти преподавателя</Link><a href="#how-it-works">Как это работает</a></div><p className={st.heroNote}><Icon name="check" size={16} />Посмотрите анкеты без регистрации</p><p className={st.heroContext}>«Жұп» — пара. Ученик и преподаватель, с которыми всё складывается.</p></div>
    <div className={st.finder}>
      <div className={st.finderHeading}><span className={st.featureIcon}><Icon name="filters" size={23} /></span><div><h2>Начнём с вашей цели</h2><p>Пара деталей — и можно выбирать.</p></div></div>
      <fieldset className={st.goalChoices}><legend className="srOnly">Что хотите изучать?</legend>
        {[["SAT", "Подготовиться к SAT", "Математика, чтение и письмо"], ["ЕНТ", "Подготовиться к ЕНТ", "Разобраться в темах перед экзаменом"], ["Школьная программа", "Подтянуть учёбу", "Понять предмет и закрыть пробелы"]].map(([value, title, description]) => <ChoiceCard key={value} name="landing-exam" value={value} selected={exam === value} title={title} description={description} onChange={setExam} />)}
      </fieldset>
      <div className={st.finderOptions}><fieldset><legend>Как удобнее?</legend><div className={st.segment}><button type="button" aria-pressed={!format} onClick={() => setFormat("")}>Любой формат</button><button type="button" aria-pressed={!!format} onClick={() => setFormat("online")}>Онлайн</button></div></fieldset>
      <label className={st.budgetLabel}>Бюджет за урок · 60 минут<select aria-label="Бюджет за урок · 60 минут" value={budget} onChange={(e) => setBudget(Number(e.target.value))}><option value={100000}>Пока не определился</option><option value={0}>Бесплатные занятия</option>{[3000,5000,7000,10000].map((value) => <option key={value} value={value}>До {money(value)}</option>)}</select></label></div>
      <p className={st.finderNote}>Выбранные условия перейдут в каталог.</p><div className={st.finderFoot}><Link href={catalog}>Посмотреть анкеты</Link>{params.size > 0 && <button type="button" onClick={() => { setExam(""); setFormat(""); setBudget(100000); }}>Сбросить</button>}</div>
    </div>
  </section>;
}

const previewTabs = ["Занятие", "Материалы", "Переписка"];
export function LessonPreview() {
  const [tab, setTab] = useState(0);
  const id = useId();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  function navigate(event: KeyboardEvent, index: number) {
    const next = event.key === "ArrowRight" ? (index + 1) % 3 : event.key === "ArrowLeft" ? (index + 2) % 3 : event.key === "Home" ? 0 : event.key === "End" ? 2 : null;
    if (next == null) return;
    event.preventDefault(); setTab(next); buttons.current[next]?.focus();
  }
  return <div className={st.productPreview}>
    <div className={st.previewTop}><span className={st.previewMark}><Icon name="calendar" size={19} /></span><span>Всё вокруг вашего урока</span><small>Пример интерфейса</small></div>
    <div className={st.previewTabs} role="tablist" aria-label="Возможности занятия">{previewTabs.map((name, index) => <button key={name} id={`${id}-tab-${index}`} ref={(node) => { buttons.current[index] = node; }} type="button" role="tab" aria-selected={tab === index} aria-controls={`${id}-panel`} tabIndex={tab === index ? 0 : -1} onClick={() => setTab(index)} onKeyDown={(event) => navigate(event, index)}>{name}</button>)}</div>
    <div className={st.previewPanel} id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${tab}`} tabIndex={0}>
      {tab === 0 && <><span className={st.previewEyebrow}>Математика · индивидуально</span><h3>Квадратные уравнения.<br />Спокойно, по шагам.</h3><p className={st.previewDescription}>Одна запись — всё, что нужно для первого урока.</p><dl className={st.lessonFacts}><div><dt><Icon name="clock" size={17} />Длительность</dt><dd>60 минут</dd></div><div><dt><Icon name="calendar" size={17} />Дата и время</dt><dd>В вашей записи</dd></div></dl><div className={st.previewReminder}><Icon name="check" size={19} /><p>Место встречи или ссылка, материалы и чат остаются рядом с занятием.</p></div></>}
      {tab === 1 && <><span className={st.previewEyebrow}>До урока и после</span><h3>Разобрали тему?<br />Есть к чему вернуться.</h3><div className={st.materialRow}><span><Icon name="teacher" size={24} /></span><div><strong>План занятия</strong><p>Вспомнить формулу, разобрать пример, попробовать самостоятельно.</p></div></div><div className={st.materialRow}><span><Icon name="bookmark" size={24} /></span><div><strong>Домашняя работа</strong><p>Задание, ваш ответ и обратная связь преподавателя — в комнате урока.</p></div></div></>}
      {tab === 2 && <><span className={st.previewEyebrow}>Не терять контекст</span><h3>Можно просто<br />задать вопрос.</h3><div className={st.exampleChat}><p>Можно на первом уроке разобрать задачу, которая у меня не получается?</p><p>Да, пришлите условие. Начнём с того, на каком шаге стало сложно.</p></div><small className={st.chatCaption}>Пример переписки. Ваш диалог виден его участникам.</small></>}
    </div>
    <div className={st.previewCaption}><Icon name="bookmark" size={16} /><span>Иллюстрация возможностей, а не реальное предложение урока.</span></div>
  </div>;
}

export function PartnerPanel() {
  const [business, setBusiness] = useState(false);
  return <section className={st.partners} id="partners" aria-labelledby="partners-title">
    <div><p className={st.eyebrow}>По другую сторону урока</p><h2 id="partners-title">Вы помогаете учиться.<br /><span>Мы помогаем встретиться.</span></h2><p>Jup edu объединяет тех, кто хочет разобраться, и тех, кто умеет объяснять.</p></div>
    <div className={st.partnerDetails}><div className={st.partnerTabs} role="group" aria-label="Выберите свою роль"><button type="button" aria-pressed={!business} onClick={() => setBusiness(false)}>Я преподаватель</button><button type="button" aria-pressed={business} onClick={() => setBusiness(true)}>У меня центр</button></div><h3>{business ? "Команда. Направления. Одно расписание." : "Ваш подход заслуживает своей анкеты."}</h3><p>{business ? "Создайте страницу центра, пригласите преподавателей и ведите направления и записи в одном кабинете." : "Расскажите о своём опыте, добавьте направления и опубликуйте удобное время. Ученики смогут познакомиться с вами до урока."}</p><ul>{(business ? ["Своя команда с личными аккаунтами", "Направления и расписание центра", "Обращения учеников в одном месте"] : ["Образование, опыт и подход в профиле", "Индивидуальные уроки и мини-группы", "Материалы и работы рядом с занятием"]).map((text) => <li key={text}><Icon name="check" size={17} />{text}</li>)}</ul><Link className="primary" href={"/login?mode=signup&role=" + (business ? "business" : "teacher")}>{business ? "Создать аккаунт центра" : "Создать аккаунт преподавателя"}</Link><Link className={st.quietLink} href={business ? "/for-centers" : "/teach"}>Подробнее об условиях</Link><small>Анкеты и центры публикуются после ручной проверки.</small></div>
  </section>;
}
