import React from 'react';
import { Alert, Box } from '@mui/material';
import MainFrame from '../MainFrame/MainFrame';
import useStore from '../../hooks/useStore';

/**
 * Container for the existing queue/download UI. MainFrame -> Queue is reused
 * unchanged; this only frames it and nudges the user to pick a service when
 * none is active.
 */
const DownloadsView: React.FC = () => {
	const [{ service }] = useStore();

	return (
		<Box sx={{ p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
			{!service && (
				<Alert severity="info" sx={{ mb: 2, width: '100%', maxWidth: '62rem' }}>
					Select a service from the sidebar to search for and add episodes to the queue.
				</Alert>
			)}
			<MainFrame />
		</Box>
	);
};

export default DownloadsView;
