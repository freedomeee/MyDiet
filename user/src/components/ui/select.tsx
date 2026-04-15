import * as React from "react";

import { cn } from "@/lib/utils";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "flex h-11 w-full appearance-none rounded-2xl border border-input bg-white/80 px-4 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20",
      className
    )}
    {...props}
  >
    {children}
  </select>
));

Select.displayName = "Select";

export { Select };
