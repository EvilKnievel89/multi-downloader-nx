import React from 'react';
import { ThemeProvider, createTheme, CssBaseline, GlobalStyles, PaletteMode, Theme } from '@mui/material';

/**
 * Central color-mode context. The theme toggle in the TopBar consumes this to
 * flip between light and dark. Kept separate from the data Store so theming
 * stays a pure presentation concern.
 */
export const ColorModeContext = React.createContext<{ mode: PaletteMode; toggle: () => void }>({
	mode: 'dark',
	toggle: () => undefined
});

const STORAGE_KEY = 'anidl.colorMode';

/**
 * Single source of truth for the design tokens. Coral-orange accent, warm-biased
 * neutrals and semantic status colors kept separate from the accent so state
 * (success/warning/error) never collides with branding.
 */
const makeTheme = (mode: PaletteMode): Theme => {
	const isDark = mode === 'dark';
	return createTheme({
		palette: {
			mode,
			primary: {
				main: isDark ? '#ff6a3d' : '#e6541f',
				light: isDark ? '#ff8a63' : '#f06a3a',
				dark: isDark ? '#e0501f' : '#c2440f',
				contrastText: '#ffffff'
			},
			secondary: {
				main: isDark ? '#69b6c9' : '#2f7c8c'
			},
			background: {
				default: isDark ? '#151311' : '#faf7f3',
				paper: isDark ? '#1e1b18' : '#ffffff'
			},
			text: isDark ? { primary: '#f4efe9', secondary: '#b1a89f' } : { primary: '#1c1a17', secondary: '#6b6259' },
			divider: isDark ? 'rgba(255, 255, 255, 0.09)' : 'rgba(28, 26, 23, 0.10)',
			success: { main: isDark ? '#5cc26a' : '#2e9c43' },
			warning: { main: isDark ? '#f2b34d' : '#c9821b' },
			error: { main: isDark ? '#f26d6d' : '#d23b3b' },
			info: { main: isDark ? '#67aee0' : '#2b6cb0' }
		},
		shape: { borderRadius: 10 },
		typography: {
			fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
			h5: { fontWeight: 700, letterSpacing: '-0.01em' },
			h6: { fontWeight: 700, letterSpacing: '-0.01em' },
			subtitle2: { letterSpacing: '0.04em' },
			button: { fontWeight: 600 }
		},
		components: {
			MuiButton: {
				defaultProps: { disableElevation: true },
				styleOverrides: { root: { textTransform: 'none', borderRadius: 8 } }
			},
			MuiAppBar: {
				defaultProps: { elevation: 0, color: 'default' },
				styleOverrides: {
					root: ({ theme }) => ({
						backgroundImage: 'none',
						backgroundColor: theme.palette.background.paper,
						borderBottom: `1px solid ${theme.palette.divider}`
					})
				}
			},
			MuiDrawer: {
				styleOverrides: {
					paper: ({ theme }) => ({
						backgroundImage: 'none',
						borderRight: `1px solid ${theme.palette.divider}`,
						backgroundColor: theme.palette.background.paper
					})
				}
			},
			MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
			MuiCard: { styleOverrides: { root: { backgroundImage: 'none' } } }
		}
	});
};

const getInitialMode = (): PaletteMode => {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored === 'light' || stored === 'dark') return stored;
	} catch {
		/* localStorage may be unavailable; fall back to default */
	}
	return 'dark';
};

const Style: FCWithChildren = ({ children }) => {
	const [mode, setMode] = React.useState<PaletteMode>(getInitialMode);

	const colorMode = React.useMemo(
		() => ({
			mode,
			toggle: () =>
				setMode((prev) => {
					const next: PaletteMode = prev === 'dark' ? 'light' : 'dark';
					try {
						localStorage.setItem(STORAGE_KEY, next);
					} catch {
						/* ignore persistence errors */
					}
					return next;
				})
		}),
		[mode]
	);

	const theme = React.useMemo(() => makeTheme(mode), [mode]);

	return (
		<ColorModeContext.Provider value={colorMode}>
			<ThemeProvider theme={theme}>
				<CssBaseline enableColorScheme />
				<GlobalStyles
					styles={{
						'html, body, #root': { height: '100%' },
						'#root': { display: 'flex', justifyContent: 'center', minHeight: '100vh' }
					}}
				/>
				{children}
			</ThemeProvider>
		</ColorModeContext.Provider>
	);
};

export default Style;
