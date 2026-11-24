"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocale } from "../i18n/LocaleProvider";
import { Icon, type IconName } from "./Icon";
import st from "./workspace-search.module.css";
export type WorkspaceLink = { href: string; label: string; icon: IconName };
export function WorkspaceSearch({
  items,
  active = false,
}: {
  items: WorkspaceLink[];
  active?: boolean;
}) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const focusSearch = useRef(true);
  const results = useRef<(HTMLAnchorElement | null)[]>([]);
  const normalize = (value: string) =>
    value
      .toLocaleLowerCase()
      .normalize("NFKD")
      .replace(/\p{Diacritic}/gu, "");
  const matches = items.filter((item) =>
    normalize(t(item.label) + " " + item.label).includes(
      normalize(query.trim()),
    ),
  );
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        if (document.querySelector("dialog[open]") && !dialog.current?.open) {
          event.preventDefault();
          return;
        }
        event.preventDefault();
        focusSearch.current = true;
        setOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    const element = dialog.current;
    if (open) {
      if (!element?.open) element?.showModal();
      if (focusSearch.current) input.current?.focus();
    } else element?.close();
  }, [open]);
  function launch(search = true) {
    focusSearch.current = search;
    setQuery("");
    setSelected(0);
    setOpen(true);
  }
  return (
    <>
      <button
        type="button"
        className={st.trigger}
        onClick={() => launch()}
        aria-haspopup="dialog"
      >
        <Icon name="search" size={17} />
        <span>{t("Быстрый переход")}</span>
        <kbd>⌘ K</kbd>
      </button>
      <button
        type="button"
        className={st.mobileTrigger}
        data-active={active}
        aria-expanded={open}
        onClick={() => launch(false)}
        aria-haspopup="dialog"
      >
        <Icon name="menu" size={21} />
        <span>{t("Все разделы")}</span>
      </button>
      <dialog
        ref={dialog}
        className={st.dialog}
        aria-labelledby="workspace-search-title"
        onCancel={() => setOpen(false)}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom
          )
            setOpen(false);
        }}
      >
        <header>
          <h2 id="workspace-search-title">{t("Быстрый переход")}</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={t("Закрыть")}
          >
            <Icon name="close" size={20} />
          </button>
        </header>
        <div className={st.input}>
          <Icon name="search" />
          <input
            ref={input}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelected(0);
            }}
            placeholder={t("Найти раздел…")}
            aria-label={t("Найти раздел…")}
            aria-controls="workspace-search-results"
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                const next =
                  (selected +
                    (event.key === "ArrowDown" ? 1 : -1) +
                    matches.length) %
                  (matches.length || 1);
                setSelected(next);
                results.current[next]?.scrollIntoView({ block: "nearest" });
              }
              if (event.key === "Enter" && matches[selected]) {
                event.preventDefault();
                results.current[selected]?.click();
              }
            }}
          />
          <kbd>esc</kbd>
        </div>
        <nav
          id="workspace-search-results"
          className={st.results}
          aria-label={t("Разделы кабинета")}
        >
          {matches.map((item, index) => (
            <Link
              ref={(node) => {
                results.current[index] = node;
              }}
              key={item.href}
              href={item.href}
              prefetch={false}
              className={selected === index ? st.selected : undefined}
              onPointerMove={() => setSelected(index)}
              onClick={(event) => {
                if (
                  event.metaKey ||
                  event.ctrlKey ||
                  event.shiftKey ||
                  event.altKey
                )
                  return;
                if (item.href.startsWith("#")) {
                  event.preventDefault();
                  window.location.hash = item.href;
                }
                setOpen(false);
              }}
            >
              <span>
                <Icon name={item.icon} size={20} />
              </span>
              {t(item.label)}
              <Icon name="arrowRight" size={17} />
            </Link>
          ))}
          {!matches.length && (
            <p className={st.empty} role="status">
              {t("Раздел не найден. Попробуйте другое название.")}
            </p>
          )}
        </nav>
        <footer>
          <span>{t("Навигация с клавиатуры")}</span>
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd>
            <kbd>↵</kbd>
          </span>
        </footer>
      </dialog>
    </>
  );
}
