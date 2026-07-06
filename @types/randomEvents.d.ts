import { DownloadStage, ExtendedProgress, HistoryEntry, QueueItem } from './messageHandler';

export type LogLine = {
	level: string;
	message: string;
	time: number;
};

/** Live authentication state of the active service, pushed to the GUI. */
export type AuthState = {
	service: string;
	loggedIn: boolean;
};

export type RandomEvents = {
	progress: ExtendedProgress;
	finish: undefined;
	queueChange: QueueItem[];
	current: QueueItem | undefined;
	log: LogLine;
	downloadStage: DownloadStage;
	authState: AuthState;
	/** Full download history for the active service, broadcast whenever it changes. */
	historyChange: HistoryEntry[];
};

export interface RandomEvent<T extends keyof RandomEvents> {
	name: T;
	data: RandomEvents[T];
}

export type Handler<T extends keyof RandomEvents> = (data: RandomEvent<T>) => unknown;
