import React from 'react';
import { Box, SxProps, Theme } from '@mui/material';
import TopBar from './TopBar';
import SideBar from './SideBar';
import DownloadsView from '../views/DownloadsView';
import ConsoleView from '../views/ConsoleView';
import SettingsView from '../views/SettingsView';
import { messageChannelContext } from '../../provider/MessageChannel';
import useStore from '../../hooks/useStore';
import { LogLine, RandomEvent } from '../../../../../@types/randomEvents';

const MAX_LOG_LINES = 1000;

/**
 * Root layout of the modern GUI: a fixed TopBar, a permanent SideBar and a
 * content region that swaps between the Downloads / Console / Settings views.
 *
 * Views are kept mounted (toggled via `display`) so their state — active
 * download progress, console scroll position — survives navigation. Log lines
 * are collected here (always mounted) rather than inside ConsoleView so they
 * accumulate even while other views are on screen.
 */
const AppShell: React.FC = () => {
	const msg = React.useContext(messageChannelContext);
	const [{ view }] = useStore();
	const [logs, setLogs] = React.useState<LogLine[]>([]);
	// On phones / small tablets the SideBar collapses behind a hamburger and
	// opens as a temporary overlay; on wider screens it stays permanent.
	const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

	React.useEffect(() => {
		if (!msg) return;
		const handler = (ev: RandomEvent<'log'>) => {
			setLogs((prev) => {
				const next = prev.length >= MAX_LOG_LINES ? prev.slice(prev.length - (MAX_LOG_LINES - 1)) : prev.slice();
				next.push(ev.data);
				return next;
			});
		};
		msg.randomEvents.on('log', handler);
		return () => msg.randomEvents.removeListener('log', handler);
	}, [msg]);

	const slot = (active: boolean): SxProps<Theme> => ({
		position: 'absolute',
		inset: 0,
		overflow: 'auto',
		display: active ? 'block' : 'none'
	});

	return (
		<Box sx={{ height: '100vh', width: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
			<TopBar onMenuClick={() => setMobileNavOpen(true)} />
			<Box sx={{ flex: 1, minHeight: 0, display: 'flex' }}>
				<SideBar mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
				<Box sx={{ flex: 1, minWidth: 0, position: 'relative', bgcolor: 'background.default' }}>
					<Box sx={slot(view === 'downloads')}>
						<DownloadsView />
					</Box>
					<Box sx={slot(view === 'console')}>
						<ConsoleView logs={logs} onClear={() => setLogs([])} />
					</Box>
					<Box sx={slot(view === 'settings')}>
						<SettingsView />
					</Box>
				</Box>
			</Box>
		</Box>
	);
};

export default AppShell;
