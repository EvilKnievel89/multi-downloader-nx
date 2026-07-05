import { PauseCircleFilled, PlayCircleFilled } from '@mui/icons-material';
import { Box, Button } from '@mui/material';
import React from 'react';
import { messageChannelContext } from '../provider/MessageChannel';
import Require from './Require';

const StartQueueButton: React.FC = () => {
	const messageChannel = React.useContext(messageChannelContext);
	const [start, setStart] = React.useState(false);
	const msg = React.useContext(messageChannelContext);

	React.useEffect(() => {
		(async () => {
			if (!msg) return alert('Invalid state: msg not found');
			setStart(await msg.getDownloadQueue());
		})();
	}, []);

	// Keep the button in sync with the backend: when the queue finishes on its own
	// the server stops working on it, so re-read the state on every queue change.
	React.useEffect(() => {
		if (!msg) return;
		const handler = () => {
			msg.getDownloadQueue().then(setStart);
		};
		msg.randomEvents.on('queueChange', handler);
		return () => msg.randomEvents.removeListener('queueChange', handler);
	}, [msg]);

	const change = async () => {
		if (await messageChannel?.isDownloading()) alert('The current download will be finished before the queue stops');
		msg?.setDownloadQueue(!start);
		setStart(!start);
	};

	return (
		<Require value={messageChannel}>
			<Button
				startIcon={start ? <PauseCircleFilled /> : <PlayCircleFilled />}
				variant="contained"
				onClick={change}
				aria-label={start ? 'Stop queue' : 'Start queue'}
				sx={{
					maxHeight: '2.3rem',
					minWidth: { xs: 0, md: 'auto' },
					px: { xs: 1.25, md: 2 },
					'& .MuiButton-startIcon': { mr: { xs: 0, md: 1 }, ml: { xs: 0, md: -0.5 } }
				}}
			>
				<Box component="span" sx={{ display: { xs: 'none', md: 'inline' } }}>
					{start ? 'Stop Queue' : 'Start Queue'}
				</Box>
			</Button>
		</Require>
	);
};

export default StartQueueButton;
