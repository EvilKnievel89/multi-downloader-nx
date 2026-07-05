import React from 'react';
import { Box, Tooltip } from '@mui/material';
import { WarningAmberRounded } from '@mui/icons-material';
import { messageChannelContext } from '../provider/MessageChannel';
import useStore from '../hooks/useStore';
import { RandomEvent } from '../../../../@types/randomEvents';

/**
 * Floating warning shown at the bottom-right whenever the active service is not
 * authenticated — e.g. Crunchyroll's session token was invalidated and the
 * automatic one-shot re-login could not recover it.
 *
 * The backend broadcasts `authState` events on every auth-relevant operation
 * (check / login / search / download); we additionally seed the state once when
 * a service is selected so the indicator is correct even before the first
 * operation runs.
 */
const AuthIndicator: React.FC = () => {
	const msg = React.useContext(messageChannelContext);
	const [{ service }] = useStore();
	const [loggedIn, setLoggedIn] = React.useState<boolean | null>(null);
	const [show, setShow] = React.useState(false);

	// Seed the state whenever a service becomes active / changes. Reset to
	// "unknown" first so the previous service's state never lingers during a switch.
	React.useEffect(() => {
		setLoggedIn(null);
		if (!msg || !service) return;
		let cancelled = false;
		(async () => {
			const res = await msg.checkToken();
			if (!cancelled) setLoggedIn(res?.isOk ?? false);
		})();
		return () => {
			cancelled = true;
		};
	}, [msg, service]);

	// React live to backend auth-state broadcasts.
	React.useEffect(() => {
		if (!msg) return;
		const handler = (ev: RandomEvent<'authState'>) => setLoggedIn(ev.data.loggedIn);
		msg.randomEvents.on('authState', handler);
		return () => msg.randomEvents.removeListener('authState', handler);
	}, [msg]);

	// Only surface the warning once "not logged in" persists briefly. Service
	// switches and startup both produce a transient false while the backend
	// refreshes the token; debouncing keeps the indicator from flickering then.
	React.useEffect(() => {
		if (loggedIn !== false) {
			setShow(false);
			return;
		}
		const timer = setTimeout(() => setShow(true), 1000);
		return () => clearTimeout(timer);
	}, [loggedIn]);

	if (!service || !show) return null;

	return (
		<Tooltip title="Not logged in — your session token is invalid. Use the “Authenticate” button to log in again." placement="left" arrow>
			<Box
				role="alert"
				aria-label="Not logged in"
				sx={{
					position: 'fixed',
					bottom: { xs: 16, md: 24 },
					right: { xs: 16, md: 24 },
					zIndex: (theme) => theme.zIndex.snackbar - 1,
					width: 56,
					height: 56,
					borderRadius: '50%',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					color: 'warning.contrastText',
					bgcolor: 'warning.main',
					boxShadow: 6,
					cursor: 'help',
					animation: 'anidl-auth-in 0.3s ease-out, anidl-auth-float 2.6s ease-in-out 0.3s infinite',
					'@keyframes anidl-auth-in': {
						from: { opacity: 0, transform: 'scale(0.6)' },
						to: { opacity: 1, transform: 'scale(1)' }
					},
					'@keyframes anidl-auth-float': {
						'0%, 100%': { transform: 'translateY(0)' },
						'50%': { transform: 'translateY(-6px)' }
					},
					'@media (prefers-reduced-motion: reduce)': {
						animation: 'none'
					}
				}}
			>
				<WarningAmberRounded sx={{ fontSize: 30 }} />
			</Box>
		</Tooltip>
	);
};

export default AuthIndicator;
