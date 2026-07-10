import React from 'react';
import {
	Box,
	Button,
	Chip,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	IconButton,
	InputAdornment,
	Stack,
	TextField,
	Typography,
	useMediaQuery,
	useTheme
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import ClearAllIcon from '@mui/icons-material/ClearAll';
import useStore from '../../../../hooks/useStore';
import SeasonAccordion from './SeasonAccordion';
import { episodeSearchText, groupBySeason, seedSelection, serializeSelection } from './selection';

/**
 * Season-grouped episode picker. Replaces the old flat-list + season-dropdown
 * dialog. Selection state is keyed by episode index (collision-proof), seeded
 * from and committed back to `downloadOptions.e`. Confirm writes the selector
 * string and clears the `all`/`but` flags (which would otherwise override or
 * invert an explicit pick); Cancel — including backdrop click and Escape —
 * discards every change.
 *
 * Bulk actions (Select all, season tri-state) always operate on the *visible*
 * set: with an active filter they never touch hidden episodes.
 */
const EpisodeSelectionDialog: React.FC = () => {
	const [store, dispatch] = useStore();
	const theme = useTheme();
	const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

	const episodes = store.episodeListing;
	const open = episodes.length > 0;
	const service = store.service;

	const [selected, setSelected] = React.useState<Set<number>>(new Set());
	const [passThrough, setPassThrough] = React.useState<string[]>([]);
	const [filter, setFilter] = React.useState('');
	const [expandedKeys, setExpandedKeys] = React.useState<Set<string>>(new Set());

	const groups = React.useMemo(() => groupBySeason(episodes), [episodes]);

	// Seed checkboxes + panel state whenever a fresh listing arrives. Reads the
	// current download options at that moment; intentionally not dependencies so
	// an in-progress selection is never wiped mid-edit.
	const opts = store.downloadOptions;
	React.useEffect(() => {
		if (episodes.length === 0) return;
		const { selected: matched, passThrough: pass } = seedSelection(episodes, opts.e, service);
		let seededSelected: Set<number>;
		let seededPass: string[];
		if (opts.all) {
			// Whole-series intent → start with everything checked; `e` is ignored server-side.
			seededSelected = new Set(episodes.map((_, i) => i));
			seededPass = [];
		} else if (opts.but) {
			// `e` is an exclusion list → check the inverse so "checked = will download" holds.
			seededSelected = new Set(episodes.map((_, i) => i).filter((i) => !matched.has(i)));
			seededPass = [];
		} else {
			seededSelected = matched;
			seededPass = pass;
		}
		setSelected(seededSelected);
		setPassThrough(seededPass);
		setFilter('');
		const toExpand = new Set<string>();
		if (groups[0]) toExpand.add(groups[0].key);
		groups.forEach((g) => {
			if (g.indices.some((i) => seededSelected.has(i))) toExpand.add(g.key);
		});
		setExpandedKeys(toExpand);
	}, [episodes]);

	const filterText = filter.trim().toLowerCase();
	const visibleByKey = React.useMemo(() => {
		const map = new Map<string, number[]>();
		groups.forEach((g) => {
			map.set(g.key, filterText ? g.indices.filter((i) => episodeSearchText(episodes[i]).includes(filterText)) : g.indices);
		});
		return map;
	}, [groups, episodes, filterText]);

	const visibleGroups = filterText ? groups.filter((g) => (visibleByKey.get(g.key) ?? []).length > 0) : groups;
	const visibleIndices = React.useMemo(() => visibleGroups.flatMap((g) => visibleByKey.get(g.key) ?? []), [visibleGroups, visibleByKey]);
	const allVisibleSelected = visibleIndices.length > 0 && visibleIndices.every((i) => selected.has(i));

	const selectionString = React.useMemo(() => serializeSelection(episodes, selected, passThrough, service), [episodes, selected, passThrough, service]);
	const nothingToCommit = selected.size === 0 && passThrough.length === 0;

	const toggleEpisode = React.useCallback((index: number) => {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(index)) next.delete(index);
			else next.add(index);
			return next;
		});
	}, []);

	const toggleSeason = React.useCallback((indices: number[]) => {
		setSelected((prev) => {
			const next = new Set(prev);
			const allOn = indices.length > 0 && indices.every((i) => next.has(i));
			indices.forEach((i) => (allOn ? next.delete(i) : next.add(i)));
			return next;
		});
	}, []);

	const onExpandedChange = React.useCallback((key: string, isExpanded: boolean) => {
		setExpandedKeys((prev) => {
			const next = new Set(prev);
			if (isExpanded) next.add(key);
			else next.delete(key);
			return next;
		});
	}, []);

	const toggleSelectAllVisible = () => {
		setSelected((prev) => {
			const next = new Set(prev);
			if (allVisibleSelected) visibleIndices.forEach((i) => next.delete(i));
			else visibleIndices.forEach((i) => next.add(i));
			return next;
		});
	};
	const expandAll = () => setExpandedKeys(new Set(visibleGroups.map((g) => g.key)));
	const collapseAll = () => setExpandedKeys(new Set());

	const onCancel = () => dispatch({ type: 'episodeListing', payload: [] });
	const onConfirm = () => {
		dispatch({
			type: 'downloadOptions',
			payload: { ...store.downloadOptions, e: selectionString, all: false, but: false }
		});
		dispatch({ type: 'episodeListing', payload: [] });
	};

	return (
		<Dialog
			open={open}
			onClose={onCancel}
			scroll="paper"
			fullScreen={fullScreen}
			fullWidth
			maxWidth="md"
			slotProps={{
				paper: {
					sx: {
						display: 'flex',
						flexDirection: 'column',
						maxHeight: fullScreen ? '100%' : '85vh'
					}
				}
			}}
		>
			<DialogTitle sx={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1.5, pb: 1.5 }}>
				<Box sx={{ minWidth: 0, flex: 1 }}>
					<Typography variant="overline" sx={{ color: 'primary.main', fontWeight: 700, letterSpacing: '0.14em', lineHeight: 1 }}>
						Select episodes
					</Typography>
					<Typography variant="h6" noWrap sx={{ mt: 0.25 }}>
						{episodes[0]?.seasonTitle || 'Episodes'}
					</Typography>
				</Box>
				<Chip
					label={`${selected.size} selected`}
					color={selected.size > 0 ? 'primary' : 'default'}
					variant={selected.size > 0 ? 'filled' : 'outlined'}
					sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}
				/>
			</DialogTitle>

			<Box sx={{ flexShrink: 0, px: 3, pb: 1.5, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
				<TextField
					value={filter}
					onChange={(e) => setFilter(e.target.value)}
					placeholder="Filter episodes by title or number…"
					size="small"
					sx={{ flex: 1, minWidth: 180 }}
					slotProps={{
						input: {
							startAdornment: (
								<InputAdornment position="start">
									<SearchIcon fontSize="small" color="disabled" />
								</InputAdornment>
							)
						}
					}}
				/>
				<Button size="small" startIcon={allVisibleSelected ? <ClearAllIcon /> : <DoneAllIcon />} onClick={toggleSelectAllVisible} disabled={visibleIndices.length === 0}>
					{allVisibleSelected ? 'Clear all' : 'Select all'}
				</Button>
				<IconButton size="small" onClick={expandAll} title="Expand all seasons" aria-label="Expand all seasons">
					<UnfoldMoreIcon fontSize="small" />
				</IconButton>
				<IconButton size="small" onClick={collapseAll} title="Collapse all seasons" aria-label="Collapse all seasons">
					<UnfoldLessIcon fontSize="small" />
				</IconButton>
			</Box>

			{/* Block-level scroll container (MUI's proven pattern). Making DialogContent
			    itself a flex column breaks overflow scrolling on some browsers, so the
			    column layout lives in an inner Box instead. */}
			<DialogContent dividers sx={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', p: 0, bgcolor: 'background.default' }}>
				<Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, p: 2 }}>
					{visibleGroups.length === 0 ? (
						<Typography variant="body2" color="text.secondary" sx={{ p: 3, textAlign: 'center' }}>
							No episodes match “{filter}”.
						</Typography>
					) : (
						visibleGroups.map((group) => (
							<SeasonAccordion
								key={group.key}
								group={group}
								episodes={episodes}
								selected={selected}
								visibleIndices={visibleByKey.get(group.key) ?? []}
								expanded={expandedKeys.has(group.key)}
								onExpandedChange={onExpandedChange}
								onToggleEpisode={toggleEpisode}
								onToggleSeason={toggleSeason}
							/>
						))
					)}
				</Box>
			</DialogContent>

			<DialogActions sx={{ flexShrink: 0, px: 3, py: 2, gap: 1.5, flexWrap: 'wrap' }}>
				<Box sx={{ flex: 1, minWidth: 200 }}>
					<Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
						Selection
					</Typography>
					<Box
						component="code"
						sx={{
							display: 'block',
							mt: 0.5,
							px: 1.25,
							py: 0.75,
							borderRadius: 1,
							border: 1,
							borderColor: 'divider',
							bgcolor: 'background.paper',
							fontFamily: 'monospace',
							fontSize: '0.8rem',
							whiteSpace: 'nowrap',
							overflowX: 'auto',
							color: selectionString ? 'text.primary' : 'text.disabled'
						}}
					>
						{selectionString ? `-e ${selectionString}` : 'Nothing selected'}
					</Box>
				</Box>
				<Stack direction="row" spacing={1.25} sx={{ flexShrink: 0, alignSelf: 'flex-end' }}>
					<Button onClick={onCancel} color="inherit" variant="outlined">
						Cancel
					</Button>
					<Button onClick={onConfirm} variant="contained" disabled={nothingToCommit} title={nothingToCommit ? 'Select at least one episode' : undefined}>
						Confirm selection
					</Button>
				</Stack>
			</DialogActions>
		</Dialog>
	);
};

export default EpisodeSelectionDialog;
