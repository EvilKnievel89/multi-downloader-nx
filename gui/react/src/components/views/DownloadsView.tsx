import React from 'react';
import { Alert, Box } from '@mui/material';
import MainFrame from '../MainFrame/MainFrame';
import useStore from '../../hooks/useStore';

/**
 * Container for the queue/download UI. The content lives in a fixed, centered
 * column (max 62rem) with a *definite* width, so the layout width stays constant
 * regardless of content — expanding/collapsing a series no longer resizes it.
 * The column only shrinks once the viewport is narrower than the cap.
 */
const DownloadsView: React.FC = () => {
	const [{ service }] = useStore();

	return (
		<Box sx={{ p: { xs: 1.5, md: 3 }, width: '100%' }}>
			<Box sx={{ width: '100%', maxWidth: '62rem', mx: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
				{!service && (
					<Alert severity="info" sx={{ width: '100%' }}>
						Select a service from the sidebar to search for and add episodes to the queue.
					</Alert>
				)}
				<MainFrame />
			</Box>
		</Box>
	);
};

export default DownloadsView;
