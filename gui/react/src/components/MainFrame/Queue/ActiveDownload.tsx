import React from 'react';
import { Box, Card, CardContent, Chip, LinearProgress, Stack, Typography } from '@mui/material';
import DownloadingIcon from '@mui/icons-material/Downloading';
import { ExtendedProgress, QueueItem } from '../../../../../../@types/messageHandler';

const formatTime = (time: number) => {
	time = Math.floor(time / 1000);
	const minutes = Math.floor(time / 60);
	time = time % 60;
	const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
	return `${pad(minutes)}m${pad(time)}s`;
};

/**
 * Prominent "now downloading" card shown above the pending queue. Driven by the
 * live progress event (`data`) when available, otherwise by the item that was
 * just pulled off the queue (`current`) while it spins up. Purely presentational
 * — theme-token colors, no hard-coded palette.
 */
const ActiveDownload: React.FC<{ data?: ExtendedProgress; current?: QueueItem }> = ({ data, current }) => {
	if (!data && !current) return null;

	const seriesTitle = data ? data.downloadInfo.parent.title : current!.parent.title;
	const episodeTitle = data ? data.downloadInfo.title : current!.title;
	const image = data ? data.downloadInfo.image : current!.image;
	const langName = data ? data.downloadInfo.language?.name : undefined;

	const percentRaw = data ? data.progress.percent : 0;
	const percent = typeof percentRaw === 'string' ? parseInt(percentRaw) : percentRaw;

	return (
		<Card
			variant="outlined"
			sx={{
				width: '100%',
				borderColor: 'primary.main',
				position: 'relative',
				overflow: 'hidden',
				'&::before': {
					content: '""',
					position: 'absolute',
					insetBlock: 0,
					left: 0,
					width: 4,
					bgcolor: 'primary.main'
				}
			}}
		>
			<CardContent sx={{ display: 'flex', gap: 2, alignItems: 'center', '&:last-child': { pb: 2 } }}>
				<Box
					component="img"
					src={image}
					alt={episodeTitle}
					sx={{
						width: 140,
						height: 88,
						flexShrink: 0,
						objectFit: 'cover',
						borderRadius: 1.5,
						bgcolor: 'action.hover',
						boxShadow: 2,
						userSelect: 'none'
					}}
				/>
				<Box sx={{ flex: 1, minWidth: 0 }}>
					<Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75 }}>
						<Chip size="small" color="primary" icon={<DownloadingIcon />} label={langName ? `Downloading · ${langName}` : 'Downloading'} />
					</Stack>
					<Typography variant="subtitle1" fontWeight={700} noWrap title={seriesTitle}>
						{seriesTitle}
					</Typography>
					<Typography variant="body2" color="text.secondary" noWrap sx={{ mb: 1.25 }} title={episodeTitle}>
						{episodeTitle}
					</Typography>
					{data ? (
						<>
							<LinearProgress variant="determinate" value={isNaN(percent) ? 0 : percent} sx={{ height: 8, borderRadius: 4 }} />
							<Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, display: 'block', fontVariantNumeric: 'tabular-nums' }}>
								{data.progress.cur} / {data.progress.total} parts · {data.progress.percent}% · {formatTime(data.progress.time)} ·{' '}
								{(data.progress.downloadSpeed / 1024 / 1024).toFixed(2)} MB/s · {(data.progress.bytes / 1024 / 1024).toFixed(2)} MB
							</Typography>
						</>
					) : (
						<>
							<LinearProgress variant="indeterminate" sx={{ height: 8, borderRadius: 4 }} />
							<Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, display: 'block' }}>
								Preparing download…
							</Typography>
						</>
					)}
				</Box>
			</CardContent>
		</Card>
	);
};

export default ActiveDownload;
