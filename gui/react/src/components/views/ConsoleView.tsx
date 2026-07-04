import React from 'react';
import { Box, Button, FormControlLabel, Switch, Typography } from '@mui/material';
import { DeleteSweepOutlined } from '@mui/icons-material';
import { LogLine } from '../../../../../@types/randomEvents';

const levelColor = (level: string): string => {
	switch (level.toUpperCase()) {
		case 'ERROR':
		case 'FATAL':
			return 'error.main';
		case 'WARN':
			return 'warning.main';
		case 'DEBUG':
		case 'TRACE':
			return 'text.secondary';
		default:
			return 'text.primary';
	}
};

const two = (n: number) => n.toString().padStart(2, '0');
const formatTime = (time: number) => {
	const d = new Date(time);
	return `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`;
};

const ConsoleView: React.FC<{ logs: LogLine[]; onClear: () => void }> = ({ logs, onClear }) => {
	const [autoScroll, setAutoScroll] = React.useState(true);
	const endRef = React.useRef<HTMLDivElement>(null);

	React.useEffect(() => {
		if (autoScroll) endRef.current?.scrollIntoView({ block: 'end' });
	}, [logs, autoScroll]);

	return (
		<Box sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
			<Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 2 }}>
				<Typography variant="h6" sx={{ flexGrow: 1 }}>
					Console
				</Typography>
				<FormControlLabel
					control={<Switch size="small" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} />}
					label={<Typography variant="body2">Auto-scroll</Typography>}
				/>
				<Button size="small" variant="outlined" color="inherit" startIcon={<DeleteSweepOutlined />} onClick={onClear}>
					Clear
				</Button>
			</Box>

			<Box
				sx={{
					flexGrow: 1,
					minHeight: 0,
					overflow: 'auto',
					bgcolor: 'background.default',
					border: 1,
					borderColor: 'divider',
					borderRadius: 2,
					p: 2,
					fontFamily: '"SFMono-Regular", "Menlo", "Consolas", monospace',
					fontSize: 13,
					lineHeight: 1.6
				}}
			>
				{logs.length === 0 ? (
					<Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'inherit' }}>
						Waiting for log output…
					</Typography>
				) : (
					logs.map((line, i) => (
						<Box key={i} sx={{ display: 'flex', gap: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
							<Box component="span" sx={{ color: 'text.disabled', flexShrink: 0, userSelect: 'none' }}>
								{formatTime(line.time)}
							</Box>
							<Box component="span" sx={{ color: levelColor(line.level), flexShrink: 0, width: 52, userSelect: 'none' }}>
								{line.level.toUpperCase()}
							</Box>
							<Box component="span" sx={{ color: levelColor(line.level) }}>
								{line.message}
							</Box>
						</Box>
					))
				)}
				<div ref={endRef} />
			</Box>
		</Box>
	);
};

export default ConsoleView;
