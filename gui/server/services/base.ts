import { DownloadInfo, DownloadStage, FolderTypes, GuiState, ProgressData, QueueItem } from '../../../@types/messageHandler';
import { RandomEvent, RandomEvents } from '../../../@types/randomEvents';
import WebSocketHandler from '../websocket';
import open from 'open';
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

	version(): Promise<string> {
		return new Promise(() => {
			return packageJson.version;
		});
	}

	initState() {
		if (this.state.services[this.name]) {
			this.queue = this.state.services[this.name].queue;
			this.queueChange();
		} else {
			this.state.services[this.name] = {
				queue: []
			};
		}
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
		return this.downloading;
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
		this.queueChange();
	}

	public async clearQueue() {
		this.queue = [];
		this.queueChange();
	}

	public addToQueue(data: QueueItem[]) {
		this.queue = this.queue.concat(...data);
		this.queueChange();
	}

	public setDownloadQueue(data: boolean) {
		this.workOnQueue = data;
		this.queueChange();
	}

	public async getDownloadQueue(): Promise<boolean> {
		return this.workOnQueue;
	}

	private async queueChange() {
		this.sendMessage({ name: 'queueChange', data: this.queue });
		if (this.workOnQueue && this.queue.length > 0 && !(await this.isDownloading())) {
			this.setDownloading(true);
			this.sendMessage({ name: 'current', data: this.queue[0] });
			this.downloadItem(this.queue[0]);
			this.queue = this.queue.slice(1);
			this.queueChange();
		}
		this.state.services[this.name].queue = this.queue;
		setState(this.state);
	}

	public async onFinish() {
		this.sendMessage({ name: 'current', data: undefined });
		// Nothing left to process once the queue is drained, so stop working on it
		// instead of leaving it "armed" — otherwise a newly added item would start
		// downloading without the user pressing start again. Set before queueChange()
		// so the broadcast carries the final state (the button re-syncs from it).
		if (this.queue.length === 0) {
			this.workOnQueue = false;
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
		try {
			await this.performDownload(data);
		} catch (error) {
			this.alertError(error as Error);
		} finally {
			this.sendMessage({ name: 'finish', data: undefined });
			this.setDownloading(false);
			this.onFinish();
		}
	}

	//Overriten
	// eslint-disable-next-line
	protected async performDownload(_: QueueItem) {
		throw new Error('performDownload not overriden');
	}
}
