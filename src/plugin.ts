import streamDeck, { LogLevel } from "@elgato/streamdeck";
import { ChangeModel } from "./actions/change-model";
import { MoveModel } from "./actions/move-model";
import { RotateModel } from "./actions/rotate-model";
import { ZoomModel } from "./actions/zoom-model";
import { Motion } from "./actions/motion";
import { Expression } from "./actions/expression";
import { NLPlugin } from "./nLPlugin";

type GlobalSettings = {
    isConnected?: boolean;
    port?: number;
    connectionRequested?: boolean;
    token?: string;
};

// nLPluginインスタンスを作成
const nLPlugin = new NLPlugin("StreamDeck");
nLPlugin.developer = "Live2D Inc.";
nLPlugin.version = "1.0.1";

nLPlugin.addEventListener("NotifyCurrentModelChanged", setCurrentModel);
nLPlugin.addEventListener("NotifyEnabledChanged", (message: any) => {
    streamDeck.logger.debug("NotifyEnabledChanged:", message);
});

function setCurrentModel(message: any) {
    streamDeck.logger.debug("NotifyCurrentModelChanged:", message);
    (globalThis as any).currentModelId = message.Data.ModelId;
}

// グローバル設定の取得・更新用関数
async function getGlobalSettings(): Promise<GlobalSettings> {
    const gs = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
    return {
        isConnected: gs?.isConnected ?? false,
        port: gs?.port ?? 22022,
        connectionRequested: gs?.connectionRequested ?? false,
        token: gs?.token ?? ""
    };
}

async function setGlobalSettings(newSettings: Partial<GlobalSettings>) {
    const current = await getGlobalSettings();
    const merged = { ...current, ...newSettings };
    await streamDeck.settings.setGlobalSettings(merged);
    return merged;
}

nLPlugin.onStateChanged = async (state) => {
    switch (state) {
        case NLPlugin.AVAILABLE: {
            streamDeck.logger.info("nLPlugin WebSocket接続成功");
            await setGlobalSettings({ isConnected: true });
            nLPlugin.callMethod("NotifyCurrentModelChanged", { "Enabled": true }).catch(e => streamDeck.logger.error(e));
            //nLPlugin.callMethod("NotifyEnabledChanged", { "Enabled": true }).catch(e => streamDeck.logger.error(e));
            nLPlugin.callMethod("GetCurrentModelId", {}).then(setCurrentModel);
            break;
        }
        case NLPlugin.CLOSED:
            streamDeck.logger.error("nLPlugin WebSocket接続失敗または切断");
            await setGlobalSettings({ isConnected: false });
            break;
        case NLPlugin.ESTABLISHED:
            streamDeck.logger.info("nLPlugin WebSocket接続確立");
            try {
                await setGlobalSettings({ token: nLPlugin.token, isConnected: false });
                streamDeck.logger.debug("Tokenを保存しました");
            } catch (e) {
                streamDeck.logger.error("Token保存エラー", e);
            }
            break;
        default:
            break;
    }
};

streamDeck.system.onApplicationDidLaunch(async (ev) => {
    const gs = await getGlobalSettings();
    await setGlobalSettings({ isConnected: false });
    streamDeck.logger.info("Application launched:", ev.application, ev, gs);
    try {
        streamDeck.logger.info("nLPlugin WebSocket接続開始");
        nLPlugin.token = gs.token || "";
        nLPlugin.startLocalhost(gs.port ?? 22022);
    } catch (e) {
        streamDeck.logger.error("nLPlugin WebSocket接続エラー", e);
    }
});

streamDeck.system.onApplicationDidTerminate(ev => {
    streamDeck.logger.info("Application terminated:", ev.application, ev);
    nLPlugin.stop();
});

streamDeck.settings.onDidReceiveGlobalSettings(async (ev) => {
    const gs = ev.settings as GlobalSettings;
    streamDeck.logger.debug("Global Settings received:", gs);
    if (!gs.isConnected && gs.connectionRequested) {
        try {
            await setGlobalSettings({ connectionRequested: false, port: Number(gs.port ?? 22022) });
            nLPlugin.startLocalhost(Number(gs.port ?? 22022));
        } catch (e) {
            streamDeck.logger.error("nLPlugin WebSocket接続エラー", e);
        }
    }
});

// NOTE: 「trace」ログを有効にすると、Stream Deck とプラグイン間のすべてのメッセージが記録される。
// リリース時は「info」レベルに設定すること→pack化したものはinfoレベルに勝手になってるかも？
streamDeck.logger.setLevel(LogLevel.INFO);

// 各アクションを登録
streamDeck.actions.registerAction(new ChangeModel(nLPlugin));
streamDeck.actions.registerAction(new MoveModel(nLPlugin));
streamDeck.actions.registerAction(new RotateModel(nLPlugin));
streamDeck.actions.registerAction(new ZoomModel(nLPlugin));
streamDeck.actions.registerAction(new Motion(nLPlugin));
streamDeck.actions.registerAction(new Expression(nLPlugin));

streamDeck.connect();
