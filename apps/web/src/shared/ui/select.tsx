"use client";

import * as SelectPrimitive from "@radix-ui/react-select";
import { ChevronDown } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

const EMPTY_VALUE = "__stream_music_select_empty__";

export interface SelectProps {
  value?: string;
  onChange?: (event: { target: { value: string } }) => void;
  valid?: boolean;
  "aria-invalid"?: boolean;
  id?: string;
  name?: string;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  children: React.ReactNode;
}

type ParsedOption = { value: string; label: React.ReactNode; disabled?: boolean };

function parseOptions(children: React.ReactNode): ParsedOption[] {
  const out: ParsedOption[] = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    const t = child.type;
    const isOpt =
      t === "option" || (typeof t === "string" && (t as string).toLowerCase() === "option");
    if (!isOpt) return;
    const props = child.props as React.OptionHTMLAttributes<HTMLOptionElement>;
    const raw = props.value;
    const v = raw === undefined || raw === null ? "" : String(raw);
    out.push({
      value: v === "" ? EMPTY_VALUE : v,
      label: props.children,
      disabled: props.disabled,
    });
  });
  return out;
}

const Select = React.forwardRef<HTMLButtonElement, SelectProps>(
  (
    {
      value,
      onChange,
      valid = false,
      "aria-invalid": ariaInvalid,
      id,
      name,
      className,
      disabled,
      placeholder = " ",
      children,
    },
    ref,
  ) => {
    const items = React.useMemo(() => parseOptions(children), [children]);
    const innerValue =
      value === undefined || value === null || value === "" ? EMPTY_VALUE : String(value);

    if (!items.length) {
      return (
        <div
          id={id}
          className={cn(
            "flex h-10 w-full items-center rounded-lg border border-border/90 bg-card/80 px-3 text-sm text-muted-foreground",
            className,
          )}
        >
          No options
        </div>
      );
    }

    return (
      <SelectPrimitive.Root
        value={innerValue}
        onValueChange={(v) => {
          const out = v === EMPTY_VALUE ? "" : v;
          onChange?.({ target: { value: out } });
        }}
        disabled={disabled}
      >
        {name ? <input type="hidden" name={name} value={value ?? ""} readOnly tabIndex={-1} aria-hidden /> : null}
        <SelectPrimitive.Trigger
          ref={ref}
          id={id}
          aria-invalid={ariaInvalid}
          className={cn(
            "flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-border/90 bg-card/80 px-3 py-2 text-left text-sm text-foreground shadow-inner transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "[&>span]:line-clamp-1 [&>span]:min-w-0",
            ariaInvalid && "border-red-500/70 focus-visible:ring-red-500/50",
            !ariaInvalid && valid && "border-brand/50 focus-visible:ring-brand/40",
            className,
          )}
        >
          <SelectPrimitive.Value placeholder={placeholder} />
          <SelectPrimitive.Icon className="shrink-0">
            <ChevronDown className="h-4 w-4 opacity-60" aria-hidden />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            position="popper"
            sideOffset={4}
            className={cn(
              "z-[100] max-h-[min(20rem,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border border-border/90 bg-background text-foreground shadow-xl shadow-black/50",
              "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            )}
          >
            <SelectPrimitive.Viewport className="max-h-[18rem] overflow-y-auto p-1">
              {items.map((item) => (
                <SelectPrimitive.Item
                  key={item.value}
                  value={item.value}
                  disabled={item.disabled}
                  className={cn(
                    "relative flex w-full cursor-pointer select-none items-center rounded-md px-2 py-1.5 text-sm outline-none",
                    "data-[highlighted]:bg-muted data-[state=checked]:bg-[var(--brand-subtle)] data-[state=checked]:text-brand",
                    "data-[disabled]:pointer-events-none data-[disabled]:opacity-40",
                  )}
                >
                  <SelectPrimitive.ItemText>{item.label}</SelectPrimitive.ItemText>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    );
  },
);
Select.displayName = "Select";

export { Select };
