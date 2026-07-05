import React from 'react';
import { Box, Button, Divider, Link, Paper, Stack, Typography } from '@mui/material';
import { BugReportOutlined, FolderOpenOutlined, GitHub, GroupsOutlined, InsertDriveFileOutlined, TuneOutlined } from '@mui/icons-material';
import { messageChannelContext } from '../../provider/MessageChannel';
import useStore from '../../hooks/useStore';

const Row: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
	<Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', gap: { xs: 0, sm: 2 }, py: 0.75 }}>
		<Typography variant="body2" color="text.secondary">
			{label}
		</Typography>
		<Typography variant="body2" sx={{ fontWeight: 600, textAlign: { xs: 'left', sm: 'right' }, wordBreak: 'break-word' }}>
			{value}
		</Typography>
	</Box>
);

const SectionCard: React.FC<{ title: string; subtitle?: string; children: React.ReactNode }> = ({ title, subtitle, children }) => (
	<Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
		<Typography variant="h6" sx={{ mb: subtitle ? 0.25 : 1.5 }}>
			{title}
		</Typography>
		{subtitle && (
			<Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
				{subtitle}
			</Typography>
		)}
		{children}
	</Paper>
);

const SettingsView: React.FC = () => {
	const msg = React.useContext(messageChannelContext);
	const [{ downloadOptions, version }] = useStore();

	const links: { label: string; icon: React.ReactNode; url: string }[] = [
		{ label: 'GitHub', icon: <GitHub fontSize="small" />, url: 'https://github.com/anidl/multi-downloader-nx' },
		{
			label: 'Report a bug',
			icon: <BugReportOutlined fontSize="small" />,
			url: 'https://github.com/anidl/multi-downloader-nx/issues/new?assignees=AnimeDL,AnidlSupport&labels=bug&template=bug.yml&title=BUG'
		},
		{ label: 'Contributors', icon: <GroupsOutlined fontSize="small" />, url: 'https://github.com/anidl/multi-downloader-nx/graphs/contributors' }
	];

	return (
		<Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 900, mx: 'auto' }}>
			<Stack spacing={3}>
				<SectionCard title="Download defaults" subtitle="Read-only in this version. Edit cli-defaults.yml to change these permanently.">
					<Row label="Quality" value={downloadOptions.q === 0 ? 'Best available' : downloadOptions.q} />
					<Row label="Dub language(s)" value={downloadOptions.dubLang.join(', ') || '—'} />
					<Row label="Subtitle language(s)" value={downloadOptions.dlsubs.join(', ') || '—'} />
					<Row label="Filename template" value={downloadOptions.fileName || '(service default)'} />
					<Row label="Video only" value={downloadOptions.novids ? 'no video' : 'yes'} />
				</SectionCard>

				<SectionCard title="Configuration files">
					<Stack direction="row" flexWrap="wrap" gap={1.5}>
						<Button variant="outlined" startIcon={<FolderOpenOutlined />} onClick={() => msg?.openFolder('config')}>
							Settings folder
						</Button>
						<Button variant="outlined" startIcon={<InsertDriveFileOutlined />} onClick={() => msg?.openFile(['config', 'bin-path.yml'])}>
							bin-path.yml
						</Button>
						<Button variant="outlined" startIcon={<TuneOutlined />} onClick={() => msg?.openFile(['config', 'cli-defaults.yml'])}>
							cli-defaults.yml
						</Button>
						<Button variant="outlined" startIcon={<FolderOpenOutlined />} onClick={() => msg?.openFolder('content')}>
							Output folder
						</Button>
					</Stack>
				</SectionCard>

				<SectionCard title="About">
					<Row label="Version" value={version ? `v${version}` : '—'} />
					<Divider sx={{ my: 1.5 }} />
					<Stack direction="row" flexWrap="wrap" gap={2}>
						{links.map((l) => (
							<Link
								key={l.label}
								component="button"
								type="button"
								underline="hover"
								onClick={() => msg?.openURL(l.url)}
								sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
							>
								{l.icon}
								{l.label}
							</Link>
						))}
					</Stack>
				</SectionCard>
			</Stack>
		</Box>
	);
};

export default SettingsView;
