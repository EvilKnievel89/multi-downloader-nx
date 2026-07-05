import { AuthData, CheckTokenResponse, DownloadData, EpisodeListResponse, MessageHandler, ResolveItemsData, SearchData, SearchResponse } from '../../../@types/messageHandler';
import Crunchy from '../../../crunchy';
import { getDefault } from '../../../modules/module.args';
import { languages, subtitleLanguagesFilter } from '../../../modules/module.langsData';
import WebSocketHandler from '../websocket';
import Base from './base';
import { console } from '../../../modules/log';
import * as yargs from '../../../modules/module.app-args';

class CrunchyHandler extends Base implements MessageHandler {
	private crunchy: Crunchy;
	public name = 'crunchy';
	// Holds the single in-flight forced re-login so concurrent operations share
	// one attempt instead of each hammering the auth endpoint.
	private reloginAttempt: Promise<boolean> | null = null;
	// Resolves once the initial token load/refresh has finished. Auth checks await
	// this so they don't race the constructor's refresh: the on-disk access token
	// is often stale on startup and only becomes valid after this refresh, so a
	// check that runs too early would wrongly report "not logged in".
	private ready: Promise<void>;
	constructor(ws: WebSocketHandler) {
		super(ws);
		this.crunchy = new Crunchy();
		this.crunchy.onStage = (stage) => this.emitStage(stage);
		// Kick off the initial refresh and, once it settles, broadcast the real auth
		// state — this corrects any early checkToken() that lost the race above.
		this.ready = this.crunchy
			.refreshToken()
			.then(async () => this.emitAuthState(await this.crunchy.getProfile(true)))
			.catch(() => this.emitAuthState(false));
		this.initState();
		this.getDefaults();
	}

	public getDefaults() {
		const _default = yargs.appArgv(this.crunchy.cfg.cli, true);
		this.crunchy.locale = _default.locale;
	}

	/**
	 * Broadcast the current Crunchyroll auth state to every connected GUI client
	 * so the floating "not logged in" indicator can react live.
	 */
	private emitAuthState(loggedIn: boolean) {
		this.sendMessage({ name: 'authState', data: { service: this.name, loggedIn } });
	}

	/**
	 * Guarantee we are authenticated before running an operation.
	 *
	 * Crunchyroll can revoke the access token server-side before its local expiry,
	 * so `refreshToken(true)` still considers it valid while the API already
	 * rejects it ("token invalid"). When we detect that, we make exactly ONE
	 * automatic re-login attempt via the stored refresh token. The resulting state
	 * is broadcast so the GUI shows/hides the warning indicator. Returns whether we
	 * ended up authenticated.
	 */
	private async ensureAuth(): Promise<boolean> {
		await this.ready;
		this.getDefaults();
		// Normal path: refresh only when the token is actually time-expired.
		await this.crunchy.refreshToken(true, true);
		if (await this.crunchy.getProfile(true)) {
			this.emitAuthState(true);
			return true;
		}
		// Token rejected even though it was not time-expired → one forced re-login.
		// Share a single attempt across concurrent operations (max one try).
		if (!this.reloginAttempt) {
			this.reloginAttempt = (async () => {
				console.warn('Crunchyroll token is invalid — attempting a single automatic re-login.');
				await this.crunchy.refreshToken(false, true);
				return this.crunchy.getProfile(true);
			})();
		}
		let loggedIn = false;
		try {
			loggedIn = await this.reloginAttempt;
		} finally {
			this.reloginAttempt = null;
		}
		this.emitAuthState(loggedIn);
		if (loggedIn) {
			console.info('Crunchyroll automatic re-login succeeded.');
		} else {
			console.error('Crunchyroll automatic re-login failed — please authenticate again.');
		}
		return loggedIn;
	}

	public async listEpisodes(id: string): Promise<EpisodeListResponse> {
		await this.ensureAuth();
		return { isOk: true, value: (await this.crunchy.listSeriesID(id)).list };
	}

	public async handleDefault(name: string) {
		return getDefault(name, this.crunchy.cfg.cli);
	}

	public async availableDubCodes(): Promise<string[]> {
		const dubLanguageCodesArray: string[] = [];
		for (const language of languages) {
			if (language.cr_locale) dubLanguageCodesArray.push(language.code);
		}
		return [...new Set(dubLanguageCodesArray)];
	}

	public async availableSubCodes(): Promise<string[]> {
		return subtitleLanguagesFilter;
	}

	public async resolveItems(data: ResolveItemsData): Promise<boolean> {
		await this.ensureAuth();
		console.debug(`Got resolve options: ${JSON.stringify(data)}`);
		const res = await this.crunchy.downloadFromSeriesID(data.id, data);
		if (!res.isOk) return res.isOk;
		this.addToQueue(
			res.value.map((a) => {
				return {
					...data,

					ids: a.data.map((a) => a.mediaId),
					title: a.episodeTitle,
					parent: {
						title: a.seasonTitle,
						season: a.season.toString()
					},
					e: a.e,
					image: a.image,
					episode: a.episodeNumber
				};
			})
		);
		return true;
	}

	public async search(data: SearchData): Promise<SearchResponse> {
		await this.ensureAuth();
		if (!data['search-type']) data['search-type'] = 'series';
		console.debug(`Got search options: ${JSON.stringify(data)}`);
		const crunchySearch = await this.crunchy.doSearch(data);
		if (!crunchySearch.isOk) {
			this.crunchy.refreshToken();
			return crunchySearch;
		}
		return { isOk: true, value: crunchySearch.value };
	}

	public async checkToken(): Promise<CheckTokenResponse> {
		await this.ready;
		const loggedIn = await this.crunchy.getProfile(true);
		this.emitAuthState(loggedIn);
		return loggedIn ? { isOk: true, value: undefined } : { isOk: false, reason: new Error('Not authenticated') };
	}

	public async auth(data: AuthData) {
		const res = await this.crunchy.doAuth(data);
		this.emitAuthState(res.isOk);
		return res;
	}

	protected async performDownload(data: DownloadData) {
		await this.ensureAuth();
		console.debug(`Got download options: ${JSON.stringify(data)}`);
		this.setDownloading(true);
		const _default = yargs.appArgv(this.crunchy.cfg.cli, true);
		const res = await this.crunchy.downloadFromSeriesID(data.id, {
			dubLang: data.dubLang,
			e: data.e
		});
		if (res.isOk) {
			for (const select of res.value) {
				if (
					!(await this.crunchy.downloadEpisode(select, {
						..._default,
						skipsubs: false,
						callbackMaker: this.makeProgressHandler.bind(this),
						q: data.q,
						fileName: data.fileName,
						dlsubs: data.dlsubs,
						dlVideoOnce: data.dlVideoOnce,
						force: 'y',
						novids: data.novids,
						noaudio: data.noaudio,
						hslang: data.hslang || 'none'
					}))
				) {
					const er = new Error(`Unable to download episode ${data.e} from ${data.id}`);
					er.name = 'Download error';
					this.alertError(er);
				}
			}
		} else {
			this.alertError(res.reason);
		}
	}
}

export default CrunchyHandler;
