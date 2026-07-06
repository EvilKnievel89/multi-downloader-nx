import { HLSCallback } from 'hls-download';
import type { FunimationSearch } from './funiSearch';
import type { AvailableMuxer } from '../modules/module.args';
import { LanguageItem } from '../modules/module.langsData';

export interface MessageHandler {
	name: string;
	auth: (data: AuthData) => Promise<AuthResponse>;
	version: () => Promise<string>;
	checkToken: () => Promise<CheckTokenResponse>;
	search: (data: SearchData) => Promise<SearchResponse>;
	availableDubCodes: () => Promise<string[]>;
	availableSubCodes: () => Promise<string[]>;
	handleDefault: (name: string) => Promise<any>;
	resolveItems: (data: ResolveItemsData) => Promise<boolean>;
	listEpisodes: (id: string) => Promise<EpisodeListResponse>;
	downloadItem: (data: QueueItem) => void;
	isDownloading: () => Promise<boolean>;
	openFolder: (path: FolderTypes) => void;
	openFile: (data: [FolderTypes, string]) => void;
	openURL: (data: string) => void;
	getQueue: () => Promise<QueueItem[]>;
	removeFromQueue: (index: number) => void;
	clearQueue: () => void;
	setDownloadQueue: (data: boolean) => void;
	getDownloadQueue: () => Promise<boolean>;
	getHistory: () => Promise<HistoryEntry[]>;
	requeue: (item: QueueItem) => void;
	removeFromHistory: (id: string) => void;
	clearHistory: () => void;
}

export type FolderTypes = 'content' | 'config';

export type QueueItem = {
	title: string;
	episode: string;
	fileName: string;
	dlsubs: string[];
	parent: {
		title: string;
		season: string;
	};
	q: number;
	dlVideoOnce: boolean;
	dubLang: string[];
	image: string;
} & ResolveItemsData;

export type ResolveItemsData = {
	id: string;
	dubLang: string[];
	all: boolean;
	but: boolean;
	novids: boolean;
	noaudio: boolean;
	dlVideoOnce: boolean;
	e: string;
	fileName: string;
	q: number;
	dlsubs: string[];
};

/**
 * A completed download attempt (one queue item), recorded for the Downloads
 * history. `success` is authoritative — it reflects the service core's own
 * result, so a download that fails before any progress step (auth/resolve) is
 * still captured. `error` carries the failure reason when one is available.
 */
export type HistoryEntry = {
	/** Stable id (generated at record time) — used to address entries for removal. */
	id: string;
	item: QueueItem;
	success: boolean;
	error?: string;
	/** Completion time (ms since epoch). */
	time: number;
};

/**
 * Outcome of a service core's `performDownload`. `error` carries a human-readable
 * reason for non-throwing failures so it can be surfaced in the history.
 */
export type DownloadResult = {
	success: boolean;
	error?: string;
};

export type SearchResponseItem = {
	image: string;
	name: string;
	desc?: string;
	id: string;
	lang?: string[];
	rating: number;
};

export type Episode = {
	e: string;
	lang: string[];
	name: string;
	season: string;
	seasonTitle: string;
	episode: string;
	id: string;
	img: string;
	description: string;
	time: string;
};

export type SearchResponse = ResponseBase<SearchResponseItem[]>;
export type EpisodeListResponse = ResponseBase<Episode[]>;

export type FuniEpisodeData = {
	title: string;
	episode: string;
	epsiodeNumber: string;
	episodeID: string;
	seasonTitle: string;
	seasonNumber: string;
	ids: {
		episode: string;
		show: string;
		season: string;
	};
	image: string;
};

export type AuthData = { username: string; password: string };
export type SearchData = { search: string; page?: number; 'search-type'?: string; 'search-locale'?: string };
export type FuniGetShowData = { id: number; e?: string; but: boolean; all: boolean };
export type FuniGetEpisodeData = { subs: FuniSubsData; fnSlug: FuniEpisodeData; simul?: boolean; dubLang: string[]; s: string };
export type FuniStreamData = {
	force?: 'Y' | 'y' | 'N' | 'n' | 'C' | 'c';
	callbackMaker?: (data: DownloadInfo) => HLSCallback;
	q: number;
	x: number;
	fileName: string;
	numbers: number;
	novids?: boolean;
	timeout: number;
	partsize: number;
	fsRetryTime: number;
	noaudio?: boolean;
	mp4: boolean;
	ass: boolean;
	fontSize: number;
	fontName?: string;
	skipmux?: boolean;
	forceMuxer: AvailableMuxer | undefined;
	simul: boolean;
	skipSubMux: boolean;
	nocleanup: boolean;
	override: string[];
	videoTitle: string;
	ffmpegOptions: string[];
	mkvmergeOptions: string[];
	defaultAudio: LanguageItem;
	defaultSub: LanguageItem;
	ccTag: string;
};
export type FuniSubsData = { nosubs?: boolean; sub: boolean; dlsubs: string[]; ccTag: string };
export type DownloadData = {
	hslang?: string;
	id: string;
	e: string;
	dubLang: string[];
	dlsubs: string[];
	fileName: string;
	q: number;
	novids: boolean;
	noaudio: boolean;
	dlVideoOnce: boolean;
};

export type AuthResponse = ResponseBase<undefined>;
export type FuniSearchReponse = ResponseBase<FunimationSearch>;
export type FuniShowResponse = ResponseBase<FuniEpisodeData[]>;
export type FuniGetEpisodeResponse = ResponseBase<undefined>;
export type CheckTokenResponse = ResponseBase<undefined>;

export type ResponseBase<T> =
	| {
			isOk: true;
			value: T;
	  }
	| {
			isOk: false;
			reason: Error;
	  };

export type ProgressData = {
	total: number;
	cur: number;
	percent: number | string;
	time: number;
	downloadSpeed: number;
	bytes: number;
};

export type PossibleMessages = keyof ServiceHandler;

/** Which media stream a progress tick belongs to. */
export type StreamType = 'video' | 'audio' | 'subtitle';

export type DownloadInfo = {
	image: string;
	parent: {
		title: string;
	};
	title: string;
	language: LanguageItem;
	fileName: string;
	/** Set by the service cores so the GUI can attribute progress to a step. */
	type?: StreamType;
};

/**
 * A discrete step transition inside a running download that has no streamdl
 * progress of its own (subtitle fetch, decryption, muxing). Emitted by the
 * service cores via their optional `onStage` hook; the GUI turns these into a
 * live step checklist alongside the video/audio progress steps.
 */
export type DownloadStage = {
	kind: 'video' | 'audio' | 'subtitle' | 'decrypt' | 'mux';
	state: 'start' | 'done' | 'fail';
	/** Human-readable language name, when the step is language-specific. */
	lang?: string;
	/** Extra qualifier, e.g. 'video'/'audio' for decrypt or 'mkvmerge'/'ffmpeg' for mux. */
	label?: string;
};

export type ExtendedProgress = {
	progress: ProgressData;
	downloadInfo: DownloadInfo;
};

export type GuiState = {
	setup: boolean;
	services: Record<string, GuiStateService>;
};

export type GuiStateService = {
	queue: QueueItem[];
	history: HistoryEntry[];
};
