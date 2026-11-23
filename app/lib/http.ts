// Never retry mutations automatically: a timed-out booking may have been committed.
export async function fetchJson<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      signal: options.signal ?? AbortSignal.timeout(20000),
    });
  } catch {
    throw new Error(
      options.method === "POST"
        ? "Не удалось получить подтверждение. Проверьте результат в кабинете перед повторной отправкой."
        : "Нет ответа от сервера. Проверьте соединение и повторите загрузку.",
    );
  }
  let payload;
  try {
    payload = await response.json();
  } catch {
    if (options.method === "POST" && response.ok)
      throw new Error(
        "Не удалось прочитать подтверждение. Проверьте результат в кабинете перед повторной отправкой.",
      );
    throw new Error(
      response.status === 413
        ? "Слишком большой файл или сообщение. Уменьшите размер и попробуйте снова."
        : "Сервис временно недоступен. Повторите попытку позже.",
    );
  }
  if (!response.ok) {
    const message =
      payload && typeof payload.error === "string" ? payload.error : "";
    throw new Error(
      message ||
        (response.status === 401
          ? "Войдите в аккаунт, чтобы продолжить."
          : "Не удалось загрузить данные. Попробуйте ещё раз."),
    );
  }
  return payload as T;
}
