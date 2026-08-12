export function LangGraphLogoSVG({
  className,
  width,
  height,
}: {
  width?: number;
  height?: number;
  className?: string;
}) {
  return (
    <img
      src="/icon1.png"
      alt="Odoo ERP"
      width={width}
      height={height}
      className={className}
    />
  );
}
