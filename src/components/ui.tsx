



import React, { ReactNode, useState, useRef, useEffect, Children, cloneElement, ReactElement } from 'react';
import ReactDOM from 'react-dom'; 
import { ChevronDownIcon, UploadIcon as DefaultUploadIcon, InformationCircleIcon, XCircleIcon as CloseIcon } from '../constants'; // Added CloseIcon
import { useTranslation } from '../App';
import { NotificationState, NotificationType } from '../hooks/useNotification'; // Added NotificationState and Type

export interface TooltipProps {
  content: ReactNode;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end' | 'left-start' | 'left-end' | 'right-start' | 'right-end';
  children: ReactNode;
  wrapperClassName?: string;
  tooltipClassName?: string;
  delayDuration?: number;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  placement = 'top',
  children,
  wrapperClassName = '',
  tooltipClassName = '',
  delayDuration = 100, 
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

  const baseTooltipStyle = `absolute z-50 whitespace-nowrap rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-100 shadow-xl ring-1 ring-slate-700/50 pointer-events-none
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
        
        // Check for tabIndex on props
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
      {content && ( 
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
  ...props
}, ref) => {
  const baseStyle = `inline-flex items-center justify-center font-semibold rounded-lg focus:outline-none 
                     disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none
                     transition-all var(--duration-fast) var(--ease-ios)
                     hover:scale-[1.02] active:scale-[0.98] will-change-transform`; 

  const variantStyles = {
    primary: "bg-sky-500 hover:bg-sky-400 text-white shadow-lg hover:shadow-sky-400/40 focus-visible:ring-4 focus-visible:ring-sky-400/30 disabled:bg-sky-500/50 border border-transparent",
    secondary: "bg-slate-700 hover:bg-slate-600 text-slate-100 shadow-md hover:shadow-slate-900/50 focus-visible:ring-4 focus-visible:ring-slate-400/20 disabled:bg-slate-700/70 disabled:text-slate-400 border border-transparent",
    outline: "border-2 border-sky-400 text-sky-300 hover:bg-sky-400/15 hover:text-sky-200 focus-visible:ring-4 focus-visible:ring-sky-400/20 shadow-none disabled:border-slate-600 disabled:text-slate-500",
    subtle: "bg-slate-700/60 hover:bg-slate-600/80 text-slate-200 focus-visible:ring-4 focus-visible:ring-slate-400/20 shadow-none border border-transparent disabled:text-slate-500",
    danger: "bg-red-500 hover:bg-red-600 text-white shadow-lg hover:shadow-red-500/40 focus-visible:ring-4 focus-visible:ring-red-500/30 disabled:bg-red-500/50 border border-transparent",
    ghost: "bg-transparent hover:bg-slate-400/10 text-slate-300 hover:text-sky-300 focus-visible:ring-4 focus-visible:ring-slate-400/20 disabled:text-slate-500 shadow-none border border-transparent",
    link: "bg-transparent text-sky-400 hover:text-sky-300 hover:underline focus-visible:ring-1 focus-visible:ring-sky-400/50 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900 rounded-sm shadow-none p-0 border border-transparent !hover:scale-100 !active:scale-100", 
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

  return tooltip ? <Tooltip content={tooltip} placement={tooltipPlacement} wrapperClassName="inline-flex">{buttonElement}</Tooltip> : buttonElement;
});
Button.displayName = 'Button';

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  useGlassEffect?: boolean;
  style?: React.CSSProperties;
}

export const Card: React.FC<CardProps> = ({ children, className = '', onClick, useGlassEffect = false, style }) => {
  const baseClasses = `rounded-xl p-6 md:p-8 ${onClick ? 'card-float-hover' : ''}`;
  const themeClasses = useGlassEffect
    ? "glass-effect" 
    : "bg-slate-800 shadow-slate-950/50 border border-slate-700/70 transition-all var(--duration-normal) var(--ease-ios)";
  const interactivityClasses = onClick ? "cursor-pointer" : "";

  const combinedClassName = `${baseClasses} ${themeClasses} ${interactivityClasses} ${className}`.trim().replace(/\s+/g, ' ');
  
  return (
    <div
      className={combinedClassName}
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
}

export const Input: React.FC<InputProps> = ({ label, name, error, className = '', icon, containerClassName = '', inputClassName = '', ...props }) => {
  return (
    <div className={`w-full ${containerClassName}`}>
      {label && <label htmlFor={name} className="block text-sm font-medium text-slate-200 mb-2">{label}</label>}
      <div className="relative">
        {icon && <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500">{icon}</div>}
        <input
          id={name}
          name={name}
          className={`block w-full bg-slate-700/40 border ${error ? 'border-red-500/80 focus:ring-red-500/50 focus:border-red-500' : 'border-slate-600 focus:ring-sky-400/50 focus:border-sky-400'} text-slate-100 rounded-lg shadow-sm py-3 ${icon ? 'pl-12' : 'px-4'} focus:outline-none sm:text-sm placeholder-slate-500 hover:border-slate-500 focus:bg-slate-700/70 disabled:opacity-60 disabled:bg-slate-700/20 disabled:cursor-not-allowed 
                     transition-colors var(--duration-fast) var(--ease-ios), border-color var(--duration-fast) var(--ease-ios), box-shadow var(--duration-fast) var(--ease-ios) will-change-border, background-color, box-shadow
                     ${inputClassName} ${className}`}
          {...props}
        />
      </div>
      {error && <p className={`mt-2 text-xs text-red-500 animate-fadeIn`}>{error}</p>}
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
  return (
    <div className={`w-full ${containerClassName}`}>
      {label && <label htmlFor={name} className="block text-sm font-medium text-slate-200 mb-2">{label}</label>}
      <textarea
        id={name}
        name={name}
        rows={4}
        className={`block w-full bg-slate-700/40 border ${error ? 'border-red-500/80 focus:ring-red-500/50 focus:border-red-500' : 'border-slate-600 focus:ring-sky-400/50 focus:border-sky-400'} text-slate-100 rounded-lg shadow-sm py-3 px-4 focus:outline-none sm:text-sm placeholder-slate-500 hover:border-slate-500 focus:bg-slate-700/70 disabled:opacity-60 disabled:bg-slate-700/20 disabled:cursor-not-allowed resize-none
                     transition-colors var(--duration-fast) var(--ease-ios), border-color var(--duration-fast) var(--ease-ios), box-shadow var(--duration-fast) var(--ease-ios) will-change-border, background-color, box-shadow
                     ${className}`}
        {...props}
      />
      {error && <p className={`mt-2 text-xs text-red-500 animate-fadeIn`}>{error}</p>}
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
  return (
    <div className={`w-full ${containerClassName}`}>
      {label && <label htmlFor={name} className="block text-sm font-medium text-slate-200 mb-2">{label}</label>}
      <div className="relative">
        <select
          id={name}
          name={name}
          disabled={disabled}
          className={`block w-full bg-slate-700/40 border ${error ? 'border-red-500/80 focus:ring-red-500/50 focus:border-red-500' : 'border-slate-600 focus:ring-sky-400/50 focus:border-sky-400'} text-slate-100 rounded-lg shadow-sm py-3 px-4 focus:outline-none sm:text-sm appearance-none pr-10 hover:border-slate-500 focus:bg-slate-700/70 ${disabled ? 'opacity-60 bg-slate-700/30 text-slate-400 cursor-not-allowed' : ''}
                     transition-colors var(--duration-fast) var(--ease-ios), border-color var(--duration-fast) var(--ease-ios), box-shadow var(--duration-fast) var(--ease-ios) will-change-border, background-color, box-shadow
                     ${className}`}
          {...props}
        >
          {options.map(opt => (
            <option key={opt.value} value={opt.value} className="bg-slate-800 text-slate-100">{opt.label}</option>
          ))}
        </select>
        <ChevronDownIcon className={`absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 ${disabled ? 'text-slate-600' : 'text-slate-500'} pointer-events-none transition-transform var(--duration-fast) var(--ease-ios)`} />
      </div>
      {error && <p className={`mt-2 text-xs text-red-500 animate-fadeIn`}>{error}</p>}
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
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = 'md', footerContent, titleClassName = '', hideCloseButton = false }) => {
  const [isMounted, setIsMounted] = useState(false);
  const [animationState, setAnimationState] = useState<'hidden' | 'entering' | 'visible' | 'exiting'>('hidden');
  const modalRef = useRef<HTMLDivElement>(null);

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
      }, parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--duration-fast') || '250'));


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
      }, parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--duration-fast') || '250'));
      return () => clearTimeout(timer);
    }
  }, [isOpen, onClose]);

  const animationStateRef = useRef(animationState);
  useEffect(() => {
    animationStateRef.current = animationState;
  }, [animationState]);


  if (!isMounted || animationState === 'hidden') return null;

  const sizeClasses = {
    sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-xl', xl: 'max-w-3xl',
    '2xl': 'max-w-5xl', '3xl': 'max-w-7xl', full: 'max-w-full h-full !rounded-none sm:!rounded-2xl',
  };
  
  const modalTitleId = typeof title === 'string' && title ? 'modal-title' : undefined;

  let modalContainerClasses = `bg-slate-800/90 backdrop-blur-md rounded-2xl shadow-2xl w-full ${sizeClasses[size]} flex flex-col max-h-[90vh] !border-slate-700/50 overflow-hidden m-4 border`;
  if (animationState === 'entering') {
    modalContainerClasses += ' modal-container-animate-enter-active';
  } else if (animationState === 'exiting') {
    modalContainerClasses += ' modal-container-animate-exit-active';
  } else if (animationState === 'visible') {
     modalContainerClasses += ' modal-container-animate-enter-active'; 
  } else {
     modalContainerClasses += ' modal-container-animate-enter'; 
  }


  return ReactDOM.createPortal(
    <div
        className={`fixed inset-0 z-[100] flex items-center justify-center modal-backdrop-enhanced ${isOpen || animationState === 'exiting' ? 'open' : ''}`}
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
            <div className="flex items-center justify-between p-5 sm:p-6 border-b border-slate-700/70">
            {title && <h3 id={modalTitleId} className={`text-lg md:text-xl font-semibold text-slate-50 ${titleClassName}`}>{title}</h3>}
            {!hideCloseButton && (
                <button
                    onClick={onClose}
                    className="p-2 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-400/10 focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800 transition-colors var(--duration-fast) var(--ease-ios)"
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
          <div className="p-5 sm:p-6 border-t border-slate-700/70 bg-slate-700/20 rounded-b-2xl">
            {footerContent}
          </div>
        )}
      </div>
    </div>,
    document.body 
  );
};
Modal.displayName = "Modal";

export const LoadingSpinner: React.FC<{text?: string; size?: 'sm' | 'md' | 'lg' | 'xl'; className?: string; textClassName?: string;}> = ({ text, size = 'md', className, textClassName }) => {
  const sizeClasses = { sm: 'w-7 h-7', md: 'w-10 h-10', lg: 'w-14 h-14', xl: 'w-20 h-20' };
  const textClasses = { sm: 'text-sm', md: 'text-base', lg: 'text-lg', xl: 'text-xl' };
  return (
    <div className={`flex flex-col items-center justify-center space-y-3.5 p-4 animate-fadeIn ${className || ''}`}>
      <svg className={`animate-spin text-sky-400 ${sizeClasses[size]}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle>
        <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      {text && <p className={`text-slate-300 font-medium ${textClasses[size]} ${textClassName || ''}`}>{text}</p>}
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
      {(label || showPercentage) && <div className="flex justify-between text-xs text-slate-400 mb-1.5">
        {label && <span className="font-medium">{label}</span>}
        {showPercentage && <span className="font-semibold text-slate-200">{safeProgress.toFixed(0)}%</span>}
      </div>}
      <div className={`w-full bg-slate-700/80 rounded-full ${heightClass} overflow-hidden shadow-inner`}>
        <div
          className={`${barClassName || 'bg-sky-400'} ${heightClass} rounded-full transition-width var(--duration-normal) var(--ease-ios) ${shimmerClass}`}
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
    <div className={`border border-slate-700/70 rounded-xl overflow-hidden bg-slate-800 shadow-lg transition-shadow var(--duration-fast) var(--ease-ios) ${containerClassName || ''}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex justify-between items-center p-4 sm:p-5 hover:bg-slate-700/50 text-left focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-inset
         transition-colors var(--duration-fast) var(--ease-ios) ${isOpen ? "bg-slate-700/30 border-b border-slate-700/60" : "bg-transparent"} ${titleClassName || ''}`}
        aria-expanded={isOpen}
      >
        <div className="flex items-center flex-grow min-w-0 mr-2">
            {icon && <span className="mr-3.5 text-sky-400 flex-shrink-0">{icon}</span>}
            <span className="font-semibold text-slate-100 text-sm sm:text-base block min-w-0 w-full">{title}</span>
        </div>
        {chevronIcon ? React.cloneElement(chevronIcon, { className: `transform transition-transform var(--duration-fast) var(--ease-ios) ${isOpen ? 'rotate-180' : ''} ${chevronIcon.props.className || ''}`}) 
                     : <ChevronDownIcon className={`w-5 h-5 text-slate-400 transform transition-transform var(--duration-fast) var(--ease-ios) ${isOpen ? 'rotate-180' : ''}`} />}
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
        className={`bg-slate-700/20 ${contentClassName || ''}`}
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
  description?: string;
  labelClassName?: string;
  containerClassName?: string;
  disabled?: boolean;
}

