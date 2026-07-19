import { DownloadInfo, DownloadResult, DownloadStage, FolderTypes, GuiState, HistoryEntry, ProgressData, QueueItem } from '../../../@types/messageHandler';
import { RandomEvent, RandomEvents } from '../../../@types/randomEvents';
import WebSocketHandler from '../websocket';
import open from 'open';
import { randomUUID } from 'crypto';
import { cfg } from '..';
import path from 'path';
import { console } from '../../../modules/log';
import { getState, setState } from '../../../modules/module.cfg-loader';
import packageJson from '../../../package.json';

export default class Base {
	private state: GuiState;
	public name = 'default';
	constructor(private ws: WebSocketHandler) {
		this.state = getState();
	}

	private downloading = false;

	private queue: QueueItem[] = [];
	private workOnQueue = false;

	/**
	 * Rate-limit pacing: services start throttling/blocking when many downloads are
	 * fired back-to-back. After REST_AFTER_DOWNLOADS finished downloads the queue
	 * pauses for REST_DURATION_MS before starting the next one. `consecutiveDownloads`
	 * counts finished downloads within one continuous run (reset when the queue stops
	 * or drains); `resting` guards the queue while paused. `restingUntil` (epoch-ms) and
	 * the timer/resolver handles let a stop/clear abort an in-flight pause immediately
	 * and let a freshly (re)connected GUI seed the countdown.
	 */
	private consecutiveDownloads = 0;
	private resting = false;
	private restingUntil: number | undefined;
	private restTimer: ReturnType<typeof setTimeout> | undefined;
	private restResolve: (() => void) | undefined;
	private static readonly REST_AFTER_DOWNLOADS = 6;
	private static readonly REST_DURATION_MS = 2 * 60 * 1000;

	/** Newest-first, capped log of finished download attempts (persisted per service). */
	private history: HistoryEntry[] = [];
	private static readonly HISTORY_LIMIT = 200;

	version(): Promise<string> {
		return new Promise(() => {
			return packageJson.version;
		});
	}

	initState() {
		if (!this.state.services[this.name]) {
			this.state.services[this.name] = {
				queue: [],
				history: []
			};
		} else {
			this.queue = this.state.services[this.name].queue;
			// `history` is absent in state files written before this feature — default it.
			this.history = this.state.services[this.name].history ?? [];
		}
		// Always (re-)broadcast so a service switch authoritatively resets the GUI to
		// THIS service's queue/history — even for a never-used service, whose data is
		// empty (otherwise the frontend keeps showing the previous service's entries,
		// since it seeds once and thereafter only follows these broadcasts).
		this.queueChange();
		this.historyChange();
	}

	setDownloading(downloading: boolean) {
		this.downloading = downloading;
	}

	getDownloading() {
		return this.downloading;
	}

	alertError(error: Error) {
		console.error(`${error}`);
	}

	makeProgressHandler(videoInfo: DownloadInfo) {
		return (data: ProgressData) => {
			this.sendMessage({
				name: 'progress',
				data: {
					downloadInfo: videoInfo,
					progress: data
				}
			});
		};
	}

	/**
	 * Relay a discrete download-stage transition (subtitle fetch, decrypt, mux)
	 * from a service core to the GUI. Bound and handed to the core's `onStage`
	 * hook by each service handler.
	 */
	emitStage(stage: DownloadStage) {
		this.sendMessage({ name: 'downloadStage', data: stage });
	}

	sendMessage<T extends keyof RandomEvents>(data: RandomEvent<T>) {
		this.ws.sendMessage(data);
	}

	async isDownloading() {
		// Treat a rate-limit rest as "busy": while the queue is paused between batches
		// the service is still mid-run (just waiting), so external gates — switching
		// service, the stop-queue prompt — must not let the user swap the service out
		// from under a queue that will resume. Otherwise the old handler's pending rest
		// timer would fire and start a "ghost" download on the abandoned service. The
		// internal queue loop uses getDownloading() (the raw flag), so the rest→resume
		// handoff is unaffected by this.
		return this.downloading || this.resting;
	}

	async openFolder(folderType: FolderTypes) {
		switch (folderType) {
			case 'content':
				open(cfg.dir.content);
				break;
			case 'config':
				open(cfg.dir.config);
				break;
		}
	}

	async openFile(data: [FolderTypes, string]) {
		switch (data[0]) {
			case 'config':
				open(path.join(cfg.dir.config, data[1]));
				break;
			case 'content':
				throw new Error('No subfolders');
		}
	}

