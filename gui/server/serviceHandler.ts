import { ServerResponse } from 'http';
import { Server } from 'http';
import { IncomingMessage } from 'http';
import { MessageHandler, GuiState } from '../../@types/messageHandler';
import { setState, getState, writeYamlCfgFile } from '../../modules/module.cfg-loader';
import CrunchyHandler from './services/crunchyroll';
import HidiveHandler from './services/hidive';
import ADNHandler from './services/adn';
import WebSocketHandler from './websocket';
import packageJson from '../../package.json';
import { registerLogSink } from '../../modules/log';
import { cfg } from '.';
import open from 'open';
import path from 'path';

export default class ServiceHandler {
	private service: MessageHandler | undefined = undefined;
	private ws: WebSocketHandler;
	private state: GuiState;

	constructor(server: Server<typeof IncomingMessage, typeof ServerResponse>) {
		this.ws = new WebSocketHandler(server);
		// Stream log lines to any connected GUI client (Console view).
		registerLogSink((line) => this.ws.sendMessage({ name: 'log', data: line }));
		this.handleMessages();
		this.state = getState();
	}

	private handleMessages() {
		this.ws.events.on('setupServer', ({ data }, respond) => {
			writeYamlCfgFile('gui', data);
			this.state.setup = true;
			setState(this.state);
			respond(true);
			process.exit(0);
		});

		this.ws.events.on('setup', ({ data }) => {
			if (data === 'crunchy') {
				this.service = new CrunchyHandler(this.ws);
			} else if (data === 'hidive') {
				this.service = new HidiveHandler(this.ws);
			} else if (data === 'adn') {
				this.service = new ADNHandler(this.ws);
			}
		});

		this.ws.events.on('changeProvider', async (_, respond) => {
			if (await this.service?.isDownloading()) return respond(false);
			this.service = undefined;
			respond(true);
		});

		this.ws.events.on('auth', async ({ data }, respond) => {
			if (this.service === undefined) return respond({ isOk: false, reason: new Error('No service selected') });
			respond(await this.service.auth(data));
		});
		this.ws.events.on('version', async (_, respond) => {
			respond(packageJson.version);
		});
		this.ws.events.on('type', async (_, respond) => respond(this.service === undefined ? undefined : (this.service.name as 'hidive' | 'crunchy' | 'adn')));
		this.ws.events.on('checkToken', async (_, respond) => {
			if (this.service === undefined) return respond({ isOk: false, reason: new Error('No service selected') });
			respond(await this.service.checkToken());
		});
		this.ws.events.on('search', async ({ data }, respond) => {
			if (this.service === undefined) return respond({ isOk: false, reason: new Error('No service selected') });
			respond(await this.service.search(data));
		});
		this.ws.events.on('default', async ({ data }, respond) => {
			if (this.service === undefined) return respond({ isOk: false, reason: new Error('No service selected') });
			respond(await this.service.handleDefault(data));
		});
		this.ws.events.on('availableDubCodes', async (_, respond) => {
			if (this.service === undefined) return respond([]);
			respond(await this.service.availableDubCodes());
		});
		this.ws.events.on('availableSubCodes', async (_, respond) => {
			if (this.service === undefined) return respond([]);
			respond(await this.service.availableSubCodes());
		});
		this.ws.events.on('resolveItems', async ({ data }, respond) => {
			if (this.service === undefined) return respond(false);
			respond(await this.service.resolveItems(data));
		});
		this.ws.events.on('listEpisodes', async ({ data }, respond) => {
			if (this.service === undefined) return respond({ isOk: false, reason: new Error('No service selected') });
			respond(await this.service.listEpisodes(data));
		});
		this.ws.events.on('downloadItem', async ({ data }, respond) => {
			this.service?.downloadItem(data);
			respond(undefined);
		});
		// Generic filesystem/URL helpers — intentionally independent of the active
		// service so the Settings view works before a service is selected.
		this.ws.events.on('openFolder', async ({ data }, respond) => {
			if (data === 'content') open(cfg.dir.content);
			else if (data === 'config') open(cfg.dir.config);
			respond(undefined);
		});
		this.ws.events.on('openFile', async ({ data }, respond) => {
			if (data[0] === 'config') open(path.join(cfg.dir.config, data[1]));
			respond(undefined);
		});
		this.ws.events.on('openURL', async ({ data }, respond) => {
			open(data);
			respond(undefined);
		});
		this.ws.events.on('getQueue', async (_, respond) => {
			respond((await this.service?.getQueue()) ?? []);
		});
		this.ws.events.on('removeFromQueue', async ({ data }, respond) => {
			this.service?.removeFromQueue(data);
			respond(undefined);
		});
		this.ws.events.on('clearQueue', async (_, respond) => {
			this.service?.clearQueue();
			respond(undefined);
		});
		this.ws.events.on('setDownloadQueue', async ({ data }, respond) => {
			this.service?.setDownloadQueue(data);
			respond(undefined);
		});
		this.ws.events.on('getDownloadQueue', async (_, respond) => {
			respond((await this.service?.getDownloadQueue()) ?? false);
		});
		this.ws.events.on('getResting', async (_, respond) => {
			respond((await this.service?.getResting()) ?? undefined);
		});
		this.ws.events.on('isDownloading', async (_, respond) => respond((await this.service?.isDownloading()) ?? false));
		this.ws.events.on('getHistory', async (_, respond) => {
			respond((await this.service?.getHistory()) ?? []);
		});
		this.ws.events.on('requeue', async ({ data }, respond) => {
			this.service?.requeue(data);
			respond(undefined);
		});
		this.ws.events.on('removeFromHistory', async ({ data }, respond) => {
			this.service?.removeFromHistory(data);
			respond(undefined);
		});
		this.ws.events.on('clearHistory', async (_, respond) => {
			this.service?.clearHistory();
			respond(undefined);
		});
	}
}
