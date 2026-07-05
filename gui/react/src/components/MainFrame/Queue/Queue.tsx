import { Box, Chip, Stack, Typography } from '@mui/material';
import PlaylistPlayIcon from '@mui/icons-material/PlaylistPlay';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';
import React from 'react';
import { QueueItem } from '../../../../../../@types/messageHandler';
import { messageChannelContext } from '../../../provider/MessageChannel';
import { queueContext } from '../../../provider/QueueProvider';
import useDownloadManager from '../DownloadManager/DownloadManager';
import ActiveDownload from './ActiveDownload';
import QueueGroup, { Group, IndexedItem } from './QueueGroup';

/** Group the flat queue into series/season buckets, preserving order and each item's original index. */
const buildGroups = (queue: QueueItem[]): Group[] => {
	const groups: Group[] = [];
	const byKey = new Map<string, Group>();
	queue.forEach((item, index) => {
		const key = `${item.parent.title}::${item.parent.season}`;
		let group = byKey.get(key);
		if (!group) {
			group = { key, title: item.parent.title, season: item.parent.season, image: item.image, items: [] };
			byKey.set(key, group);
			groups.push(group);
		}
		group.items.push({ item, index } satisfies IndexedItem);
	});
	return groups;
};

const EmptyState: React.FC = () => (
	<Box
		sx={{
			width: '100%',
			py: 8,
			px: 3,
			display: 'flex',
			flexDirection: 'column',
			alignItems: 'center',
			textAlign: 'center',
			gap: 1,
			border: 1,
			borderStyle: 'dashed',
			borderColor: 'divider',
			borderRadius: 3,
			color: 'text.secondary'
		}}
	>
		<InboxOutlinedIcon sx={{ fontSize: 48, opacity: 0.6 }} />
		<Typography variant="h6" color="text.primary">
			Your queue is empty
		</Typography>
		<Typography variant="body2" sx={{ maxWidth: '28rem' }}>
			Use <strong>Add to Queue</strong> to search a series and pick episodes. They&apos;ll appear here grouped by series, ready to
			download.
		</Typography>
	</Box>
);

const Queue: React.FC = () => {
	const { data, current, steps } = useDownloadManager();
	const queue = React.useContext(queueContext);
	const msg = React.useContext(messageChannelContext);

	if (!msg) return null;

	const removeOne = (index: number) => {
		msg.removeFromQueue(index);
	};

	// Delete highest index first so the lower indices we captured stay valid even as
	// the queue shrinks (each removal only shifts items *after* it).
	const removeGroup = async (indices: number[]) => {
		for (const index of [...indices].sort((a, b) => b - a)) {
			await msg.removeFromQueue(index);
		}
	};

	const groups = buildGroups(queue);
	const hasActive = Boolean(data || current);

	return (
		<Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
			{hasActive && <ActiveDownload data={data} current={current} steps={steps} />}

			{queue.length > 0 && (
				<>
					<Stack direction="row" spacing={1} alignItems="center" sx={{ px: 0.5, mt: hasActive ? 1 : 0 }}>
						<PlaylistPlayIcon fontSize="small" sx={{ color: 'text.secondary' }} />
						<Typography variant="subtitle2" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>
							Up next
						</Typography>
						<Chip size="small" label={queue.length} sx={{ height: 20, fontWeight: 700 }} />
					</Stack>
					{groups.map((group) => (
						<QueueGroup key={group.key} group={group} onDelete={removeOne} onDeleteGroup={removeGroup} />
					))}
				</>
			)}

			{!hasActive && queue.length === 0 && <EmptyState />}
		</Box>
	);
};

export default Queue;
