{
  "app": {
    "name": "Bengkel & Toko Sparepart Motor (Offline PWA)",
    "type": "mobile_web_app",
    "primary_users": [
      "Pemilik bengkel",
      "Kasir / admin toko",
      "Mekanik yang cek harga cepat"
    ],
    "success_actions": [
      "Scan barang -> cocokkan item lokal -> tampilkan harga jual besar",
      "Tambah barang baru dari hasil scan (prefill foto + kode part)",
      "Cari barang cepat (nama/kode part/kecocokan motor)",
      "Kelola stok + indikator stok menipis",
      "Backup/restore JSON tanpa internet"
    ],
    "hard_constraints": {
      "offline_100_percent": true,
      "no_external_google_fonts": true,
      "language": "id-ID",
      "currency_format": "Rp 15.000",
      "touch_targets_min_height_px": 52,
      "desktop_layout": "centered phone-width column",
      "no_transparent_over_unknown": true,
      "data_testid_required": true,
      "js_files_not_tsx": true
    }
  },

  "visual_personality": {
    "keywords": [
      "dark automotive workshop",
      "industrial",
      "high-contrast",
      "fast-glance",
      "grease-friendly",
      "tooling / dashboard"
    ],
    "layout_principles": [
      "Thumb-first: bottom nav + floating scan button",
      "Card-based info blocks with strong hierarchy",
      "Big numerals for price + stock",
      "Minimal text density; 2–3x spacing",
      "Use chips for filters; bottom sheets for results"
    ],
    "do_not": [
      "Do not use purple",
      "Do not use gradients on reading areas",
      "Do not center-align all text globally",
      "Do not use tiny icon-only buttons without labels"
    ]
  },

  "design_tokens": {
    "colors": {
      "base": {
        "bg": "#0F172A",
        "surface": "#1E293B",
        "surface_2": "#0B1220",
        "border": "#334155",
        "text": "#E5E7EB",
        "text_muted": "#94A3B8"
      },
      "brand": {
        "cyan": "#06B6D4",
        "amber": "#F59E0B"
      },
      "semantic": {
        "success": "#22C55E",
        "warning": "#F59E0B",
        "danger": "#EF4444",
        "info": "#06B6D4"
      },
      "scanner": {
        "scrim": "rgba(2, 6, 23, 0.72)",
        "frame": "rgba(6, 182, 212, 0.85)",
        "focus_ring": "rgba(245, 158, 11, 0.9)"
      },
      "masked_cost": {
        "mask_bg": "#0B1220",
        "mask_text": "#94A3B8"
      }
    },
    "gradients": {
      "allowed_usage": [
        "Hero/header background only (<=20% viewport)",
        "Decorative top strip behind page title",
        "Never on cards with dense text"
      ],
      "recipes": {
        "header_mild": "linear-gradient(135deg, rgba(6,182,212,0.18), rgba(245,158,11,0.10) 55%, rgba(15,23,42,0) 100%)"
      }
    },
    "typography": {
      "font_strategy": {
        "offline_safe_default": "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', Arial, sans-serif",
        "optional_bundled": {
          "recommendation": "@fontsource/space-grotesk",
          "why": "Tech/industrial feel, readable numerals; can be bundled offline",
          "install": "npm i @fontsource/space-grotesk",
          "usage_in_js": "import '@fontsource/space-grotesk/400.css'; import '@fontsource/space-grotesk/600.css';"
        }
      },
      "scale_tailwind": {
        "h1": "text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight",
        "h2": "text-base md:text-lg text-slate-200",
        "body": "text-sm text-slate-200 leading-relaxed",
        "small": "text-xs text-slate-400"
      },
      "numeric": {
        "price": "tabular-nums tracking-tight",
        "stock": "tabular-nums",
        "code": "font-mono text-xs"
      }
    },
    "radius_shadow": {
      "radius": {
        "card": "rounded-xl",
        "button": "rounded-lg",
        "chip": "rounded-full"
      },
      "shadow": {
        "card": "shadow-[0_10px_30px_rgba(0,0,0,0.35)]",
        "floating": "shadow-[0_18px_50px_rgba(0,0,0,0.55)]"
      },
      "borders": {
        "default": "border border-slate-700/70",
        "focus": "ring-2 ring-cyan-400/70 ring-offset-0"
      }
    },
    "spacing": {
      "page_padding": "px-4 pt-4 pb-24",
      "card_padding": "p-4",
      "stack_gap": "gap-3",
      "section_gap": "gap-5"
    }
  },

  "layout": {
    "viewport": {
      "mobile_target": "360–430px",
      "desktop": "center a phone-width column (max-w-[430px]) with full-height background"
    },
    "app_shell": {
      "structure": [
        "Top: compact header (title + optional actions)",
        "Middle: scrollable content",
        "Bottom: fixed nav bar + center floating Scan button"
      ],
      "safe_area": "Use pb-[calc(96px+env(safe-area-inset-bottom))] for pages with bottom nav"
    },
    "bottom_nav": {
      "tabs": [
        "Beranda",
        "(Scan Kamera - FAB center)",
        "Daftar Barang",
        "Pengaturan"
      ],
      "spec": {
        "height": "h-16",
        "background": "bg-slate-900/95 (solid, no blur dependency)",
        "border": "border-t border-slate-700/70",
        "tap_target": "min-h-[52px] min-w-[52px]",
        "fab": "w-16 h-16 -translate-y-5 bg-amber-500 text-slate-950"
      }
    },
    "grids": {
      "dashboard_cards": "grid grid-cols-2 gap-3",
      "list": "flex flex-col gap-3",
      "form": "flex flex-col gap-4"
    }
  },

  "components": {
    "component_path": {
      "shadcn_primary": [
        "/app/frontend/src/components/ui/button.jsx",
        "/app/frontend/src/components/ui/card.jsx",
        "/app/frontend/src/components/ui/input.jsx",
        "/app/frontend/src/components/ui/textarea.jsx",
        "/app/frontend/src/components/ui/label.jsx",
        "/app/frontend/src/components/ui/badge.jsx",
        "/app/frontend/src/components/ui/separator.jsx",
        "/app/frontend/src/components/ui/dialog.jsx",
        "/app/frontend/src/components/ui/drawer.jsx",
        "/app/frontend/src/components/ui/sheet.jsx",
        "/app/frontend/src/components/ui/progress.jsx",
        "/app/frontend/src/components/ui/tabs.jsx",
        "/app/frontend/src/components/ui/scroll-area.jsx",
        "/app/frontend/src/components/ui/skeleton.jsx",
        "/app/frontend/src/components/ui/tooltip.jsx",
        "/app/frontend/src/components/ui/switch.jsx",
        "/app/frontend/src/components/ui/sonner.jsx",
        "/app/frontend/src/components/ui/calendar.jsx",
        "/app/frontend/src/components/ui/command.jsx",
        "/app/frontend/src/components/ui/toggle-group.jsx"
      ]
    },
    "patterns": {
      "dashboard_stat_card": {
        "use": ["Card", "Badge"],
        "layout": "Icon left, label small, value big; optional delta chip",
        "classes": "bg-slate-800/40 border-slate-700/70 rounded-xl p-4",
        "data_testid": "dashboard-stat-card"
      },
      "inventory_item_card": {
        "use": ["Card", "Badge", "Button"],
        "layout": "Photo thumb left; name + code + compatibility; right: stock chip + chevron",
        "low_stock": "Add amber border + subtle glow when stock <= threshold",
        "classes": "bg-slate-800/30 border-slate-700/70 rounded-xl p-3",
        "data_testid": "inventory-item-card"
      },
      "filter_chips": {
        "use": ["ToggleGroup"],
        "chips": ["Beat", "Vario", "Mio", "Supra", "Semua"],
        "classes": "rounded-full border border-slate-700 bg-slate-900 text-slate-200",
        "data_testid": "inventory-filter-chips"
      },
      "search_bar": {
        "use": ["Input"],
        "placeholder": "Cari nama / kode part / motor…",
        "classes": "h-12 rounded-xl bg-slate-900 border-slate-700",
        "data_testid": "inventory-search-input"
      },
      "scan_price_overlay": {
        "use": ["Drawer"],
        "layout": "Top: big photo; middle: name + code + compatibility; bottom: Harga Jual huge",
        "price_style": "text-4xl font-semibold tabular-nums",
        "cost_mask": "Harga Modal + Keuntungan behind eye toggle",
        "data_testid": "scan-result-overlay"
      },
      "profit_calculator": {
        "use": ["Input", "Card"],
        "behavior": "Update Keuntungan (Rp) & Margin (%) realtime as user types",
        "display": "Show as two compact stat pills",
        "data_testid": "profit-calculator"
      },
      "backup_restore": {
        "use": ["Card", "Button", "Dialog"],
        "actions": ["Export JSON", "Import JSON"],
        "warnings": "Show unencrypted warning in muted text",
        "data_testid": "settings-backup-restore"
      },
      "first_open_examples": {
        "use": ["Badge"],
        "rule": "Seed items labeled 'Contoh' badge; allow delete",
        "data_testid": "example-item-badge"
      }
    }
  },

  "motion_microinteractions": {
    "library": "framer-motion",
    "principles": [
      "Fast, snappy; avoid bouncy playful easing",
      "Use motion to confirm scan/progress and sheet transitions",
      "Respect prefers-reduced-motion"
    ],
    "recipes": {
      "bottom_sheet": {
        "enter": "y: 24 -> 0, opacity: 0 -> 1, duration 0.18",
        "exit": "y: 24, opacity: 0, duration 0.14"
      },
      "button_press": "active: scale-[0.98] (Tailwind) + transition-colors duration-150",
      "scan_success": "brief cyan outline pulse around frame (0.35s)"
    }
  },

  "scanner_ui": {
    "full_screen": true,
    "overlays": {
      "top_status": "Small pill showing step: 'Membaca teks…' -> 'Mencocokkan foto…'",
      "progress": "Use Progress component; keep thin (h-2) and high contrast",
      "viewfinder": "Corner brackets in cyan; center reticle amber dot",
      "candidate_list": "Bottom sheet with 3–5 candidates; each row shows thumb + name + confidence"
    },
    "empty_not_found": {
      "cta": "Tambah sebagai barang baru",
      "prefill": ["foto", "kode part hasil OCR"],
      "secondary": "Coba cari manual"
    }
  },

  "accessibility": {
    "contrast": "Ensure text-slate-200 on bg #0F172A; muted text >= slate-400",
    "focus": "Visible ring on all inputs/buttons (cyan ring)",
    "touch": "Min 52px height for primary controls; spacing between destructive actions",
    "icons": "lucide-react only; always pair icon with label for critical actions",
    "reduced_motion": "Disable scan pulse + reduce sheet animation durations"
  },

  "data_testid_convention": {
    "format": "kebab-case",
    "examples": [
      "bottom-nav-beranda-tab",
      "bottom-nav-scan-fab",
      "bottom-nav-daftar-barang-tab",
      "bottom-nav-pengaturan-tab",
      "scan-camera-capture-button",
      "scan-manual-search-input",
      "scan-add-new-item-button",
      "product-form-save-button",
      "product-form-cost-eye-toggle",
      "settings-export-json-button",
      "settings-import-json-input"
    ]
  },

  "image_urls": [
    {
      "category": "beranda_header",
      "description": "Subtle workshop hero image used as a dim header background (apply dark overlay; keep <=20% viewport)",
      "url": "https://images.pexels.com/photos/29409960/pexels-photo-29409960.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"
    },
    {
      "category": "empty_state_scan",
      "description": "Mechanic working image for empty/not-found state illustration (dim + vignette)",
      "url": "https://images.pexels.com/photos/4427647/pexels-photo-4427647.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"
    }
  ],

  "instructions_to_main_agent": [
    "Update /frontend/src/index.css tokens: set :root to the specified dark palette (bg #0F172A, card #1E293B, border #334155, primary cyan/amber mapping). Prefer using .dark class globally or set root tokens directly for dark-first.",
    "Remove any global centering styles from App.css; keep layout left-aligned with max-w phone column on desktop.",
    "Implement AppShell with fixed bottom nav + center FAB for Scan Kamera; ensure safe-area padding.",
    "Scanner screen: full-screen camera with viewfinder overlay + top status pill + progress; results shown in Drawer/Sheet bottom overlay.",
    "Price overlay: show Harga Jual huge; mask Harga Modal & Keuntungan behind eye toggle (default hidden).",
    "Inventory list: search input + filter chips (ToggleGroup) + item cards; low-stock indicator uses amber border/glow.",
    "Settings: JSON export/import with Dialog confirmations; show warning that backup is not encrypted.",
    "Seed first-open example items with 'Contoh' badge.",
    "All interactive elements must include data-testid attributes (kebab-case).",
    "Keep everything offline: avoid external font CDNs; if using Space Grotesk, bundle via @fontsource and import locally."
  ],

  "general_ui_ux_design_guidelines_appendix": "<General UI UX Design Guidelines>  \n    - You must **not** apply universal transition. Eg: `transition: all`. This results in breaking transforms. Always add transitions for specific interactive elements like button, input excluding transforms\n    - You must **not** center align the app container, ie do not add `.App { text-align: center; }` in the css file. This disrupts the human natural reading flow of text\n   - NEVER: use AI assistant Emoji characters like`🤖🧠💭💡🔮🎯📚🎭🎬🎪🎉🎊🎁🎀🎂🍰🎈🎨🎰💰💵💳🏦💎🪙💸🤑📊📈📉💹🔢🏆🥇 etc for icons. Always use **FontAwesome cdn** or **lucid-react** library already installed in the package.json\n\n **GRADIENT RESTRICTION RULE**\nNEVER use dark/saturated gradient combos (e.g., purple/pink) on any UI element.  Prohibited gradients: blue-500 to purple 600, purple 500 to pink-500, green-500 to blue-500, red to pink etc\nNEVER use dark gradients for logo, testimonial, footer etc\nNEVER let gradients cover more than 20% of the viewport.\nNEVER apply gradients to text-heavy content or reading areas.\nNEVER use gradients on small UI elements (<100px width).\nNEVER stack multiple gradient layers in the same viewport.\n\n**ENFORCEMENT RULE:**\n    • Id gradient area exceeds 20% of viewport OR affects readability, **THEN** use solid colors\n\n**How and where to use:**\n   • Section backgrounds (not content backgrounds)\n   • Hero section header content. Eg: dark to light to dark color\n   • Decorative overlays and accent elements only\n   • Hero section with 2-3 mild color\n   • Gradients creation can be done for any angle say horizontal, vertical or diagonal\n\n- For AI chat, voice application, **do not use purple color. Use color like light green, ocean blue, peach orange etc**\n\n</Font Guidelines>\n\n- Every interaction needs micro-animations - hover states, transitions, parallax effects, and entrance animations. Static = dead. \n   \n- Use 2-3x more spacing than feels comfortable. Cramped designs look cheap.\n\n- Subtle grain textures, noise overlays, custom cursors, selection states, and loading animations: separates good from extraordinary.\n   \n- Before generating UI, infer the visual style from the problem statement (palette, contrast, mood, motion) and immediately instantiate it by setting global design tokens (primary, secondary/accent, background, foreground, ring, state colors), rather than relying on any library defaults. Don't make the background dark as a default step, always understand problem first and define colors accordingly\n    Eg: - if it implies playful/energetic, choose a colorful scheme\n           - if it implies monochrome/minimal, choose a black–white/neutral scheme\n\n**Component Reuse:**\n\t- Prioritize using pre-existing components from src/components/ui when applicable\n\t- Create new components that match the style and conventions of existing components when needed\n\t- Examine existing components to understand the project's component patterns before creating new ones\n\n**IMPORTANT**: Do not use HTML based component like dropdown, calendar, toast etc. You **MUST** always use `/app/frontend/src/components/ui/ ` only as a primary components as these are modern and stylish component\n\n**Best Practices:**\n\t- Use Shadcn/UI as the primary component library for consistency and accessibility\n\t- Import path: ./components/[component-name]\n\n**Export Conventions:**\n\t- Components MUST use named exports (export const ComponentName = ...)\n\t- Pages MUST use default exports (export default function PageName() {...})\n\n**Toasts:**\n  - Use `sonner` for toasts\"\n  - Sonner component are located in `/app/src/components/ui/sonner.tsx`\n\nUse 2–4 color gradients, subtle textures/noise overlays, or CSS-based noise to avoid flat visuals.\n</General UI UX Design Guidelines>"
}
