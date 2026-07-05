import { Box, Button, Divider, List, SxProps } from '@mui/material';
import React from 'react';

export type Option = {
	text: string;
	onClick: () => unknown;
};

export type ContextMenuProps<T extends HTMLElement> = {
	options: ('divider' | Option)[];
	popupItem: React.RefObject<T>;
};

const buttonSx: SxProps = {
	'&:hover': {
		background: 'rgb(0, 30, 60)'
	},
	fontSize: { xs: '0.85rem', sm: '0.7rem' },
	minHeight: { xs: 44, sm: '30px' },
	justifyContent: 'center',
	px: 2,
	py: 0
};

// Rough menu footprint used to keep the popup fully inside the viewport.
const MENU_W = 240;
const MENU_H = 260;

function ContextMenu<T extends HTMLElement>(props: ContextMenuProps<T>) {
	const [anchor, setAnchor] = React.useState({ x: 0, y: 0 });

	const [show, setShow] = React.useState(false);

	React.useEffect(() => {
		const { popupItem: ref } = props;
		if (ref.current === null) return;
		const listener = (ev: MouseEvent) => {
			ev.preventDefault();
			// Clamp to the viewport so the menu never opens off-screen on phones/tablets.
			const x = Math.max(8, Math.min(ev.x + 10, window.innerWidth - MENU_W));
			const y = Math.max(8, Math.min(ev.y + 10, window.innerHeight - MENU_H));
			setAnchor({ x, y });
			setShow(true);
		};
		ref.current.addEventListener('contextmenu', listener);

		return () => {
			if (ref.current) ref.current.removeEventListener('contextmenu', listener);
		};
	}, [props.popupItem]);

	return show ? (
		<Box
			sx={{
				zIndex: 1400,
				p: 1,
				background: 'rgba(0, 0, 0, 0.75)',
				backdropFilter: 'blur(5px)',
				borderRadius: 1,
				position: 'fixed',
				left: anchor.x,
				top: anchor.y,
				minWidth: 160,
				maxWidth: 'calc(100vw - 16px)',
				maxHeight: 'calc(100vh - 16px)',
				overflowY: 'auto'
			}}
		>
			<List sx={{ p: 0, m: 0, display: 'flex', flexDirection: 'column' }}>
				{props.options.map((item, i) => {
					return item === 'divider' ? (
						<Divider key={`ContextMenu_Divider_${i}_${item}`} />
					) : (
						<Button
							color="inherit"
							key={`ContextMenu_Value_${i}_${item}`}
							onClick={() => {
								item.onClick();
								setShow(false);
							}}
							sx={buttonSx}
						>
							{item.text}
						</Button>
					);
				})}
				<Divider />
				<Button fullWidth color="inherit" onClick={() => setShow(false)} sx={buttonSx}>
					Close
				</Button>
			</List>
		</Box>
	) : (
		<></>
	);
}

export default ContextMenu;
