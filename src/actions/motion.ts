import { action, SingletonAction, WillAppearEvent, DidReceiveSettingsEvent, KeyDownEvent, SendToPluginEvent, JsonValue } from "@elgato/streamdeck";
import streamDeck from "@elgato/streamdeck";
import { NLPlugin } from "../nLPlugin";
import type { DataSourcePayload, DataSourceResult } from "../sdpi";

type MotionSettings = {
    actionType?: string; // start, stop, clear
    selectedMotion?: string;
}

type MotionItem = {
    Name: string;
    MotionPath: string;
}

@action({ UUID: "com.live2d.nizima-live.motion" })
export class Motion extends SingletonAction<MotionSettings> {
    private nLPlugin: NLPlugin;
    private motions: MotionItem[] = [];
    constructor(nLPlugin: NLPlugin) {
        super();
        this.nLPlugin = nLPlugin;
    }
    
    override async onWillAppear(ev: WillAppearEvent<MotionSettings>): Promise<void> {
    }

    override async onKeyDown(ev: KeyDownEvent<MotionSettings>): Promise<void> {
        const { settings } = ev.payload;
        // 未選択時のデフォルト値設定
        if (settings.selectedMotion === undefined) {
            streamDeck.logger.debug("No motion selected, setting default.");
            settings.selectedMotion = this.motions.length > 0 ? this.motions[0].MotionPath : "";
        }
        if (settings.actionType === undefined) {
            settings.actionType = "start"; // Default action type
        }
        streamDeck.logger.info("Selected Motion:", settings.actionType, settings.selectedMotion);
        if (this.nLPlugin.pluginState === NLPlugin.AVAILABLE) {
            const modelId = (globalThis as any).currentModelId || "";
            try {
                switch (settings.actionType) {
                    case "start":
                        if (settings.selectedMotion === "") return;
                        streamDeck.logger.info("Start motion:", modelId, settings.selectedMotion);
                        await this.nLPlugin.callMethod("StartMotion", {
                            ModelId: modelId,
                            MotionPath: settings.selectedMotion
                        });
                        break;
                    case "stop":
                        streamDeck.logger.info("Stop motion:", modelId);
                        await this.nLPlugin.callMethod("StopMotion", {
                            ModelId: modelId
                        });
                        break;
                    case "clear":
                        streamDeck.logger.info("Clear motion:", modelId);
                        await this.nLPlugin.callMethod("StopMotion", {
                            ModelId: modelId
                        });
                        await this.nLPlugin.callMethod("ResetPose", {
                            ModelId: modelId
                        });
                        await this.nLPlugin.callMethod("ResetCubismParameterValues", {
                            ModelId: modelId
                        });
                        break;
                    default:
                        streamDeck.logger.warn("Unknown action type:", settings.actionType);
                        return;
                }
            } catch (error) {
                    streamDeck.logger.error("Motion API call error:", error);
            }
        }
    }

    override async onSendToPlugin(ev: SendToPluginEvent<JsonValue, MotionSettings>): Promise<void> {
        if (ev.payload instanceof Object && "event" in ev.payload && ev.payload.event === "getMotionList") {
            streamDeck.ui.current?.sendToPropertyInspector({
                event: "getMotionList",
                items: await this.#getMotionList()
            } satisfies DataSourcePayload);
        }
    }
    
    async #getMotionList(): Promise<DataSourceResult> {
        if (this.nLPlugin.pluginState === NLPlugin.AVAILABLE) {
            const modelId = (globalThis as any).currentModelId || "";
            try {
                await this.nLPlugin.callMethod("GetMotions", {
                    ModelId: modelId
                }).then(result => {
                    this.motions = result?.Data?.Motions || [];
                    streamDeck.logger.debug("Motions retrieved:", result, this.motions);
                });
            } catch (error) {
                streamDeck.logger.error("GetMotionList API call error:", error);
            }
        }
        return this.motions.map((motion: { Name: string; MotionPath: string }) => ({
            label: motion.Name,
            value: motion.MotionPath
        }));
    }

    override onDidReceiveSettings(ev: DidReceiveSettingsEvent<MotionSettings>): Promise<void> | void {
        const { settings } = ev.payload;
        streamDeck.logger.debug("Received Settings:", settings);
    }
}
