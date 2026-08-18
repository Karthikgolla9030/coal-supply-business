import FormField from '../FormField';

/**
 * TransportSection — transport name and vehicle number.
 *
 * Props:
 *   data      { transport_name, vehicle_number }
 *   errors    { transport_name?, vehicle_number? }
 *   onChange  (fieldName, value) => void
 */
export default function TransportSection({ data, errors, onChange }) {
  return (
    <div className="card">
      <div className="card-title">Transport Information</div>
      <div className="form-grid">
        <FormField
          label="Transporter Name"
          name="transport_name"
          id="transport_name"
          value={data.transport_name}
          onChange={(e) => onChange('transport_name', e.target.value)}
          error={errors.transport_name}
          placeholder="e.g. ABC Transport Co."
        />
        <FormField
          label="Vehicle Number"
          name="vehicle_number"
          id="vehicle_number"
          value={data.vehicle_number}
          onChange={(e) => onChange('vehicle_number', e.target.value)}
          error={errors.vehicle_number}
          placeholder="e.g. AP 39 XX 1234"
          help="Stored exactly as entered — alphanumeric with spaces is supported"
        />
      </div>
    </div>
  );
}
