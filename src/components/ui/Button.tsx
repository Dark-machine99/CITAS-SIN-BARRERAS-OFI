import { LoaderCircle } from 'lucide-react'
import { forwardRef, type ButtonHTMLAttributes, type PropsWithChildren } from 'react'
import { Link, type LinkProps } from 'react-router'

type ButtonProps = PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; loading?: boolean }>
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = 'primary', loading, children, className = '', disabled, ...props }, ref) {
  return <button ref={ref} className={`button button--${variant} ${className}`} disabled={disabled || loading} {...props}>
    {loading ? <LoaderCircle className="spin" aria-hidden="true" /> : null}<span>{children}</span>
  </button>
})

export function ButtonLink({ variant = 'primary', className = '', ...props }: LinkProps & { variant?: 'primary' | 'secondary' | 'ghost' }) {
  return <Link className={`button button--${variant} ${className}`} {...props} />
}
