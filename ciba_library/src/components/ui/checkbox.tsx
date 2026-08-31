import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: React.ReactNode;
}

/** Accessible checkbox: a visually-hidden input drives a styled box. */
export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, checked, ...props }, ref) => (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
      <span className="relative inline-flex">
        <input
          ref={ref}
          type="checkbox"
          checked={checked}
          className="peer sr-only"
          {...props}
        />
        <span
          className={cn(
            "flex size-5 items-center justify-center rounded border border-input text-transparent transition-colors peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-1 peer-focus-visible:ring-offset-background",
            className,
          )}
        >
          <Check className="size-3.5" strokeWidth={3} />
        </span>
      </span>
      {label}
    </label>
  ),
);
Checkbox.displayName = "Checkbox";
