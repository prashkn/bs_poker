import * as React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const Field = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex flex-col gap-2", className)} {...props} />
));
Field.displayName = "Field";

interface FieldLabelProps extends React.ComponentPropsWithoutRef<typeof Label> {
  required?: boolean;
}

const FieldLabel = React.forwardRef<
  React.ComponentRef<typeof Label>,
  FieldLabelProps
>(({ className, required, children, ...props }, ref) => (
  <Label ref={ref} className={cn(className)} {...props}>
    {children}
    {required && <span className="text-destructive ml-0.5">*</span>}
  </Label>
));
FieldLabel.displayName = "FieldLabel";

export { Field, FieldLabel };
