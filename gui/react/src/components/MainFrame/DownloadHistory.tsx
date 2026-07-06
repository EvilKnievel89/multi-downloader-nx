import React from 'react';
import { Box, Card, Chip, Collapse, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import HistoryIcon from '@mui/icons-material/History';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import ReplayIcon from '@mui/icons-material/Replay';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useSnackbar } from 'notistack';
import { HistoryEntry } from '../../../../../@types/messageHandler';
import { messageChannelContext } from '../../provider/MessageChannel';
import { historyContext } from '../../provider/HistoryProvider';

/** Compact "5m ago" style stamp; full date/time is exposed via the title attribute. */
const relativeTime = (ts: number): string => {
	const diff = Date.now() - ts;
	if (diff < 60_000) return 'just now';
	const mins = Math.floor(diff / 60_000);
	if (mins < 60) return `${mins}m ago`;
	const hours = Math.floor(mins / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	if (days < 7) return `${days}d ago`;
	return new Date(ts).toLocaleDateString();
};

/** One finished download: status icon, thumbnail, title/episode/time, retry + remove. */
const HistoryRow: React.FC<{
	entry: HistoryEntry;
	onRetry: (entry: HistoryEntry) => void;
	onRemove: (id: string) => void;
}> = ({ entry, onRetry, onRemove }) => {
	const { item, success, error, time } = entry;
	const epLabel = item.parent.season ? `S${item.parent.season} · E${item.episode}` : `E${item.episode}`;
	const statusColor = success ? 'success.main' : 'error.main';
	const reason = error || 'Download failed — check the Console for details.';

	return (
		<Box
			sx={{
				display: 'flex',
				alignItems: 'center',
				gap: 1.5,
				py: 1,
				px: 1.5,
				borderRadius: 1.5,
				transition: 'background-color 150ms',
				'&:hover': { bgcolor: 'action.hover' }
			}}
		>
			<Tooltip title={success ? 'Completed' : reason} arrow placement="top">
				<Box sx={{ display: 'flex', flexShrink: 0, color: statusColor }}>{success ? <CheckCircleIcon fontSize="small" /> : <ErrorOutlineIcon fontSize="small" />}</Box>
			</Tooltip>

			<Box
				component="img"
				src={item.image}
				alt={item.title}
				sx={{ width: 56, height: 35, objectFit: 'cover', borderRadius: 1, flexShrink: 0, bgcolor: 'action.hover', boxShadow: 1, userSelect: 'none' }}
			/>

			<Box sx={{ flex: 1, minWidth: 0 }}>
				<Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
					<Chip size="small" label={epLabel} sx={{ height: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums', flexShrink: 0, borderRadius: 1 }} />
					<Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 0 }} title={item.title}>
						{item.title}
					</Typography>
				</Stack>
				<Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', mt: 0.25 }} title={new Date(time).toLocaleString()}>
					{item.parent.title}
					{' · '}
					{relativeTime(time)}
				</Typography>
				{!success && (
					<Typography variant="caption" color="error.main" noWrap sx={{ display: 'block' }} title={reason}>
						{reason}
					</Typography>
				)}
			</Box>

			<Tooltip title="Retry — add back to queue" arrow placement="top">
				<IconButton
					size="small"
					onClick={() => onRetry(entry)}
					sx={{ flexShrink: 0, color: 'text.secondary', '&:hover': { color: 'primary.main', bgcolor: (t) => alpha(t.palette.primary.main, 0.12) } }}
				>
					<ReplayIcon fontSize="small" />
				</IconButton>
			</Tooltip>
			<Tooltip title="Remove from history" arrow placement="top">
				<IconButton
					size="small"
					onClick={() => onRemove(entry.id)}
					sx={{ flexShrink: 0, color: 'text.secondary', '&:hover': { color: 'error.main', bgcolor: (t) => alpha(t.palette.error.main, 0.12) } }}
				>
					<DeleteIcon fontSize="small" />
				</IconButton>
			</Tooltip>
		</Box>
	);
};

/**
 * History of finished downloads (successful and failed) for the active service.
 * Sits under the queue in the Downloads view. Hidden entirely until the first
 * download completes. Entries are authoritative — a download that failed before
 * any progress step (auth/resolve) still appears here as failed.
 */
const DownloadHistory: React.FC = () => {
	const history = React.useContext(historyContext);
	const msg = React.useContext(messageChannelContext);
	const { enqueueSnackbar } = useSnackbar();
	const [open, setOpen] = React.useState(true);

	if (!msg || history.length === 0) return null;

	const succeeded = history.filter((e) => e.success).length;
	const failed = history.length - succeeded;

	const onRetry = (entry: HistoryEntry) => {
		msg.requeue(entry.item);
		enqueueSnackbar(`Added "${entry.item.title}" back to the queue.`, { variant: 'success' });
	};

	const onRemove = (id: string) => {
		msg.removeFromHistory(id);
	};

	const onClear = () => {
		msg.clearHistory();
		enqueueSnackbar('Download history cleared.', { variant: 'info' });
	};

	return (
		<Card variant="outlined" sx={{ width: '100%', overflow: 'hidden' }}>
			<Box
				sx={{
					display: 'flex',
					alignItems: 'center',
					gap: 1.5,
					p: 1.5,
					borderBottom: open ? 1 : 0,
					borderColor: 'divider'
				}}
			>
				<Box onClick={() => setOpen((o) => !o)} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, minWidth: 0, cursor: 'pointer', userSelect: 'none' }}>
					<HistoryIcon fontSize="small" sx={{ color: 'text.secondary' }} />
					<Typography variant="subtitle2" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>
						History
					</Typography>
					{succeeded > 0 && (
						<Tooltip title="Successful" arrow placement="top">
							<Chip size="small" icon={<CheckCircleIcon />} label={succeeded} color="success" variant="outlined" sx={{ height: 22, fontWeight: 700 }} />
						</Tooltip>
					)}
					{failed > 0 && (
						<Tooltip title="Failed" arrow placement="top">
							<Chip size="small" icon={<ErrorOutlineIcon />} label={failed} color="error" variant="outlined" sx={{ height: 22, fontWeight: 700 }} />
						</Tooltip>
					)}
					<ExpandMoreIcon sx={{ ml: 'auto', color: 'text.secondary', transition: 'transform 200ms', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }} />
				</Box>
				<Tooltip title="Clear history" arrow placement="top">
					<IconButton
						size="small"
						onClick={onClear}
						sx={{ flexShrink: 0, color: 'text.secondary', '&:hover': { color: 'error.main', bgcolor: (t) => alpha(t.palette.error.main, 0.12) } }}
					>
						<DeleteSweepIcon fontSize="small" />
					</IconButton>
				</Tooltip>
			</Box>
			<Collapse in={open} timeout="auto" unmountOnExit>
				<Box sx={{ p: 1, display: 'flex', flexDirection: 'column', gap: 0.25, maxHeight: '26rem', overflowY: 'auto' }}>
					{history.map((entry) => (
						<HistoryRow key={entry.id} entry={entry} onRetry={onRetry} onRemove={onRemove} />
					))}
				</Box>
			</Collapse>
		</Card>
	);
};

export default DownloadHistory;
