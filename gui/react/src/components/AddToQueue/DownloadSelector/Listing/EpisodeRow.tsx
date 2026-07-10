import React, { RefObject } from 'react';
import { Box, Checkbox, Chip, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useSnackbar } from 'notistack';
import ContextMenu from '../../../reusable/ContextMenu';
import { Episode, episodeCode, formatDuration } from './selection';

type EpisodeRowProps = {
	episode: Episode;
	index: number;
	selected: boolean;
	onToggle: (index: number) => void;
};

/**
 * A single episode line: checkbox, thumbnail, code + title + summary, duration
 * and audio-language chips. Memoised so toggling one episode only re-renders the
 * affected row, not the whole (potentially 100+ episode) list.
 */
const EpisodeRow: React.FC<EpisodeRowProps> = ({ episode, index, selected, onToggle }) => {
	const { enqueueSnackbar } = useSnackbar();
	const imageRef = React.useRef<HTMLImageElement>(null);
	const summaryRef = React.useRef<HTMLParagraphElement>(null);
	const duration = formatDuration(episode.time);
	const langs = episode.lang?.filter((l) => l && l !== 'none') ?? [];

	return (
		<Box>
			<Box
				onClick={() => onToggle(index)}
				sx={{
					display: 'grid',
					gridTemplateColumns: { xs: 'auto 1fr auto', sm: 'auto 84px 1fr auto' },
					alignItems: 'center',
					gap: { xs: 1, sm: 1.5 },
					px: 1.5,
					py: 1,
					cursor: 'pointer',
					borderRadius: 1.5,
					transition: 'background-color 120ms',
					bgcolor: selected ? (t) => alpha(t.palette.primary.main, 0.12) : 'transparent',
					'&:hover': { bgcolor: (t) => alpha(t.palette.primary.main, selected ? 0.16 : 0.06) }
				}}
			>
				<Checkbox
					checked={selected}
					disableRipple
					onClick={(e) => e.stopPropagation()}
					onChange={() => onToggle(index)}
					sx={{ p: 0.5 }}
					inputProps={{ 'aria-label': `Select ${episodeCode(episode)} ${episode.name}` }}
				/>

				<Box
					component="img"
					ref={imageRef}
					src={episode.img}
					alt={episode.name}
					loading="lazy"
					sx={{
						display: { xs: 'none', sm: 'block' },
						width: 84,
						height: 48,
						objectFit: 'cover',
						borderRadius: 1,
						bgcolor: 'action.hover',
						boxShadow: 1,
						userSelect: 'none'
					}}
				/>

				<Box sx={{ minWidth: 0 }}>
					<Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
						{episodeCode(episode)}
					</Typography>
					<Typography variant="body2" noWrap sx={{ fontWeight: 600, color: 'text.primary' }} title={episode.name}>
						{episode.name}
					</Typography>
					{episode.description && (
						<Typography variant="caption" color="text.secondary" noWrap ref={summaryRef} sx={{ display: 'block' }} title={episode.description}>
							{episode.description}
						</Typography>
					)}
				</Box>

				<Stack spacing={0.5} alignItems="flex-end" sx={{ flexShrink: 0 }}>
					{duration && (
						<Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
							{duration}
						</Typography>
					)}
					{langs.length > 0 && (
						<Stack direction="row" spacing={0.5} sx={{ display: { xs: 'none', sm: 'flex' } }}>
							{langs.slice(0, 4).map((lang) => (
								<Chip
									key={lang}
									label={lang}
									size="small"
									variant="outlined"
									sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase' }}
								/>
							))}
						</Stack>
					)}
				</Stack>
			</Box>

			<ContextMenu
				options={[
					{
						text: 'Copy image URL',
						onClick: async () => {
							await navigator.clipboard.writeText(episode.img);
							enqueueSnackbar('Copied URL to clipboard', { variant: 'info' });
						}
					},
					{
						text: 'Open image in new tab',
						onClick: () => {
							window.open(episode.img);
						}
					}
				]}
				popupItem={imageRef as RefObject<HTMLElement>}
			/>
			{episode.description && (
				<ContextMenu
					options={[
						{
							text: 'Copy summary to clipboard',
							onClick: async () => {
								await navigator.clipboard.writeText(episode.description);
								enqueueSnackbar('Copied summary to clipboard', { variant: 'info' });
							}
						}
					]}
					popupItem={summaryRef as RefObject<HTMLElement>}
				/>
			)}
		</Box>
	);
};

export default React.memo(EpisodeRow);
