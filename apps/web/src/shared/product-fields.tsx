import { useId, useRef, useState, type InputHTMLAttributes } from 'react';

type LocalDateInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'inputMode' | 'pattern'
>;

/** 中文产品界面的本地日期字段；用中文提示表达输入格式，提交值仍保持标准本地日期格式。 */
export const LocalDateInput = ({
  placeholder = '年-月-日，例如 2026-08-28',
  ...props
}: LocalDateInputProps) => (
  <input
    {...props}
    type="text"
    inputMode="numeric"
    pattern="\d{4}-\d{2}-\d{2}"
    placeholder={placeholder}
  />
);

type ProductField = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

let validationId = 0;

const isProductField = (target: EventTarget): target is ProductField =>
  target instanceof HTMLInputElement ||
  target instanceof HTMLSelectElement ||
  target instanceof HTMLTextAreaElement;

const fieldName = (field: ProductField): string => {
  const ariaLabel = field.getAttribute('aria-label')?.trim();
  if (ariaLabel) return ariaLabel;

  const label = field.labels?.[0];
  const directLabel = Array.from(label?.childNodes ?? [])
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent?.trim() ?? '')
    .find(Boolean);
  if (directLabel) return directLabel;

  const placeholder = field
    .getAttribute('placeholder')
    ?.split(/[，,：:]/u)[0]
    ?.trim();
  return placeholder ?? '此字段';
};

const validationMessage = (field: ProductField): string => {
  const name = fieldName(field);
  const spacing = /^[A-Za-z]/u.test(name) ? ' ' : '';
  if (field.validity.valueMissing) {
    if (field instanceof HTMLSelectElement) return `请选择${name}`;
    if (field instanceof HTMLInputElement && ['checkbox', 'radio'].includes(field.type)) {
      return `请确认${name}`;
    }
    return `请输入${spacing}${name}`;
  }
  if (field.validity.typeMismatch) return `请输入有效的${spacing}${name}`;
  if (field.validity.patternMismatch) return `请按提示格式填写${name}`;
  if (field.validity.rangeUnderflow) return `${name}不能小于 ${field.getAttribute('min') ?? ''}`;
  if (field.validity.rangeOverflow) return `${name}不能大于 ${field.getAttribute('max') ?? ''}`;
  if (field.validity.stepMismatch || field.validity.badInput)
    return `请输入有效的${spacing}${name}`;
  return `请检查${name}`;
};

export const clearProductFieldError = (target: EventTarget): void => {
  if (!isProductField(target)) return;
  const errorId = target.dataset.validationErrorId;
  if (errorId) document.getElementById(errorId)?.remove();
  delete target.dataset.validationErrorId;
  target.removeAttribute('aria-invalid');
  target.removeAttribute('aria-errormessage');
};

export const showProductFieldError = (target: EventTarget): void => {
  if (!isProductField(target)) return;
  clearProductFieldError(target);

  validationId += 1;
  const errorId = `field-validation-${String(validationId)}`;
  const error = document.createElement('span');
  error.id = errorId;
  error.className = 'field-validation-error';
  error.setAttribute('role', 'alert');
  error.textContent = validationMessage(target);

  target.dataset.validationErrorId = errorId;
  target.setAttribute('aria-invalid', 'true');
  target.setAttribute('aria-errormessage', errorId);
  target.insertAdjacentElement('afterend', error);

  requestAnimationFrame(() => {
    const firstInvalid = document.querySelector<ProductField>('[aria-invalid="true"]');
    firstInvalid?.focus({ preventScroll: true });
    firstInvalid?.scrollIntoView({ block: 'nearest' });
  });
};

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${String(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const ProductFilePicker = ({
  label,
  onSelect,
  disabled = false,
  accept,
}: {
  readonly label: string;
  readonly onSelect: (file: File) => void;
  readonly disabled?: boolean;
  readonly accept?: string;
}) => {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const clearSelection = () => {
    setSelectedFile(null);
    if (inputRef.current !== null) inputRef.current.value = '';
  };

  return (
    <div className="product-file-picker">
      <span className="product-file-picker__label">{label}</span>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        disabled={disabled}
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file === undefined) return;
          setSelectedFile(file);
          onSelect(file);
        }}
      />
      <div className="product-file-picker__control">
        <button
          className="button button--small"
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          选择文件
        </button>
        {selectedFile === null ? (
          <span className="field-hint">未选择文件</span>
        ) : (
          <span className="product-file-picker__selection">
            <span>
              <strong>{selectedFile.name}</strong>
              <small>{formatFileSize(selectedFile.size)}</small>
            </span>
            <button className="text-button" type="button" onClick={clearSelection}>
              移除
            </button>
          </span>
        )}
      </div>
    </div>
  );
};
