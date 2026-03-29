import { cva, type VariantProps } from "class-variance-authority"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center border bg-clip-padding font-sans text-[13px] font-medium tracking-[0.02em] whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "border-primary bg-primary text-primary-foreground hover:border-foreground hover:bg-foreground hover:text-background",
        outline:
          "border-border bg-background text-foreground hover:border-foreground hover:bg-secondary",
        secondary:
          "border-border bg-secondary text-secondary-foreground hover:bg-muted",
        ghost:
          "border-transparent bg-transparent text-muted-foreground hover:text-foreground",
        destructive:
          "border-destructive bg-destructive text-white hover:bg-[#7f0d2a] hover:border-[#7f0d2a] focus-visible:ring-destructive/20",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-11 gap-2 px-5 has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        xs: "h-8 gap-1.5 px-3 text-[11px] tracking-[0.08em] uppercase has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 gap-1.5 px-4 text-[12px] has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-12 gap-2 px-6",
        icon: "size-11",
        "icon-xs":
          "size-8 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-9",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

type ButtonVariantProps = VariantProps<typeof buttonVariants>

export { buttonVariants, type ButtonVariantProps }
