import { useState } from 'react';

import { useTags } from '../settings/api.js';
import { useAddEntityTag, useEntityTags, useRemoveEntityTag } from './api.js';

export const EntityTagsEditor = ({
  entityId,
  version,
}: {
  readonly entityId: string;
  readonly version: number;
}) => {
  const tags = useTags();
  const assigned = useEntityTags(entityId);
  const addTag = useAddEntityTag();
  const removeTag = useRemoveEntityTag();
  const [tagId, setTagId] = useState('');
  const assignedIds = new Set(assigned.data?.map((tag) => tag.id) ?? []);
  const available = (tags.data ?? []).filter((tag) => !assignedIds.has(tag.id));

  return (
    <section aria-label="对象标签">
      <h3>标签</h3>
      {(assigned.data?.length ?? 0) === 0 ? (
        <p className="field-hint">尚未关联标签。</p>
      ) : (
        <ul>
          {assigned.data?.map((tag) => (
            <li key={tag.id}>
              {tag.name}
              <button
                className="button button--small button--danger"
                type="button"
                disabled={removeTag.isPending}
                onClick={() => {
                  removeTag.mutate({ entityId, version, tagId: tag.id });
                }}
              >
                移除标签
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="inline-create">
        <select
          aria-label="选择标签"
          value={tagId}
          onChange={(event) => {
            setTagId(event.target.value);
          }}
        >
          <option value="">选择标签</option>
          {available.map((tag) => (
            <option key={tag.id} value={tag.id}>
              {tag.name}
            </option>
          ))}
        </select>
        <button
          className="button button--small"
          type="button"
          disabled={tagId === '' || addTag.isPending}
          onClick={() => {
            if (tagId === '') return;
            addTag.mutate(
              { entityId, version, tagId },
              {
                onSuccess: () => {
                  setTagId('');
                },
              },
            );
          }}
        >
          添加标签
        </button>
      </div>
      {addTag.isError || removeTag.isError ? (
        <p className="form-error">标签更新失败。数据版本可能已变化，请重新打开详情后再试。</p>
      ) : null}
    </section>
  );
};
