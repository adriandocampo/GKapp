---
name: GKApp
description: >
  Goalkeeping session management and match analysis application for
  Club Deportivo Lugo. Desktop-first (Electron) with a web-deployed
  GitHub Pages companion.
colors:
  primary:    "#0f172a"
  surface:    "#1e293b"
  accent:     "#14b8a6"
  accent-dark: "#0d9488"
  neutral:    "#f1f5f9"
  muted:      "#94a3b8"
  body:       "#e2e8f0"
  border:     "#475569"
  border-light: "#334155"
  danger:     "#ef4444"
  success:    "#14b8a6"
  warning:    "#f59e0b"
  admin:      "#818cf8"
  dev-glow:   "#8b5cf6"
typography:
  body:
    fontFamily: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif
    fontSize: 1rem
  heading:
    fontFamily: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif
    fontWeight: 700
  small:
    fontFamily: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif
    fontSize: 0.875rem
rounded:
  sm: 4px
  md: 8px
  lg: 12px
  xl: 16px
  "2xl": 20px
spacing:
  px: 1px
  "1": 4px
  "2": 8px
  "3": 12px
  "4": 16px
  "5": 20px
  "6": 24px
  "8": 32px
  "10": 40px
  "12": 48px
  "16": 64px
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "#ffffff"
    rounded: "{rounded.lg}"
    padding: 12px 16px
    fontFamily: "{typography.small.fontFamily}"
    fontSize: "{typography.small.fontSize}"
    fontWeight: 600
  button-primary-hover:
    backgroundColor: "{colors.accent-dark}"
  button-secondary:
    backgroundColor: transparent
    textColor: "{colors.neutral}"
    rounded: "{rounded.md}"
    padding: 8px 12px
    border: "1px solid {colors.border}"
  nav-item:
    backgroundColor: transparent
    textColor: "{colors.muted}"
    rounded: "{rounded.md}"
    padding: 8px 12px
  nav-item-active:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.accent}"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl}"
    padding: 16px
    border: "1px solid {colors.border-light}"
  card-elevated:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded['2xl']}"
    padding: 32px
    border: "1px solid {colors.border-light}"
  input:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.neutral}"
    rounded: "{rounded.lg}"
    padding: 8px 12px
    border: "1px solid {colors.border}"
  auth-gate:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded['2xl']}"
    padding: 32px
    border: "1px solid {colors.border-light}"
    maxWidth: 384px
  modal-overlay:
    backgroundColor: "rgba(15, 23, 42, 0.8)"
  toast:
    rounded: "{rounded.lg}"
    padding: 12px 16px
---

## Overview

GKApp is a dark-theme goalkeeper training tool. The visual identity evokes a premium sports analytics dashboard — high contrast, minimal ornament, with a single teal accent driving all interaction. The dark background (slate-900) reduces eye strain during extended use on the training pitch or in video analysis sessions.

The UI uses Tailwind CSS v4 with PostCSS for styling. A dev mode (`import.meta.env.DEV`) applies distinct purple-tinted visual cues so developers can instantly distinguish development from production.

## Colors

The palette is anchored by deep navy backgrounds with a warm teal accent.

