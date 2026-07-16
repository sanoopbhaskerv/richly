import type { ReactNode } from 'react';

/** Props for a target-styled icon button. */
export interface IconButtonProps {
  readonly label: string;
  readonly children: ReactNode;
  readonly active?: boolean;
  readonly disabled?: boolean;
  readonly onClick?: () => void;
  readonly onPointerDown?: () => void;
  readonly onPointerUp?: () => void;
  readonly onPointerLeave?: () => void;
  readonly onKeyDown?: (key: string) => void;
  readonly onKeyUp?: (key: string) => void;
}

/** Target-styled icon button with consistent accessible naming. */
export function IconButton(props: IconButtonProps) {
  return (
    <button
      type="button"
      className="ris-icon-button"
      aria-label={props.label}
      aria-pressed={props.active}
      disabled={props.disabled}
      title={props.disabled ? 'Coming soon' : props.label}
      onClick={props.onClick}
      onPointerDown={props.onPointerDown}
      onPointerUp={props.onPointerUp}
      onPointerLeave={props.onPointerLeave}
      onKeyDown={(event) => props.onKeyDown?.(event.key)}
      onKeyUp={(event) => props.onKeyUp?.(event.key)}
    >
      {props.children}
    </button>
  );
}

/** Props for a labeled numeric field. */
export interface NumberFieldProps {
  readonly label: string;
  readonly value: number;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly suffix?: string;
  readonly onChange: (value: number) => void;
  readonly onCommit?: () => void;
}

/** Compact numeric field used by inspectors and floating toolbars. */
export function NumberField(props: NumberFieldProps) {
  return (
    <label className="ris-number-field">
      <span>{props.label}</span>
      <span className="ris-number-input-wrap">
        <input
          type="number"
          value={Number.isFinite(props.value) ? props.value : 0}
          min={props.min}
          max={props.max}
          step={props.step ?? 1}
          onBlur={props.onCommit}
          onChange={(event) => props.onChange(Number(event.currentTarget.value))}
        />
        {props.suffix ? <span>{props.suffix}</span> : null}
      </span>
    </label>
  );
}

/** Props for a labeled range and synchronized numeric value. */
export interface SliderFieldProps extends NumberFieldProps {
  readonly defaultValue?: number;
  readonly onPreview: (value: number) => void;
}

/** Slider plus value field that commits only on gesture or explicit confirmation. */
export function SliderField(props: SliderFieldProps) {
  const commit = (): void => props.onCommit?.();
  return (
    <label className="ris-slider-field">
      <span>{props.label}</span>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step ?? 1}
        value={props.value}
        onChange={(event) => props.onPreview(Number(event.currentTarget.value))}
        onPointerUp={commit}
        onKeyUp={(event) => {
          if (event.key === 'Enter') commit();
        }}
        aria-valuenow={props.value}
      />
      <input
        type="number"
        value={Number.isFinite(props.value) ? props.value : (props.defaultValue ?? 0)}
        min={props.min}
        max={props.max}
        step={props.step ?? 1}
        onBlur={commit}
        onChange={(event) => props.onChange(Number(event.currentTarget.value))}
      />
    </label>
  );
}
