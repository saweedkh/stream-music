"use client";

import * as SelectPrimitive from "@radix-ui/react-select";
import { ChevronDown } from "lucide-react";
import * as React from "react";

import { useLocale } from "@/shared/providers/locale-provider";
import { cn } from "@/lib/utils";

const EMPTY_VALUE = "__stream_music_select_empty__";

/** Keep floating menus inset from viewport edges (mobile safe area + panel padding). */
const SELECT_COLLISION_PADDING = 16;

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
    const { dir } = useLocale();
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
        dir={dir}
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
            "grid h-10 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-border/90 bg-card/80 px-3 py-2 text-start text-sm text-foreground shadow-inner transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            "disabled:cursor-not-allowed disabled:opacity-50",
            ariaInvalid && "border-red-500/70 focus-visible:ring-red-500/50",
            !ariaInvalid && valid && "border-brand/50 focus-visible:ring-brand/40",
            className,
          )}
        >
          <SelectPrimitive.Value
            placeholder={placeholder}
            className="min-w-0 truncate text-start"
          />
          <SelectPrimitive.Icon asChild>
            <span className="pointer-events-none flex shrink-0 items-center justify-center">
              <ChevronDown className="size-4 opacity-60" aria-hidden />
            </span>
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            dir={dir}
            position="popper"
            align="start"
            side="bottom"
            sideOffset={4}
            avoidCollisions
            collisionPadding={SELECT_COLLISION_PADDING}
            className={cn(
              "z-[250] w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-border/90 bg-background text-start text-foreground shadow-xl shadow-black/50",
              "max-h-[min(20rem,var(--radix-select-content-available-height))]",
              "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
              "data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2",
            )}
          >
            <SelectPrimitive.Viewport className="max-h-[18rem] overflow-y-auto p-1">
              {items.map((item) => (
                <SelectPrimitive.Item
                  key={item.value}
                  value={item.value}
                  disabled={item.disabled}
                  className={cn(
                    "relative flex w-full cursor-pointer select-none items-center rounded-md px-2 py-1.5 text-start text-sm outline-none",
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