	async openURL(data: string) {
		open(data);
	}

	public async getQueue(): Promise<QueueItem[]> {
		return this.queue;
	}

	public async removeFromQueue(index: number) {
		this.queue.splice(index, 1);
		this.endRunIfEmptiedDuringRest();
		this.queueChange();
	}

	public async clearQueue() {
		this.queue = [];
		this.endRunIfEmptiedDuringRest();
		this.queueChange();
	}

	/**
	 * If the queue was emptied by hand (clear, or removing the last item) *while resting*,
	 * end the run explicitly: a normal drain is handled by onFinish, but during a rest no
	 * download completes to trigger it, so the pacing count and armed flag would otherwise
	 * leak — leaving the next added item to auto-start with a spurious 2-minute pause. Also
	 * aborts the pause so its countdown clears.
	 */
	private endRunIfEmptiedDuringRest() {
		if (this.queue.length > 0 || !this.resting) return;
		this.consecutiveDownloads = 0;
		this.workOnQueue = false;
		this.cancelRest();
	}

	public addToQueue(data: QueueItem[]) {
		this.queue = this.queue.concat(...data);
		this.queueChange();
	}

	public setDownloadQueue(data: boolean) {
		this.workOnQueue = data;
		// Stopping ends the current run: a later start begins a fresh batch, so the
		// "consecutive downloads" count for rate-limit pacing resets to zero, and any
		// in-flight pause is abandoned at once (so the GUI countdown clears and the
		// service stops reporting busy) instead of lingering until its timer fires.
		if (!data) {
			this.consecutiveDownloads = 0;
			this.cancelRest();
		}
		this.queueChange();
	}

	public async getDownloadQueue(): Promise<boolean> {
		return this.workOnQueue;
	}

	public async getHistory(): Promise<HistoryEntry[]> {
		return this.history;
	}

	public async removeFromHistory(id: string) {
		// Address by stable id, not array position: recordHistory prepends on every
		// completed download, so a positional index can shift out from under a click.
		this.history = this.history.filter((entry) => entry.id !== id);
		this.historyChange();
	}

	public async clearHistory() {
		this.history = [];
		this.historyChange();
	}

	/** Re-add a finished item to the queue (retry). Does not auto-start. */
	public requeue(item: QueueItem) {
		this.addToQueue([item]);
	}

	/** Prepend a finished attempt, cap the log and broadcast + persist it. */
	private recordHistory(item: QueueItem, success: boolean, error?: string) {
		this.history = [{ id: randomUUID(), item, success, error, time: Date.now() }, ...this.history].slice(0, Base.HISTORY_LIMIT);
		this.historyChange();
	}

	private historyChange() {
		this.sendMessage({ name: 'historyChange', data: this.history });
		if (this.state.services[this.name]) {
			this.state.services[this.name].history = this.history;
			setState(this.state);
		}
	}

	private async queueChange() {
		this.sendMessage({ name: 'queueChange', data: this.queue });
		// Re-entrancy guards are read synchronously (no await between the check and the
		// state mutation that starts a download or begins a rest), so overlapping
		// queueChange calls — e.g. the user editing the queue mid-run — can neither
		// double-start a download nor double-trigger a rest. `downloading` is the same
		// flag isDownloading() returns, read directly to keep this window await-free.
		if (this.workOnQueue && this.queue.length > 0 && !this.resting && !this.getDownloading()) {
			// After every REST_AFTER_DOWNLOADS finished downloads, pause before the next
			// one so the service doesn't throttle or block us. queue.length is > 0 here,
			// so we never rest with nothing left to download.
			if (this.consecutiveDownloads > 0 && this.consecutiveDownloads % Base.REST_AFTER_DOWNLOADS === 0) {
				await this.restBeforeNextDownload();
			}
			// Re-validate after the (possible) pause: the user may have stopped or
			// emptied the queue while we waited.
			if (this.workOnQueue && this.queue.length > 0 && !this.getDownloading()) {
				this.setDownloading(true);
				this.sendMessage({ name: 'current', data: this.queue[0] });
				this.downloadItem(this.queue[0]);
				this.queue = this.queue.slice(1);
				this.queueChange();
			}
		}
		this.state.services[this.name].queue = this.queue;
		setState(this.state);
	}

