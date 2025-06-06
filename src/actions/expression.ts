import { action, SingletonAction, WillAppearEvent, DidReceiveSettingsEvent, KeyDownEvent, SendToPluginEvent, JsonValue } from "@elgato/streamdeck";
import streamDeck from "@elgato/streamdeck";
import { NLPlugin } from "../nLPlugin";
import type { DataSourcePayload, DataSourceResult } from "../sdpi";

type ExpressionSettings = {
    actionType?: string; // start, stop, clear
    selectedExpression?: string;
};

type ExpressionItem = {
    Name: string;
    ExpressionPath: string;
};

@action({ UUID: "com.live2d.nizima-live.expression" })
export class Expression extends SingletonAction<ExpressionSettings> {
    private nLPlugin: NLPlugin;
    private expressions: ExpressionItem[] = [];
    private running: boolean = false;
    constructor(nLPlugin: NLPlugin) {
        super();
        this.nLPlugin = nLPlugin;
    }

    override async onWillAppear(ev: WillAppearEvent<ExpressionSettings>): Promise<void> {
    }

    override async onKeyDown(ev: KeyDownEvent<ExpressionSettings>): Promise<void> {
        const { settings } = ev.payload;
        // 未選択時のデフォルト値設定
        if (settings.selectedExpression === undefined) {
            streamDeck.logger.debug("No expression selected, setting default.");
            settings.selectedExpression = this.expressions.length > 0 ? this.expressions[0].ExpressionPath : "";
        }
        if (settings.actionType === undefined) {
            settings.actionType = "toggle"; // Default action type
        }

        streamDeck.logger.info("Selected Expression:", settings.actionType, settings.selectedExpression);
        if (this.nLPlugin.pluginState === NLPlugin.AVAILABLE) {
            const modelId = (globalThis as any).currentModelId || "";
            try {
                switch (settings.actionType) {
                    case "toggle":
                        if (settings.selectedExpression === "") return;
                        if (this.running) {
                            streamDeck.logger.info("Stop expression:", modelId, settings.selectedExpression);
                            await this.nLPlugin.callMethod("StopExpression", {
                                ModelId: modelId,
                                ExpressionPath: settings.selectedExpression
                            });
                            this.running = false;
                        } else {
                            streamDeck.logger.info("Start expression:", modelId, settings.selectedExpression);
                            await this.nLPlugin.callMethod("StartExpression", {
                                ModelId: modelId,
                                ExpressionPath: settings.selectedExpression
                            });
                            this.running = true;
                        }
                        break;
                    case "start":
                        if (settings.selectedExpression === "") return;
                        streamDeck.logger.info("Start expression:", modelId, settings.selectedExpression);
                        await this.nLPlugin.callMethod("StartExpression", {
                            ModelId: modelId,
                            ExpressionPath: settings.selectedExpression
                        });
                        break;
                    case "stop":
                        streamDeck.logger.info("Stop expression:", modelId, settings.selectedExpression);
                        await this.nLPlugin.callMethod("StopExpression", {
                            ModelId: modelId,
                            ExpressionPath: settings.selectedExpression
                        });
                        break;
                    case "clear":
                        streamDeck.logger.info("Clear expressions:", modelId);
                        await this.nLPlugin.callMethod("StopAllExpressions", {
                            ModelId: modelId
                        });
                        break;
                    default:
                        streamDeck.logger.warn("Unknown action type:", settings.actionType);
                        return;
                }
            } catch (error) {
                streamDeck.logger.error("SetExpression API call error:", error);
            }
        }
    }

    override async onSendToPlugin(ev: SendToPluginEvent<JsonValue, ExpressionSettings>): Promise<void> {
        if (ev.payload instanceof Object && "event" in ev.payload && ev.payload.event === "getExpressionList") {
            streamDeck.ui.current?.sendToPropertyInspector({
                event: "getExpressionList",
                items: await this.#getExpressionList()
            } satisfies DataSourcePayload);
        }
    }

    async #getExpressionList(): Promise<DataSourceResult> {
        if (this.nLPlugin.pluginState === NLPlugin.AVAILABLE) {
            const modelId = (globalThis as any).currentModelId || "";
            try {
                await this.nLPlugin.callMethod("GetExpressions", {
                    ModelId: modelId
                }).then(result => {
                    this.expressions = result?.Data?.Expressions || [];
                    streamDeck.logger.debug("Motions retrieved:", result, this.expressions);
                });
            } catch (error) {
                streamDeck.logger.error("GetMotionList API call error:", error);
            }
        }
        return this.expressions.map((expression: { Name: string; ExpressionPath: string }) => ({
            label: expression.Name,
            value: expression.ExpressionPath
        }));
    }

    override onDidReceiveSettings(ev: DidReceiveSettingsEvent<ExpressionSettings>): Promise<void> | void {
        const { settings } = ev.payload;
        streamDeck.logger.debug("Received Settings:", settings);
    }
}
