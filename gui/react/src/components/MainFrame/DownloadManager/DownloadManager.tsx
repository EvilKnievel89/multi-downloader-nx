import React from 'react';
import { DownloadStage, ExtendedProgress, QueueItem } from '../../../../../../@types/messageHandler';
import { RandomEvent } from '../../../../../../@types/randomEvents';
import { messageChannelContext } from '../../../provider/MessageChannel';

export type StepStatus = 'active' | 'done' | 'failed';

/**
 * One step of the currently-downloading episode: a video/audio/subtitle stream
 * (with live percent) or a decrypt/mux phase (indeterminate). Built from the
 * `progress` and `downloadStage` events by the reducer below.
 */
export type DownloadStep = {
	key: string;
	kind: DownloadStage['kind'];
	lang?: string;
	label?: string;
	status: StepStatus;
	percent?: number;
};

const toPercent = (p: number | string): number => {
	const n = typeof p === 'string' ? parseInt(p) : p;
	return isNaN(n) ? 0 : n;
};

const stageKey = (s: DownloadStage): string => {
	if (s.kind === 'mux') return 'mux';
	// Include lang so each dub's decrypt is its own row (multi-dub decrypts otherwise collapse).
	if (s.kind === 'decrypt') return `decrypt:${s.label ?? ''}:${s.lang ?? ''}`;
	return `${s.kind}:${s.lang ?? s.label ?? ''}`;
};

const closeActive = (steps: DownloadStep[], status: StepStatus = 'done'): DownloadStep[] =>
	steps.map((s) => (s.status === 'active' ? { ...s, status } : s));

const upsertActive = (steps: DownloadStep[], step: DownloadStep): DownloadStep[] => {
	const idx = steps.findIndex((s) => s.key === step.key);
	if (idx === -1) return [...steps, step];
	const next = steps.slice();
	next[idx] = step;
	return next;
};

/**
 * Subscribes to the live download events for the active episode and exposes the
 * raw progress (`data`), the queue item being processed (`current`) and a
 * derived, ordered list of steps. Downloads run strictly one-at-a-time, so the
 * reducer keeps the invariant "at most one active step": any new stream or
 * stage first closes the previous active step as done.
 */
const useDownloadManager = () => {
	const messageHandler = React.useContext(messageChannelContext);

	const [progressData, setProgressData] = React.useState<ExtendedProgress | undefined>();
	const [current, setCurrent] = React.useState<undefined | QueueItem>();
	const [steps, setSteps] = React.useState<DownloadStep[]>([]);
	// Epoch-ms the queue resumes at while it is resting between batches (rate-limit pause).
	const [restingUntil, setRestingUntil] = React.useState<number | undefined>();

	React.useEffect(() => {
		const progressHandler = (ev: RandomEvent<'progress'>) => {
			setProgressData(ev.data);
			const info = ev.data.downloadInfo;
			const kind = info.type ?? 'video';
			const lang = info.language?.name;
			const key = `${kind}:${lang ?? ''}`;
			const percent = toPercent(ev.data.progress.percent);
			setSteps((prev) => {
				const activeSame = prev.find((s) => s.key === key && s.status === 'active');
				if (activeSame) return prev.map((s) => (s.key === key ? { ...s, percent } : s));
				return upsertActive(closeActive(prev), { key, kind, lang, status: 'active', percent });
			});
		};

		const stageHandler = (ev: RandomEvent<'downloadStage'>) => {
			const stage = ev.data;
			const key = stageKey(stage);
			setSteps((prev) => {
				if (stage.state === 'start') {
					return upsertActive(closeActive(prev), { key, kind: stage.kind, lang: stage.lang, label: stage.label, status: 'active' });
				}
				const status: StepStatus = stage.state === 'fail' ? 'failed' : 'done';
				if (prev.some((s) => s.key === key)) return prev.map((s) => (s.key === key ? { ...s, status } : s));
				// Unseen key: surface a failure as its own row (so it is visible even if it
				// failed before any progress); a stray 'done' just closes the active step.
				if (stage.state === 'fail') {
					return upsertActive(closeActive(prev), { key, kind: stage.kind, lang: stage.lang, label: stage.label, status: 'failed' });
				}
				return closeActive(prev, status);
			});
		};

		const currentHandler = (ev: RandomEvent<'current'>) => {
			setCurrent(ev.data);
			// A new episode (or the drained-queue `undefined`) resets the step list.
			setSteps([]);
			setProgressData(undefined);
		};

		const finishHandler = () => {
			setProgressData(undefined);
		};

		const restingHandler = (ev: RandomEvent<'queueResting'>) => {
			setRestingUntil(ev.data?.until);
		};

		// Seed the resting state on (re)connect: a rest emits no events for its full
		// duration, so a page load mid-pause would otherwise show an idle-looking queue.
		messageHandler?.getResting().then(setRestingUntil);

		messageHandler?.randomEvents.on('progress', progressHandler);
		messageHandler?.randomEvents.on('current', currentHandler);
		messageHandler?.randomEvents.on('finish', finishHandler);
		messageHandler?.randomEvents.on('downloadStage', stageHandler);
		messageHandler?.randomEvents.on('queueResting', restingHandler);

		return () => {
			messageHandler?.randomEvents.removeListener('progress', progressHandler);
			messageHandler?.randomEvents.removeListener('finish', finishHandler);
			messageHandler?.randomEvents.removeListener('current', currentHandler);
			messageHandler?.randomEvents.removeListener('downloadStage', stageHandler);
			messageHandler?.randomEvents.removeListener('queueResting', restingHandler);
		};
	}, [messageHandler]);

	return { data: progressData, current, steps, restingUntil };
};

export default useDownloadManager;
