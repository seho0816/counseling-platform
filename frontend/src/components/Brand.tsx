import { Link } from 'react-router-dom';

export function BrandMark() {
  return (
    <svg className="brand__mark" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="#1B6B73" />
      <rect x="8" y="7" width="3" height="18" rx="1.5" fill="#DFEEEE" />
      <rect x="14" y="10" width="10" height="2.5" rx="1.25" fill="#fff" />
      <rect x="14" y="15" width="10" height="2.5" rx="1.25" fill="#fff" />
      <rect x="14" y="20" width="6" height="2.5" rx="1.25" fill="#fff" />
    </svg>
  );
}

export default function Brand({ to = '/' }: { to?: string }) {
  return (
    <Link to={to} className="brand">
      <BrandMark />
      마음기록
    </Link>
  );
}
