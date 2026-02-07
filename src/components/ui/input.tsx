import { type InputHTMLAttributes, forwardRef } from 'react'

type InputSize = 'sm' | 'md' | 'lg'

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string
  error?: string
  inputSize?: InputSize
  helperText?: string
}

const sizeStyles: Record<InputSize, string> = {
  sm: 'px-2.5 py-1 text-xs',
  md: 'px-3 py-1.5 text-sm',
  lg: 'px-3 py-2 text-sm',
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input(
    {
      label,
      error,
      inputSize = 'md',
      helperText,
      className = '',
      disabled,
      ...props
    },
    ref
  ) {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-[#37352f] mb-1.5">
            {label}
          </label>
        )}
        <input
          ref={ref}
          disabled={disabled}
          className={`
            w-full
            bg-[#f7f6f3]
            border border-[#e3e2e0]
            rounded
            text-[#37352f]
            placeholder:text-[#9ca3af]
            transition-colors duration-100
            focus:outline-none focus:border-[#2383e2] focus:bg-white
            hover:border-[#d1d1cd]
            disabled:bg-[#f1f1ef] disabled:text-[#9ca3af] disabled:cursor-not-allowed
            ${error ? 'border-[#fca5a5] focus:border-[#ef4444]' : ''}
            ${sizeStyles[inputSize]}
            ${className}
          `}
          {...props}
        />
        {error && (
          <p className="mt-1.5 text-xs text-[#dc2626]">{error}</p>
        )}
        {helperText && !error && (
          <p className="mt-1.5 text-xs text-[#6b6b67]">{helperText}</p>
        )}
      </div>
    )
  }
)
