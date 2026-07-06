import React from 'react';
import { HistoryEntry } from '../../../../@types/messageHandler';
import { messageChannelContext } from './MessageChannel';
import { RandomEvent } from '../../../../@types/randomEvents';

export const historyContext = React.createContext<HistoryEntry[]>([]);

/**
 * Mirrors QueueProvider: seeds the download history once from the backend, then
 * keeps it in sync via the `historyChange` broadcast (fired on every completed
 * download and whenever the service is switched — its initState re-broadcasts).
 */
const HistoryProvider: FCWithChildren = ({ children }) => {
	const msg = React.useContext(messageChannelContext);

	const [ready, setReady] = React.useState(false);
	const [history, setHistory] = React.useState<HistoryEntry[]>([]);

	React.useEffect(() => {
		if (msg && !ready) {
			msg.getHistory().then((data) => {
				setHistory(data);
				setReady(true);
			});
		}
		const listener = (ev: RandomEvent<'historyChange'>) => {
			setHistory(ev.data);
		};
		msg?.randomEvents.on('historyChange', listener);
		return () => {
			msg?.randomEvents.removeListener('historyChange', listener);
		};
	}, [msg]);

	return <historyContext.Provider value={history}>{children}</historyContext.Provider>;
};

export default HistoryProvider;