- **Primary (#0f172a):** Page background and input surfaces.
- **Surface (#1e293b):** Nav bar, cards, containers — one step lighter than the page.
- **Accent (#14b8a6):** The sole interaction driver — active nav links, primary buttons, brand text, high-success-rate indicators.
- **Accent-dark (#0d9488):** Hover states for accent elements.
- **Neutral (#f1f5f9):** Headings and high-emphasis text.
- **Body (#e2e8f0):** Body and paragraph text.
- **Muted (#94a3b8):** Secondary labels, captions, metadata, disabled states.
- **Border (#475569):** Heavy borders (scrollbar thumb, inputs).
- **Border-light (#334155):** Subtle card and container borders.
- **Success (#14b8a6):** Same as accent; used in pass-map success-rate gradients (≥90% = teal, 70-90% = yellow gradient, <70% = red).
- **Warning (#f59e0b):** Amber alerts (guest mode indicators, image sync warnings).
- **Danger (#ef4444):** Destructive actions and low success-rate indicators.
- **Admin (#818cf8):** Indigo accent for admin-only UI elements.
- **Dev-glow (#8b5cf6):** Purple pulse animation visible only in dev mode.

Do not introduce additional accent colors. The teal + indigo (admin only) + dev-purple (dev only) system must remain the complete palette.

## Typography

The app uses the system font stack exclusively — no custom font loading. This ensures instant text rendering and native feel across platforms.

| Role | Stack | Size | Weight |
|---|---|---|---|
| Heading | system-ui stack | inherited from Tailwind | 700 (bold) |
| Body | system-ui stack | 1rem/16px | 400 (normal) |
| Small/label | system-ui stack | 0.875rem/14px | 500 (medium) or 600 (semibold) |

A `NotoSans-Regular.ttf` file exists in `public/fonts/` but is not referenced anywhere in the codebase. Do not rely on it.

## Layout

- Max content width: `80rem` (1280px, Tailwind `max-w-7xl`), centered with auto margins.
- Sticky top nav at `z-50`.
- Full-height layout: nav → flex-1 main → (no footer).
- Mobile: not a primary target; no responsive breakpoints are enforced.
- Print layout is explicitly handled in `index.css` (landscape, white background, hides all UI except `.template-print-target`).

## Shapes

Rounded corners follow a consistent progression:

| Token | Value | Usage |
|---|---|---|
| sm | 4px | scrollbar thumbs |
| md | 8px | nav items, secondary buttons |
| lg | 12px | primary buttons, inputs |
| xl | 16px | cards |
| 2xl | 20px | elevated cards, auth gate dialog |

## Components

### Button Primary
Teal-filled button for all primary actions ("Guardar datos", "Iniciar sesión" via Google). Uses accent background, white text, rounded-lg. Hover darkens to accent-dark.

The Google sign-in button in `AuthGate.jsx` is an exception — it uses a white background with the Google logo, not the standard teal primary.

### Nav Item
Transparent by default with muted text. Active state uses surface background + accent text. Transition on hover to slate-700 background + white text.

### Card
Surface background with subtle border-light border and rounded-xl. Used for task listings, session details, settings panels.

### Auth Gate (Login Screen)
Full-screen centered layout. A single elevated card (rounded-2xl, 384px max-width) containing the brand logo, "GKApp" heading, tagline, and Google sign-in button. A "Modo invitado" link allows skip. Only shown when no Firebase user is authenticated.

### Modal
Dark overlay (`primary` at 80% opacity) covering the full screen. Content card centered with z-50. Controlled via the `Modal` component.

### Toast
Slide-in from right with `animate-slide-in` keyframe. Appears at top-right. Color-coded by type: teal for success/info, amber for warning, red for error. Auto-dismisses (customizable duration via `addToast`).

## Do's and Don'ts

- **Do** use `text-teal-400` and `bg-teal-600/20` for inline status badges (guest mode, active indicators).
- **Don't** remove the custom scrollbar styles — they're intentional for the dark theme.
- **Do** keep the dev mode CSS classes (`dev-bg`, `dev-navbar`, `dev-nav-active`, `dev-badge`, `dev-gradient-text`, `dev-spinner`, `dev-page-enter`, `dev-grid-pattern`, `dev-scrollbar`) gated behind `if (isDev)` checks. They are never visible in production.
- **Don't** change `color-scheme: dark` on `:root` — it ensures native elements (scrollbars, form controls) render in dark mode.
- **Do** respect the print stylesheet: landscape orientation, white background, `.template-print-target` only. All interactive elements are hidden.
- **Don't** introduce new colors for interactive states — use the existing accent/warning/danger/admin palette.
- **Do** use Tailwind's built-in spacing and rounding scale; the tokens above are documentation, not custom values.
