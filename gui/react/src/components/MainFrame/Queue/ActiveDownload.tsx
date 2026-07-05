import React from 'react';
import { Box, Card, CardContent, Chip, CircularProgress, Divider, LinearProgress, Stack, Typography } from '@mui/material';
import DownloadingIcon from '@mui/icons-material/Downloading';
import MovieOutlinedIcon from '@mui/icons-material/MovieOutlined';
import AudiotrackIcon from '@mui/icons-material/Audiotrack';
import SubtitlesIcon from '@mui/icons-material/Subtitles';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import MergeIcon from '@mui/icons-material/Merge';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { ExtendedProgress, QueueItem } from '../../../../../../@types/messageHandler';
import { DownloadStep } from '../DownloadManager/DownloadManager';

const formatTime = (time: number) => {
	time = Math.floor(time / 1000);
	const minutes = Math.floor(time / 60);
	time = time % 60;
	const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
	return `${pad(minutes)}m${pad(time)}s`;
};

const kindIcon = (kind: DownloadStep['kind']) => {
	switch (kind) {
		case 'audio':
			return <AudiotrackIcon fontSize="small" />;
		case 'subtitle':
			return <SubtitlesIcon fontSize="small" />;
		case 'decrypt':
			return <LockOpenIcon fontSize="small" />;
		case 'mux':
			return <MergeIcon fontSize="small" />;
		default:
			return <MovieOutlinedIcon fontSize="small" />;
	}
};

const stepLabel = (step: DownloadStep): string => {
	switch (step.kind) {
		case 'audio':
			return step.lang ? `Audio · ${step.lang}` : 'Audio';
		case 'subtitle':
			return step.lang ? `Subtitle · ${step.lang}` : 'Subtitle';
		case 'decrypt':
			return step.label ? `Decrypting ${step.label}` : 'Decrypting';
		case 'mux':
			return step.label ? `Muxing · ${step.label}` : 'Muxing';
		default:
			return 'Video';
	}
};

/** One step row: stream (with % + stats) or a decrypt/mux phase (indeterminate). */
const StepRow: React.FC<{ step: DownloadStep; stats?: ExtendedProgress }> = ({ step, stats }) => {
	const active = step.status === 'active';
	const done = step.status === 'done';
	const failed = step.status === 'failed';
	const hasPercent = typeof step.percent === 'number';
	const iconColor = failed ? 'error.main' : done ? 'success.main' : active ? 'primary.main' : 'text.disabled';

	return (
		<Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
			<Box sx={{ mt: '1px', color: iconColor, display: 'flex', flexShrink: 0 }}>{kindIcon(step.kind)}</Box>
			<Box sx={{ flex: 1, minWidth: 0 }}>
				<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
					<Typography
						variant="body2"
						noWrap
						sx={{ flex: 1, minWidth: 0, fontWeight: active ? 600 : 400, color: done || failed ? 'text.secondary' : 'text.primary' }}
					>
						{stepLabel(step)}
					</Typography>
					{failed && <ErrorOutlineIcon fontSize="small" color="error" />}
					{done && <CheckCircleIcon fontSize="small" sx={{ color: 'success.main' }} />}
					{active && hasPercent && (
						<Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
							{Math.round(step.percent as number)}%
						</Typography>
					)}
					{active && !hasPercent && <CircularProgress size={14} thickness={5} />}
				</Box>
				{active &&
					(hasPercent ? (
						<LinearProgress variant="determinate" value={step.percent} sx={{ height: 5, borderRadius: 3, mt: 0.5 }} />
					) : (
						<LinearProgress variant="indeterminate" sx={{ height: 5, borderRadius: 3, mt: 0.5 }} />
					))}
				{active && hasPercent && stats && (
					<Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', fontVariantNumeric: 'tabular-nums' }}>
						{stats.progress.cur} / {stats.progress.total} parts · {formatTime(stats.progress.time)} ·{' '}
						{(stats.progress.downloadSpeed / 1024 / 1024).toFixed(2)} MB/s · {(stats.progress.bytes / 1024 / 1024).toFixed(2)} MB
					</Typography>
				)}
			</Box>
		</Box>
	);
};

/**
 * "Now downloading" card. Shows the episode header plus a live step checklist
 * (video / audio / subtitles per language, then decrypt and mux). Falls back to
 * an indeterminate "preparing" bar until the first step arrives.
 */
const ActiveDownload: React.FC<{ data?: ExtendedProgress; current?: QueueItem; steps: DownloadStep[] }> = ({ data, current, steps }) => {
	if (!data && !current) return null;

	const seriesTitle = data ? data.downloadInfo.parent.title : current!.parent.title;
	const episodeTitle = data ? data.downloadInfo.title : current!.title;
	const image = data ? data.downloadInfo.image : current!.image;

	return (
		<Card
			variant="outlined"
			sx={{
				width: '100%',
				borderColor: 'primary.main',
				position: 'relative',
				overflow: 'hidden',
				'&::before': { content: '""', position: 'absolute', insetBlock: 0, left: 0, width: 4, bgcolor: 'primary.main' }
			}}
		>
			<CardContent sx={{ '&:last-child': { pb: 2 } }}>
				<Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
					<Box
						component="img"
						src={image}
						alt={episodeTitle}
						sx={{ width: 132, height: 82, flexShrink: 0, objectFit: 'cover', borderRadius: 1.5, bgcolor: 'action.hover', boxShadow: 2, userSelect: 'none' }}
					/>
					<Box sx={{ flex: 1, minWidth: 0 }}>
						<Chip size="small" color="primary" icon={<DownloadingIcon />} label="Downloading" sx={{ mb: 0.75 }} />
						<Typography variant="subtitle1" fontWeight={700} noWrap title={seriesTitle}>
							{seriesTitle}
						</Typography>
						<Typography variant="body2" color="text.secondary" noWrap title={episodeTitle}>
							{episodeTitle}
						</Typography>
					</Box>
				</Box>

				<Divider sx={{ my: 1.5 }} />

				{steps.length > 0 ? (
					<Stack spacing={1.25} sx={{ maxHeight: '17rem', overflowY: 'auto', pr: 0.5 }}>
						{steps.map((step) => (
							<StepRow key={step.key} step={step} stats={step.status === 'active' ? data : undefined} />
						))}
					</Stack>
				) : (
					<Box>
						<LinearProgress variant="indeterminate" sx={{ height: 5, borderRadius: 3 }} />
						<Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
							Preparing download…
						</Typography>
					</Box>
				)}
			</CardContent>
		</Card>
	);
};

export default ActiveDownload;
