import { action, SingletonAction, WillAppearEvent, DidReceiveSettingsEvent, KeyDownEvent, SendToPluginEvent, JsonValue } from "@elgato/streamdeck";
import streamDeck from "@elgato/streamdeck";
import { NLPlugin } from "../nLPlugin";
import type { DataSourcePayload, DataSourceResult } from "../sdpi";

type ChangeModelSettings = {
    selectedPath?: string;
}

type ModelItem = {
    Name: string;
    ModelPath: string;
}

@action({ UUID: "com.live2d.nizima-live.change-model" })
export class ChangeModel extends SingletonAction<ChangeModelSettings> {
    private nLPlugin: NLPlugin;
    private modelList: ModelItem[] = [];
    constructor(nLPlugin: NLPlugin) {
        super();
        this.nLPlugin = nLPlugin;
    }

    override async onWillAppear(ev: WillAppearEvent<ChangeModelSettings>): Promise<void> {
    }

    override async onKeyDown(ev: KeyDownEvent<ChangeModelSettings>): Promise<void> {
        const { settings } = ev.payload;
        // 未選択時のデフォルト値設定
        if (settings.selectedPath === undefined) {
            streamDeck.logger.debug("No model selected, setting default.");
            settings.selectedPath = this.modelList.length > 0 ? this.modelList[0].ModelPath : "";
        }
        streamDeck.logger.info("Selected Path:", settings.selectedPath);
        if (settings.selectedPath === "") return;
        if (this.nLPlugin.pluginState === NLPlugin.AVAILABLE) {
            const modelId = (globalThis as any).currentModelId || "";
            try {
                await this.nLPlugin.callMethod("ChangeModel", {
                    ModelId: modelId,
                    ModelPath: settings.selectedPath
                });
            } catch (error) {
                streamDeck.logger.error("ChangeModel API call error:", error);
            }
        }
    }

    override async onSendToPlugin(ev: SendToPluginEvent<JsonValue, ChangeModelSettings>): Promise<void> {
        if (ev.payload instanceof Object && "event" in ev.payload && ev.payload.event === "getModelList") {
            streamDeck.ui.current?.sendToPropertyInspector({
                event: "getModelList",
                items: await this.#getModelList()
            } satisfies DataSourcePayload);
        }
    }

    async #getModelList(): Promise<DataSourceResult> {
        if (this.nLPlugin.pluginState === NLPlugin.AVAILABLE) {
            try {
                await this.nLPlugin.callMethod("GetRegisteredModels", {})
                    .then(result => {
                        this.modelList = result?.Data?.RegisteredModels || [];
                        streamDeck.logger.debug("Registerd Models retrieved:", this.modelList);
                    });
            } catch (error) {
                streamDeck.logger.error("GetRegisteredModels API call error:", error);
            }
        }
        // 未ダウンロードのモデルも含まれているので除外する
        this.modelList = this.modelList.filter((model: { Name: string; ModelPath: string }) => model.ModelPath !== "");
        streamDeck.logger.debug("Registered Models:", this.modelList);
        return this.modelList.map((model: { Name: string; ModelPath: string }) => ({
            label: model.Name,
            value: model.ModelPath
        }));
    }

    override onDidReceiveSettings(ev: DidReceiveSettingsEvent<ChangeModelSettings>): Promise<void> | void {
        const { settings } = ev.payload;
        streamDeck.logger.debug("Received Settings:", settings);
        // NOTE: アイコンの良いクロップ手段が見つからないので一旦コメントアウト
        //await this.nLPlugin.callMethod("GetRegisteredModelIcons", {
        //    ModelPaths: [settings.selectedPath]
        //}).then(result => {
        //    streamDeck.logger.debug("Model Icons retrieved:", result?.Data?.RegisteredModelIcons);
        //    if (result?.Data?.RegisteredModelIcons && result.Data.RegisteredModelIcons.length > 0) {
        //        const icon = result.Data.RegisteredModelIcons[0].Icon;
        //        if (icon) {
        //            ev.action.setImage("data:image/png;base64,"+icon);
        //        } else {
        //            ev.action.setImage("");
        //        }
        //    } else {
        //        ev.action.setImage("");
        //    }
        //});
    }
}
