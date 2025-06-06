import WebSocket from "ws"; // WebSocket モジュールをインポート
import streamDeck from "@elgato/streamdeck";

export class NLPlugin {
	static get apiVersion(): string {
		return "1.0.0";
	}
	static get CLOSED(): number {
		return 0;
	}
	static get CONNECTING(): number {
		return 1;
	}
	static get OPEN(): number {
		return 2;
	}
	static get ESTABLISHED(): number {
		return 3;
	}
	static get AVAILABLE(): number {
		return 4;
	}

	private static messageId = 0;
	private readonly name: string;
	private state: number = NLPlugin.CLOSED;
	private socket: WebSocket | null = null;
	private promises: Record<string, { resolve: (value: any) => void; reject: (reason?: any) => void }> = {};
	private eventListener: Record<string, ((message: any) => void)[]> = {};

	developer: string = "";
	version: string = "";
	token: string = "";
	debug: boolean = false;
	onStateChanged: (state: number) => void = () => {};

	constructor(name: string) {
		if (!name) throw new Error("name is empty!");
		this.name = name;
	}

	get pluginName(): string {
		return this.name;
	}

	get pluginState(): number {
		return this.state;
	}

	start(address: string): void {
		if (this.socket) {
			this.socket.onopen = null;
			this.socket.onclose = null;
			this.socket.onmessage = null;
			this.socket.onerror = null;
			this.socket.close();
		}
		this.socket = new WebSocket(address);
		this.setState(NLPlugin.CONNECTING);

		this.socket.onopen = () => {
			this.setState(NLPlugin.OPEN);
			this.establishConnection().catch(() => this.registerPlugin()).catch(() => this.stop());
		};

		this.socket.onclose = () => {
			if (this.state === NLPlugin.CONNECTING) {
				setTimeout(() => this.start(this.socket!.url), 1000);
			} else {
				this.stop();
			}
		};

		this.socket.onerror = (event) => {
			if (this.debug) streamDeck.logger.error("WebSocket error event:", event);
			this.stop();
		};

		this.socket.onmessage = (event) => {
			const message = JSON.parse(event.data.toString());
			if (this.debug) streamDeck.logger.info("<<<<<<<<<<<<<<<< Received <<<<<<<<<<<<<<<<\n", JSON.stringify(message, undefined, 2));

			if (message.Id in this.promises) {
				if (message.Type === "Response") {
					this.promises[message.Id].resolve(message);
				} else if (message.Type === "Error") {
					this.promises[message.Id].reject(message);
				}
				delete this.promises[message.Id];
			}

			if (message.Type === "Event") {
				if (message.Method === "NotifyEnabledChanged") {
					this.setState(message.Data.Enabled ? NLPlugin.AVAILABLE : NLPlugin.ESTABLISHED);
				}
				if (message.Method in this.eventListener) {
					for (const callback of this.eventListener[message.Method]) {
						callback(message);
					}
				}
			}
		};
	}

	startLocalhost(port: number): void {
		this.start(`ws://localhost:${port}/`);
	}

	stop(): void {
		this.setState(NLPlugin.CLOSED);
		if (this.socket) {
			this.socket.close();
		}
		this.socket = null;
	}

	addEventListener(event: string, callback: (message: any) => void): void {
		if (!this.eventListener[event]) {
			this.eventListener[event] = [];
		}
		this.eventListener[event].push(callback);
	}

	async callMethod(method: string, data: any): Promise<any> {
		if (this.state !== NLPlugin.AVAILABLE) throw new Error("API not ready!");
		return this.sendRequest(method, data);
	}

	private setState(state: number): void {
		if (this.state === state) return;
		this.state = state;
		this.onStateChanged(state);
	}

	private async sendRequest(method: string, data: any): Promise<any> {
		const id = String(NLPlugin.messageId++);
		const message = {
			nLPlugin: NLPlugin.apiVersion,
			Timestamp: Date.now(),
			Id: id,
			Type: "Request",
			Method: method,
			Data: data,
		};
		if (this.debug) streamDeck.logger.info(">>>>>>>>>>>>>>>>   Send   >>>>>>>>>>>>>>>>", JSON.stringify(message, undefined, 2));
		this.socket!.send(JSON.stringify(message));
		return new Promise((resolve, reject) => {
			this.promises[id] = { resolve, reject };
		});
	}

	private async registerPlugin(): Promise<void> {
		if (this.state !== NLPlugin.OPEN) return Promise.reject();
		return this.sendRequest("RegisterPlugin", {
			Name: this.name,
			Developer: this.developer,
			Version: this.version,
		}).then((message) => {
			this.token = message.Data.Token;
			this.setState(NLPlugin.ESTABLISHED);
		});
	}

	private async establishConnection(): Promise<void> {
		if (!this.token || this.state !== NLPlugin.OPEN) return Promise.reject();
		return this.sendRequest("EstablishConnection", {
			Name: this.name,
			Token: this.token,
			Version: this.version,
		}).then((message) => {
			this.setState(NLPlugin.ESTABLISHED);
			if (message.Data.Enabled) {
				this.setState(NLPlugin.AVAILABLE);
			}
		});
	}
}
