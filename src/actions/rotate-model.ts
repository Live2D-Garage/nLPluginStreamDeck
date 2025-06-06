import streamDeck, { action, SingletonAction, DialRotateEvent, WillAppearEvent, DialDownEvent } from "@elgato/streamdeck";
import { NLPlugin } from "../nLPlugin";

type RotateModelSettings = {
    incrementBy?: number; // [1, 5]
};

@action({ UUID: "com.live2d.nizima-live.rotate-model" })
export class RotateModel extends SingletonAction<RotateModelSettings> {
    private nLPlugin: NLPlugin;
    constructor(nLPlugin: NLPlugin) {
        super();
        this.nLPlugin = nLPlugin;
    }

    override async onDialRotate(ev: DialRotateEvent<RotateModelSettings>): Promise<void> {
        if (this.nLPlugin.pluginState === NLPlugin.AVAILABLE) {
            const modelId = (globalThis as any).currentModelId || "";
            if (!modelId) {
                streamDeck.logger.error("No current model ID found");
                return;
            }
            try {
                let angle = -(ev.payload.ticks ?? 0) * (ev.payload.settings.incrementBy ??= 1);
                await this.nLPlugin.callMethod("MoveModel", {
                    ModelId: modelId,
                    Rotation: angle,
                    Absolute: false
                });
            } catch (error) {
                streamDeck.logger.error("RotateModel API call error:", error);
            }
        }
    }

    override async onDialDown(ev: DialDownEvent<RotateModelSettings>): Promise<void> {
        if (this.nLPlugin.pluginState === NLPlugin.AVAILABLE) {
            try {
                const modelId = (globalThis as any).currentModelId || "";
                if (!modelId) {
                    console.error("No current model ID found");
                    return;
                }
                await this.nLPlugin.callMethod("MoveModel", {
                    ModelId: modelId,
                    Rotation: 0,
                    Absolute: true
                });
            } catch (error) {
                streamDeck.logger.error("RotateModel API call error:", error);
            }
        }
    }
}