	/**
	 * Block the queue for REST_DURATION_MS before the next download and tell the GUI,
	 * so a long batch doesn't hammer a service into a rate limit. Broadcasts a
	 * `queueResting` event carrying the resume time on the way in and `undefined` on
	 * the way out; the GUI shows a countdown between the two. The timer handle and
	 * resolver are stored so cancelRest() can abort the pause early (stop/clear). The
	 * teardown lives in `finally` so `resting` can never leak true and brick the queue
	 * (mirrors the guarantee in downloadItem).
	 */
	private async restBeforeNextDownload() {
		this.resting = true;
		this.restingUntil = Date.now() + Base.REST_DURATION_MS;
		console.info(
			`[queue] Reached ${Base.REST_AFTER_DOWNLOADS} downloads in a row — pausing ${Base.REST_DURATION_MS / 1000}s before the next one to avoid service rate limits.`
		);
		this.sendMessage({ name: 'queueResting', data: { until: this.restingUntil } });
		try {
			await new Promise<void>((resolve) => {
				this.restResolve = resolve;
				this.restTimer = setTimeout(resolve, Base.REST_DURATION_MS);
			});
		} finally {
			if (this.restTimer) clearTimeout(this.restTimer);
			this.restTimer = undefined;
			this.restResolve = undefined;
			this.restingUntil = undefined;
			this.resting = false;
			this.sendMessage({ name: 'queueResting', data: undefined });
		}
	}

	/**
	 * Abort an in-flight rate-limit pause because the run ended (user stopped or cleared
	 * the queue). Wakes the awaiting restBeforeNextDownload so its `finally` tears the
	 * rest down at once — clearing `resting`, the countdown broadcast and the timer —
	 * instead of leaving a stale timer running (and a lying countdown) for up to 2 min.
	 * The resumed queueChange then re-validates and, with the run stopped, starts nothing.
	 */
	private cancelRest() {
		if (!this.resting) return;
		if (this.restTimer) clearTimeout(this.restTimer);
		this.restTimer = undefined;
		this.restResolve?.();
	}

	/** Current rate-limit pause resume time (epoch-ms), or undefined if not resting.
	 *  Lets a freshly (re)connected GUI seed its countdown, since the pause emits no
	 *  events for its full duration. */
	public async getResting(): Promise<number | undefined> {
		return this.restingUntil;
	}

	public async onFinish() {
		this.sendMessage({ name: 'current', data: undefined });
		// Nothing left to process once the queue is drained, so stop working on it
		// instead of leaving it "armed" — otherwise a newly added item would start
		// downloading without the user pressing start again. Set before queueChange()
		// so the broadcast carries the final state (the button re-syncs from it).
		if (this.queue.length === 0) {
			this.workOnQueue = false;
			// Queue drained: the next start is a fresh run, so reset the rate-limit count.
			this.consecutiveDownloads = 0;
		}
		this.queueChange();
	}

	/**
	 * Template method. Runs the service-specific download and then GUARANTEES the
	 * completion trio (finish event → clear downloading flag → onFinish) runs, even
	 * if performDownload returns early or throws. Without this a failed/aborted
	 * download would leave the queue stuck: `downloading` and `workOnQueue` would
	 * never reset, no further item would start, and the queue could not auto-stop.
	 */
	public async downloadItem(data: QueueItem) {
		let success = false;
		let errorMessage: string | undefined;
		try {
			// Services report their own outcome (they handle most failures without
			// throwing) and, on failure, a reason to surface in the history.
			const result = await this.performDownload(data);
			success = result.success;
			errorMessage = result.error;
		} catch (error) {
			this.alertError(error as Error);
			errorMessage = (error as Error).message;
		} finally {
			// Count finished downloads (success or failure) so the queue can pace itself
			// and insert a rate-limit pause after every REST_AFTER_DOWNLOADS in a row.
			// Only count downloads that belong to an active run: if the user stopped the
			// queue mid-download, this completion is not "am Stück" and must not carry a
			// stray +1 into the next run (which would trip the pause one download early).
			if (this.workOnQueue) this.consecutiveDownloads++;
			this.recordHistory(data, success, errorMessage);
			this.sendMessage({ name: 'finish', data: undefined });
			this.setDownloading(false);
			this.onFinish();
		}
	}

	//Overriten
	// eslint-disable-next-line
	protected async performDownload(_: QueueItem): Promise<DownloadResult> {
		throw new Error('performDownload not overriden');
	}
}
