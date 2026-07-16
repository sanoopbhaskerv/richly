import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';

/** Accessible icon/button primitive for Image Studio controls. */
export function ImageToolbarButton(
  props: ButtonHTMLAttributes<HTMLButtonElement> & {
    readonly label: string;
    readonly icon?: ReactNode;
  }
) {
  const { label, icon, children, ...buttonProps } = props;
  return (
    <button type="button" aria-label={label} title={label} {...buttonProps}>
      {icon}
      {children}
    </button>
  );
}

/** Labeled slider primitive used by adjustments and future numeric tools. */
export function ImageSlider(
  props: InputHTMLAttributes<HTMLInputElement> & { readonly label: string }
) {
  const { label, id, ...inputProps } = props;
  const inputId = id ?? `image-slider-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <label htmlFor={inputId}>
      <span>{label}</span>
      <input id={inputId} type="range" {...inputProps} />
    </label>
  );
}
