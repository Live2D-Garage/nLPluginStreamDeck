import streamDeck, { action, SingletonAction, DialRotateEvent, WillAppearEvent, DialDownEvent } from "@elgato/streamdeck";
import { NLPlugin } from "../nLPlugin";

type ZoomModelSettings = {
    rate?: number; // [1, 2] step 0.01
    delay?: number; // [0, 5] seconds
};

@action({ UUID: "com.live2d.nizima-live.zoom-model" })
export class ZoomModel extends SingletonAction<ZoomModelSettings> {
    private nLPlugin: NLPlugin;
    constructor(nLPlugin: NLPlugin) {
        super();
        this.nLPlugin = nLPlugin;
    }

    override async onDialRotate(ev: DialRotateEvent<ZoomModelSettings>): Promise<void> {
        if (this.nLPlugin.pluginState === NLPlugin.AVAILABLE) {
            const modelId = (globalThis as any).currentModelId || "";
            if (!modelId) {
                streamDeck.logger.error("No current model ID found");
                return;
            }
            try {
                let scale = (ev.payload.settings.rate ??= 1);
                if (ev.payload.ticks < 0) scale = 1/scale;
                await this.nLPlugin.callMethod("MoveModel", {
                    ModelId: modelId,
                    Scale: scale,
                    Delay: ev.payload.settings.delay ??= 0,
                    isAbsolute: false
                });
            } catch (error) {
                streamDeck.logger.error("ZoomModel API call error:", error);
            }
        }
    }

    override async onDialDown(ev: DialDownEvent<ZoomModelSettings>): Promise<void> {
        if (this.nLPlugin.pluginState === NLPlugin.AVAILABLE) {
            const modelId = (globalThis as any).currentModelId || "";
            if (!modelId) {
                streamDeck.logger.error("No current model ID found");
                return;
            }
            try {
                await this.nLPlugin.callMethod("MoveModel", {
                    ModelId: modelId,
                    Scale: 1.0,
                    Delay: ev.payload.settings.delay ??= 0,
                    Absolute: true
                });
            } catch (error) {
                streamDeck.logger.error("ZoomModel API call error:", error);
            }
        }
    }
}