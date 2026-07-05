import React from 'react';
import { Box, Card, Chip, Collapse, IconButton, LinearProgress, Stack, Tooltip, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import TranslateIcon from '@mui/icons-material/Translate';
import SubtitlesIcon from '@mui/icons-material/Subtitles';
import HighQualityIcon from '@mui/icons-material/HighQuality';
import { QueueItem } from '../../../../../../@types/messageHandler';

/** A queue item paired with its original index in the flat queue (needed for deletion). */
export type IndexedItem = { item: QueueItem; index: number };

/** One series/season worth of queued episodes. */
export type Group = {
	key: string;
	title: string;
	season: string;
	image: string;
	items: IndexedItem[];
};

const qualityLabel = (q: number) => (q === 0 ? 'Best' : `${q}`);

/** Dub / subtitle / quality summary for a single episode. */
const MetaChips: React.FC<{ item: QueueItem }> = ({ item }) => {
	const hasSubs = item.dlsubs.length > 0 && !(item.dlsubs.length === 1 && item.dlsubs[0] === 'none');
	return (
		<Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" alignItems="center" sx={{ flexShrink: 0 }}>
			{item.dubLang.length > 0 && (
				<Tooltip title="Dub language(s)" arrow placement="top">
					<Chip size="small" variant="outlined" icon={<TranslateIcon />} label={item.dubLang.join(', ')} sx={{ maxWidth: '100%' }} />
				</Tooltip>
			)}
			<Tooltip title="Subtitle(s)" arrow placement="top">
				<Chip size="small" variant="outlined" icon={<SubtitlesIcon />} label={hasSubs ? item.dlsubs.join(', ') : 'none'} sx={{ maxWidth: '100%' }} />
			</Tooltip>
			<Tooltip title="Quality" arrow placement="top">
				<Chip size="small" variant="outlined" icon={<HighQualityIcon />} label={qualityLabel(item.q)} />
			</Tooltip>
		</Stack>
	);
};

const EpisodeRow: React.FC<{ entry: IndexedItem; onDelete: (index: number) => void }> = ({ entry, onDelete }) => {
	const { item, index } = entry;
	const epLabel = item.parent.season ? `S${item.parent.season} · E${item.episode}` : `E${item.episode}`;

	return (
		<Box
			sx={{
				borderRadius: 1.5,
				transition: 'background-color 150ms',
				'&:hover': { bgcolor: 'action.hover' }
			}}
		>
			<Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1, px: 1.5, flexWrap: { xs: 'wrap', sm: 'nowrap' } }}>
				<Chip size="small" label={epLabel} sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', flexShrink: 0, borderRadius: 1 }} />
				<Typography variant="body2" sx={{ flex: 1, minWidth: '4rem' }} noWrap title={item.title}>
					{item.title}
				</Typography>
				<MetaChips item={item} />
				<Tooltip title="Remove from queue" arrow placement="top">
					<IconButton
						size="small"
						onClick={() => onDelete(index)}
						sx={{
							flexShrink: 0,
							color: 'text.secondary',
							'&:hover': { color: 'error.main', bgcolor: (t) => alpha(t.palette.error.main, 0.12) }
						}}
					>
						<DeleteIcon fontSize="small" />
					</IconButton>
				</Tooltip>
			</Box>
			{/* Per-episode progress. Queued items sit at 0% ("waiting") — the item that is
			    actually downloading is lifted out of the queue and shown with a live bar in
			    the ActiveDownload card above. */}
			<Box sx={{ px: 1.5, pb: 0.75 }}>
				<Tooltip title="Queued — 0%" arrow placement="bottom-start">
					<LinearProgress variant="determinate" value={0} sx={{ height: 3, borderRadius: 2, opacity: 0.7, bgcolor: 'action.hover' }} />
				</Tooltip>
			</Box>
		</Box>
	);
};

/**
 * A collapsible series card: the series/season is the header (parent), its queued
 * episodes are the rows underneath (children), each carrying its dub/sub/quality
 * info. Defaults to expanded.
 */
const QueueGroup: React.FC<{
	group: Group;
	onDelete: (index: number) => void;
	onDeleteGroup: (indices: number[]) => void;
}> = ({ group, onDelete, onDeleteGroup }) => {
	const [open, setOpen] = React.useState(true);
	const count = group.items.length;

	return (
		<Card variant="outlined" sx={{ width: '100%', overflow: 'hidden' }}>
			<Box
				onClick={() => setOpen((o) => !o)}
				sx={{
					display: 'flex',
					alignItems: 'center',
					gap: 1.5,
					p: 1.5,
					cursor: 'pointer',
					userSelect: 'none',
					transition: 'background-color 150ms',
					'&:hover': { bgcolor: 'action.hover' }
				}}
			>
				<Box
					component="img"
					src={group.image}
					alt={group.title}
					sx={{ width: 72, height: 44, objectFit: 'cover', borderRadius: 1, flexShrink: 0, bgcolor: 'action.hover', boxShadow: 1 }}
				/>
				<Box sx={{ flex: 1, minWidth: 0 }}>
					<Typography variant="subtitle1" fontWeight={700} noWrap title={group.title}>
						{group.title}
					</Typography>
					<Stack direction="row" spacing={1} alignItems="center" divider={<Typography color="text.disabled">·</Typography>}>
						{group.season && (
							<Typography variant="caption" color="text.secondary">
								Season {group.season}
							</Typography>
						)}
						<Typography variant="caption" color="text.secondary">
							{count} {count === 1 ? 'episode' : 'episodes'}
						</Typography>
					</Stack>
				</Box>
				<Tooltip title="Remove series from queue" arrow placement="top">
					<IconButton
						size="small"
						onClick={(e) => {
							e.stopPropagation();
							onDeleteGroup(group.items.map((i) => i.index));
						}}
						sx={{ color: 'text.secondary', '&:hover': { color: 'error.main', bgcolor: (t) => alpha(t.palette.error.main, 0.12) } }}
					>
						<DeleteIcon fontSize="small" />
					</IconButton>
				</Tooltip>
				<ExpandMoreIcon sx={{ color: 'text.secondary', transition: 'transform 200ms', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }} />
			</Box>
			<Collapse in={open} timeout="auto" unmountOnExit>
				<Box sx={{ px: 1, pt: 1, pb: 1, display: 'flex', flexDirection: 'column', gap: 0.25, borderTop: 1, borderColor: 'divider' }}>
					{group.items.map((entry) => (
						<EpisodeRow key={`q_${entry.index}`} entry={entry} onDelete={onDelete} />
					))}
				</Box>
			</Collapse>
		</Card>
	);
};

export default QueueGroup;
