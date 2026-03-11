import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Puck, Render, DropZone, usePuck } from '@measured/puck'
import '@measured/puck/puck.css'
import api from '../../utils/api'
import { useBusiness } from '../../contexts/BusinessContext'

/* ───────────────────────────── SVG ICONS ───────────────────────────── */

const icons = {
  back: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4l-6 6 6 6" />
    </svg>
  ),
  desktop: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="16" height="11" rx="1" />
      <path d="M7 17h6M10 14v3" />
    </svg>
  ),
  tablet: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="12" height="16" rx="1.5" />
      <path d="M9 16h2" />
    </svg>
  ),
  mobile: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5.5" y="2" width="9" height="16" rx="1.5" />
      <path d="M9 16h2" />
    </svg>
  ),
  undo: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7h8a4 4 0 110 8H7" /><path d="M6 4L3 7l3 3" />
    </svg>
  ),
  redo: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 7H7a4 4 0 100 8h4" /><path d="M12 4l3 3-3 3" />
    </svg>
  ),
  settings: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="9" r="2.5" /><path d="M14.7 11a1.2 1.2 0 00.2 1.3l.04.04a1.44 1.44 0 11-2.04 2.04l-.04-.04a1.2 1.2 0 00-1.3-.2 1.2 1.2 0 00-.72 1.1v.12a1.44 1.44 0 11-2.88 0v-.06a1.2 1.2 0 00-.78-1.1 1.2 1.2 0 00-1.3.2l-.04.04a1.44 1.44 0 11-2.04-2.04l.04-.04a1.2 1.2 0 00.2-1.3 1.2 1.2 0 00-1.1-.72H3.44a1.44 1.44 0 110-2.88h.06a1.2 1.2 0 001.1-.78 1.2 1.2 0 00-.2-1.3l-.04-.04A1.44 1.44 0 116.4 3.34l.04.04a1.2 1.2 0 001.3.2h.06a1.2 1.2 0 00.72-1.1V2.44a1.44 1.44 0 112.88 0v.06a1.2 1.2 0 00.72 1.1 1.2 1.2 0 001.3-.2l.04-.04a1.44 1.44 0 112.04 2.04l-.04.04a1.2 1.2 0 00-.2 1.3v.06a1.2 1.2 0 001.1.72h.12a1.44 1.44 0 110 2.88h-.06a1.2 1.2 0 00-1.1.72z" />
    </svg>
  ),
  search: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5L14 14" />
    </svg>
  ),
  chevDown: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 5l4 4 4-4" />
    </svg>
  ),
  chevRight: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 3l4 4-4 4" />
    </svg>
  ),
  plus: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M8 3v10M3 8h10" />
    </svg>
  ),
  eye: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
      <path d="M1 7s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z" /><circle cx="7" cy="7" r="1.8" />
    </svg>
  ),
  lock: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
      <rect x="3" y="6" width="8" height="6" rx="1" /><path d="M5 6V4.5a2 2 0 014 0V6" />
    </svg>
  ),
  trash: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
      <path d="M2 4h10M5 4V3a1 1 0 011-1h2a1 1 0 011 1v1M11 4v7a1 1 0 01-1 1H4a1 1 0 01-1-1V4" />
    </svg>
  ),
  close: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  ),
  layout: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="1" y="1" width="14" height="14" rx="2" /><path d="M1 5h14M6 5v10" /></svg>
  ),
  content: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M3 3h10M3 6.5h7M3 10h10M3 13.5h5" /></svg>
  ),
  business: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="2" y="4" width="12" height="10" rx="1" /><path d="M5 4V2.5a.5.5 0 01.5-.5h5a.5.5 0 01.5.5V4M2 7h12" /></svg>
  ),
  booking: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="2" y="3" width="12" height="11" rx="1" /><path d="M2 6h12M5 1v3M11 1v3" /></svg>
  ),
  shop: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M4 1L2 5v1a2 2 0 004 0 2 2 0 004 0 2 2 0 004 0V5l-2-4H4zM2 6v8a1 1 0 001 1h10a1 1 0 001-1V6" /></svg>
  ),
  blog: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M13 2H3a1 1 0 00-1 1v10a1 1 0 001 1h10a1 1 0 001-1V3a1 1 0 00-1-1zM2 6h12M6 6v8" /></svg>
  ),
  social: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><circle cx="4" cy="8" r="2" /><circle cx="12" cy="4" r="2" /><circle cx="12" cy="12" r="2" /><path d="M5.8 7l4.4-2M5.8 9l4.4 2" /></svg>
  ),
  drag: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" opacity="0.4"><circle cx="4" cy="2" r="1" /><circle cx="8" cy="2" r="1" /><circle cx="4" cy="6" r="1" /><circle cx="8" cy="6" r="1" /><circle cx="4" cy="10" r="1" /><circle cx="8" cy="10" r="1" /></svg>
  ),
  alignLeft: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 3h12M2 6.5h8M2 10h12M2 13.5h6" /></svg>
  ),
  alignCenter: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 3h12M4 6.5h8M2 10h12M5 13.5h6" /></svg>
  ),
  alignRight: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 3h12M6 6.5h8M2 10h12M8 13.5h6" /></svg>
  ),
}

const catIcons = {
  Layout: icons.layout,
  Content: icons.content,
  Business: icons.business,
  Booking: icons.booking,
  Shop: icons.shop,
  Blog: icons.blog,
  Social: icons.social,
}

/* ───────────────────────────── COMPONENT CATEGORIES ───────────────────────────── */

const CATEGORIES = {
  Layout: ['Section', 'Columns', 'Spacer', 'Divider'],
  Content: ['Heading', 'TextBlock', 'Image', 'VideoEmbed', 'Button', 'IconText'],
  Business: ['HeroBanner', 'ServiceCard', 'TeamMember', 'Testimonial', 'BeforeAfterGallery', 'OpeningHours', 'ContactForm', 'Map', 'FAQAccordion', 'AnnouncementBar'],
  Booking: ['BookNowButton', 'NextAvailableSlot', 'ServiceList', 'PackageCard', 'GiftVoucher'],
  Shop: ['ProductCard', 'ProductGrid', 'FeaturedProducts', 'CartWidget'],
  Blog: ['BlogPostCard', 'BlogGrid', 'NewsletterSignup'],
  Social: ['InstagramFeed', 'SocialLinks', 'WhatsAppButton', 'ReviewsWidget'],
}

const COMPONENT_LABELS = {
  Section: 'Section', Columns: 'Columns', Spacer: 'Spacer', Divider: 'Divider',
  Heading: 'Heading', TextBlock: 'Text Block', Image: 'Image', VideoEmbed: 'Video Embed',
  Button: 'Button', IconText: 'Icon + Text',
  HeroBanner: 'Hero Banner', ServiceCard: 'Service Card', TeamMember: 'Team Member',
  Testimonial: 'Testimonial', BeforeAfterGallery: 'Before/After Gallery',
  OpeningHours: 'Opening Hours', ContactForm: 'Contact Form', Map: 'Map',
  FAQAccordion: 'FAQ Accordion', AnnouncementBar: 'Announcement Bar',
  BookNowButton: 'Book Now Button', NextAvailableSlot: 'Next Available Slot',
  ServiceList: 'Service List', PackageCard: 'Package Card', GiftVoucher: 'Gift Voucher',
  ProductCard: 'Product Card', ProductGrid: 'Product Grid',
  FeaturedProducts: 'Featured Products', CartWidget: 'Cart Widget',
  BlogPostCard: 'Blog Post Card', BlogGrid: 'Blog Grid', NewsletterSignup: 'Newsletter Signup',
  InstagramFeed: 'Instagram Feed', SocialLinks: 'Social Links',
  WhatsAppButton: 'WhatsApp Button', ReviewsWidget: 'Reviews Widget',
}

/* ───────────────────────────── SHARED STYLE HELPERS ───────────────────────────── */

const FONT = 'Figtree, sans-serif'
const GOLD = '#C9A84C'
const DARK = '#111111'
const placeholderBg = (w, h, label) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect fill="#e5e5e5" width="${w}" height="${h}"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#999" font-family="sans-serif" font-size="14">${label}</text></svg>`)}`

const paddingMap = { none: '0', s: '8px', m: '16px', l: '32px', xl: '64px' }

/* ───────────────────────────── PUCK CONFIG ───────────────────────────── */

