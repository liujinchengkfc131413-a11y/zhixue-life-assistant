const TODAY_AI_DRAFT_KEY = 'life-assistant:today-ai-draft';

export const saveTodayAiDraft = (value: string): void => {
  try {
    window.sessionStorage.setItem(TODAY_AI_DRAFT_KEY, value);
  } catch {
    // 会话存储不可用时仍允许用户进入 AI 助手页；不把内容写入 URL 或持久化存储。
  }
};

export const consumeTodayAiDraft = (): string => {
  try {
    const value = window.sessionStorage.getItem(TODAY_AI_DRAFT_KEY) ?? '';
    window.sessionStorage.removeItem(TODAY_AI_DRAFT_KEY);
    return value;
  } catch {
    return '';
  }
};

export const clearTodayAiDraft = (): void => {
  try {
    window.sessionStorage.removeItem(TODAY_AI_DRAFT_KEY);
  } catch {
    // 清理失败不影响已进入服务端会话的消息。
  }
};
