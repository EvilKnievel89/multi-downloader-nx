import React from 'react';
import { Box, Divider, Drawer, List, ListItemButton, ListItemIcon, ListItemText, ListSubheader, Typography } from '@mui/material';
import { FiberManualRecord, SettingsOutlined, TerminalOutlined } from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import useStore from '../../hooks/useStore';
import { messageChannelContext } from '../../provider/MessageChannel';
import { StoreState, View } from '../../provider/Store';

export const DRAWER_WIDTH = 248;

type ServiceEntry = { key: NonNullable<StoreState['service']>; label: string; color: string };

const SERVICES: ServiceEntry[] = [
	{ key: 'crunchy', label: 'Crunchyroll', color: '#f47521' },
	{ key: 'hidive', label: 'Hidive', color: '#00b3d6' },
	{ key: 'adn', label: 'AnimationDigitalNetwork', color: '#7b61ff' }
];

const SideBar: React.FC = () => {
	const messageHandler = React.useContext(messageChannelContext);
	const [store, dispatch] = useStore();
	const { enqueueSnackbar } = useSnackbar();

	const { service, view, version } = store;

	React.useEffect(() => {
		(async () => {
			if (!messageHandler || version !== '') return;
			dispatch({ type: 'version', payload: await messageHandler.version() });
		})();
	}, [messageHandler, version, dispatch]);

	const setView = (next: View) => dispatch({ type: 'view', payload: next });

	const selectService = async (next: ServiceEntry['key']) => {
		if (!messageHandler) return;
		if (service === next) return setView('downloads');
		if (await messageHandler.isDownloading()) {
			return enqueueSnackbar('Please finish the current download before switching service.', { variant: 'warning' });
		}
		if (service !== undefined) {
			const ok = await messageHandler.logout();
			if (!ok) return enqueueSnackbar('Unable to change service.', { variant: 'error' });
		}
		dispatch({ type: 'service', payload: next });
		setView('downloads');
	};

	return (
		<Drawer
			variant="permanent"
			sx={{
				width: DRAWER_WIDTH,
				flexShrink: 0,
				'& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box', position: 'relative', height: '100%' }
			}}
		>
			<Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
				<List
					sx={{ flexGrow: 1, overflowY: 'auto', px: 1 }}
					subheader={
						<ListSubheader component="div" sx={{ bgcolor: 'transparent', fontWeight: 700, letterSpacing: '0.06em' }}>
							SERVICES
						</ListSubheader>
					}
				>
					{SERVICES.map((s) => {
						const active = service === s.key;
						return (
							<ListItemButton key={s.key} selected={active && view === 'downloads'} onClick={() => selectService(s.key)} sx={{ borderRadius: 2, mb: 0.5 }}>
								<ListItemIcon sx={{ minWidth: 32 }}>
									<Box
										sx={{
											width: 12,
											height: 12,
											borderRadius: '50%',
											bgcolor: s.color,
											boxShadow: active ? `0 0 0 3px ${s.color}44` : 'none'
										}}
									/>
								</ListItemIcon>
								<ListItemText primary={s.label} primaryTypographyProps={{ noWrap: true, fontSize: 14 }} />
								{active && <FiberManualRecord sx={{ fontSize: 10, color: 'success.main' }} />}
							</ListItemButton>
						);
					})}

					<Divider sx={{ my: 1 }} />

					<ListItemButton selected={view === 'console'} onClick={() => setView('console')} sx={{ borderRadius: 2, mb: 0.5 }}>
						<ListItemIcon sx={{ minWidth: 32 }}>
							<TerminalOutlined fontSize="small" />
						</ListItemIcon>
						<ListItemText primary="Console" primaryTypographyProps={{ fontSize: 14 }} />
					</ListItemButton>
					<ListItemButton selected={view === 'settings'} onClick={() => setView('settings')} sx={{ borderRadius: 2 }}>
						<ListItemIcon sx={{ minWidth: 32 }}>
							<SettingsOutlined fontSize="small" />
						</ListItemIcon>
						<ListItemText primary="Settings" primaryTypographyProps={{ fontSize: 14 }} />
					</ListItemButton>
				</List>

				<Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
					<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
						<FiberManualRecord sx={{ fontSize: 10, color: 'success.main' }} />
						<Typography variant="caption" color="text.secondary">
							Connected
						</Typography>
					</Box>
					<Typography variant="caption" color="text.secondary">
						{version ? `v${version}` : ''}
					</Typography>
				</Box>
			</Box>
		</Drawer>
	);
};

export default SideBar;
