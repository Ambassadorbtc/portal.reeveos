/**
 * BrandIcons — Official brand SVG logos in their real colors
 * Use these everywhere instead of Font Awesome or white-on-color buttons
 * 
 * Usage:
 *   import { WhatsAppIcon, InstagramIcon, FacebookIcon, GoogleIcon } from '../../components/ui/BrandIcons'
 *   <WhatsAppIcon size={20} />
 */

export const WhatsAppIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" className={className} fill="none">
    <path d="M24 2C11.85 2 2 11.85 2 24c0 3.89 1.02 7.54 2.8 10.7L2 46l11.6-2.76C16.56 44.96 20.16 46 24 46c12.15 0 22-9.85 22-22S36.15 2 24 2z" fill="#25D366"/>
    <path d="M34.6 28.4c-.58-.29-3.43-1.7-3.96-1.89-.54-.2-.93-.29-1.32.29-.39.58-1.51 1.89-1.85 2.28-.34.39-.68.44-1.26.15-.58-.29-2.45-.9-4.67-2.88-1.73-1.54-2.89-3.44-3.23-4.02-.34-.58-.04-.9.25-1.19.26-.26.58-.68.87-1.02.29-.34.39-.58.58-.97.2-.39.1-.73-.05-1.02-.15-.29-1.32-3.18-1.8-4.36-.48-1.14-.96-.99-1.32-1.01-.34-.02-.73-.02-1.12-.02s-1.02.15-1.56.73c-.54.58-2.04 2-2.04 4.87s2.09 5.65 2.38 6.04c.29.39 4.11 6.27 9.96 8.8 1.39.6 2.48.96 3.33 1.23 1.4.44 2.67.38 3.67.23 1.12-.17 3.43-1.4 3.92-2.76.49-1.36.49-2.52.34-2.76-.14-.24-.54-.39-1.12-.68z" fill="white"/>
  </svg>
)

export const InstagramIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" className={className} fill="none">
    <defs>
      <radialGradient id="ig1" cx="19.38" cy="42.035" r="44.899" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#FD5"/>
        <stop offset=".1" stopColor="#FD5"/>
        <stop offset=".5" stopColor="#FF543E"/>
        <stop offset="1" stopColor="#C837AB"/>
      </radialGradient>
      <radialGradient id="ig2" cx="11.786" cy="-2.903" r="65.136" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#3771C8"/>
        <stop offset=".128" stopColor="#3771C8"/>
        <stop offset="1" stopColor="#6600FF" stopOpacity="0"/>
      </radialGradient>
    </defs>
    <rect x="2" y="2" width="44" height="44" rx="14" fill="url(#ig1)"/>
    <rect x="2" y="2" width="44" height="44" rx="14" fill="url(#ig2)"/>
    <circle cx="24" cy="24" r="8.5" stroke="white" strokeWidth="2.5" fill="none"/>
    <circle cx="34.5" cy="13.5" r="2" fill="white"/>
    <rect x="8" y="8" width="32" height="32" rx="10" stroke="white" strokeWidth="2.5" fill="none"/>
  </svg>
)

export const FacebookIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" className={className} fill="none">
    <path d="M24 2C11.85 2 2 11.85 2 24c0 10.98 8.03 20.09 18.53 21.73V30.09h-5.57v-6.09h5.57v-4.64c0-5.5 3.27-8.53 8.28-8.53 2.4 0 4.91.43 4.91.43v5.4h-2.77c-2.72 0-3.57 1.69-3.57 3.42V24h6.09l-.97 6.09h-5.12v15.64C37.97 44.09 46 34.98 46 24 46 11.85 36.15 2 24 2z" fill="#1877F2"/>
    <path d="M33.12 30.09L34.09 24h-6.09v-3.91c0-1.73.85-3.42 3.57-3.42h2.77v-5.4s-2.51-.43-4.91-.43c-5.01 0-8.28 3.04-8.28 8.53V24h-5.57v6.09h5.57v15.64a22.22 22.22 0 006.9 0V30.09h5.12z" fill="white"/>
  </svg>
)

export const GoogleIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" className={className}>
    <path d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" fill="#FFC107"/>
    <path d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" fill="#FF3D00"/>
    <path d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0124 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" fill="#4CAF50"/>
    <path d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 01-4.087 5.571l.001-.001 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" fill="#1976D2"/>
  </svg>
)

export const SMSIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" className={className} fill="none">
    <rect x="2" y="6" width="44" height="36" rx="8" fill="#4A5568"/>
    <path d="M10 18h28M10 26h18" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
    <circle cx="38" cy="38" r="8" fill="#48BB78" stroke="white" strokeWidth="2"/>
    <path d="M35 38l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

export const EmailIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" className={className} fill="none">
    <rect x="2" y="8" width="44" height="32" rx="6" fill="#111111"/>
    <path d="M4 12l18.4 13.2a3 3 0 003.2 0L44 12" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

export const EmbedIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" className={className} fill="none">
    <rect x="4" y="4" width="40" height="40" rx="8" fill="#F7FAFC" stroke="#CBD5E0" strokeWidth="2"/>
    <path d="M18 16l-8 8 8 8M30 16l8 8-8 8" stroke="#4A5568" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="22" y1="14" x2="26" y2="34" stroke="#A0AEC0" strokeWidth="2" strokeLinecap="round"/>
  </svg>
)