export const Toggle: React.FC<ToggleProps> = ({ label, checked, onChange, name, description, labelClassName = '', containerClassName = '', disabled = false }) => {
  const id = name || (typeof label === 'string' ? label.replace(/\s+/g, '-').toLowerCase() : `toggle-${Math.random().toString(36).substring(2, 9)}`);
  return (
    <div className={`flex items-start ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${containerClassName}`}>
        <button
            role="switch"
            aria-checked={checked}
            onClick={() => !disabled && onChange(!checked)}
            id={id}
            className={`relative inline-flex flex-shrink-0 h-6 w-11 items-center rounded-full cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800 
                       transition-colors var(--duration-fast) var(--ease-ios) will-change-background
                       ${checked ? 'bg-sky-400' : 'bg-slate-600'}`}
            disabled={disabled}
        >
            <span className="sr-only">Use setting</span>
            <span
                aria-hidden="true"
                className={`dot pointer-events-none inline-block h-5 w-5 transform rounded-full shadow-lg ring-0`} 
            />
        </button>
        {(label || description) && (
            <div className="ml-3.5">
                {typeof label === 'string' ? (
                    <label htmlFor={id} className={`text-slate-100 text-sm font-medium ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'} ${labelClassName}`}>{label}</label>
                ) : (
                     <div className={`${disabled ? 'cursor-not-allowed' : 'cursor-pointer'} ${labelClassName}`} onClick={() => !disabled && onChange(!checked)}>{label}</div>
                )}
                {description && <p className={`text-xs text-slate-400 mt-1 animate-fadeIn`}>{description}</p>}
            </div>
        )}
    </div>
  );
};
Toggle.displayName = "Toggle";

