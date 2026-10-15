export default function MinistryBrand({ className = '' }: { className?: string }) {
  return (
    <img
      className={`ministry-brand ${className}`}
      src="./branding/ministry-jordan.png"
      alt="وزارة التربية والتعليم الأردنية"
    />
  );
}
