import streamDeck, { action, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import { NLPlugin } from "../nLPlugin";

type MoveModelSettings = {
    absolute?: boolean;
    positionX?: number; // [-1,1] step 0.01
    positionY?: number; // [-1,1] step 0.01
    scale?: number; // [0.1, 5.0] step 0.1
    rotation?: number; // [-180, 180]
    delay?: number; // [0, 5] seconds
    interpolation?: string;
};

@action({ UUID: "com.live2d.nizima-live.move-model" })
export class MoveModel extends SingletonAction<MoveModelSettings> {
    private nLPlugin: NLPlugin;
    constructor(nLPlugin: NLPlugin) {
        super();
        this.nLPlugin = nLPlugin;
    }

    override onWillAppear(ev: WillAppearEvent<MoveModelSettings>): void | Promise<void> {}

    override async onKeyDown(ev: KeyDownEvent<MoveModelSettings>): Promise<void> {
        const { settings } = ev.payload;
        settings.absolute ??= false;
        settings.positionX ??= 0;
        settings.positionY ??= 0;
        settings.scale ??= 1;
        settings.rotation ??= 0;
        settings.delay ??= 1;
        settings.interpolation ??= "Linear";
        if (this.nLPlugin.pluginState === NLPlugin.AVAILABLE) {
            const modelId = (globalThis as any).currentModelId || "";
            if (!modelId) {
                streamDeck.logger.error("No current model ID found");
                return;
            }
            try {
                await this.nLPlugin.callMethod("MoveModel", {
                    ModelId: modelId,
                    PositionX: settings.positionX,
                    PositionY: settings.positionY,
                    Absolute: settings.absolute,
                    Scale: settings.scale,
                    Rotation: settings.rotation,
                    Delay: settings.delay,
                    InterpolationType: settings.interpolation
                });
            } catch (error) {
                streamDeck.logger.error("MoveModel API call error:", error);
            }
        }
    }
}
