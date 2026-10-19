import { useEffect, useMemo, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

import { useCreateNote, useDeleteDraft, useDraft, useSaveDraft, useUpdateNote } from './api.js';
import { formatDateTime } from '../../shared/format.js';

interface WorkNote {
  id: string;
  version: number;
  title: string;
  editorMode: 'RICH_TEXT' | 'MARKDOWN';
  markdownContent: string | null;
  richContent?: unknown;
  plainText: string;
}
interface NoteComposerProps {
  entityId: string;
  categoryId: string;
  role: 'SCRIPT' | 'TECHNICAL' | 'KNOWLEDGE';
  note?: WorkNote | undefined;
  onDone: () => void;
}
interface NoteDraftContent {
  title: string;
  mode: 'RICH_TEXT' | 'MARKDOWN';
  markdown: string;
  richContent: unknown;
}

const asDraft = (value: unknown): NoteDraftContent | undefined => {
  if (value === null || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  if (
    typeof record.title !== 'string' ||
    (record.mode !== 'RICH_TEXT' && record.mode !== 'MARKDOWN') ||
    typeof record.markdown !== 'string'
  )
    return undefined;
  return {
    title: record.title,
    mode: record.mode,
    markdown: record.markdown,
    richContent: record.richContent ?? null,
  };
};

export const NoteComposer = (props: NoteComposerProps) => {
  const draftKey = `work-note:${props.entityId}:${props.note?.id ?? 'new'}`;
  const draft = useDraft(draftKey);
  const restored = asDraft(draft.data?.content);
  if (draft.isLoading) return <p className="field-hint">正在检查未保存草稿…</p>;
  return (
    <ReadyNoteComposer
      {...props}
      draftKey={draftKey}
      restored={restored}
      restoredAt={draft.data?.updatedAt}
    />
  );
};

const ReadyNoteComposer = ({
  entityId,
  categoryId,
  role,
  note,
  onDone,
  draftKey,
  restored,
  restoredAt,
}: NoteComposerProps & {
  draftKey: string;
  restored: NoteDraftContent | undefined;
  restoredAt: string | undefined;
}) => {
  const initial = useMemo<NoteDraftContent>(
    () =>
      restored ?? {
        title: note?.title ?? '',
        mode: note?.editorMode ?? 'MARKDOWN',
        markdown: note?.markdownContent ?? note?.plainText ?? '',
        richContent: note?.richContent ?? { type: 'doc', content: [{ type: 'paragraph' }] },
      },
    [note, restored],
  );
  const [title, setTitle] = useState(initial.title);
  const [mode, setMode] = useState(initial.mode);
  const [markdown, setMarkdown] = useState(initial.markdown);
  const [richContent, setRichContent] = useState(initial.richContent);
  const [showPreview, setShowPreview] = useState(false);
  const [conversionWarning, setConversionWarning] = useState('');
  const { mutate: saveDraft } = useSaveDraft(),
    deleteDraft = useDeleteDraft();
  const createNote = useCreateNote(),
    updateNote = useUpdateNote();
  const editor = useEditor({
    extensions: [StarterKit],
    content:
      typeof initial.richContent === 'object' && initial.richContent !== null
        ? initial.richContent
        : '',
    onUpdate: ({ editor: value }) => {
      setRichContent(value.getJSON());
    },
  });

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      saveDraft({ draftKey, entityId, content: { title, mode, markdown, richContent } });
    }, 600);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [draftKey, entityId, markdown, mode, richContent, saveDraft, title]);

  const switchMode = (target: 'RICH_TEXT' | 'MARKDOWN') => {
    if (target === mode) return;
    if (target === 'RICH_TEXT') {
      const hasComplexMarkdown = /(^|\n)(```|\|.+\|)/.test(markdown);
      setConversionWarning(
        hasComplexMarkdown ? '检测到代码块或表格，请先核对预览；原 Markdown 草稿仍会保留。' : '',
      );
      editor.commands.setContent(
        markdown.split('\n').map((line) => ({
          type: 'paragraph',
          content: line === '' ? [] : [{ type: 'text', text: line }],
        })),
      );
    } else {
      const plain = editor.getText({ blockSeparator: '\n' });
      setMarkdown(plain);
      setConversionWarning('富文本样式将转为纯 Markdown 文本，请在预览后保存。');
    }
    setShowPreview(true);
    setMode(target);
  };
  const submit = () => {
    const plainText = mode === 'MARKDOWN' ? markdown : editor.getText({ blockSeparator: '\n' });
    const finish = () => {
      deleteDraft.mutate(draftKey);
      onDone();
    };
    if (note === undefined) {
      createNote.mutate(
        {
          entityId,
          categoryId,
          title,
          markdownContent: plainText,
          editorMode: mode,
          richContent: mode === 'RICH_TEXT' ? richContent : undefined,
          role,
        },
        { onSuccess: finish },
      );
    } else {
      updateNote.mutate(
        {
          entityId,
          noteId: note.id,
          version: note.version,
          title,
          editorMode: mode,
          markdownContent: mode === 'MARKDOWN' ? markdown : plainText,
          richContent: mode === 'RICH_TEXT' ? richContent : null,
          role,
        },
        { onSuccess: finish },
      );
    }
  };

  return (
    <div className="note-composer">
      {restored !== undefined && (
        <p className="draft-restored">
          已恢复 {restoredAt === undefined ? '' : formatDateTime(restoredAt)} 的未保存草稿
        </p>
      )}
      <input
        aria-label="笔记标题"
        placeholder="笔记标题"
        value={title}
        onChange={(event) => {
          setTitle(event.target.value);
        }}
      />
      <div className="note-toolbar" aria-label="编辑器模式">
        <button
          className="button button--small"
          data-selected={mode === 'MARKDOWN'}
          onClick={() => {
            switchMode('MARKDOWN');
          }}
          type="button"
        >
          Markdown
        </button>
        <button
          className="button button--small"
          data-selected={mode === 'RICH_TEXT'}
          onClick={() => {
            switchMode('RICH_TEXT');
          }}
          type="button"
        >
          富文本
        </button>
        {mode === 'RICH_TEXT' && (
          <>
            <button
              className="text-button"
              onClick={() => {
                editor.chain().focus().toggleBold().run();
              }}
              type="button"
            >
              加粗
            </button>
            <button
              className="text-button"
              onClick={() => {
                editor.chain().focus().toggleBulletList().run();
              }}
              type="button"
            >
              列表
            </button>
          </>
        )}
        <button
          className="text-button"
          onClick={() => {
            setShowPreview((value) => !value);
          }}
          type="button"
        >
          {showPreview ? '返回编辑' : '转换预览'}
        </button>
      </div>
      {conversionWarning !== '' && <p className="conversion-warning">{conversionWarning}</p>}
      {showPreview ? (
        <div className="note-preview" aria-label="转换预览">
          {mode === 'MARKDOWN' ? <pre>{markdown}</pre> : <EditorContent editor={editor} />}
        </div>
      ) : mode === 'MARKDOWN' ? (
        <textarea
          aria-label="Markdown 正文"
          placeholder="支持 Markdown 的正文"
          value={markdown}
          onChange={(event) => {
            setMarkdown(event.target.value);
          }}
        />
      ) : (
        <EditorContent className="rich-text-editor" editor={editor} />
      )}
      <div className="form-actions">
        <button
          className="button button--primary"
          disabled={title.trim() === '' || createNote.isPending || updateNote.isPending}
          onClick={submit}
          type="button"
        >
          {note === undefined ? '保存笔记' : '保存修改'}
        </button>
        <button className="button" onClick={onDone} type="button">
          取消
        </button>
        <span className="draft-status">自动保存草稿</span>
      </div>
    </div>
  );
};
