import { Box } from '@mui/material';
import React from 'react';
import Queue from './Queue/Queue';

const MainFrame: React.FC = () => {
	return (
		<Box sx={{ width: '100%' }}>
			<Queue />
		</Box>
	);
};

export default MainFrame;
