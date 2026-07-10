import { Add } from '@mui/icons-material';
import { Box, Button, Dialog, Divider, useMediaQuery, useTheme } from '@mui/material';
import React from 'react';
import DownloadSelector from './DownloadSelector/DownloadSelector';
import EpisodeSelectionDialog from './DownloadSelector/Listing/EpisodeSelectionDialog';
import SearchBox from './SearchBox/SearchBox';

const AddToQueue: React.FC<{ disabled?: boolean }> = ({ disabled }) => {
	const [isOpen, setOpen] = React.useState(false);
	const theme = useTheme();
	const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

	return (
		<Box>
			<EpisodeSelectionDialog />
			<Dialog open={isOpen} onClose={() => setOpen(false)} fullScreen={fullScreen} fullWidth maxWidth="md" PaperProps={{ elevation: 4 }}>
				<Box sx={{ overflowX: 'auto' }}>
					<SearchBox />
					<Divider variant="middle" />
					<DownloadSelector onFinish={() => setOpen(false)} />
				</Box>
			</Dialog>
			<Button
				variant="contained"
				aria-label="Add to queue"
				startIcon={<Add />}
				disabled={disabled}
				onClick={() => setOpen(true)}
				sx={{
					maxHeight: '2.3rem',
					minWidth: { xs: 0, md: 'auto' },
					px: { xs: 1.25, md: 2 },
					'& .MuiButton-startIcon': { mr: { xs: 0, md: 1 }, ml: { xs: 0, md: -0.5 } }
				}}
			>
				<Box component="span" sx={{ display: { xs: 'none', md: 'inline' } }}>
					Add to Queue
				</Box>
			</Button>
		</Box>
	);
};

export default AddToQueue;