interface DropzoneProps {
  onFileUpload: (file: File) => void;
  acceptedFileTypes?: string;
  maxFileSizeMB?: number;
  label?: ReactNode;
  icon?: ReactNode;
  isLoading?: boolean;
  currentFile?: File | null;
}

export const Dropzone: React.FC<DropzoneProps> = ({
    onFileUpload,
    acceptedFileTypes = ".pdf,.txt,.docx,.jpg,.png,.jpeg",
    maxFileSizeMB = 10,
    label,
    icon = <DefaultUploadIcon className="w-10 h-10 sm:w-12 sm:h-12 mb-3 text-slate-500 group-hover:text-sky-400 transition-colors var(--duration-fast) var(--ease-ios)" strokeWidth={1}/>,
    isLoading = false,
    currentFile = null,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation();

  const handleDragEnter = (e: React.DragEvent<HTMLLabelElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); setError(null);};
  const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => { e.preventDefault(); e.stopPropagation(); };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false); setError(null);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) validateAndUploadFile(files[0]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const files = e.target.files;
    if (files && files.length > 0) validateAndUploadFile(files[0]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const validateAndUploadFile = (file: File) => {
    if (file.size > maxFileSizeMB * 1024 * 1024) {
      setError(t('step1ErrorProcessingFile') + ` ${t('error')}: Max size ${maxFileSizeMB}MB.`); return;
    }

    const acceptedTypesArray = acceptedFileTypes.split(',').map(type => type.trim().toLowerCase());
    const fileExtension = ("." + file.name.split('.').pop()?.toLowerCase()) || "";
    const fileMimeType = file.type.toLowerCase();

    let isValidType = acceptedTypesArray.includes(fileExtension);
    if (!isValidType) {
      isValidType = acceptedTypesArray.some(acceptedType => {
        if (acceptedType.startsWith('.')) return false;
        if (acceptedType.endsWith('/*')) return fileMimeType.startsWith(acceptedType.slice(0, -2));
        return fileMimeType === acceptedType;
      });
    }
    if (!isValidType && fileExtension === '.docx' && acceptedFileTypes.includes('.docx')) { isValidType = true; }
    if (!isValidType && fileExtension === '.pdf' && acceptedFileTypes.includes('.pdf')) { isValidType = true; }


    if (!isValidType) {
        setError(`${t('step1ErrorUnsupportedFile')} ${t('error')}: Accepted types are ${acceptedFileTypes.replace(/\./g, '').toUpperCase()}`); return;
    }
    onFileUpload(file);
  };

  return (
    <div className="w-full">
      {label && <div className="block text-sm font-medium text-slate-200 mb-2.5">{label}</div>}
      <label
        htmlFor="file-upload-dropzone"
        onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragOver={handleDragOver} onDrop={handleDrop}
        className={`group flex flex-col items-center justify-center w-full min-h-[220px] sm:min-h-[260px] border-2 ${isDragging ? 'border-sky-400 bg-sky-400/15 ring-4 ring-sky-400/20 ring-offset-1 ring-offset-slate-900 shadow-2xl scale-[1.01]' : 'border-slate-600 border-dashed'} rounded-xl cursor-pointer bg-slate-700/50 hover:bg-slate-700/70 hover:border-slate-500 relative p-5
                   transition-all var(--duration-fast) var(--ease-ios) will-change-transform, border, background-color`}
        tabIndex={0}
        onKeyDown={(e) => { if(e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();}}
      >
        {isLoading || currentFile ? (
            <div className="text-center animate-fadeIn">
                <LoadingSpinner size="md" className="mb-3.5"/>
                <p className="text-sm text-slate-300 font-semibold">{isLoading ? t('step1ProcessingFile') : t('loading')}</p>
                {currentFile && <p className="text-xs text-slate-400 mt-1.5 truncate max-w-[200px] sm:max-w-xs">{currentFile.name}</p>}
            </div>
        ) : (
            <div className="flex flex-col items-center justify-center text-center group-hover:opacity-80 transition-opacity var(--duration-fast) var(--ease-ios)">
            {icon}
            <p className="mb-2 text-xs sm:text-sm text-slate-300 group-hover:text-slate-200 transition-colors var(--duration-fast) var(--ease-ios)">
                <span className="font-semibold text-sky-400 group-hover:text-sky-300 transition-colors var(--duration-fast) var(--ease-ios)">{t('step1UploadOrDrag').split(' ')[0]}</span> {t('step1UploadOrDrag').substring(t('step1UploadOrDrag').indexOf(' ')+1)}
            </p>
            <p className="text-[0.7rem] sm:text-xs text-slate-400 group-hover:text-slate-300 transition-colors var(--duration-fast) var(--ease-ios)">{t('step1AcceptedFiles', {maxFileSizeMB})}</p>
            </div>
        )}
        <input id="file-upload-dropzone" ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} accept={acceptedFileTypes} disabled={isLoading || !!currentFile}/>
        {error && !isLoading && !currentFile && <div role="alert" className={`absolute bottom-3 left-3 right-3 p-2 bg-red-500/30 border border-red-500/60 rounded-lg text-xs text-red-200 text-center shadow-md animate-fadeIn`}>{error}</div>}
      </label>
    </div>
  );
};
Dropzone.displayName = "Dropzone";

interface NotificationDisplayProps {
  notification: NotificationState | null;
  onClose: () => void;
}

export const NotificationDisplay: React.FC<NotificationDisplayProps> = ({ notification, onClose }) => {
  if (!notification) return null;

  const { type, message } = notification;

  let bgColor = '';
  let borderColor = '';
  let textColor = '';
  let IconComponent: React.FC<any> | null = null; // Type for icon component

  switch (type) {
    case 'error':
      bgColor = 'bg-red-600';
      borderColor = 'border-red-700';
      textColor = 'text-white';
      IconComponent = InformationCircleIcon; // Example, use appropriate icons
      break;
    case 'success':
      bgColor = 'bg-green-500';
      borderColor = 'border-green-600';
      textColor = 'text-white';
      IconComponent = InformationCircleIcon; // Example
      break;
    case 'info':
      bgColor = 'bg-sky-500';
      borderColor = 'border-sky-600';
      textColor = 'text-white';
      IconComponent = InformationCircleIcon;
      break;
    case 'warning':
      bgColor = 'bg-amber-500';
      borderColor = 'border-amber-600';
      textColor = 'text-white';
      IconComponent = InformationCircleIcon; // Example
      break;
    default:
      bgColor = 'bg-slate-700';
      borderColor = 'border-slate-800';
      textColor = 'text-slate-100';
      IconComponent = InformationCircleIcon;
  }

  return (
    <div 
      role="alert"
      className={`fixed top-5 right-5 md:top-6 md:right-6 p-4 rounded-lg shadow-2xl border-l-4 z-[200] animate-slideInRightPage max-w-sm w-[calc(100%-2.5rem)] sm:w-auto ${bgColor} ${borderColor} ${textColor}`}
    >
      <div className="flex items-start">
        {IconComponent && <IconComponent className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5" />}
        <div className="flex-grow text-sm font-medium">{message}</div>
        <button
          onClick={onClose}
          className="ml-4 -mr-1 -mt-1 p-1.5 rounded-full text-current opacity-80 hover:opacity-100 hover:bg-black/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 transition-opacity"
          aria-label="Close notification"
        >
          <CloseIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
NotificationDisplay.displayName = "NotificationDisplay";
