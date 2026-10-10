import Image from "next/image";
export function Logo({
  icon = false,
  light = false,
  compact = false,
}: {
  icon?: boolean;
  light?: boolean;
  compact?: boolean;
}) {
  return (
    <Image
      src={
        icon
          ? "/brand/intervexa-mark.svg"
          : light
            ? "/brand/intervexa-logo-light.svg"
            : "/brand/intervexa-logo-dark.svg"
      }
      alt="Intervexa"
      width={icon ? 32 : 146}
      height={32}
      style={{ width: icon ? 32 : compact ? 128 : 146, height: 32 }}
      priority
    />
  );
}
