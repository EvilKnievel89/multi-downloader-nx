import React from 'react';
import { Accordion, AccordionDetails, AccordionSummary, Box, Checkbox, Chip, Stack, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import EpisodeRow from './EpisodeRow';
import { Episode, SeasonGroup } from './selection';

type SeasonAccordionProps = {
	group: SeasonGroup;
	episodes: Episode[];
	selected: Set<number>;
	/** Indices (subset of group.indices) that pass the current text filter. */
	visibleIndices: number[];
	expanded: boolean;
	onExpandedChange: (key: string, expanded: boolean) => void;
	onToggleEpisode: (index: number) => void;
	onToggleSeason: (indices: number[]) => void;
};

/**
 * One collapsible season panel. The summary carries a tri-state checkbox that
 * reflects/controls the episodes currently *visible* in this season (so a text
 * filter never lets a bulk toggle touch hidden rows); the details render the
 * episode rows and unmount when collapsed so large series don't keep hundreds of
 * rows mounted.
 */
const SeasonAccordion: React.FC<SeasonAccordionProps> = ({ group, episodes, selected, visibleIndices, expanded, onExpandedChange, onToggleEpisode, onToggleSeason }) => {
	const picked = visibleIndices.filter((i) => selected.has(i)).length;
	const total = visibleIndices.length;
	const allSelected = picked === total && total > 0;
	const someSelected = picked > 0 && !allSelected;

	return (
		<Accordion
			expanded={expanded}
			onChange={(_, isExpanded) => onExpandedChange(group.key, isExpanded)}
			disableGutters
			elevation={0}
			slotProps={{ transition: { unmountOnExit: true } }}
			sx={{
				border: 1,
				borderColor: 'divider',
				borderRadius: 2,
				overflow: 'hidden',
				'&:before': { display: 'none' },
				'&.Mui-expanded': { borderColor: 'divider' }
			}}
		>
			<AccordionSummary
				component="div"
				expandIcon={<ExpandMoreIcon />}
				sx={{ bgcolor: 'action.hover', '& .MuiAccordionSummary-content': { alignItems: 'center', gap: 1.5, minWidth: 0 } }}
			>
				<Checkbox
					checked={allSelected}
					indeterminate={someSelected}
					disableRipple
					onClick={(e) => e.stopPropagation()}
					onFocus={(e) => e.stopPropagation()}
					onChange={() => onToggleSeason(visibleIndices)}
					sx={{ p: 0.5 }}
					inputProps={{ 'aria-label': `Select all episodes in ${group.label}` }}
				/>
				<Box sx={{ minWidth: 0, flex: 1 }}>
					<Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
						<Typography sx={{ fontWeight: 700, letterSpacing: '-0.01em' }} noWrap>
							{group.label}
						</Typography>
						{group.sublabel && (
							<Typography variant="body2" color="text.secondary" noWrap title={group.sublabel}>
								{group.sublabel}
							</Typography>
						)}
					</Stack>
					<Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
						{picked} of {total} selected
					</Typography>
				</Box>
				<Chip
					label={`${total} ep`}
					size="small"
					sx={{ height: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums', flexShrink: 0, mr: 1 }}
					color={picked > 0 ? 'primary' : 'default'}
					variant={picked > 0 ? 'filled' : 'outlined'}
				/>
			</AccordionSummary>
			<AccordionDetails sx={{ p: 0.5 }}>
				{visibleIndices.length === 0 ? (
					<Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
						No episodes match the filter.
					</Typography>
				) : (
					visibleIndices.map((i) => <EpisodeRow key={i} episode={episodes[i]} index={i} selected={selected.has(i)} onToggle={onToggleEpisode} />)
				)}
			</AccordionDetails>
		</Accordion>
	);
};

export default SeasonAccordion;
