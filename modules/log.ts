import fs from 'fs';
import path from 'path';
import { workingDir } from './module.cfg-loader';
import log4js from 'log4js';

const logFolder = path.join(workingDir, 'logs');
const latest = path.join(logFolder, 'latest.log');

export type LogLine = { level: string; message: string; time: number };
export type LogSink = (line: LogLine) => void;

const MAX_BUFFER = 500;
const logBuffer: LogLine[] = [];
let logSink: LogSink | undefined;

/**
 * Late registration of a consumer for log lines (used by the GUI to stream the
 * console over the WebSocket). Registered after the WebSocket exists, because
 * this logger is created very early — before any server is up.
 */
export const registerLogSink = (sink: LogSink) => {
	logSink = sink;
};

/** Last ~500 lines, available for a future "log history" request on connect. */
export const getLogHistory = (): LogLine[] => logBuffer.slice();

/**
 * Custom log4js appender that forwards every line to the registered sink and
 * keeps a bounded history. It must never log itself (directly or indirectly)
 * to avoid a feedback loop, so all failures here are swallowed.
 */
const wsAppender = {
	configure: (_config: any, layouts: any) => {
		const layout = layouts.messagePassThroughLayout;
		return (loggingEvent: any) => {
			const line: LogLine = {
				level: loggingEvent.level?.levelStr ?? 'INFO',
				message: layout(loggingEvent),
				time: (loggingEvent.startTime instanceof Date ? loggingEvent.startTime : new Date()).getTime()
			};
			logBuffer.push(line);
			if (logBuffer.length > MAX_BUFFER) logBuffer.shift();
			try {
				logSink?.(line);
			} catch {
				/* never throw from the appender */
			}
		};
	}
};

const makeLogFolder = () => {
	if (!fs.existsSync(logFolder)) fs.mkdirSync(logFolder, { recursive: true });
	if (fs.existsSync(latest)) {
		const stats = fs.statSync(latest);
		fs.renameSync(latest, path.join(logFolder, `${stats.mtimeMs}.log`));
	}
};

const makeLogger = () => {
	global.console.log =
		global.console.info =
		global.console.warn =
		global.console.error =
		global.console.debug =
			(...data: any[]) => {
				console.info(data.length >= 1 ? data.shift() : '', ...data);
			};
	makeLogFolder();
	log4js.configure({
		appenders: {
			console: {
				type: 'console',
				layout: {
					type: 'pattern',
					pattern: process.env.isGUI === 'true' ? '%[%x{info}%m%]' : '%x{info}%m',
					tokens: {
						info: (ev) => {
							return ev.level.levelStr === 'INFO' ? '' : `[${ev.level.levelStr}] `;
						}
					}
				}
			},
			file: {
				type: 'file',
				filename: latest,
				layout: {
					type: 'pattern',
					pattern: '%x{info}%m',
					tokens: {
						info: (ev) => {
							return ev.level.levelStr === 'INFO' ? '' : `[${ev.level.levelStr}] `;
						}
					}
				}
			},
			// Custom in-memory appender that streams lines to the GUI console.
			// `type` is an object with a `configure` fn; typed as string to satisfy log4js' config types.
			ws: {
				type: wsAppender as unknown as string
			}
		},
		categories: {
			default: {
				appenders: ['console', 'file', 'ws'],
				level: 'all'
			}
		}
	});
};

const getLogger = () => {
	if (!log4js.isConfigured()) makeLogger();
	return log4js.getLogger();
};

export const console = getLogger();
