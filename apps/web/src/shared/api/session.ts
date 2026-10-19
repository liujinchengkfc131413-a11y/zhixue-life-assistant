let csrfTokenPromise: Promise<string> | undefined;

export const getCsrfToken = async (): Promise<string> => {
  csrfTokenPromise ??= fetch('/api/v1/session', { credentials: 'same-origin' })
    .then(async (response) => {
      if (!response.ok) throw new Error('本地会话不可用，请通过桌面快捷方式重新打开应用。');
      const body = (await response.json()) as { data: { csrfToken: string } };
      return body.data.csrfToken;
    })
    .catch((error: unknown) => {
      csrfTokenPromise = undefined;
      throw error;
    });
  return csrfTokenPromise;
};
