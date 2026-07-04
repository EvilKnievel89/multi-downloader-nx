import { ExtendedProgress, QueueItem } from './messageHandler';

export type LogLine = {
	level: string;
	message: string;
	time: number;
};

export type RandomEvents = {
	progress: ExtendedProgress;
	finish: undefined;
	queueChange: QueueItem[];
	current: QueueItem | undefined;
	log: LogLine;
};

export interface RandomEvent<T extends keyof RandomEvents> {
	name: T;
	data: RandomEvents[T];
}

export type Handler<T extends keyof RandomEvents> = (data: RandomEvent<T>) => unknown;
