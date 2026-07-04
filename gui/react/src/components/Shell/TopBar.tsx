import React from 'react';
import { AppBar, Box, Button, Chip, IconButton, Toolbar, Tooltip, Typography } from '@mui/material';
import { ClearAll, DarkModeOutlined, DownloadRounded, LightModeOutlined } from '@mui/icons-material';
import { messageChannelContext } from '../../provider/MessageChannel';
import useStore from '../../hooks/useStore';
import { StoreState } from '../../provider/Store';
import { ColorModeContext } from '../../Style';
import AddToQueue from '../AddToQueue/AddToQueue';
import StartQueueButton from '../StartQueue';
import AuthButton from '../AuthButton';

const serviceLabel = (service: StoreState['service']) => {
	switch (service) {
		case 'crunchy':
			return 'Crunchyroll';
		case 'hidive':
			return 'Hidive';
		case 'adn':
			return 'AnimationDigitalNetwork';
		default:
			return undefined;
	}
};

const TopBar: React.FC = () => {
	const messageHandler = React.useContext(messageChannelContext);
	const colorMode = React.useContext(ColorModeContext);
	const [{ service }] = useStore();

	const label = serviceLabel(service);

	return (
		<AppBar position="static">
			<Toolbar sx={{ gap: 1.5, minHeight: '64px' }}>
				<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
					<DownloadRounded sx={{ color: 'primary.main' }} />
					<Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
						aniDL
					</Typography>
				</Box>

				<Chip
					size="small"
					variant={label ? 'filled' : 'outlined'}
					color={label ? 'primary' : 'default'}
					label={label ?? 'No service selected'}
					sx={{ fontWeight: 600 }}
				/>

				<Box sx={{ flexGrow: 1 }} />

				{service && <AuthButton />}
				<AddToQueue disabled={!service} />
				<Button variant="outlined" color="inherit" startIcon={<ClearAll />} onClick={() => messageHandler?.clearQueue()} sx={{ maxHeight: '2.3rem' }}>
					Clear
				</Button>
				<StartQueueButton />

				<Tooltip title={colorMode.mode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}>
					<IconButton onClick={colorMode.toggle} color="inherit">
						{colorMode.mode === 'dark' ? <LightModeOutlined /> : <DarkModeOutlined />}
					</IconButton>
				</Tooltip>
			</Toolbar>
		</AppBar>
	);
};

export default TopBar;
