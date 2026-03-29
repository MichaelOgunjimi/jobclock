"use client"

import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { isValidElement, type ReactElement } from "react"

import { buttonVariants, type ButtonVariantProps } from "@/components/ui/button-styles"
import { cn } from "@/lib/utils"

function Button({
  className,
  variant = "default",
  size = "default",
  asChild,
  children,
  ...props
}: ButtonPrimitive.Props & ButtonVariantProps & { asChild?: boolean }) {
  const mergedClassName = cn(buttonVariants({ variant, size, className }))
  if (asChild && isValidElement(children)) {
    return (
      <ButtonPrimitive
        data-slot="button"
        className={mergedClassName}
        nativeButton={false}
        render={children as ReactElement}
        {...props}
      />
    )
  }
  return (
    <ButtonPrimitive
      data-slot="button"
      className={mergedClassName}
      {...props}
    >
      {children}
    </ButtonPrimitive>
  )
}

export { Button, buttonVariants }
