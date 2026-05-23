import type { Config } from "tailwindcss";

const config: Config = {
    darkMode: ["class"],
    content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
  	extend: {
  		colors: {
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			'auth-accent': {
  				DEFAULT: 'hsl(var(--auth-accent))',
  				foreground: 'hsl(var(--auth-accent-foreground))',
  				soft: 'hsl(var(--auth-accent-soft))'
  			},
  			'auth-link': 'hsl(var(--auth-link))',
  			'auth-surface-muted': 'hsl(var(--auth-surface-muted))',
  			cg: {
  				bg: 'var(--cg-bg)',
  				surface: 'var(--cg-surface)',
  				'surface-2': 'var(--cg-surface-2)',
  				'surface-3': 'var(--cg-surface-3)',
  				border: 'var(--cg-border)',
  				'border-strong': 'var(--cg-border-strong)',
  				text: 'var(--cg-text)',
  				'text-muted': 'var(--cg-text-muted)',
  				'text-subtle': 'var(--cg-text-subtle)',
  				accent: 'var(--cg-accent)',
  				'accent-hov': 'var(--cg-accent-hov)',
  				'accent-soft': 'var(--cg-accent-soft)',
  				'accent-fg': 'var(--cg-accent-fg)',
  				'accent-text': 'var(--cg-accent-text)',
  				danger: 'var(--cg-danger)',
  				'danger-hov': 'var(--cg-danger-hov)',
  				'danger-fg': 'var(--cg-danger-fg)',
  				'danger-soft': 'var(--cg-danger-soft)',
  				'danger-border': 'var(--cg-danger-border)',
  				'danger-text': 'var(--cg-danger-text)',
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		boxShadow: {
  			'cg-lg': 'var(--cg-shadow-lg)',
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		}
  	}
  },
  plugins: [],
};
export default config;
