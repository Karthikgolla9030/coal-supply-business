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
  return (
    <div className={`form-field${wrapperClassName ? ` ${wrapperClassName}` : ''}`}>
      {label && (
        <label className="form-label">
          {label}
          {required && <span className="required">*</span>}
        </label>
      )}
      {rightElement ? (
        <div style={{ position: 'relative' }}>
          <Tag
            className={`${Tag === 'textarea' ? 'form-textarea' : 'form-input'}${error ? ' error' : ''}`}
            style={{ paddingRight: '2.5rem' }}
            {...rest}
          />
          {rightElement}
        </div>
      ) : (
        <Tag
          className={`${Tag === 'textarea' ? 'form-textarea' : 'form-input'}${error ? ' error' : ''}`}
          {...rest}
        />
      )}
      {error && <p className="form-error">{error}</p>}
      {help && !error && <p className="form-help">{help}</p>}
    </div>
  );
}
