export default function StatusBadge({ isActive }) {
  return (
    <span className={`badge ${isActive ? 'badge-active' : 'badge-inactive'}`}>
      <span style={{ fontSize: '0.5rem' }}>{isActive ? '●' : '○'}</span>
      {isActive ? 'Active' : 'Inactive'}
    </span>
  );
}
