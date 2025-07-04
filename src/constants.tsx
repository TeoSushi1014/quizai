
import React from 'react';
import { Pencil as LucidePencil } from 'lucide-react';

export const APP_NAME = "QuizAI";

export const GEMINI_MODEL_ID: 'gemini' = 'gemini';

export const GEMINI_TEXT_MODEL = "gemini-2.5-flash-preview-04-17";

interface IconProps {
  className?: string;
  strokeWidth?: number;
}

export { LucidePencil as EditIcon };


export const UploadIcon: React.FC<IconProps> = ({ className = "w-6 h-6", strokeWidth = 1.5 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={strokeWidth} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v12" />
  </svg>
);
UploadIcon.displayName = "UploadIcon";


export const ShareIcon: React.FC<IconProps> = ({ className = "w-6 h-6" }) => (
  <img src="https://img.icons8.com/?size=256&id=fe3NTBhh8IKg&format=png" alt="Share" className={className} />
);
ShareIcon.displayName = "ShareIcon";

export const PlusIcon: React.FC<IconProps> = ({ className = "w-6 h-6", strokeWidth = 1.5 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={strokeWidth} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
);
PlusIcon.displayName = "PlusIcon";

export const DocumentTextIcon: React.FC<IconProps> = ({ className = "w-6 h-6" }) => (
  <img src="https://img.icons8.com/?size=256&id=XWoSyGbnshH2&format=png" alt="File" className={className} />
);
DocumentTextIcon.displayName = "DocumentTextIcon";

export const ChartBarIcon: React.FC<IconProps> = ({ className = "w-6 h-6" }) => (
  <img src="https://img.icons8.com/?size=256&id=UD9nG7mgbuXZ&format=png" alt="Dashboard" className={className} />
);
ChartBarIcon.displayName = "ChartBarIcon";

export const DeleteIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <img src="https://img.icons8.com/?size=256&id=OZuepOQd0omj&format=png" alt="Delete" className={className} />
);
DeleteIcon.displayName = "DeleteIcon";

export const CheckCircleIcon: React.FC<IconProps & {isFilled?: boolean}> = ({ className = "w-6 h-6 text-green-500", strokeWidth = 1.5, isFilled }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill={isFilled ? "currentColor" : "none"} 
    stroke={isFilled ? "none" : "currentColor"} 
    strokeWidth={isFilled ? undefined : strokeWidth} 
    className={className}
  >
    {isFilled ? (
      <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.06-1.06l-3.25 3.25-1.5-1.5a.75.75 0 00-1.06 1.06l2 2a.75.75 0 001.06 0l3.75-3.75z" clipRule="evenodd" />
    ) : (
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    )}
  </svg>
);
CheckCircleIcon.displayName = "CheckCircleIcon";

export const XCircleIcon: React.FC<IconProps> = ({ className = "w-6 h-6 text-red-500", strokeWidth = 1.5 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={strokeWidth} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
XCircleIcon.displayName = "XCircleIcon";

export const LightbulbIcon: React.FC<IconProps> = ({ className = "w-6 h-6" }) => (
  <span className={className}>💡</span>
);
LightbulbIcon.displayName = "LightbulbIcon";

export const ChevronDownIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.23 8.29a.75.75 0 01.02-1.06z" clipRule="evenodd" />
  </svg>
);
ChevronDownIcon.displayName = "ChevronDownIcon";

export const ChevronRightIcon: React.FC<IconProps> = ({ className = "w-5 h-5", strokeWidth = 2 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={strokeWidth} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
  </svg>
);
ChevronRightIcon.displayName = "ChevronRightIcon";

export const ChevronLeftIcon: React.FC<IconProps> = ({ className = "w-5 h-5", strokeWidth = 2 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={strokeWidth} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
  </svg>
);
ChevronLeftIcon.displayName = "ChevronLeftIcon";

export const SaveIcon: React.FC<IconProps> = ({ className = "w-5 h-5", strokeWidth = 1.5 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={strokeWidth} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 3.75H6.912a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.663V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.663L18.24 5.338a2.25 2.25 0 00-2.15-1.588H15M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859M12 3v8.25m0 0l-3-3m3 3l3-3" />
  </svg>
);
SaveIcon.displayName = "SaveIcon";

export const ArrowUturnLeftIcon: React.FC<IconProps> = ({ className = "w-5 h-5", strokeWidth = 1.5 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={strokeWidth} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
  </svg>
);
ArrowUturnLeftIcon.displayName = "ArrowUturnLeftIcon";

export const HomeIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <img src="https://img.icons8.com/?size=256&id=wFfu6zXx15Yk&format=png" alt="Home" className={className} />
);
HomeIcon.displayName = "HomeIcon";

export const InformationCircleIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <img src="https://img.icons8.com/?size=256&id=VQOfeAx5KWTK&format=png" alt="Information" className={className} />
);
InformationCircleIcon.displayName = "InformationCircleIcon";

export const PlusCircleIcon: React.FC<IconProps> = ({ className = "w-6 h-6" }) => (
  <img src="https://img.icons8.com/?size=256&id=7LhMaNDFgoYK&format=png" alt="Create Quiz" className={className} />
);
PlusCircleIcon.displayName = "PlusCircleIcon";

export const CircleIcon: React.FC<IconProps & {isFilled?: boolean}> = ({ className = "w-5 h-5", strokeWidth = 2, isFilled }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill={isFilled ? "currentColor" : "none"} viewBox="0 0 24 24" strokeWidth={strokeWidth} stroke="currentColor" className={className}>
    <circle cx="12" cy="12" r="7.5" />
  </svg>
);
CircleIcon.displayName = "CircleIcon";

export const UserCircleIcon: React.FC<IconProps> = ({ className = "w-6 h-6" }) => (
  <img src="https://img.icons8.com/?size=256&id=kDoeg22e5jUY&format=png" alt="Profile" className={className} />
);
UserCircleIcon.displayName = "UserCircleIcon";

export const KeyIcon: React.FC<IconProps> = ({ className = "w-4 h-4", strokeWidth = 1.5 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={strokeWidth} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
  </svg>
);
KeyIcon.displayName = "KeyIcon";

export const LogoutIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
   <img src="https://img.icons8.com/?size=256&id=uVA8I3rgWfOs&format=png" alt="Logout" className={className} />
);
LogoutIcon.displayName = "LogoutIcon";

export const CopyIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <img src="https://img.icons8.com/?size=256&id=rByZVfKrdkJo&format=png" alt="Copy" className={className} />
);
CopyIcon.displayName = "CopyIcon";

export const DownloadIcon: React.FC<IconProps> = ({ className = "w-5 h-5", strokeWidth = 1.5 }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={strokeWidth} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
);
DownloadIcon.displayName = "DownloadIcon";

export const ExportIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <img src="https://img.icons8.com/?size=256&id=80348&format=png" alt="Export" className={className} />
);
ExportIcon.displayName = "ExportIcon";

export const RefreshIcon: React.FC<{className?: string}> = ({className = "w-5 h-5"}) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
    <path d="M3 21v-5h5" />
  </svg>
);
RefreshIcon.displayName = "RefreshIcon";

// Icon for general settings, including theme settings.
export const SettingsIconSvg: React.FC<IconProps> = ({ className = "w-6 h-6" }) => (
  <img src="https://img.icons8.com/?size=256&id=GPMAau8xXPb4&format=png" alt="Settings" className={className} />
);
SettingsIconSvg.displayName = "SettingsIconSvg";

export const SettingsIcon: React.FC<IconProps> = SettingsIconSvg;

export const SettingsIconMobileNav: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <img src="https://img.icons8.com/?size=256&id=s5NUIabJrb4C&format=png" alt="Settings" className={className} />
);
SettingsIconMobileNav.displayName = "SettingsIconMobileNav";


