/**
 * FormField — labelled input/textarea with optional error and help text.
 *
 * Props:
 *   label            string   visible label text
 *   required         bool     shows red asterisk
 *   error            string   validation error message
 *   help             string   subtle hint below the field
 *   as               'input' | 'textarea'   default: 'input'
 *   wrapperClassName string   extra CSS classes applied to the outer wrapper div
 *   ...rest          passed directly to the input/textarea element
 */
export default function FormField({
  label,
  required,
  error,
  help,
  as: Tag = 'input',
  rightElement,
  wrapperClassName,
  className,   // consumed here — NOT forwarded to inner element
  ...rest
}) {
  // Prevent duplicate asterisks if label string already ends with * or if required is passed
  const hasAsteriskInLabel = typeof label === 'string' && /\*\s*$/.test(label);
  const cleanLabel = typeof label === 'string' ? label.replace(/\s*\*+\s*$/, '') : label;
  const isRequired = Boolean(required || hasAsteriskInLabel);

  return (
    <div className={`form-field${wrapperClassName ? ` ${wrapperClassName}` : ''}`}>
      {cleanLabel && (
        <label className="form-label" htmlFor={rest.id}>
          {cleanLabel}
          {isRequired && <span className="required"> *</span>}
        </label>
      )}
      {rightElement ? (
        <div style={{ position: 'relative' }}>
          <Tag
            className={`${Tag === 'textarea' ? 'form-textarea' : 'form-input'}${error ? ' error' : ''}`}
            style={{ paddingRight: '2.5rem' }}
            onWheel={(e) => {
              if (rest.type === 'number') e.target.blur();
              if (rest.onWheel) rest.onWheel(e);
            }}
            {...rest}
          />
          {rightElement}
        </div>
      ) : (
        <Tag
          className={`${Tag === 'textarea' ? 'form-textarea' : 'form-input'}${error ? ' error' : ''}`}
          onWheel={(e) => {
            if (rest.type === 'number') e.target.blur();
            if (rest.onWheel) rest.onWheel(e);
          }}
          {...rest}
        />
      )}
      {error && <p className="form-error">{error}</p>}
      {help && !error && <p className="form-help">{help}</p>}
    </div>
  );
}
