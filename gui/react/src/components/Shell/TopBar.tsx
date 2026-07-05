import React from 'react';
import { AppBar, Box, Button, Chip, IconButton, Toolbar, Tooltip, Typography } from '@mui/material';
import { ClearAll, DarkModeOutlined, DownloadRounded, LightModeOutlined, Menu as MenuIcon } from '@mui/icons-material';
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

const TopBar: React.FC<{ onMenuClick: () => void }> = ({ onMenuClick }) => {
	const messageHandler = React.useContext(messageChannelContext);
	const colorMode = React.useContext(ColorModeContext);
	const [{ service }] = useStore();

	const label = serviceLabel(service);

	return (
		<AppBar position="static">
			<Toolbar sx={{ gap: { xs: 0.5, md: 1.5 }, rowGap: 1, minHeight: '64px', flexWrap: { xs: 'wrap', md: 'nowrap' }, px: { xs: 1.5, sm: 2, md: 3 } }}>
				<Tooltip title="Menu">
					<IconButton edge="start" color="inherit" aria-label="Open navigation" onClick={onMenuClick} sx={{ display: { md: 'none' } }}>
						<MenuIcon />
					</IconButton>
				</Tooltip>

				<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
					<DownloadRounded sx={{ color: 'primary.main' }} />
					<Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.02em', display: { xs: 'none', sm: 'block' } }}>
						aniDL
					</Typography>
				</Box>

				<Chip
					size="small"
					variant={label ? 'filled' : 'outlined'}
					color={label ? 'primary' : 'default'}
					label={label ?? 'No service selected'}
					sx={{ fontWeight: 600, display: { xs: 'none', sm: 'inline-flex' }, maxWidth: { sm: 140, lg: 'none' } }}
				/>

				<Box sx={{ flexGrow: 1 }} />

				{service && <AuthButton />}
				<AddToQueue disabled={!service} />
				<Button
					variant="outlined"
					color="inherit"
					aria-label="Clear queue"
					startIcon={<ClearAll />}
					onClick={() => messageHandler?.clearQueue()}
					sx={{
						maxHeight: '2.3rem',
						minWidth: { xs: 0, md: 'auto' },
						px: { xs: 1.25, md: 2 },
						'& .MuiButton-startIcon': { mr: { xs: 0, md: 1 }, ml: { xs: 0, md: -0.5 } }
					}}
				>
					<Box component="span" sx={{ display: { xs: 'none', md: 'inline' } }}>
						Clear
					</Box>
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
