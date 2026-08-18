/**
 * FormField — labelled input/textarea with optional error and help text.
 *
 * Props:
 *   label       string   visible label text
 *   required    bool     shows red asterisk
 *   error       string   validation error message
 *   help        string   subtle hint below the field
 *   as          'input' | 'textarea'   default: 'input'
 *   ...rest     passed directly to the input/textarea element
 */
export default function FormField({
  label,
  required,
  error,
  help,
  as: Tag = 'input',
  ...rest
}) {
  return (
    <div className="form-field">
      {label && (
        <label className="form-label">
          {label}
          {required && <span className="required">*</span>}
        </label>
      )}
      <Tag
        className={`${Tag === 'textarea' ? 'form-textarea' : 'form-input'}${error ? ' error' : ''}`}
        {...rest}
      />
      {error && <p className="form-error">{error}</p>}
      {help && !error && <p className="form-help">{help}</p>}
    </div>
  );
}
