
import React, { ReactNode, useState, useRef, useEffect, Children, useId } from 'react';
import ReactDOM from 'react-dom'; 
import { ChevronDownIcon, UploadIcon as DefaultUploadIcon, InformationCircleIcon, XCircleIcon as CloseIcon, CheckCircleIcon, XCircleIcon as ErrorIcon, DocumentTextIcon } from '../constants';
import { useTranslation } from '../App';
import { NotificationState } from '../hooks/useNotification'; 
import { useDragAndDrop } from '../hooks/useDragAndDrop';

export interface TooltipProps {
  content: ReactNode;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end' | 'left-start' | 'left-end' | 'right-start' | 'right-end';
  children: ReactNode;
  wrapperClassName?: string;
  tooltipClassName?: string;
  delayDuration?: number;
  disabled?: boolean;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  placement = 'top',
  children,
  wrapperClassName = '',
  tooltipClassName = '',
  delayDuration = 100, 
  disabled = false,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const showTooltip = () => {
    if (disabled) return;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      if (mountedRef.current) {
        setIsVisible(true);
      }
    }, delayDuration);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  const baseTooltipStyle = `absolute z-50 whitespace-nowrap rounded-lg bg-[var(--color-tooltip-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--color-tooltip-text)] shadow-xl ring-1 ring-[var(--color-tooltip-border)] pointer-events-none
                           transition-opacity var(--duration-fast) var(--ease-ios)`;
  
  const placementStyles: Record<NonNullable<TooltipProps['placement']>, string> = {
    'top': 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    'top-start': 'bottom-full left-0 mb-2',
    'top-end': 'bottom-full right-0 mb-2',
    'bottom': 'top-full left-1/2 -translate-x-1/2 mt-2',
    'bottom-start': 'top-full left-0 mt-2',
    'bottom-end': 'top-full right-0 mt-2',
    'left': 'right-full top-1/2 -translate-y-1/2 mr-2',
    'left-start': 'right-full top-0 mr-2',
    'left-end': 'right-full bottom-0 mr-2',
    'right': 'left-full top-1/2 -translate-y-1/2 ml-2',
    'right-start': 'left-full top-0 ml-2',
    'right-end': 'left-full bottom-0 ml-2',
  };

  const isFocusableChild = (child: ReactNode): boolean => {
    if (React.isValidElement(child)) {
        const focusableTags = ['button', 'input', 'select', 'textarea', 'a'];
        
        if (typeof child.type === 'string' && focusableTags.includes(child.type)) {
            return true;
        }
        
        const props = child.props as { tabIndex?: any; [key: string]: any };
        if (props && typeof props.tabIndex !== 'undefined' && Number(props.tabIndex) >= 0) {
            return true;
        }
    }
    return false;
  };

  const needsTabIndex = Children.count(children) === 1 ? !isFocusableChild(Children.only(children)) : false;

  return (
    <div
      className={`relative inline-block ${wrapperClassName}`}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
      tabIndex={needsTabIndex ? 0 : undefined}
    >
      {children}
      {content && !disabled && ( // Only render tooltip content if not disabled
        <div
          role="tooltip"
          className={`${baseTooltipStyle} ${placementStyles[placement]} ${isVisible ? 'opacity-100' : 'opacity-0'} ${tooltipClassName}`}
        >
          {content}
        </div>
      )}
    </div>
  );
};
Tooltip.displayName = "Tooltip";


interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'link' | 'outline' | 'subtle';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  isLoading?: boolean;
  fullWidth?: boolean;
  tooltip?: string;
  tooltipPlacement?: TooltipProps['placement'];
  tooltipDisabled?: boolean; // Added tooltipDisabled
  children?: ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({
  children,
  variant = 'primary',
  size = 'md',
  leftIcon,
  rightIcon,
  isLoading = false,
  fullWidth = false,
  className = '',
  tooltip,
  tooltipPlacement,
  tooltipDisabled = false, // Initialize tooltipDisabled
  ...props
}, ref) => {
  const baseStyle = `inline-flex items-center justify-center font-semibold rounded-lg focus:outline-none 
                     disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none
                     transition-all var(--duration-fast) var(--ease-ios)
                     hover:scale-[1.02] active:scale-[0.98] will-change-transform`; 

  const variantStyles = {
    primary: "bg-[var(--color-primary-accent)] hover:bg-[var(--color-primary-accent-hover)] text-[var(--color-primary-accent-text)] shadow-lg hover:shadow-[var(--color-primary-accent)]/40 focus-visible:ring-4 focus-visible:ring-[var(--color-focus-shadow)] disabled:bg-[var(--color-primary-accent)]/50 border border-transparent",
    secondary: "bg-[var(--color-secondary-accent)] hover:bg-[var(--color-secondary-accent-hover)] text-[var(--color-secondary-accent-text)] shadow-md hover:shadow-[var(--shadow-color-level-1)] focus-visible:ring-4 focus-visible:ring-[var(--color-secondary-accent)]/20 disabled:bg-[var(--color-secondary-accent)]/70 disabled:text-[var(--color-text-muted)] border border-transparent",
    outline: "border-2 border-[var(--color-primary-accent)] text-[var(--color-primary-accent)] hover:bg-[var(--color-primary-accent)]/15 hover:text-[var(--color-primary-accent-hover)] focus-visible:ring-4 focus-visible:ring-[var(--color-focus-shadow)] shadow-none disabled:border-[var(--color-border-strong)] disabled:text-[var(--color-text-muted)]",
    subtle: "bg-[var(--color-bg-surface-2)]/60 hover:bg-[var(--color-bg-surface-2)]/80 text-[var(--color-text-secondary)] focus-visible:ring-4 focus-visible:ring-[var(--color-text-secondary)]/20 shadow-none border border-transparent disabled:text-[var(--color-text-muted)]",
    danger: "bg-[var(--color-danger-accent)] hover:bg-[var(--color-danger-accent)]/80 text-white shadow-lg hover:shadow-[var(--color-danger-accent)]/40 focus-visible:ring-4 focus-visible:ring-[var(--color-danger-accent)]/30 disabled:bg-[var(--color-danger-accent)]/50 border border-transparent",
    ghost: "bg-transparent hover:bg-[var(--color-bg-surface-2)] text-[var(--color-text-secondary)] hover:text-[var(--color-primary-accent)] focus-visible:ring-4 focus-visible:ring-[var(--color-text-secondary)]/20 disabled:text-[var(--color-text-muted)] shadow-none border border-transparent",
    link: "bg-transparent text-[var(--color-primary-accent)] hover:text-[var(--color-primary-accent-hover)] hover:underline focus-visible:ring-1 focus-visible:ring-[var(--color-primary-accent)]/50 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--color-bg-body)] rounded-sm shadow-none p-0 border border-transparent !hover:scale-100 !active:scale-100", 
  };


  const sizeStyles = {
    xs: "px-3 py-1.5 text-xs",
    sm: "px-4 py-2 text-sm",
    md: "px-5 py-2.5 text-sm",
    lg: "px-6 py-3 text-base",
  };

  const iconOnlyPadding = {
    xs: "p-2", sm: "p-2.5", md: "p-2.5", lg: "p-3",
  };

  const currentSizeStyle = !children && (leftIcon || rightIcon) ? iconOnlyPadding[size] : (variant === 'link' ? '' : sizeStyles[size]);
  const widthStyle = fullWidth ? "w-full" : "";
  
  const iconSizeClass = size === 'xs' ? 'h-4 w-4' : size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  const iconMarginClass = children ? (size === 'xs' || size === 'sm' ? 'mr-1.5' : 'mr-2') : '';
  const rightIconMarginClass = children ? (size === 'xs' || size === 'sm' ? 'ml-1.5' : 'ml-2') : '';

  const buttonContent = (
    <>
      {isLoading && (
        <svg className={`animate-spin ${children ? '-ml-1 mr-2.5' : ''} ${iconSizeClass}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      )}
      {leftIcon && !isLoading && <span className={`${iconMarginClass} ${iconSizeClass} flex-shrink-0`}>{leftIcon}</span>}
      {children}
      {rightIcon && !isLoading && <span className={`${rightIconMarginClass} ${iconSizeClass} flex-shrink-0`}>{rightIcon}</span>}
    </>
  );

  const buttonElement = (
    <button
      ref={ref}
      className={`${baseStyle} ${variantStyles[variant]} ${currentSizeStyle} ${widthStyle} ${className}`}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {buttonContent}
    </button>
  );

  return tooltip ? <Tooltip content={tooltip} placement={tooltipPlacement} wrapperClassName="inline-flex" disabled={tooltipDisabled}>{buttonElement}</Tooltip> : buttonElement;
});
Button.displayName = 'Button';

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  useGlassEffect?: boolean;
  style?: React.CSSProperties;
}

export const Card: React.FC<CardProps> = ({ 
  children, 
  className = '', 
  onClick, 
  useGlassEffect = false, 
  style 
}) => {
  const baseClasses = `rounded-xl p-6 md:p-8`; // Default padding, can be overridden by className
  const themeClasses = useGlassEffect
    ? "card-glass" 
    : "bg-[var(--color-bg-surface-1)] shadow-lg border border-[var(--color-border-default)] transition-all var(--duration-normal) var(--ease-ios)";
  const interactivityClasses = onClick ? "cursor-pointer card-float-hover" : "";

  // Ensure shadow-slate-950/50 is removed if it exists from previous hardcoding, as shadow-lg from var now handles it
  const finalClassName = `${baseClasses} ${themeClasses} ${interactivityClasses} ${className}`.trim().replace(/\s+/g, ' ');
  
  return (
    <div
      className={finalClassName}
      onClick={onClick}
      style={style}
    >
      {children}
    </div>
  );
};
Card.displayName = "Card";


interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
  error?: string;
  icon?: ReactNode;
  containerClassName?: string;
  inputClassName?: string;
  description?: string; // Added description prop
}

export const Input: React.FC<InputProps> = ({ label, name, error, className = '', icon, containerClassName = '', inputClassName = '', description, ...props }) => {
  const baseInputStyle = `block w-full rounded-lg shadow-sm py-3 ${icon ? 'pl-12' : 'px-4'} focus:outline-none sm:text-sm transition-colors var(--duration-fast) var(--ease-ios), border-color var(--duration-fast) var(--ease-ios), box-shadow var(--duration-fast) var(--ease-ios) will-change-border, background-color, box-shadow`;
  const errorStyle = `border-[var(--color-danger-accent)] focus:ring-[var(--color-danger-accent)]/50 focus:border-[var(--color-danger-accent)]`;
  const normalStyle = `border-[var(--color-input-border)] focus:ring-[var(--color-input-focus-ring)] focus:border-[var(--color-input-focus-border)] hover:border-[var(--color-border-strong)] focus:bg-[var(--color-bg-surface-1)]`; 
  const disabledStyle = `disabled:opacity-60 disabled:!bg-[var(--color-bg-surface-2)]/30 disabled:cursor-not-allowed`;

  return (
    <div className={`w-full ${containerClassName}`}>
      {label && <label htmlFor={name} className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">{label}</label>}
      <div className="relative">
        {icon && <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[var(--color-text-muted)]">{icon}</div>}
        <input
          id={name}
          name={name}
          className={`${baseInputStyle} ${error ? errorStyle : normalStyle} ${disabledStyle} ${inputClassName} ${className}`}
          {...props}
        />
      </div>
      {description && !error && <p className={`mt-2 text-xs text-[var(--color-text-muted)] animate-fadeIn`}>{description}</p>}
      {error && <p className={`mt-2 text-xs text-[var(--color-danger-accent)] animate-fadeIn`}>{error}</p>}
    </div>
  );
};
Input.displayName = "Input";

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode;
  error?: string;
  containerClassName?: string;
}
export const Textarea: React.FC<TextareaProps> = ({ label, name, error, className = '', containerClassName = '', ...props }) => {
  const baseInputStyle = `block w-full rounded-lg shadow-sm py-3 px-4 focus:outline-none sm:text-sm resize-none transition-colors var(--duration-fast) var(--ease-ios), border-color var(--duration-fast) var(--ease-ios), box-shadow var(--duration-fast) var(--ease-ios) will-change-border, background-color, box-shadow`;
  const errorStyle = `border-[var(--color-danger-accent)] focus:ring-[var(--color-danger-accent)]/50 focus:border-[var(--color-danger-accent)]`;
  const normalStyle = `border-[var(--color-input-border)] focus:ring-[var(--color-input-focus-ring)] focus:border-[var(--color-input-focus-border)] hover:border-[var(--color-border-strong)] focus:bg-[var(--color-bg-surface-1)]`;
  const disabledStyle = `disabled:opacity-60 disabled:!bg-[var(--color-bg-surface-2)]/30 disabled:cursor-not-allowed`;

  return (
    <div className={`w-full ${containerClassName}`}>
      {label && <label htmlFor={name} className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">{label}</label>}
      <textarea
        id={name}
        name={name}
        rows={4}
        className={`${baseInputStyle} ${error ? errorStyle : normalStyle} ${disabledStyle} ${className}`}
        {...props}
      />
      {error && <p className={`mt-2 text-xs text-[var(--color-danger-accent)] animate-fadeIn`}>{error}</p>}
    </div>
  );
};
Textarea.displayName = "Textarea";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: ReactNode;
  error?: string;
  options: { value: string | number; label: string }[];
  containerClassName?: string;
}

export const Select: React.FC<SelectProps> = ({ label, name, error, options, className = '', containerClassName = '', disabled, ...props }) => {
  const baseInputStyle = `block w-full rounded-lg shadow-sm py-3 px-4 focus:outline-none sm:text-sm appearance-none pr-10 transition-colors var(--duration-fast) var(--ease-ios), border-color var(--duration-fast) var(--ease-ios), box-shadow var(--duration-fast) var(--ease-ios) will-change-border, background-color, box-shadow`;
  const errorStyle = `border-[var(--color-danger-accent)] focus:ring-[var(--color-danger-accent)]/50 focus:border-[var(--color-danger-accent)]`;
  const normalStyle = `border-[var(--color-input-border)] focus:ring-[var(--color-input-focus-ring)] focus:border-[var(--color-input-focus-border)] hover:border-[var(--color-border-strong)] focus:bg-[var(--color-bg-surface-1)]`;
  const disabledStyle = `disabled:opacity-60 disabled:!bg-[var(--color-bg-surface-2)]/30 disabled:text-[var(--color-text-muted)]/70 disabled:cursor-not-allowed`;


  return (
    <div className={`w-full ${containerClassName}`}>
      {label && <label htmlFor={name} className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">{label}</label>}
      <div className="relative">
        <select
          id={name}
          name={name}
          disabled={disabled}
          className={`${baseInputStyle} ${error ? errorStyle : normalStyle} ${disabled ? disabledStyle : ''} ${className}`}
          {...props}
        >
          {options.map(opt => (
            <option key={opt.value} value={opt.value} className="!bg-[var(--color-bg-surface-1)] !text-[var(--color-text-primary)]">{opt.label}</option>
          ))}
        </select>
        <ChevronDownIcon className={`absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 ${disabled ? 'text-[var(--color-text-muted)]/50' : 'text-[var(--color-text-muted)]'} pointer-events-none transition-transform var(--duration-fast) var(--ease-ios)`} />
      </div>
      {error && <p className={`mt-2 text-xs text-[var(--color-danger-accent)] animate-fadeIn`}>{error}</p>}
    </div>
  );
};
Select.displayName = "Select";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'full';
  footerContent?: ReactNode;
  titleClassName?: string;
  hideCloseButton?: boolean;
  useSolidBackground?: boolean;
}

export const Modal: React.FC<ModalProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  size = 'md', 
  footerContent, 
  titleClassName = '', 
  hideCloseButton = false,
  useSolidBackground = false
}) => {
  const [isMounted, setIsMounted] = useState(false);
  const [animationState, setAnimationState] = useState<'hidden' | 'entering' | 'visible' | 'exiting'>('hidden');
  const modalRef = useRef<HTMLDivElement>(null);
  const modalContentId = useId();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setAnimationState('entering');
      document.body.style.overflow = 'hidden';
      const handleEscapeKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
      document.addEventListener('keydown', handleEscapeKey);

      const timer = setTimeout(() => {
        if (animationStateRef.current === 'entering') setAnimationState('visible');
      }, parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--duration-fast') || '150'));


      return () => {
        clearTimeout(timer);
        document.removeEventListener('keydown', handleEscapeKey);
        
        if (!document.querySelector('.modal-backdrop-enhanced.open')) {
            document.body.style.overflow = 'auto';
        }
      };
    } else if (animationState !== 'hidden' && animationState !== 'exiting') { 
      setAnimationState('exiting');
      const timer = setTimeout(() => {
        setAnimationState('hidden');
         if (!document.querySelector('.modal-backdrop-enhanced.open')) { 
            document.body.style.overflow = 'auto';
        }
      }, parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--duration-fast') || '150'));
      return () => clearTimeout(timer);
    }
  }, [isOpen, onClose, animationState]);

  const animationStateRef = useRef(animationState);
  useEffect(() => {
    animationStateRef.current = animationState;
  }, [animationState]);


  if (!isMounted || animationState === 'hidden') return null;

  const sizeClasses = {
    sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-xl', xl: 'max-w-3xl',
    '2xl': 'max-w-5xl', '3xl': 'max-w-7xl', full: 'max-w-full h-full !rounded-none sm:!rounded-2xl',
  };
  
  const modalTitleId = title ? `${modalContentId}-title` : undefined;

  let modalContainerClasses = `modal-container-base ${useSolidBackground ? 'solid-modal' : ''} rounded-2xl shadow-2xl w-full ${sizeClasses[size]} flex flex-col max-h-[90vh] m-4`;
  
  if (animationState === 'entering' || animationState === 'visible') {
    modalContainerClasses += ' modal-container-animate-enter-active';
  } else if (animationState === 'exiting') {
    modalContainerClasses += ' modal-container-animate-exit-active';
  } else { 
     modalContainerClasses += ' modal-container-animate-enter'; 
  }

  return ReactDOM.createPortal(
    <div
        className={`fixed inset-0 z-[100] flex items-center justify-center p-4 modal-backdrop-enhanced ${isOpen || animationState === 'exiting' ? 'open' : ''}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={modalTitleId}
    >
      <div
        ref={modalRef}
        className={modalContainerClasses}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || !hideCloseButton) && (
            <div className="flex items-center justify-between p-5 sm:p-6 border-b border-[var(--color-modal-border)]">
            {title && <h3 id={modalTitleId} className={`text-lg md:text-xl font-semibold text-[var(--color-text-primary)] ${titleClassName}`}>{title}</h3>}
            {!hideCloseButton && (
                <button
                    onClick={onClose}
                    className="p-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] rounded-lg hover:bg-[var(--color-bg-surface-2)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-modal-content-bg)] transition-colors var(--duration-fast) var(--ease-ios)"
                    aria-label="Close modal"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            )}
            </div>
        )}
        <div className="p-5 sm:p-6 flex-grow modal-content-scrollable">
          {children}
        </div>
        {footerContent && (
          <div className="p-5 sm:p-6 border-t border-[var(--color-modal-border)] bg-[var(--color-bg-surface-2)]/40 rounded-b-2xl">
            {footerContent}
          </div>
        )}
      </div>
    </div>,
    document.body 
  );
};
Modal.displayName = "Modal";

export const LoadingSpinner: React.FC<{text?: string; size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'; className?: string; textClassName?: string;}> = ({ text, size = 'md', className, textClassName }) => {
  const sizeClasses = { xs: 'w-5 h-5', sm: 'w-7 h-7', md: 'w-10 h-10', lg: 'w-14 h-14', xl: 'w-20 h-20' };
  const textClasses = { xs: 'text-xs', sm: 'text-sm', md: 'text-base', lg: 'text-lg', xl: 'text-xl' };
  return (
    <div className={`flex flex-col items-center justify-center space-y-3.5 p-4 animate-fadeIn ${className || ''}`}>
      <svg className={`animate-spin text-[var(--color-primary-accent)] ${sizeClasses[size]}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle>
        <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      {text && <p className={`text-[var(--color-text-secondary)] font-medium ${textClasses[size]} ${textClassName || ''}`}>{text}</p>}
    </div>
  );
};
LoadingSpinner.displayName = "LoadingSpinner";

interface ProgressBarProps {
  progress: number;
  label?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  barClassName?: string;
  showPercentage?: boolean;
}
export const ProgressBar: React.FC<ProgressBarProps> = ({ progress, label, className, size = 'md', barClassName, showPercentage = true }) => {
  const safeProgress = Math.max(0, Math.min(100, progress));
  const heightClass = size === 'sm' ? 'h-2' : size === 'md' ? 'h-2.5' : 'h-3';
  
  const shimmerClass = (safeProgress > 0 && safeProgress < 100) ? 'progress-bar-shimmer' : '';
  const willChangeStyle = (safeProgress > 0 && safeProgress < 100) ? 'width, background-position' : 'width';

  return (
    <div className={`w-full ${className || ''}`}>
      {(label || showPercentage) && <div className="flex justify-between text-xs text-[var(--color-text-muted)] mb-1.5">
        {label && <span className="font-medium">{label}</span>}
        {showPercentage && <span className="font-semibold text-[var(--color-text-secondary)]">{safeProgress.toFixed(0)}%</span>}
      </div>}
      <div className={`w-full bg-[var(--color-bg-surface-2)]/80 rounded-full ${heightClass} overflow-hidden shadow-inner`}>
        <div
          className={`${barClassName || 'bg-[var(--color-primary-accent)]'} ${heightClass} rounded-full transition-width var(--duration-normal) var(--ease-ios) ${shimmerClass}`}
          style={{ 
            width: `${safeProgress}%`,
            willChange: willChangeStyle 
          }}
          role="progressbar"
          aria-valuenow={safeProgress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={label || 'Progress'}
        ></div>
      </div>
    </div>
  );
};
ProgressBar.displayName = "ProgressBar";

interface AccordionProps {
  title: ReactNode;
  children: ReactNode;
  initiallyOpen?: boolean;
  titleClassName?: string;
  icon?: ReactNode;
  containerClassName?: string;
  contentClassName?: string;
  chevronIcon?: React.ReactElement<{ className?: string }>;
}

export const Accordion: React.FC<AccordionProps> = ({ title, children, initiallyOpen = false, titleClassName, icon, containerClassName, contentClassName, chevronIcon }) => {
  const [isOpen, setIsOpen] = useState(initiallyOpen);
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <div className={`accordion-item-container rounded-xl overflow-hidden shadow-lg transition-shadow var(--duration-fast) var(--ease-ios) ${containerClassName || ''}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex justify-between items-center p-4 sm:p-5 hover:bg-[var(--color-bg-surface-2)] text-left focus-visible:ring-2 focus-visible:ring-[var(--color-primary-accent)] focus-visible:ring-inset
         transition-colors var(--duration-fast) var(--ease-ios) ${isOpen ? "bg-[var(--color-bg-surface-2)]/80 border-b border-[var(--color-border-default)]" : "bg-transparent"} ${titleClassName || ''}`}
        aria-expanded={isOpen}
      >
        <div className="flex items-center flex-grow min-w-0 mr-2">
            {icon && <span className="mr-3.5 text-[var(--color-primary-accent)] flex-shrink-0">{icon}</span>}
            <span className="font-semibold text-[var(--color-text-primary)] text-sm sm:text-base block min-w-0 w-full">{title}</span>
        </div>
        {chevronIcon ? React.cloneElement(chevronIcon, { className: `transform transition-transform var(--duration-fast) var(--ease-ios) text-[var(--color-text-muted)] ${isOpen ? 'rotate-180' : ''} ${chevronIcon.props.className || ''}`}) 
                     : <ChevronDownIcon className={`w-5 h-5 text-[var(--color-text-muted)] transform transition-transform var(--duration-fast) var(--ease-ios) ${isOpen ? 'rotate-180' : ''}`} />}
      </button>
      <div 
        ref={contentRef}
        style={{ 
          maxHeight: isOpen ? `${contentRef.current?.scrollHeight}px` : '0px',
          opacity: isOpen ? 1 : 0,
          transition: 'max-height var(--duration-normal) var(--ease-ios), opacity var(--duration-normal) var(--ease-ios)',
          overflow: 'hidden',
          willChange: 'max-height, opacity'
        }}
        className={`bg-[var(--color-bg-surface-2)]/50 ${contentClassName || ''}`}
      >
        <div className="p-4 sm:p-5">
          {children}
        </div>
      </div>
    </div>
  );
};
Accordion.displayName = "Accordion";

interface ToggleProps {
  label: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  name?: string;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  labelClassName?: string;
  containerClassName?: string;
  labelPosition?: "left" | "right";
}

export const Toggle = React.forwardRef<HTMLButtonElement, ToggleProps>(
  ({ 
    label, 
    checked = false, 
    onChange, 
    name, 
    size = 'md', 
    disabled = false, 
    labelClassName = '',
    containerClassName = '',
    labelPosition = "right"
  }, ref) => {
  const id = name || useId();
  
  const sizeClassesThumb = 
    size === "sm" ? "h-3 w-3" : 
    size === "md" ? "h-4 w-4" : 
    size === "lg" ? "h-5 w-5" : "h-4 w-4";
  
  const sizeClassesBackground = 
    size === "sm" ? "w-7 h-4" : 
    size === "md" ? "w-10 h-5" : 
    size === "lg" ? "w-12 h-6" : "w-10 h-5";
  
  const translateX = checked ? 
    (size === "sm" ? "translate-x-3.5" : 
     size === "md" ? "translate-x-5" : 
     size === "lg" ? "translate-x-6" : "translate-x-5") : 
    "translate-x-0.5";
    
  return (
    <div className={`inline-flex items-center ${disabled ? 'opacity-60 cursor-not-allowed' : ''} ${containerClassName} ${labelPosition === "left" ? "flex-row-reverse" : ""}`}>
      {label && (
        typeof label === 'string' ? (
          <label id={`${id}-label`} htmlFor={id} className={`text-sm font-medium text-[var(--color-text-body)] ${labelPosition === "left" ? "mr-3" : "ml-3"} ${disabled ? '' : 'cursor-pointer'} ${labelClassName}`}>{label}</label>
        ) : (
           <div className={`text-sm font-medium text-[var(--color-text-body)] ${labelPosition === "left" ? "mr-3" : "ml-3"} ${disabled ? '' : 'cursor-pointer'} ${labelClassName}`} onClick={() => !disabled && onChange(!checked)}>{label}</div>
        )
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => !disabled && onChange(!checked)}
        id={id}
        ref={ref}
        className={`${sizeClassesBackground} relative inline-flex flex-shrink-0 items-center rounded-full p-0.5
                   ${checked 
                     ? 'bg-[var(--color-primary-accent)]' 
                     : 'bg-[var(--color-bg-surface-3)]'}
                   ${disabled ? '' : 'cursor-pointer'}
                   focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-focus-ring-offset)] 
                   transition-colors var(--duration-fast) var(--ease-ios) will-change-background`}
        disabled={disabled}
        aria-labelledby={typeof label === 'string' ? `${id}-label` : undefined}
      >
        <span className="sr-only">{typeof label === 'string' ? label : ''}</span>
        <span aria-hidden="true" className={`${sizeClassesThumb} ${translateX} pointer-events-none inline-block transform rounded-full bg-white shadow-lg ring-0 
                     transition-transform var(--duration-fast) var(--ease-ios)`}></span>
      </button>
    </div>
  );
});
Toggle.displayName = "Toggle";


interface DropzoneProps {
  onFileUpload: (files: File[]) => void; // Changed to handle multiple files
  acceptedFileTypes?: string;
  maxFileSizeMB?: number;
  label?: ReactNode;
  icon?: ReactNode;
  isLoading?: boolean;
  currentFiles?: File[] | null; // Changed to array
  multipleFiles?: boolean; // New prop
}

export const Dropzone: React.FC<DropzoneProps> = ({
    onFileUpload,
    acceptedFileTypes = ".pdf,.txt,.docx,.jpg,.png,.jpeg",
    maxFileSizeMB = 10,
    label,
    icon = <DefaultUploadIcon className="w-10 h-10 sm:w-12 sm:h-12 mb-3 text-[var(--color-text-muted)] group-hover:text-[var(--color-primary-accent)] transition-colors var(--duration-fast) var(--ease-ios)" strokeWidth={1}/>,
    isLoading = false,
    currentFiles = null,
    multipleFiles = false, // Default to single file
}) => {
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation();

  const {
    isDragging,
    fileInputRef,
    handlers,
  } = useDragAndDrop({
    onFilesAccepted: (files) => {
      setError(null); 
      onFileUpload(files);
    },
    onError: (errorMessage) => {
      setError(errorMessage);
    },
    maxFileSizeMB,
    acceptedFileTypes,
    multipleFiles, // Pass this to the hook
  });


  return (
    <div className="w-full">
      {label && <div className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2.5">{label}</div>}
      <label
        htmlFor="file-upload-dropzone"
        onDragEnter={handlers.handleDragEnter} 
        onDragLeave={handlers.handleDragLeave} 
        onDragOver={handlers.handleDragOver} 
        onDrop={handlers.handleDrop}
        className={`group flex flex-col items-center justify-center w-full min-h-[220px] sm:min-h-[260px] border-2 ${isDragging ? 'border-[var(--color-primary-accent)] bg-[var(--color-primary-accent)]/15 ring-4 ring-[var(--color-focus-shadow)] ring-offset-1 ring-offset-[var(--color-bg-body)] shadow-2xl scale-[1.01]' : 'border-[var(--color-border-interactive)] border-dashed'} rounded-xl cursor-pointer bg-[var(--color-bg-surface-2)]/50 hover:bg-[var(--color-bg-surface-2)]/70 hover:border-[var(--color-border-strong)] relative p-5
                   transition-all var(--duration-fast) var(--ease-ios) will-change-transform, border, background-color dropzone-themed ${isDragging ? 'dragging' : ''}`}
        tabIndex={0}
        onKeyDown={(e) => { if(e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();}}
      >
        {isLoading ? (
            <div className="text-center animate-fadeIn">
                <LoadingSpinner size="md" className="mb-3.5"/>
                <p className="text-sm text-[var(--color-text-secondary)] font-semibold">{t('step1ProcessingFile')}</p>
            </div>
        ) : currentFiles && currentFiles.length > 0 ? (
            <div className="text-center animate-fadeIn">
                <div className="flex items-center justify-center mb-2">
                    <DocumentTextIcon className="w-8 h-8 text-[var(--color-primary-accent)] mr-2.5" />
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">
                      {currentFiles.length === 1 
                        ? currentFiles[0].name 
                        : t('step1MultipleFilesSelected', { count: currentFiles.length })}
                    </span>
                </div>
                <Button 
                    variant="link"
                    size="xs"
                    onClick={(e) => {
                        e.preventDefault(); 
                        e.stopPropagation(); // Prevent label click
                        onFileUpload([]); // Clear files by passing empty array
                         if (fileInputRef.current) fileInputRef.current.value = ''; // Reset input
                    }} 
                    className="!text-[var(--color-danger-accent)] hover:!text-[var(--color-danger-accent)]/80 text-xs"
                >
                    {t('step1RemoveFiles')}
                </Button>
            </div>
        ) : (
            <div className="flex flex-col items-center justify-center text-center group-hover:opacity-80 transition-opacity var(--duration-fast) var(--ease-ios)">
                {icon}
                <p className="mb-2 text-xs sm:text-sm text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)] transition-colors var(--duration-fast) var(--ease-ios)">
                    <span className="font-semibold text-[var(--color-primary-accent)] group-hover:text-[var(--color-primary-accent-hover)] transition-colors var(--duration-fast) var(--ease-ios)">{t('step1UploadOrDrag').split(' ')[0]}</span> {t('step1UploadOrDrag').substring(t('step1UploadOrDrag').indexOf(' ')+1)}
                </p>
                <p className="text-[0.7rem] sm:text-xs text-[var(--color-text-muted)] group-hover:text-[var(--color-text-secondary)] transition-colors var(--duration-fast) var(--ease-ios)">
                    {multipleFiles ? t('step1AcceptedFilesMultiple', {maxFileSizeMB}) : t('step1AcceptedFiles', {maxFileSizeMB})}
                </p>
            </div>
        )}
        <input id="file-upload-dropzone" ref={fileInputRef} type="file" className="hidden" onChange={handlers.handleFileChange} accept={acceptedFileTypes} disabled={isLoading} multiple={multipleFiles}/>
        {error && !isLoading && <div role="alert" className={`absolute bottom-3 left-3 right-3 p-2 bg-[var(--color-danger-accent)]/30 border border-[var(--color-danger-accent)]/60 rounded-lg text-xs text-[var(--color-danger-accent)] text-center shadow-md animate-fadeIn`}>{error}</div>}
      </label>
      {/* Display list of filenames if multiple files are selected */}
      {multipleFiles && currentFiles && currentFiles.length > 1 && !isLoading && (
          <div className="mt-3 max-h-24 overflow-y-auto thin-scrollbar-horizontal p-2 bg-[var(--color-bg-surface-1)] rounded-lg border border-[var(--color-border-default)]">
              <p className="text-xs font-medium text-[var(--color-text-muted)] mb-1.5">{t('step1MultipleFilesSelected', { count: currentFiles.length })}:</p>
              <ul className="list-none space-y-1">
                  {currentFiles.map((file, index) => (
                      <li key={index} className="text-xs text-[var(--color-text-secondary)] flex items-center">
                          <DocumentTextIcon className="w-3 h-3 mr-1.5 flex-shrink-0 text-[var(--color-text-muted)]" />
                          <span className="truncate" title={file.name}>{file.name}</span>
                      </li>
                  ))}
              </ul>
          </div>
      )}
    </div>
  );
};
Dropzone.displayName = "Dropzone";

interface NotificationDisplayProps {
  notification: NotificationState | null;
  onClose: () => void;
}

export const NotificationDisplay: React.FC<NotificationDisplayProps> = ({ notification, onClose }) => {
  const { t } = useTranslation();
  
  if (!notification) return null;

  const { type, message } = notification;

  // Sử dụng design system của QuizAI với CSS variables và style tương tự Button/Alert
  let variantStyle = '';
  let IconComponent: React.FC<any> | null = InformationCircleIcon;

  switch (type) {
    case 'error':
      variantStyle = 'bg-[var(--color-danger-accent)]/15 border-[var(--color-danger-accent)]/40 text-[var(--color-danger-accent)] shadow-lg shadow-[var(--color-danger-accent)]/20';
      IconComponent = ErrorIcon;
      break;
    case 'success':
      variantStyle = 'bg-[var(--color-success-accent)]/15 border-[var(--color-success-accent)]/40 text-[var(--color-success-accent)] shadow-lg shadow-[var(--color-success-accent)]/20';
      IconComponent = CheckCircleIcon;
      break;
    case 'info':
      variantStyle = 'bg-[var(--color-primary-accent)]/15 border-[var(--color-primary-accent)]/40 text-[var(--color-primary-accent)] shadow-lg shadow-[var(--color-primary-accent)]/20';
      IconComponent = InformationCircleIcon;
      break;
    case 'warning':
      variantStyle = 'bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-400 shadow-lg shadow-amber-500/20';
      IconComponent = InformationCircleIcon;
      break;
    default:
      variantStyle = 'bg-[var(--color-bg-surface-3)] border-[var(--color-border-strong)] text-[var(--color-text-primary)] shadow-md';
      break;
  }

  const notificationId = useId();

  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      aria-labelledby={`${notificationId}-message`}
      className={`fixed top-5 right-5 sm:top-6 sm:right-6 z-[200] w-auto max-w-[calc(100%-2.5rem)] sm:max-w-md
                  animate-slideInRight transition-all var(--duration-fast) var(--ease-ios)
                  transform hover:scale-[1.02] will-change-transform`}
    >
      <div className={`flex items-start p-4 border-2 rounded-xl backdrop-blur-sm ${variantStyle}`}>
        {IconComponent && (
          <div className="flex-shrink-0 mr-3 mt-0.5">
            <IconComponent className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        )}
        <div className="flex-grow">
          <p id={`${notificationId}-message`} className="text-sm sm:text-base font-semibold leading-snug">
            {message}
          </p>
        </div>
        <div className="ml-3 flex-shrink-0">
          <button
            onClick={onClose}
            className={`p-1.5 rounded-md hover:bg-black/10 dark:hover:bg-white/10 
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-current/30 
                       transition-colors var(--duration-fast) var(--ease-ios)
                       hover:scale-110 active:scale-95`}
            aria-label={t('close')}
          >
            <CloseIcon className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
NotificationDisplay.displayName = "NotificationDisplay";


interface AlertProps {
  variant?: 'info' | 'warning' | 'error' | 'success';
  className?: string;
  children: ReactNode;
}
export const Alert: React.FC<AlertProps> = ({ variant = 'info', className = '', children }) => {
  const baseStyle = "p-4 rounded-lg border";
  const variantStyles = {
    info: "bg-[var(--color-primary-accent)]/10 border-[var(--color-primary-accent)]/30 text-[var(--color-primary-accent)] dark:text-sky-300 dark:border-sky-300/30 dark:bg-sky-500/10",
    warning: "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 dark:border-amber-400/30 dark:bg-amber-500/10",
    error: "bg-[var(--color-danger-accent)]/10 border-[var(--color-danger-accent)]/30 text-[var(--color-danger-accent)] dark:text-red-400 dark:border-red-400/30 dark:bg-red-500/10",
    success: "bg-[var(--color-success-accent)]/10 border-[var(--color-success-accent)]/30 text-[var(--color-success-accent)] dark:text-green-400 dark:border-green-400/30 dark:bg-green-500/10",
  };
  return (
    <div role="alert" className={`${baseStyle} ${variantStyles[variant]} ${className}`}>
      {children}
    </div>
  );
};
Alert.displayName = "Alert";
