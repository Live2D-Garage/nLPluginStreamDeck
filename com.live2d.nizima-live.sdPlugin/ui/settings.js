// setting-item の表示・非表示を切り替える
async function updateSettingVisibility() {
    const settings = await SDPIComponents.streamDeckClient.getGlobalSettings();
    console.log('isConnected:', settings);
    const settingItem = document.getElementById('setting-item');
    const port = document.getElementById('port');
    if (port) {
        port.value = settings.port || '';
    }
    if (settingItem) {
        settingItem.style.display = settings.isConnected ? 'none' : '';
    }
}
// Connectボタンのクリックイベントを設定
document.addEventListener('DOMContentLoaded', function() {
    const connectBtn = document.getElementById('connect-btn');
    if (connectBtn) {
        connectBtn.addEventListener('click', async function() {
            const settings = await SDPIComponents.streamDeckClient.getGlobalSettings();
            const port = document.getElementById('port').value;
            settings.port = port;
            settings.connectionRequested = true;
            SDPIComponents.streamDeckClient.setGlobalSettings(settings);
            location.reload();
        });
    }
    updateSettingVisibility();
});
window.addEventListener('SDPISettingsUpdated', updateSettingVisibility);
