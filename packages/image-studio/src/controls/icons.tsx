import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function Icon(props: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    />
  );
}

export function AdjustIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 7h10" />
      <path d="M18 7h2" />
      <path d="M14 5v4" />
      <path d="M4 17h2" />
      <path d="M10 17h10" />
      <path d="M8 15v4" />
    </Icon>
  );
}

export function FilterIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 5h14" />
      <path d="M7 12h10" />
      <path d="M10 19h4" />
      <circle cx="8" cy="5" r="2" />
      <circle cx="15" cy="12" r="2" />
      <circle cx="12" cy="19" r="2" />
    </Icon>
  );
}

export function CropIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7 3v14a2 2 0 0 0 2 2h12" />
      <path d="M3 7h12a2 2 0 0 1 2 2v12" />
    </Icon>
  );
}

export function TransformIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 7h10a4 4 0 0 1 0 8H7" />
      <path d="m7 11-3 4 3 4" />
      <path d="M18 5v4h-4" />
    </Icon>
  );
}

export function FutureIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="7" />
      <path d="M12 8v4l2.5 2.5" />
    </Icon>
  );
}

export function UndoIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9 7H4v5" />
      <path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.5" />
    </Icon>
  );
}

export function RedoIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M15 7h5v5" />
      <path d="M20 12a8 8 0 1 1-2.3-5.7L20 8.5" />
    </Icon>
  );
}

export function ZoomOutIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M8 10.5h5" />
      <path d="m15.5 15.5 4 4" />
    </Icon>
  );
}

export function ZoomInIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M8 10.5h5" />
      <path d="M10.5 8v5" />
      <path d="m15.5 15.5 4 4" />
    </Icon>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m6 6 12 12" />
      <path d="M18 6 6 18" />
    </Icon>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m5 12 4 4L19 6" />
    </Icon>
  );
}

export function RotateLeftIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 7H4V3" />
      <path d="M4 7a8 8 0 1 1 2 5.3" />
    </Icon>
  );
}

export function RotateRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M16 7h4V3" />
      <path d="M20 7a8 8 0 1 0-2 5.3" />
    </Icon>
  );
}

export function FlipHorizontalIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 4v16" />
      <path d="m4 8 5 4-5 4V8Z" />
      <path d="m20 8-5 4 5 4V8Z" />
    </Icon>
  );
}

export function FlipVerticalIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 12h16" />
      <path d="m8 4 4 5 4-5H8Z" />
      <path d="m8 20 4-5 4 5H8Z" />
    </Icon>
  );
}

export function AddIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </Icon>
  );
}
