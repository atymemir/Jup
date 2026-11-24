"use client";
import { useId, useRef, useState } from "react";
import { editText } from "../lib/authoring";
import { FormattedText } from "../ui/FormattedText";
export function TextEditor({
  label,
  name,
  value,
  onChange,
  defaultValue = "",
  maxLength = 1500,
  minLength,
  required = false,
  disabled = false,
  rows = 5,
  placeholder,
}: {
  label: string;
  name: string;
  value?: string;
  onChange?: (value: string) => void;
  defaultValue?: string;
  maxLength?: number;
  minLength?: number;
  required?: boolean;
  disabled?: boolean;
  rows?: number;
  placeholder?: string;
}) {
  const [internal, setInternal] = useState(defaultValue);
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState("");
  const text = value ?? internal;
  const id = useId();
  const textarea = useRef<HTMLTextAreaElement>(null);
  const undo = useRef<string[]>([]);
  function update(next: string) {
    if (next.length > maxLength) {
      setError(`Лимит — ${maxLength} символов.`);
      return;
    }
    undo.current.push(text);
    if (undo.current.length > 30) undo.current.shift();
    (onChange ?? setInternal)(next);
    setError("");
  }
  function format(action: "bold" | "bullet" | "number") {
    const field = textarea.current;
    if (!field || disabled) return;
    const next = editText(
      text,
      field.selectionStart,
      field.selectionEnd,
      action,
    );
    update(next.value);
    requestAnimationFrame(() => {
      field.focus({ preventScroll: true });
      field.setSelectionRange(next.start, next.end);
    });
  }
  return (
    <div className="textEditor">
      <label htmlFor={id}>{label}</label>
      <div
        className="textEditorToolbar"
        role="group"
        aria-label={`Редактор: ${label}`}
      >
        <button
          type="button"
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => format("bold")}
          aria-label="Полужирный"
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => format("bullet")}
        >
          • Список
        </button>
        <button
          type="button"
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => format("number")}
        >
          1. Шаги
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            const previous = undo.current.pop();
            if (previous !== undefined) (onChange ?? setInternal)(previous);
          }}
        >
          Отменить
        </button>
        <button
          type="button"
          disabled={disabled}
          aria-pressed={preview}
          onClick={() => setPreview(!preview)}
        >
          Предпросмотр
        </button>
      </div>
      <textarea
        ref={textarea}
        id={id}
        name={name}
        value={text}
        onChange={(e) => update(e.target.value)}
        required={required}
        minLength={minLength}
        maxLength={maxLength}
        disabled={disabled}
        rows={rows}
        placeholder={placeholder}
        aria-describedby={`${id}-count`}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
            e.preventDefault();
            format("bold");
          }
        }}
      />
      <div className="textEditorFoot">
        <span id={`${id}-count`}>
          {text.length} / {maxLength}
        </span>
        {error && <span role="alert">{error}</span>}
      </div>
      {preview && (
        <div className="textEditorPreview">
          <FormattedText value={text || "Ваш текст появится здесь."} />
        </div>
      )}
    </div>
  );
}