export const GoogleDriveIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <img src="https://img.icons8.com/color/48/google-drive--v1.png" alt="Google Drive" className={className}/>
);
GoogleDriveIcon.displayName = "GoogleDriveIcon";

export const SunIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <img src="https://img.icons8.com/?size=256&id=8EUmYhfLPTCF&format=png" alt="Light Mode" className={className} />
);
SunIcon.displayName = "SunIcon";

export const MoonIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <img src="https://img.icons8.com/?size=256&id=Opvt5B6x4fI4&format=png" alt="Dark Mode" className={className} />
);
MoonIcon.displayName = "MoonIcon";

export const UserIcon: React.FC<IconProps> = ({ className = "w-6 h-6" }) => (
  <img src="https://img.icons8.com/?size=256&id=7820&format=png" alt="User" className={className} />
);
UserIcon.displayName = "UserIcon";

export const PlayIcon: React.FC<IconProps> = ({ className = "w-6 h-6", strokeWidth = 1.5 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" strokeWidth={strokeWidth} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
  </svg>
);
PlayIcon.displayName = "PlayIcon";

export const FacebookIcon: React.FC<IconProps> = ({ className = "w-6 h-6" }) => (
  <img src="https://img.icons8.com/?size=256&id=uLWV5A9vXIPu&format=png" alt="Facebook" className={className} />
);
FacebookIcon.displayName = "FacebookIcon";

export const XIcon: React.FC<IconProps> = ({ className = "w-6 h-6" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    className={className}
    fill="currentColor" 
    aria-label="X logo" 
  >
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);


export const LinkedInIcon: React.FC<IconProps> = ({ className = "w-6 h-6" }) => (
  <img src="https://img.icons8.com/?size=256&id=xuvGCOXi8Wyg&format=png" alt="LinkedIn" className={className} />
);
LinkedInIcon.displayName = "LinkedInIcon";