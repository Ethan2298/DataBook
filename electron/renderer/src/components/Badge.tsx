interface BadgeProps {
  dot: string;
  label: string;
  className?: string;
}

export default function Badge({ dot, label, className = "" }: BadgeProps) {
  return (
    <span className={`badge ${className}`}>
      <span className={`badge-dot ${dot}`} />
      {label}
    </span>
  );
}