const buildPuckConfig = () => ({
  categories: {
    Layout: { components: CATEGORIES.Layout },
    Content: { components: CATEGORIES.Content },
    Business: { components: CATEGORIES.Business },
    Booking: { components: CATEGORIES.Booking },
    Shop: { components: CATEGORIES.Shop },
    Blog: { components: CATEGORIES.Blog },
    Social: { components: CATEGORIES.Social },
  },
  components: {
    /* ── LAYOUT ── */
    Section: {
      fields: {
        bgColor: { type: 'text', label: 'Background Colour' },
        padding: { type: 'select', label: 'Padding', options: [
          { label: 'None', value: 'none' }, { label: 'Small', value: 's' },
          { label: 'Medium', value: 'm' }, { label: 'Large', value: 'l' }, { label: 'XL', value: 'xl' },
        ]},
        maxWidth: { type: 'text', label: 'Max Width (e.g. 1200px)' },
      },
      defaultProps: { bgColor: '#ffffff', padding: 'l', maxWidth: '1200px' },
      render: ({ bgColor, padding, maxWidth, puck }) => (
        <div style={{ background: bgColor, padding: paddingMap[padding] || '32px' }}>
          <div style={{ maxWidth, margin: '0 auto' }}>
            <DropZone zone="section-content" />
          </div>
        </div>
      ),
    },
    Columns: {
      fields: {
        columns: { type: 'select', label: 'Columns', options: [
          { label: '2 Columns', value: '2' }, { label: '3 Columns', value: '3' }, { label: '4 Columns', value: '4' },
        ]},
        gap: { type: 'text', label: 'Gap (px)' },
      },
      defaultProps: { columns: '2', gap: '24' },
      render: ({ columns, gap }) => (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: `${gap}px` }}>
          {Array.from({ length: Number(columns) }, (_, i) => (
            <DropZone key={i} zone={`column-${i}`} />
          ))}
        </div>
      ),
    },
    Spacer: {
      fields: {
        height: { type: 'select', label: 'Height', options: [
          { label: 'Small (16px)', value: '16' }, { label: 'Medium (32px)', value: '32' },
          { label: 'Large (64px)', value: '64' }, { label: 'XL (96px)', value: '96' },
        ]},
      },
      defaultProps: { height: '32' },
      render: ({ height }) => <div style={{ height: `${height}px` }} />,
    },
    Divider: {
      fields: {
        color: { type: 'text', label: 'Colour' },
        thickness: { type: 'text', label: 'Thickness (px)' },
        style: { type: 'select', label: 'Style', options: [
          { label: 'Solid', value: 'solid' }, { label: 'Dashed', value: 'dashed' }, { label: 'Dotted', value: 'dotted' },
        ]},
      },
      defaultProps: { color: '#e0e0e0', thickness: '1', style: 'solid' },
      render: ({ color, thickness, style }) => (
        <hr style={{ border: 'none', borderTop: `${thickness}px ${style} ${color}`, margin: '16px 0' }} />
      ),
    },

    /* ── CONTENT ── */
    Heading: {
      fields: {
        text: { type: 'text', label: 'Heading Text' },
        level: { type: 'select', label: 'Level', options: [
          { label: 'H1', value: 'h1' }, { label: 'H2', value: 'h2' }, { label: 'H3', value: 'h3' }, { label: 'H4', value: 'h4' },
        ]},
        align: { type: 'select', label: 'Alignment', options: [
          { label: 'Left', value: 'left' }, { label: 'Centre', value: 'center' }, { label: 'Right', value: 'right' },
        ]},
        color: { type: 'text', label: 'Colour' },
      },
      defaultProps: { text: 'Your Heading', level: 'h2', align: 'left', color: '#111111' },
      render: ({ text, level, align, color }) => {
        const Tag = level
        const sizes = { h1: '2.5rem', h2: '2rem', h3: '1.5rem', h4: '1.25rem' }
        return <Tag style={{ fontFamily: FONT, textAlign: align, color, fontSize: sizes[level], margin: '0.5em 0', fontWeight: 700 }}>{text}</Tag>
      },
    },
    TextBlock: {
      fields: {
        text: { type: 'textarea', label: 'Text' },
        align: { type: 'select', label: 'Alignment', options: [
          { label: 'Left', value: 'left' }, { label: 'Centre', value: 'center' }, { label: 'Right', value: 'right' },
        ]},
        color: { type: 'text', label: 'Colour' },
        fontSize: { type: 'text', label: 'Font Size' },
      },
      defaultProps: { text: 'Add your text here. You can write paragraphs of content to describe your business, services, or anything else.', align: 'left', color: '#333333', fontSize: '1rem' },
      render: ({ text, align, color, fontSize }) => (
        <p style={{ fontFamily: FONT, textAlign: align, color, fontSize, lineHeight: 1.7, margin: '0.5em 0' }}>{text}</p>
      ),
    },
    Image: {
      fields: {
        src: { type: 'text', label: 'Image URL' },
        alt: { type: 'text', label: 'Alt Text' },
        width: { type: 'text', label: 'Width (e.g. 100%)' },
        borderRadius: { type: 'text', label: 'Border Radius' },
      },
      defaultProps: { src: '', alt: 'Image', width: '100%', borderRadius: '8px' },
      render: ({ src, alt, width, borderRadius }) => (
        <img
          src={src || placeholderBg(600, 400, 'Image')}
          alt={alt}
          style={{ width, borderRadius, display: 'block', maxWidth: '100%', height: 'auto' }}
        />
      ),
    },
    VideoEmbed: {
      fields: {
        url: { type: 'text', label: 'Video URL (YouTube/Vimeo)' },
        aspectRatio: { type: 'select', label: 'Aspect Ratio', options: [
          { label: '16:9', value: '56.25' }, { label: '4:3', value: '75' }, { label: '1:1', value: '100' },
        ]},
      },
      defaultProps: { url: '', aspectRatio: '56.25' },
      render: ({ url, aspectRatio }) => {
        let embedUrl = url
        if (url.includes('youtube.com/watch')) embedUrl = url.replace('watch?v=', 'embed/')
        if (url.includes('youtu.be/')) embedUrl = url.replace('youtu.be/', 'youtube.com/embed/')
        if (url.includes('vimeo.com/') && !url.includes('player')) embedUrl = url.replace('vimeo.com/', 'player.vimeo.com/video/')
        return (
          <div style={{ position: 'relative', paddingBottom: `${aspectRatio}%`, height: 0, overflow: 'hidden', borderRadius: '8px', background: '#e5e5e5' }}>
            {embedUrl ? (
              <iframe src={embedUrl} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }} allowFullScreen />
            ) : (
              <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontFamily: FONT }}>Paste a video URL</div>
            )}
          </div>
        )
      },
    },
    Button: {
      fields: {
        text: { type: 'text', label: 'Button Text' },
        url: { type: 'text', label: 'Link URL' },
        variant: { type: 'select', label: 'Style', options: [
          { label: 'Primary', value: 'primary' }, { label: 'Secondary', value: 'secondary' }, { label: 'Outline', value: 'outline' },
        ]},
        align: { type: 'select', label: 'Alignment', options: [
          { label: 'Left', value: 'flex-start' }, { label: 'Centre', value: 'center' }, { label: 'Right', value: 'flex-end' },
        ]},
        size: { type: 'select', label: 'Size', options: [
          { label: 'Small', value: 'sm' }, { label: 'Medium', value: 'md' }, { label: 'Large', value: 'lg' },
        ]},
      },
      defaultProps: { text: 'Click Here', url: '#', variant: 'primary', align: 'flex-start', size: 'md' },
      render: ({ text, url, variant, align, size }) => {
        const pad = { sm: '8px 16px', md: '12px 24px', lg: '16px 32px' }
        const fs = { sm: '0.85rem', md: '1rem', lg: '1.1rem' }
        const base = { fontFamily: FONT, fontWeight: 600, fontSize: fs[size], padding: pad[size], borderRadius: '6px', cursor: 'pointer', textDecoration: 'none', display: 'inline-block', border: '2px solid', transition: 'opacity 0.2s' }
        const styles = {
          primary: { ...base, background: DARK, color: '#fff', borderColor: DARK },
          secondary: { ...base, background: GOLD, color: DARK, borderColor: GOLD },
          outline: { ...base, background: 'transparent', color: DARK, borderColor: DARK },
        }
        return (
          <div style={{ display: 'flex', justifyContent: align }}>
            <a href={url} style={styles[variant]}>{text}</a>
          </div>
        )
      },
    },
    IconText: {
      fields: {
        icon: { type: 'select', label: 'Icon', options: [
          { label: 'Star', value: 'star' }, { label: 'Heart', value: 'heart' }, { label: 'Check', value: 'check' },
          { label: 'Clock', value: 'clock' }, { label: 'Location', value: 'location' }, { label: 'Phone', value: 'phone' },
        ]},
        text: { type: 'text', label: 'Text' },
        iconSize: { type: 'text', label: 'Icon Size (px)' },
      },
      defaultProps: { icon: 'check', text: 'Feature item', iconSize: '24' },
      render: ({ icon, text, iconSize }) => {
        const svgs = {
          star: '<circle cx="12" cy="12" r="0"/><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.86L12 17.77 5.82 21l1.18-6.86-5-4.87 6.91-1.01z" fill="currentColor"/>',
          heart: '<path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z" fill="currentColor"/>',
          check: '<polyline points="20 6 9 17 4 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>',
          clock: '<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none"/><path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>',
          location: '<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="currentColor"/><circle cx="12" cy="9" r="2.5" fill="#fff"/>',
          phone: '<path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" fill="none" stroke="currentColor" stroke-width="2"/>',
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontFamily: FONT }}>
            <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" dangerouslySetInnerHTML={{ __html: svgs[icon] || svgs.check }} style={{ flexShrink: 0, color: GOLD }} />
            <span style={{ fontSize: '1rem', color: '#333' }}>{text}</span>
          </div>
        )
      },
    },

    /* ── BUSINESS ── */
    HeroBanner: {
      fields: {
        heading: { type: 'text', label: 'Heading' },
        subheading: { type: 'textarea', label: 'Subheading' },
        buttonText: { type: 'text', label: 'Button Text' },
        buttonUrl: { type: 'text', label: 'Button URL' },
        bgImage: { type: 'text', label: 'Background Image URL' },
        bgColor: { type: 'text', label: 'Background Colour' },
        overlayOpacity: { type: 'select', label: 'Overlay', options: [
          { label: 'None', value: '0' }, { label: 'Light', value: '0.3' }, { label: 'Medium', value: '0.5' }, { label: 'Heavy', value: '0.7' },
        ]},
        minHeight: { type: 'text', label: 'Min Height (e.g. 500px)' },
        textColor: { type: 'text', label: 'Text Colour' },
      },
      defaultProps: { heading: 'Welcome to Our Business', subheading: 'Professional services tailored to you', buttonText: 'Book Now', buttonUrl: '#', bgImage: '', bgColor: DARK, overlayOpacity: '0.5', minHeight: '500px', textColor: '#ffffff' },
      render: ({ heading, subheading, buttonText, buttonUrl, bgImage, bgColor, overlayOpacity, minHeight, textColor }) => (
        <div style={{ position: 'relative', minHeight, background: bgImage ? `url(${bgImage}) center/cover` : bgColor, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          {bgImage && <div style={{ position: 'absolute', inset: 0, background: `rgba(0,0,0,${overlayOpacity})` }} />}
          <div style={{ position: 'relative', zIndex: 1, padding: '48px 24px', maxWidth: '800px' }}>
            <h1 style={{ fontFamily: FONT, fontSize: '3rem', fontWeight: 800, color: textColor, margin: '0 0 16px' }}>{heading}</h1>
            <p style={{ fontFamily: FONT, fontSize: '1.25rem', color: textColor, opacity: 0.9, margin: '0 0 32px', lineHeight: 1.6 }}>{subheading}</p>
            {buttonText && (
              <a href={buttonUrl} style={{ fontFamily: FONT, fontWeight: 600, fontSize: '1.1rem', background: GOLD, color: DARK, padding: '14px 32px', borderRadius: '6px', textDecoration: 'none', display: 'inline-block' }}>{buttonText}</a>
            )}
          </div>
        </div>
      ),
    },
    ServiceCard: {
      fields: {
        title: { type: 'text', label: 'Service Name' },
        description: { type: 'textarea', label: 'Description' },
        price: { type: 'text', label: 'Price' },
        duration: { type: 'text', label: 'Duration' },
        image: { type: 'text', label: 'Image URL' },
      },
      defaultProps: { title: 'Service Name', description: 'A brief description of this service.', price: '£45', duration: '60 min', image: '' },
      render: ({ title, description, price, duration, image }) => (
        <div style={{ fontFamily: FONT, border: '1px solid #e5e5e5', borderRadius: '12px', overflow: 'hidden', background: '#fff' }}>
          <img src={image || placeholderBg(400, 200, 'Service')} alt={title} style={{ width: '100%', height: '200px', objectFit: 'cover' }} />
          <div style={{ padding: '20px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '1.25rem', fontWeight: 700 }}>{title}</h3>
            <p style={{ color: '#666', margin: '0 0 12px', fontSize: '0.95rem', lineHeight: 1.5 }}>{description}</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: '1.1rem', color: GOLD }}>{price}</span>
              <span style={{ color: '#999', fontSize: '0.85rem' }}>{duration}</span>
            </div>
          </div>
        </div>
      ),
    },
    TeamMember: {
      fields: {
        name: { type: 'text', label: 'Name' },
        role: { type: 'text', label: 'Role' },
        bio: { type: 'textarea', label: 'Bio' },
        image: { type: 'text', label: 'Photo URL' },
      },
      defaultProps: { name: 'Team Member', role: 'Specialist', bio: 'A brief bio about this team member.', image: '' },
      render: ({ name, role, bio, image }) => (
        <div style={{ fontFamily: FONT, textAlign: 'center', padding: '24px' }}>
          <img src={image || placeholderBg(120, 120, 'Photo')} alt={name} style={{ width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover', margin: '0 auto 16px' }} />
          <h3 style={{ margin: '0 0 4px', fontSize: '1.2rem', fontWeight: 700 }}>{name}</h3>
          <p style={{ color: GOLD, margin: '0 0 12px', fontSize: '0.9rem', fontWeight: 600 }}>{role}</p>
          <p style={{ color: '#666', fontSize: '0.9rem', lineHeight: 1.6, margin: 0 }}>{bio}</p>
        </div>
      ),
    },
    Testimonial: {
      fields: {
        quote: { type: 'textarea', label: 'Quote' },
        author: { type: 'text', label: 'Author' },
        role: { type: 'text', label: 'Role / Location' },
        rating: { type: 'select', label: 'Rating', options: [
          { label: '5 Stars', value: '5' }, { label: '4 Stars', value: '4' }, { label: '3 Stars', value: '3' },
        ]},
      },
      defaultProps: { quote: 'Absolutely fantastic experience. Could not recommend more highly!', author: 'Jane D.', role: 'Verified Client', rating: '5' },
      render: ({ quote, author, role, rating }) => (
        <div style={{ fontFamily: FONT, background: '#f9f9f9', borderRadius: '12px', padding: '32px', borderLeft: `4px solid ${GOLD}` }}>
          <div style={{ marginBottom: '12px', color: GOLD, fontSize: '1.2rem', letterSpacing: '2px' }}>{'★'.repeat(Number(rating))}<span style={{ color: '#ddd' }}>{'★'.repeat(5 - Number(rating))}</span></div>
          <p style={{ fontSize: '1.1rem', fontStyle: 'italic', color: '#333', lineHeight: 1.7, margin: '0 0 16px' }}>"{quote}"</p>
          <p style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem' }}>{author}</p>
          <p style={{ margin: '2px 0 0', color: '#999', fontSize: '0.85rem' }}>{role}</p>
        </div>
      ),
    },
    BeforeAfterGallery: {
      fields: {
        beforeImage: { type: 'text', label: 'Before Image URL' },
        afterImage: { type: 'text', label: 'After Image URL' },
        caption: { type: 'text', label: 'Caption' },
      },
      defaultProps: { beforeImage: '', afterImage: '', caption: 'Before & After' },
      render: ({ beforeImage, afterImage, caption }) => (
        <div style={{ fontFamily: FONT }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ position: 'relative' }}>
              <img src={beforeImage || placeholderBg(300, 300, 'Before')} alt="Before" style={{ width: '100%', height: '300px', objectFit: 'cover' }} />
              <span style={{ position: 'absolute', bottom: '8px', left: '8px', background: 'rgba(0,0,0,0.6)', color: '#fff', padding: '4px 10px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>BEFORE</span>
            </div>
            <div style={{ position: 'relative' }}>
              <img src={afterImage || placeholderBg(300, 300, 'After')} alt="After" style={{ width: '100%', height: '300px', objectFit: 'cover' }} />
              <span style={{ position: 'absolute', bottom: '8px', left: '8px', background: GOLD, color: DARK, padding: '4px 10px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>AFTER</span>
            </div>
          </div>
          {caption && <p style={{ textAlign: 'center', color: '#666', marginTop: '12px', fontSize: '0.9rem' }}>{caption}</p>}
        </div>
      ),
    },
    OpeningHours: {
      fields: {
        title: { type: 'text', label: 'Title' },
        hours: { type: 'textarea', label: 'Hours (one per line: Day: Time)' },
      },
      defaultProps: { title: 'Opening Hours', hours: 'Monday: 9:00 - 18:00\nTuesday: 9:00 - 18:00\nWednesday: 9:00 - 18:00\nThursday: 9:00 - 20:00\nFriday: 9:00 - 18:00\nSaturday: 10:00 - 16:00\nSunday: Closed' },
      render: ({ title, hours }) => (
        <div style={{ fontFamily: FONT, background: '#f9f9f9', borderRadius: '12px', padding: '24px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '1.2rem', fontWeight: 700 }}>{title}</h3>
          {hours.split('\n').map((line, i) => {
            const [day, ...time] = line.split(':')
            return (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #eee', fontSize: '0.95rem' }}>
                <span style={{ fontWeight: 600 }}>{day?.trim()}</span>
                <span style={{ color: '#666' }}>{time?.join(':')?.trim()}</span>
              </div>
            )
          })}
        </div>
      ),
    },
    ContactForm: {
      fields: {
        title: { type: 'text', label: 'Title' },
        submitText: { type: 'text', label: 'Submit Button Text' },
        fields: { type: 'text', label: 'Fields (comma-separated)' },
      },
      defaultProps: { title: 'Get in Touch', submitText: 'Send Message', fields: 'Name,Email,Phone,Message' },
      render: ({ title, submitText, fields: fieldStr }) => {
        const fieldNames = fieldStr.split(',').map(f => f.trim())
        return (
          <div style={{ fontFamily: FONT, maxWidth: '600px' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: '1.3rem', fontWeight: 700 }}>{title}</h3>
            {fieldNames.map((f, i) => (
              <div key={i} style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600, fontSize: '0.85rem', color: '#555' }}>{f}</label>
                {f.toLowerCase() === 'message' ? (
                  <textarea rows={4} placeholder={f} style={{ width: '100%', border: '1px solid #ddd', borderRadius: '6px', padding: '10px 12px', fontFamily: FONT, fontSize: '0.95rem', resize: 'vertical' }} />
                ) : (
                  <input type="text" placeholder={f} style={{ width: '100%', border: '1px solid #ddd', borderRadius: '6px', padding: '10px 12px', fontFamily: FONT, fontSize: '0.95rem', boxSizing: 'border-box' }} />
                )}
              </div>
            ))}
            <button style={{ fontFamily: FONT, fontWeight: 600, background: DARK, color: '#fff', padding: '12px 24px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '1rem' }}>{submitText}</button>
          </div>
        )
      },
    },
    Map: {
      fields: {
        embedUrl: { type: 'text', label: 'Google Maps Embed URL' },
        height: { type: 'text', label: 'Height (px)' },
      },
      defaultProps: { embedUrl: '', height: '400' },
      render: ({ embedUrl, height }) => (
        <div style={{ borderRadius: '12px', overflow: 'hidden', background: '#e5e5e5', height: `${height}px` }}>
          {embedUrl ? (
            <iframe src={embedUrl} style={{ width: '100%', height: '100%', border: 0 }} allowFullScreen loading="lazy" />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontFamily: FONT }}>Paste a Google Maps embed URL</div>
          )}
        </div>
      ),
    },
    FAQAccordion: {
      fields: {
        title: { type: 'text', label: 'Section Title' },
        items: { type: 'textarea', label: 'FAQ Items (Q?A format, one per line)' },
      },
      defaultProps: { title: 'Frequently Asked Questions', items: 'What services do you offer?We offer a wide range of professional services. Check our services page for full details.\nHow do I book?You can book online through our booking page or call us directly.\nWhat is your cancellation policy?We require 24 hours notice for cancellations.' },
      render: ({ title, items }) => {
        const faqs = items.split('\n').map(line => { const [q, ...a] = line.split('?'); return { q: q?.trim() + '?', a: a.join('?')?.trim() } })
        return (
          <div style={{ fontFamily: FONT }}>
            <h3 style={{ margin: '0 0 20px', fontSize: '1.3rem', fontWeight: 700 }}>{title}</h3>
            {faqs.map((faq, i) => (
              <details key={i} style={{ borderBottom: '1px solid #eee', padding: '16px 0' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: '1rem', color: '#222' }}>{faq.q}</summary>
                <p style={{ color: '#666', lineHeight: 1.7, margin: '12px 0 0', fontSize: '0.95rem' }}>{faq.a}</p>
              </details>
            ))}
          </div>
        )
      },
    },
    AnnouncementBar: {
      fields: {
        text: { type: 'text', label: 'Announcement Text' },
        bgColor: { type: 'text', label: 'Background Colour' },
        textColor: { type: 'text', label: 'Text Colour' },
        url: { type: 'text', label: 'Link URL (optional)' },
      },
      defaultProps: { text: 'Free consultation for new clients this month!', bgColor: GOLD, textColor: DARK, url: '' },
      render: ({ text, bgColor, textColor, url }) => {
        const inner = <span style={{ fontFamily: FONT, fontWeight: 600, fontSize: '0.9rem' }}>{text}</span>
        return (
          <div style={{ background: bgColor, color: textColor, textAlign: 'center', padding: '10px 16px' }}>
            {url ? <a href={url} style={{ color: textColor, textDecoration: 'underline' }}>{inner}</a> : inner}
          </div>
        )
      },
    },

    /* ── BOOKING ── */
    BookNowButton: {
      fields: {
        text: { type: 'text', label: 'Button Text' },
        url: { type: 'text', label: 'Booking URL' },
        size: { type: 'select', label: 'Size', options: [
          { label: 'Medium', value: 'md' }, { label: 'Large', value: 'lg' },
        ]},
        fullWidth: { type: 'select', label: 'Full Width', options: [
          { label: 'No', value: 'no' }, { label: 'Yes', value: 'yes' },
        ]},
      },
      defaultProps: { text: 'Book Now', url: '#', size: 'lg', fullWidth: 'no' },
      render: ({ text, url, size, fullWidth }) => (
        <div style={{ textAlign: 'center' }}>
          <a href={url} style={{ fontFamily: FONT, fontWeight: 700, display: fullWidth === 'yes' ? 'block' : 'inline-block', textAlign: 'center', background: GOLD, color: DARK, padding: size === 'lg' ? '16px 40px' : '12px 28px', borderRadius: '8px', fontSize: size === 'lg' ? '1.15rem' : '1rem', textDecoration: 'none', letterSpacing: '0.5px' }}>{text}</a>
        </div>
      ),
    },
    NextAvailableSlot: {
      fields: {
        heading: { type: 'text', label: 'Heading' },
        slotText: { type: 'text', label: 'Slot Text (placeholder)' },
        buttonText: { type: 'text', label: 'Button Text' },
      },
      defaultProps: { heading: 'Next Available', slotText: 'Today at 2:30 PM', buttonText: 'Book This Slot' },
      render: ({ heading, slotText, buttonText }) => (
        <div style={{ fontFamily: FONT, background: '#f9f9f9', borderRadius: '12px', padding: '24px', textAlign: 'center', border: `2px solid ${GOLD}` }}>
          <p style={{ margin: '0 0 4px', fontSize: '0.85rem', color: '#999', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>{heading}</p>
          <p style={{ margin: '0 0 16px', fontSize: '1.5rem', fontWeight: 700, color: DARK }}>{slotText}</p>
          <a href="#" style={{ fontFamily: FONT, fontWeight: 600, background: GOLD, color: DARK, padding: '10px 24px', borderRadius: '6px', textDecoration: 'none', fontSize: '0.95rem' }}>{buttonText}</a>
        </div>
      ),
    },
    ServiceList: {
      fields: {
        title: { type: 'text', label: 'Title' },
        services: { type: 'textarea', label: 'Services (Name|Price|Duration per line)' },
      },
      defaultProps: { title: 'Our Services', services: 'Haircut|£30|30 min\nColour|£65|90 min\nBlowdry|£25|30 min\nStyling|£40|45 min' },
      render: ({ title, services }) => (
        <div style={{ fontFamily: FONT }}>
          <h3 style={{ margin: '0 0 20px', fontSize: '1.3rem', fontWeight: 700 }}>{title}</h3>
          {services.split('\n').map((line, i) => {
            const [name, price, dur] = line.split('|').map(s => s.trim())
            return (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderBottom: '1px solid #eee' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: '1rem' }}>{name}</p>
                  {dur && <p style={{ margin: '2px 0 0', color: '#999', fontSize: '0.8rem' }}>{dur}</p>}
                </div>
                <span style={{ fontWeight: 700, color: GOLD, fontSize: '1.05rem' }}>{price}</span>
              </div>
            )
          })}
        </div>
      ),
    },
    PackageCard: {
      fields: {
        name: { type: 'text', label: 'Package Name' },
        price: { type: 'text', label: 'Price' },
        description: { type: 'textarea', label: 'Description' },
        includes: { type: 'textarea', label: 'Includes (one per line)' },
        popular: { type: 'select', label: 'Popular Badge', options: [{ label: 'No', value: 'no' }, { label: 'Yes', value: 'yes' }] },
      },
      defaultProps: { name: 'Premium Package', price: '£120', description: 'Our most popular treatment package.', includes: 'Full consultation\nTreatment A\nTreatment B\nAftercare', popular: 'yes' },
      render: ({ name, price, description, includes, popular }) => (
        <div style={{ fontFamily: FONT, border: popular === 'yes' ? `2px solid ${GOLD}` : '1px solid #e5e5e5', borderRadius: '12px', padding: '28px', position: 'relative', background: '#fff' }}>
          {popular === 'yes' && <span style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', background: GOLD, color: DARK, fontSize: '0.7rem', fontWeight: 700, padding: '4px 14px', borderRadius: '20px', textTransform: 'uppercase', letterSpacing: '1px' }}>Most Popular</span>}
          <h3 style={{ margin: '0 0 4px', fontSize: '1.3rem', fontWeight: 700, textAlign: 'center' }}>{name}</h3>
          <p style={{ textAlign: 'center', fontSize: '2rem', fontWeight: 800, color: GOLD, margin: '8px 0 12px' }}>{price}</p>
          <p style={{ textAlign: 'center', color: '#666', fontSize: '0.9rem', margin: '0 0 20px' }}>{description}</p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {includes.split('\n').map((item, i) => (
              <li key={i} style={{ padding: '8px 0', borderTop: '1px solid #f0f0f0', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill={GOLD}><path d="M6.5 11.5l-3-3 1-1 2 2 5-5 1 1z" /></svg>
                {item.trim()}
              </li>
            ))}
          </ul>
        </div>
      ),
    },
    GiftVoucher: {
      fields: {
        title: { type: 'text', label: 'Title' },
        description: { type: 'text', label: 'Description' },
        buttonText: { type: 'text', label: 'Button Text' },
        bgColor: { type: 'text', label: 'Background Colour' },
      },
      defaultProps: { title: 'Gift Vouchers', description: 'The perfect gift for someone special.', buttonText: 'Buy a Gift Voucher', bgColor: DARK },
      render: ({ title, description, buttonText, bgColor }) => (
        <div style={{ fontFamily: FONT, background: bgColor, borderRadius: '12px', padding: '40px', textAlign: 'center' }}>
          <h3 style={{ color: '#fff', margin: '0 0 8px', fontSize: '1.5rem', fontWeight: 700 }}>{title}</h3>
          <p style={{ color: 'rgba(255,255,255,0.7)', margin: '0 0 24px', fontSize: '1rem' }}>{description}</p>
          <a href="#" style={{ fontFamily: FONT, fontWeight: 600, background: GOLD, color: DARK, padding: '12px 28px', borderRadius: '6px', textDecoration: 'none', fontSize: '1rem' }}>{buttonText}</a>
        </div>
      ),
    },

    /* ── SHOP ── */
    ProductCard: {
      fields: {
        name: { type: 'text', label: 'Product Name' },
        price: { type: 'text', label: 'Price' },
        image: { type: 'text', label: 'Image URL' },
        description: { type: 'textarea', label: 'Description' },
        badge: { type: 'text', label: 'Badge (optional)' },
      },
      defaultProps: { name: 'Product Name', price: '£24.99', image: '', description: 'High-quality product for your daily routine.', badge: '' },
      render: ({ name, price, image, description, badge }) => (
        <div style={{ fontFamily: FONT, border: '1px solid #e5e5e5', borderRadius: '12px', overflow: 'hidden', background: '#fff' }}>
          <div style={{ position: 'relative' }}>
            <img src={image || placeholderBg(400, 300, 'Product')} alt={name} style={{ width: '100%', height: '240px', objectFit: 'cover' }} />
            {badge && <span style={{ position: 'absolute', top: '12px', left: '12px', background: GOLD, color: DARK, fontSize: '0.7rem', fontWeight: 700, padding: '4px 10px', borderRadius: '4px', textTransform: 'uppercase' }}>{badge}</span>}
          </div>
          <div style={{ padding: '16px' }}>
            <h4 style={{ margin: '0 0 4px', fontWeight: 700 }}>{name}</h4>
            <p style={{ color: '#666', fontSize: '0.85rem', margin: '0 0 12px', lineHeight: 1.5 }}>{description}</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>{price}</span>
              <button style={{ fontFamily: FONT, fontWeight: 600, background: DARK, color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}>Add to Cart</button>
            </div>
          </div>
        </div>
      ),
    },
    ProductGrid: {
      fields: {
        columns: { type: 'select', label: 'Columns', options: [
          { label: '2', value: '2' }, { label: '3', value: '3' }, { label: '4', value: '4' },
        ]},
        gap: { type: 'text', label: 'Gap (px)' },
      },
      defaultProps: { columns: '3', gap: '24' },
      render: ({ columns, gap }) => (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: `${gap}px` }}>
          <DropZone zone="product-grid-items" />
        </div>
      ),
    },
    FeaturedProducts: {
      fields: {
        title: { type: 'text', label: 'Title' },
        subtitle: { type: 'text', label: 'Subtitle' },
      },
      defaultProps: { title: 'Featured Products', subtitle: 'Our top picks for you' },
      render: ({ title, subtitle }) => (
        <div style={{ fontFamily: FONT }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '1.5rem', fontWeight: 700 }}>{title}</h3>
            <p style={{ color: '#666', margin: 0 }}>{subtitle}</p>
          </div>
          <DropZone zone="featured-products-items" />
        </div>
      ),
    },
    CartWidget: {
      fields: {
        buttonText: { type: 'text', label: 'Button Text' },
        position: { type: 'select', label: 'Position', options: [
          { label: 'Left', value: 'flex-start' }, { label: 'Centre', value: 'center' }, { label: 'Right', value: 'flex-end' },
        ]},
      },
      defaultProps: { buttonText: 'View Cart (0)', position: 'flex-end' },
      render: ({ buttonText, position }) => (
        <div style={{ display: 'flex', justifyContent: position }}>
          <button style={{ fontFamily: FONT, fontWeight: 600, background: DARK, color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" /></svg>
            {buttonText}
          </button>
        </div>
      ),
    },

    /* ── BLOG ── */
    BlogPostCard: {
      fields: {
        title: { type: 'text', label: 'Title' },
        excerpt: { type: 'textarea', label: 'Excerpt' },
        date: { type: 'text', label: 'Date' },
        image: { type: 'text', label: 'Image URL' },
        url: { type: 'text', label: 'Read More URL' },
      },
      defaultProps: { title: 'Blog Post Title', excerpt: 'A brief excerpt from the blog post that gives readers a preview of the content.', date: '11 March 2026', image: '', url: '#' },
      render: ({ title, excerpt, date, image, url }) => (
        <div style={{ fontFamily: FONT, border: '1px solid #e5e5e5', borderRadius: '12px', overflow: 'hidden', background: '#fff' }}>
          <img src={image || placeholderBg(400, 200, 'Blog')} alt={title} style={{ width: '100%', height: '200px', objectFit: 'cover' }} />
          <div style={{ padding: '20px' }}>
            <p style={{ color: '#999', fontSize: '0.8rem', margin: '0 0 8px' }}>{date}</p>
            <h4 style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '1.1rem' }}>{title}</h4>
            <p style={{ color: '#666', fontSize: '0.9rem', lineHeight: 1.6, margin: '0 0 12px' }}>{excerpt}</p>
            <a href={url} style={{ color: GOLD, fontWeight: 600, fontSize: '0.9rem', textDecoration: 'none' }}>Read more</a>
          </div>
        </div>
      ),
    },
    BlogGrid: {
      fields: {
        columns: { type: 'select', label: 'Columns', options: [
          { label: '2', value: '2' }, { label: '3', value: '3' },
        ]},
      },
      defaultProps: { columns: '3' },
      render: ({ columns }) => (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: '24px' }}>
          <DropZone zone="blog-grid-items" />
        </div>
      ),
    },
    NewsletterSignup: {
      fields: {
        title: { type: 'text', label: 'Title' },
        description: { type: 'text', label: 'Description' },
        buttonText: { type: 'text', label: 'Button Text' },
        bgColor: { type: 'text', label: 'Background Colour' },
      },
      defaultProps: { title: 'Stay Updated', description: 'Subscribe to our newsletter for the latest news and offers.', buttonText: 'Subscribe', bgColor: '#f9f9f9' },
      render: ({ title, description, buttonText, bgColor }) => (
        <div style={{ fontFamily: FONT, background: bgColor, borderRadius: '12px', padding: '40px', textAlign: 'center' }}>
          <h3 style={{ margin: '0 0 8px', fontSize: '1.3rem', fontWeight: 700 }}>{title}</h3>
          <p style={{ color: '#666', margin: '0 0 24px', fontSize: '0.95rem' }}>{description}</p>
          <div style={{ display: 'flex', gap: '8px', maxWidth: '440px', margin: '0 auto' }}>
            <input type="email" placeholder="your@email.com" style={{ flex: 1, border: '1px solid #ddd', borderRadius: '6px', padding: '12px 16px', fontFamily: FONT, fontSize: '0.95rem' }} />
            <button style={{ fontFamily: FONT, fontWeight: 600, background: DARK, color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '6px', cursor: 'pointer', whiteSpace: 'nowrap' }}>{buttonText}</button>
          </div>
        </div>
      ),
    },

    /* ── SOCIAL ── */
    InstagramFeed: {
      fields: {
        handle: { type: 'text', label: 'Instagram Handle' },
        columns: { type: 'select', label: 'Columns', options: [
          { label: '3', value: '3' }, { label: '4', value: '4' }, { label: '6', value: '6' },
        ]},
        count: { type: 'select', label: 'Number of Posts', options: [
          { label: '3', value: '3' }, { label: '6', value: '6' }, { label: '9', value: '9' },
        ]},
      },
      defaultProps: { handle: '@yourbusiness', columns: '3', count: '6' },
      render: ({ handle, columns, count }) => (
        <div style={{ fontFamily: FONT }}>
          <p style={{ textAlign: 'center', fontWeight: 600, marginBottom: '16px' }}>{handle}</p>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: '4px' }}>
            {Array.from({ length: Number(count) }, (_, i) => (
              <div key={i} style={{ paddingBottom: '100%', background: '#e5e5e5', borderRadius: '4px', position: 'relative' }}>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb', fontSize: '0.75rem' }}>Post {i + 1}</div>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    SocialLinks: {
      fields: {
        facebook: { type: 'text', label: 'Facebook URL' },
        instagram: { type: 'text', label: 'Instagram URL' },
        twitter: { type: 'text', label: 'X (Twitter) URL' },
        tiktok: { type: 'text', label: 'TikTok URL' },
        linkedin: { type: 'text', label: 'LinkedIn URL' },
        align: { type: 'select', label: 'Alignment', options: [
          { label: 'Left', value: 'flex-start' }, { label: 'Centre', value: 'center' }, { label: 'Right', value: 'flex-end' },
        ]},
      },
      defaultProps: { facebook: '#', instagram: '#', twitter: '', tiktok: '', linkedin: '', align: 'center' },
      render: ({ facebook, instagram, twitter, tiktok, linkedin, align }) => {
        const links = [
          { url: facebook, label: 'F', name: 'Facebook' },
          { url: instagram, label: 'IG', name: 'Instagram' },
          { url: twitter, label: 'X', name: 'Twitter' },
          { url: tiktok, label: 'TT', name: 'TikTok' },
          { url: linkedin, label: 'in', name: 'LinkedIn' },
        ].filter(l => l.url)
        return (
          <div style={{ display: 'flex', justifyContent: align, gap: '12px' }}>
            {links.map((l, i) => (
              <a key={i} href={l.url} title={l.name} style={{ width: '40px', height: '40px', borderRadius: '50%', background: DARK, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', fontFamily: FONT, fontWeight: 700, fontSize: '0.75rem' }}>{l.label}</a>
            ))}
          </div>
        )
      },
    },
    WhatsAppButton: {
      fields: {
        phone: { type: 'text', label: 'Phone Number (with country code)' },
        text: { type: 'text', label: 'Button Text' },
        message: { type: 'text', label: 'Pre-filled Message' },
      },
      defaultProps: { phone: '+447000000000', text: 'Chat on WhatsApp', message: 'Hi! I\'d like to enquire about your services.' },
      render: ({ phone, text, message }) => (
        <div style={{ textAlign: 'center' }}>
          <a href={`https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer" style={{ fontFamily: FONT, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '10px', background: '#25D366', color: '#fff', padding: '14px 28px', borderRadius: '8px', textDecoration: 'none', fontSize: '1rem' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" /><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.612.638l4.682-1.228A11.953 11.953 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22a9.94 9.94 0 01-5.39-1.586l-.376-.243-3.128.82.835-3.047-.266-.398A9.96 9.96 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" /></svg>
            {text}
          </a>
        </div>
      ),
    },
    ReviewsWidget: {
      fields: {
        title: { type: 'text', label: 'Title' },
        rating: { type: 'text', label: 'Average Rating' },
        count: { type: 'text', label: 'Review Count' },
        source: { type: 'text', label: 'Source (e.g. Google)' },
      },
      defaultProps: { title: 'What Our Clients Say', rating: '4.9', count: '127', source: 'Google' },
      render: ({ title, rating, count, source }) => (
        <div style={{ fontFamily: FONT, textAlign: 'center', padding: '24px' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '1.3rem', fontWeight: 700 }}>{title}</h3>
          <div style={{ fontSize: '3rem', fontWeight: 800, color: GOLD, margin: '0 0 4px' }}>{rating}</div>
          <div style={{ color: GOLD, fontSize: '1.5rem', letterSpacing: '2px', marginBottom: '8px' }}>{'★'.repeat(Math.round(Number(rating)))}</div>
          <p style={{ color: '#999', margin: 0, fontSize: '0.9rem' }}>Based on {count} reviews on {source}</p>
        </div>
      ),
    },
  },
})

/* ───────────────────────────── INNER EDITOR (uses usePuck) ───────────────────────────── */

function EditorInner({ pages, currentSlug, onChangePage, onAddPage, onSaveDraft, onPublish, saving, previewWidth, setPreviewWidth, settingsOpen, setSettingsOpen }) {
  const { appState, dispatch, history } = usePuck()
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedCats, setExpandedCats] = useState(() => Object.keys(CATEGORIES).reduce((a, k) => ({ ...a, [k]: true }), {}))
  const [rightTab, setRightTab] = useState('properties')
  const [seoTitle, setSeoTitle] = useState('')
  const [seoDesc, setSeoDesc] = useState('')
  const [ogImage, setOgImage] = useState('')

  // Style tab state
  const [styleBg, setStyleBg] = useState('')
  const [stylePadding, setStylePadding] = useState('m')
  const [styleTextColor, setStyleTextColor] = useState('')
  const [styleTextAlign, setStyleTextAlign] = useState('left')
  const [styleBorderRadius, setStyleBorderRadius] = useState('none')
  const [styleVisibility, setStyleVisibility] = useState({ desktop: true, tablet: true, mobile: true })
  const [styleAnimation, setStyleAnimation] = useState('none')

  const toggleCat = (cat) => setExpandedCats(prev => ({ ...prev, [cat]: !prev[cat] }))

  const filteredCategories = useMemo(() => {
    if (!searchTerm) return CATEGORIES
    const lower = searchTerm.toLowerCase()
    const result = {}
    Object.entries(CATEGORIES).forEach(([cat, comps]) => {
      const filtered = comps.filter(c => (COMPONENT_LABELS[c] || c).toLowerCase().includes(lower))
      if (filtered.length) result[cat] = filtered
    })
    return result
  }, [searchTerm])

  const selectedComponent = appState?.ui?.itemSelector ? 'Selected Component' : null

  // Breadcrumb
  const breadcrumb = useMemo(() => {
    const sel = appState?.ui?.itemSelector
    if (!sel) return 'No selection'
    return `Page > Content > Item ${sel.index !== undefined ? sel.index : ''}`
  }, [appState?.ui?.itemSelector])

  // Layers
  const layers = appState?.data?.content || []

  const brandPalette = ['#111111', '#C9A84C', '#ffffff', '#f9f9f9', '#333333', '#666666', '#e5e5e5', '#25D366']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: FONT, overflow: 'hidden' }}>
      {/* ── TOP BAR ── */}
      <div style={{ height: '56px', background: DARK, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', flexShrink: 0, zIndex: 50 }}>
        {/* Left */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <a href="/dashboard/website" style={{ color: '#fff', display: 'flex', alignItems: 'center', textDecoration: 'none', opacity: 0.7, transition: 'opacity 0.15s' }} onMouseEnter={e => e.currentTarget.style.opacity = 1} onMouseLeave={e => e.currentTarget.style.opacity = 0.7}>{icons.back}</a>
          <select value={currentSlug} onChange={e => onChangePage(e.target.value)} style={{ background: '#222', color: '#fff', border: '1px solid #333', borderRadius: '6px', padding: '6px 12px', fontFamily: FONT, fontSize: '0.85rem', cursor: 'pointer', minWidth: '140px' }}>
            {pages.map(p => <option key={p.slug} value={p.slug}>{p.title || p.slug}</option>)}
          </select>
          <button onClick={onAddPage} style={{ background: 'transparent', border: '1px solid #444', color: '#fff', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontFamily: FONT, fontSize: '0.8rem' }}>
            {icons.plus} <span>Add Page</span>
          </button>
        </div>

        {/* Centre — responsive preview */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#222', borderRadius: '8px', padding: '4px' }}>
          {[
            { w: 1200, icon: icons.desktop, label: 'Desktop' },
            { w: 768, icon: icons.tablet, label: 'Tablet' },
            { w: 375, icon: icons.mobile, label: 'Mobile' },
          ].map(({ w, icon, label }) => (
            <button key={w} onClick={() => setPreviewWidth(w)} title={label} style={{ background: previewWidth === w ? '#444' : 'transparent', color: previewWidth === w ? GOLD : '#888', border: 'none', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all 0.15s' }}>{icon}</button>
          ))}
        </div>

        {/* Right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={() => history.back()} disabled={!history.hasPast} style={{ background: 'transparent', border: 'none', color: history.hasPast ? '#fff' : '#555', cursor: history.hasPast ? 'pointer' : 'default', padding: '6px', display: 'flex' }} title="Undo">{icons.undo}</button>
          <button onClick={() => history.forward()} disabled={!history.hasFuture} style={{ background: 'transparent', border: 'none', color: history.hasFuture ? '#fff' : '#555', cursor: history.hasFuture ? 'pointer' : 'default', padding: '6px', display: 'flex' }} title="Redo">{icons.redo}</button>
          <div style={{ width: '1px', height: '24px', background: '#333' }} />
          {saving && <span style={{ color: '#999', fontSize: '0.8rem' }}>Saving...</span>}
          <button onClick={onSaveDraft} style={{ background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '6px', padding: '7px 16px', fontFamily: FONT, fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}>Save Draft</button>
          <button onClick={onPublish} style={{ background: GOLD, color: DARK, border: 'none', borderRadius: '6px', padding: '7px 16px', fontFamily: FONT, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>Publish</button>
          <button onClick={() => setSettingsOpen(!settingsOpen)} style={{ background: 'transparent', border: 'none', color: settingsOpen ? GOLD : '#888', cursor: 'pointer', padding: '6px', display: 'flex' }}>{icons.settings}</button>
        </div>
      </div>

      {/* ── MAIN AREA ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* LEFT SIDEBAR */}
        <div style={{ width: '280px', background: '#fff', borderRight: '1px solid #e5e5e5', display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px', borderBottom: '1px solid #eee' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f5f5f5', borderRadius: '8px', padding: '8px 12px' }}>
              <span style={{ color: '#999', display: 'flex' }}>{icons.search}</span>
              <input type="text" placeholder="Search components..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ border: 'none', outline: 'none', background: 'transparent', fontFamily: FONT, fontSize: '0.85rem', flex: 1 }} />
            </div>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
            {Object.entries(filteredCategories).map(([cat, comps]) => (
              <div key={cat}>
                <button onClick={() => toggleCat(cat)} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '10px 16px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: FONT, fontWeight: 600, fontSize: '0.8rem', color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  <span style={{ display: 'flex', transition: 'transform 0.15s', transform: expandedCats[cat] ? 'rotate(90deg)' : 'rotate(0deg)' }}>{icons.chevRight}</span>
                  <span style={{ display: 'flex', color: '#888' }}>{catIcons[cat]}</span>
                  {cat}
                </button>
                {expandedCats[cat] && (
                  <div style={{ paddingBottom: '4px' }}>
                    {comps.map(comp => (
                      <div key={comp} data-puck-component={comp} draggable style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 16px 8px 44px', cursor: 'grab', fontSize: '0.88rem', color: '#333', borderRadius: '4px', margin: '0 8px', transition: 'background 0.1s' }} onMouseEnter={e => e.currentTarget.style.background = '#f5f5f5'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <span style={{ color: '#bbb', display: 'flex' }}>{icons.drag}</span>
                        <span>{COMPONENT_LABELS[comp] || comp}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* CENTRE CANVAS */}
        <div style={{ flex: 1, background: '#F0F0F0', overflow: 'auto', display: 'flex', justifyContent: 'center', padding: '24px' }}>
          <div style={{
            width: previewWidth === 1200 ? '100%' : `${previewWidth}px`,
            maxWidth: '100%',
            transition: 'width 0.3s ease',
            ...(previewWidth === 768 ? {
              border: '8px solid #333',
              borderRadius: '20px',
              background: '#fff',
              overflow: 'hidden',
              alignSelf: 'flex-start',
            } : previewWidth === 375 ? {
              border: '6px solid #333',
              borderRadius: '32px',
              background: '#fff',
              overflow: 'hidden',
              alignSelf: 'flex-start',
              position: 'relative',
            } : {
              background: '#fff',
              alignSelf: 'flex-start',
            }),
          }}>
            {/* Phone notch */}
            {previewWidth === 375 && (
              <div style={{ height: '28px', background: '#333', display: 'flex', justifyContent: 'center', alignItems: 'flex-end', paddingBottom: '4px' }}>
                <div style={{ width: '80px', height: '6px', background: '#555', borderRadius: '3px' }} />
              </div>
            )}
            <div style={{ minHeight: '400px' }}>
              <Puck.Preview />
            </div>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div style={{ width: '320px', background: '#fff', borderLeft: '1px solid #e5e5e5', display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid #eee', flexShrink: 0 }}>
            {[
              { key: 'properties', label: 'Properties' },
              { key: 'style', label: 'Style' },
              { key: 'page', label: 'Page' },
              { key: 'layers', label: 'Layers' },
            ].map(tab => (
              <button key={tab.key} onClick={() => setRightTab(tab.key)} style={{ flex: 1, padding: '12px 0', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: FONT, fontWeight: 600, fontSize: '0.75rem', color: rightTab === tab.key ? GOLD : '#999', borderBottom: rightTab === tab.key ? `2px solid ${GOLD}` : '2px solid transparent', transition: 'all 0.15s', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{tab.label}</button>
            ))}
          </div>

          <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
            {/* PROPERTIES TAB */}
            {rightTab === 'properties' && (
              <div className="puck-fields-wrapper">
                <Puck.Fields />
              </div>
            )}

            {/* STYLE TAB */}
            {rightTab === 'style' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Background */}
                <div>
                  <label style={{ fontWeight: 600, fontSize: '0.8rem', color: '#555', display: 'block', marginBottom: '8px' }}>Background</label>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {brandPalette.map(c => (
                      <button key={c} onClick={() => setStyleBg(c)} style={{ width: '28px', height: '28px', borderRadius: '6px', background: c, border: styleBg === c ? `2px solid ${GOLD}` : '1px solid #ddd', cursor: 'pointer' }} />
                    ))}
                  </div>
                </div>
                {/* Padding */}
                <div>
                  <label style={{ fontWeight: 600, fontSize: '0.8rem', color: '#555', display: 'block', marginBottom: '8px' }}>Padding</label>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {['none', 's', 'm', 'l', 'xl'].map(p => (
                      <button key={p} onClick={() => setStylePadding(p)} style={{ flex: 1, padding: '6px 0', border: '1px solid', borderColor: stylePadding === p ? GOLD : '#ddd', borderRadius: '6px', background: stylePadding === p ? `${GOLD}15` : '#fff', cursor: 'pointer', fontFamily: FONT, fontWeight: 600, fontSize: '0.75rem', color: stylePadding === p ? GOLD : '#888', textTransform: 'uppercase' }}>{p}</button>
                    ))}
                  </div>
                </div>
                {/* Text Colour */}
                <div>
                  <label style={{ fontWeight: 600, fontSize: '0.8rem', color: '#555', display: 'block', marginBottom: '8px' }}>Text Colour</label>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {brandPalette.map(c => (
                      <button key={`tc-${c}`} onClick={() => setStyleTextColor(c)} style={{ width: '28px', height: '28px', borderRadius: '6px', background: c, border: styleTextColor === c ? `2px solid ${GOLD}` : '1px solid #ddd', cursor: 'pointer' }} />
                    ))}
                  </div>
                </div>
                {/* Text Align */}
                <div>
                  <label style={{ fontWeight: 600, fontSize: '0.8rem', color: '#555', display: 'block', marginBottom: '8px' }}>Text Align</label>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {[{ key: 'left', icon: icons.alignLeft }, { key: 'center', icon: icons.alignCenter }, { key: 'right', icon: icons.alignRight }].map(a => (
                      <button key={a.key} onClick={() => setStyleTextAlign(a.key)} style={{ flex: 1, padding: '8px 0', border: '1px solid', borderColor: styleTextAlign === a.key ? GOLD : '#ddd', borderRadius: '6px', background: styleTextAlign === a.key ? `${GOLD}15` : '#fff', cursor: 'pointer', display: 'flex', justifyContent: 'center', color: styleTextAlign === a.key ? GOLD : '#888' }}>{a.icon}</button>
                    ))}
                  </div>
                </div>
                {/* Border Radius */}
                <div>
                  <label style={{ fontWeight: 600, fontSize: '0.8rem', color: '#555', display: 'block', marginBottom: '8px' }}>Border Radius</label>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {['none', 'sm', 'md', 'lg', 'pill'].map(r => (
                      <button key={r} onClick={() => setStyleBorderRadius(r)} style={{ flex: 1, padding: '6px 0', border: '1px solid', borderColor: styleBorderRadius === r ? GOLD : '#ddd', borderRadius: '6px', background: styleBorderRadius === r ? `${GOLD}15` : '#fff', cursor: 'pointer', fontFamily: FONT, fontWeight: 600, fontSize: '0.7rem', color: styleBorderRadius === r ? GOLD : '#888' }}>{r}</button>
                    ))}
                  </div>
                </div>
                {/* Visibility */}
                <div>
                  <label style={{ fontWeight: 600, fontSize: '0.8rem', color: '#555', display: 'block', marginBottom: '8px' }}>Visibility</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {['desktop', 'tablet', 'mobile'].map(device => (
                      <label key={device} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                        <span style={{ fontSize: '0.85rem', color: '#555', textTransform: 'capitalize' }}>{device}</span>
                        <div onClick={() => setStyleVisibility(prev => ({ ...prev, [device]: !prev[device] }))} style={{ width: '36px', height: '20px', borderRadius: '10px', background: styleVisibility[device] ? GOLD : '#ddd', position: 'relative', cursor: 'pointer', transition: 'background 0.15s' }}>
                          <div style={{ position: 'absolute', top: '2px', left: styleVisibility[device] ? '18px' : '2px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'left 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }} />
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
                {/* Animation */}
                <div>
                  <label style={{ fontWeight: 600, fontSize: '0.8rem', color: '#555', display: 'block', marginBottom: '8px' }}>Animation</label>
                  <select value={styleAnimation} onChange={e => setStyleAnimation(e.target.value)} style={{ width: '100%', padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', fontFamily: FONT, fontSize: '0.85rem', color: '#333' }}>
                    <option value="none">None</option>
                    <option value="fade-in">Fade In</option>
                    <option value="slide-up">Slide Up</option>
                    <option value="slide-left">Slide Left</option>
                  </select>
                </div>
              </div>
            )}

            {/* PAGE / SEO TAB */}
            {rightTab === 'page' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <label style={{ fontWeight: 600, fontSize: '0.8rem', color: '#555', display: 'block', marginBottom: '6px' }}>Page Title</label>
                  <input type="text" value={seoTitle} onChange={e => setSeoTitle(e.target.value)} placeholder="Enter page title" style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: '6px', fontFamily: FONT, fontSize: '0.9rem', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontWeight: 600, fontSize: '0.8rem', color: '#555', display: 'block', marginBottom: '6px' }}>Meta Description</label>
                  <textarea value={seoDesc} onChange={e => { if (e.target.value.length <= 160) setSeoDesc(e.target.value) }} placeholder="Enter meta description" rows={4} style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: '6px', fontFamily: FONT, fontSize: '0.9rem', resize: 'vertical', boxSizing: 'border-box' }} />
                  <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: seoDesc.length > 140 ? '#e55' : '#999', textAlign: 'right' }}>{seoDesc.length}/160</p>
                </div>
                <div>
                  <label style={{ fontWeight: 600, fontSize: '0.8rem', color: '#555', display: 'block', marginBottom: '6px' }}>OG Image URL</label>
                  <input type="text" value={ogImage} onChange={e => setOgImage(e.target.value)} placeholder="https://..." style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: '6px', fontFamily: FONT, fontSize: '0.9rem', boxSizing: 'border-box' }} />
                  {ogImage && <img src={ogImage} alt="OG Preview" style={{ width: '100%', marginTop: '8px', borderRadius: '6px', border: '1px solid #eee' }} />}
                </div>
              </div>
            )}

            {/* LAYERS TAB */}
            {rightTab === 'layers' && (
              <div>
                {layers.length === 0 && <p style={{ color: '#999', fontSize: '0.85rem', textAlign: 'center', marginTop: '40px' }}>No components added yet.</p>}
                {layers.map((item, i) => (
                  <div key={item.props?.id || i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 8px', borderBottom: '1px solid #f0f0f0', borderRadius: '4px', cursor: 'pointer', transition: 'background 0.1s' }} onMouseEnter={e => e.currentTarget.style.background = '#f9f9f9'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'} onClick={() => dispatch({ type: 'setUi', ui: { itemSelector: { index: i } } })}>
                    <span style={{ color: '#bbb', display: 'flex' }}>{icons.drag}</span>
                    <span style={{ flex: 1, fontSize: '0.85rem', fontWeight: 500 }}>{COMPONENT_LABELS[item.type] || item.type}</span>
                    <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#bbb', display: 'flex', padding: '2px' }} title="Toggle visibility">{icons.eye}</button>
                    <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#bbb', display: 'flex', padding: '2px' }} title="Lock">{icons.lock}</button>
                    <button onClick={(e) => {
                      e.stopPropagation()
                      const newContent = [...layers]
                      newContent.splice(i, 1)
                      dispatch({ type: 'setData', data: { ...appState.data, content: newContent } })
                    }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#bbb', display: 'flex', padding: '2px' }} title="Delete">{icons.trash}</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── BOTTOM BAR ── */}
      <div style={{ height: '32px', background: '#1a1a1a', display: 'flex', alignItems: 'center', padding: '0 16px', flexShrink: 0 }}>
        <span style={{ color: '#777', fontSize: '0.7rem', fontFamily: FONT }}>{breadcrumb}</span>
      </div>
    </div>
  )
}

/* ───────────────────────────── ADD PAGE MODAL ───────────────────────────── */

function AddPageModal({ open, onClose, onSubmit }) {
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')

  useEffect(() => {
    setSlug(title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''))
  }, [title])

  if (!open) return null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: '12px', padding: '32px', width: '400px', maxWidth: '90vw', fontFamily: FONT }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>Add New Page</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#999', display: 'flex' }}>{icons.close}</button>
        </div>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontWeight: 600, fontSize: '0.8rem', color: '#555', display: 'block', marginBottom: '6px' }}>Page Title</label>
          <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. About Us" style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: '6px', fontFamily: FONT, fontSize: '0.9rem', boxSizing: 'border-box' }} autoFocus />
        </div>
        <div style={{ marginBottom: '24px' }}>
          <label style={{ fontWeight: 600, fontSize: '0.8rem', color: '#555', display: 'block', marginBottom: '6px' }}>Slug</label>
          <input type="text" value={slug} onChange={e => setSlug(e.target.value)} placeholder="about-us" style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: '6px', fontFamily: FONT, fontSize: '0.9rem', boxSizing: 'border-box' }} />
        </div>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ fontFamily: FONT, fontWeight: 600, padding: '10px 20px', border: '1px solid #ddd', borderRadius: '6px', background: '#fff', cursor: 'pointer', fontSize: '0.9rem', color: '#555' }}>Cancel</button>
          <button onClick={() => { if (title && slug) onSubmit(title, slug) }} disabled={!title || !slug} style={{ fontFamily: FONT, fontWeight: 600, padding: '10px 20px', border: 'none', borderRadius: '6px', background: (!title || !slug) ? '#ccc' : DARK, color: '#fff', cursor: (!title || !slug) ? 'default' : 'pointer', fontSize: '0.9rem' }}>Create Page</button>
        </div>
      </div>
    </div>
  )
}

/* ───────────────────────────── MAIN EXPORT ───────────────────────────── */

export default function WebsiteBuilder() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { business } = useBusiness()
  const bid = business?._id || business?.id

  const [puckData, setPuckData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [pages, setPages] = useState([])
  const [showAddPage, setShowAddPage] = useState(false)
  const [previewWidth, setPreviewWidth] = useState(1200)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const puckConfig = useMemo(() => buildPuckConfig(), [])
  const autoSaveRef = useRef(null)
  const latestDataRef = useRef(null)

  // Fetch pages list
  const fetchPages = useCallback(async () => {
    if (!bid) return
    try {
      const res = await api.get(`/website/business/${bid}/pages`)
      setPages(res || [])
    } catch { /* ignore */ }
  }, [bid])

  // Fetch current page data
  const fetchPage = useCallback(async () => {
    if (!bid || !slug) return
    setLoading(true)
    setError(null)
    try {
      const res = await api.get(`/website/business/${bid}/pages/${slug}`)
      setPuckData(res?.puck_data || { content: [], root: {} })
    } catch (err) {
      setError(err?.message || 'Page not found')
    } finally {
      setLoading(false)
    }
  }, [bid, slug])

  useEffect(() => { fetchPages() }, [fetchPages])
  useEffect(() => { fetchPage() }, [fetchPage])

  // Auto-save every 30s
  useEffect(() => {
    autoSaveRef.current = setInterval(() => {
      if (latestDataRef.current && bid && slug) {
        setSaving(true)
        api.put(`/website/business/${bid}/pages/${slug}`, { puck_data: latestDataRef.current })
          .catch(() => {})
          .finally(() => setSaving(false))
      }
    }, 30000)
    return () => clearInterval(autoSaveRef.current)
  }, [bid, slug])

  const handleSaveDraft = useCallback(async () => {
    if (!latestDataRef.current || !bid || !slug) return
    setSaving(true)
    try {
      await api.put(`/website/business/${bid}/pages/${slug}`, { puck_data: latestDataRef.current })
    } catch { /* ignore */ } finally {
      setSaving(false)
    }
  }, [bid, slug])

  const handlePublish = useCallback(async (data) => {
    if (!bid || !slug) return
    // Update latestDataRef with the data puck provides via onPublish
    if (data) latestDataRef.current = data
    setSaving(true)
    try {
      // Save first, then publish
      await api.put(`/website/business/${bid}/pages/${slug}`, { puck_data: latestDataRef.current })
      await api.post(`/website/business/${bid}/pages/${slug}/publish`)
    } catch { /* ignore */ } finally {
      setSaving(false)
    }
  }, [bid, slug])

  const handleChangePage = useCallback((newSlug) => {
    navigate(`/dashboard/website/edit/${newSlug}`)
  }, [navigate])

  const handleAddPage = useCallback(async (title, newSlug) => {
    if (!bid) return
    try {
      await api.post(`/website/business/${bid}/pages`, { title, slug: newSlug, puck_data: { content: [], root: {} } })
      setShowAddPage(false)
      await fetchPages()
      navigate(`/dashboard/website/edit/${newSlug}`)
    } catch { /* ignore */ }
  }, [bid, fetchPages, navigate])

  // Loading state
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: FONT, background: '#F0F0F0' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid #e5e5e5', borderTopColor: GOLD, borderRadius: '50%', animation: 'wbSpin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: '#888', fontSize: '0.9rem' }}>Loading editor...</p>
          <style>{`@keyframes wbSpin { to { transform: rotate(360deg) } }`}</style>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: FONT, background: '#F0F0F0' }}>
        <div style={{ textAlign: 'center', maxWidth: '400px' }}>
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="#ccc" strokeWidth="2"><circle cx="24" cy="24" r="20" /><path d="M24 16v8M24 30v1" strokeLinecap="round" /></svg>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#333', margin: '16px 0 8px' }}>Page Not Found</h2>
          <p style={{ color: '#888', fontSize: '0.9rem', margin: '0 0 24px' }}>{error}</p>
          <a href="/dashboard/website" style={{ fontFamily: FONT, fontWeight: 600, color: GOLD, textDecoration: 'none' }}>Back to Website</a>
        </div>
      </div>
    )
  }

  return (
    <>
      <style>{`
        .puck-fields-wrapper .Puck-header,
        .puck-fields-wrapper [class*="PuckHeader"],
        [class*="Puck-root"] > header,
        [class*="Puck-root"] > [class*="header"] {
          display: none !important;
        }
        /* Hide default puck chrome — we render our own shell */
        .Puck [class*="leftSideBar"],
        .Puck [class*="rightSideBar"],
        .Puck > header,
        .Puck [class*="Header"],
        .Puck-header {
          display: none !important;
        }
      `}</style>
      <Puck
        config={puckConfig}
        data={puckData}
        onPublish={handlePublish}
        onChange={(data) => { latestDataRef.current = data }}
        overrides={{
          header: () => null,
          headerActions: () => null,
        }}
      >
        <EditorInner
          pages={pages}
          currentSlug={slug}
          onChangePage={handleChangePage}
          onAddPage={() => setShowAddPage(true)}
          onSaveDraft={handleSaveDraft}
          onPublish={() => handlePublish(latestDataRef.current)}
          saving={saving}
          previewWidth={previewWidth}
          setPreviewWidth={setPreviewWidth}
          settingsOpen={settingsOpen}
          setSettingsOpen={setSettingsOpen}
        />
      </Puck>
      <AddPageModal open={showAddPage} onClose={() => setShowAddPage(false)} onSubmit={handleAddPage} />
    </>
  )
}
