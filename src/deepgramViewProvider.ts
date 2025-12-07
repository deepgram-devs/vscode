import * as vscode from 'vscode';
import { DeepgramService } from './deepgramService';

export class DeepgramViewProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private deepgramService: DeepgramService;

    constructor(private readonly _extensionUri: vscode.Uri) {
        this.deepgramService = new DeepgramService();
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'setApiKey':
                    this.deepgramService.setApiKey(data.apiKey);
                    break;
                case 'setUseShortLivedToken':
                    this.deepgramService.setUseShortLivedToken(data.value);
                    break;
                case 'startRecording':
                    await this.handleStartRecording();
                    break;
                case 'stopRecording':
                    await this.handleStopRecording();
                    break;
                case 'transcribeAudio':
                    await this.handleTranscribe(data);
                    break;
                case 'synthesizeSpeech':
                    await this.handleTTS(data);
                    break;
            }
        });
    }

    private async handleStartRecording() {
        try {
            const audioData = await this.deepgramService.startRecording();
            this._view?.webview.postMessage({
                type: 'recordingStarted'
            });
        } catch (error: any) {
            vscode.window.showErrorMessage(`Recording error: ${error.message}`);
        }
    }

    private async handleStopRecording() {
        try {
            const audioData = await this.deepgramService.stopRecording();
            this._view?.webview.postMessage({
                type: 'recordingStopped',
                audioId: audioData.id,
                duration: audioData.duration
            });
        } catch (error: any) {
            vscode.window.showErrorMessage(`Recording error: ${error.message}`);
        }
    }

    private async handleTranscribe(data: any) {
        try {
            const result = await this.deepgramService.transcribeAudio(
                data.audioId,
                {
                    model: 'nova-3',
                    multichannel: data.multichannel,
                    punctuate: data.punctuate,
                    dictation: data.dictation,
                    paragraphs: data.paragraphs,
                    smart_format: data.smartFormat,
                    utterances: data.utterances,
                    diarize: data.diarize,
                    sample_rate: data.sampleRate
                }
            );

            this._view?.webview.postMessage({
                type: 'transcriptionResult',
                transcript: result.results.channels[0].alternatives[0].transcript,
                fullResult: result
            });
        } catch (error: any) {
            vscode.window.showErrorMessage(`Transcription error: ${error.message}`);
            this._view?.webview.postMessage({
                type: 'transcriptionError',
                error: error.message
            });
        }
    }

    private async handleTTS(data: any) {
        try {
            const audioBuffer = await this.deepgramService.synthesizeSpeech(
                data.text,
                data.voice
            );

            this._view?.webview.postMessage({
                type: 'ttsResult',
                audioData: Array.from(audioBuffer)
            });
        } catch (error: any) {
            vscode.window.showErrorMessage(`TTS error: ${error.message}`);
            this._view?.webview.postMessage({
                type: 'ttsError',
                error: error.message
            });
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Deepgram Voice AI</title>
            <style>
                body {
                    padding: 10px;
                    font-family: var(--vscode-font-family);
                    color: var(--vscode-foreground);
                }
                .section {
                    margin-bottom: 20px;
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 4px;
                }
                .section-header {
                    padding: 10px;
                    background: var(--vscode-editor-background);
                    cursor: pointer;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-weight: bold;
                }
                .section-content {
                    padding: 10px;
                    display: none;
                }
                .section-content.expanded {
                    display: block;
                }
                input[type="text"], input[type="password"], select, textarea {
                    width: 100%;
                    padding: 6px;
                    margin: 5px 0;
                    background: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border: 1px solid var(--vscode-input-border);
                    box-sizing: border-box;
                }
                button {
                    padding: 8px 12px;
                    margin: 5px 5px 5px 0;
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    cursor: pointer;
                }
                button:hover {
                    background: var(--vscode-button-hoverBackground);
                }
                button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                .checkbox-group {
                    margin: 10px 0;
                }
                .checkbox-group label {
                    display: block;
                    margin: 5px 0;
                }
                .audio-item {
                    padding: 8px;
                    margin: 5px 0;
                    background: var(--vscode-editor-background);
                    border: 1px solid var(--vscode-input-border);
                    cursor: pointer;
                    border-radius: 3px;
                }
                .audio-item:hover {
                    background: var(--vscode-list-hoverBackground);
                }
                .audio-item.selected {
                    background: var(--vscode-list-activeSelectionBackground);
                    color: var(--vscode-list-activeSelectionForeground);
                }
                .recording-indicator {
                    color: #f00;
                    font-weight: bold;
                }
                .result-box {
                    margin-top: 10px;
                    padding: 10px;
                    background: var(--vscode-editor-background);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 3px;
                    white-space: pre-wrap;
                    max-height: 200px;
                    overflow-y: auto;
                }
                .label {
                    font-weight: bold;
                    margin-top: 10px;
                    display: block;
                }
            </style>
        </head>
        <body>
            <div style="margin-bottom: 20px;">
                <label class="label">Deepgram API Key:</label>
                <input type="password" id="apiKey" placeholder="Enter your Deepgram API key">

                <label style="display: block; margin-top: 10px;">
                    <input type="checkbox" id="useShortLivedToken">
                    Use short-lived tokens
                </label>
            </div>

            <!-- STT Section -->
            <div class="section">
                <div class="section-header" onclick="toggleSection('stt')">
                    <span>Speech-to-Text (STT)</span>
                    <span id="stt-toggle">▼</span>
                </div>
                <div class="section-content expanded" id="stt-content">
                    <button id="recordBtn">🎤 Start Recording</button>
                    <span id="recordingStatus"></span>

                    <label class="label">Recorded Audio Clips:</label>
                    <div id="audioList"></div>

                    <label class="label">Sample Rate:</label>
                    <select id="sampleRate">
                        <option value="8000">8000 Hz</option>
                        <option value="16000" selected>16000 Hz</option>
                        <option value="24000">24000 Hz</option>
                        <option value="32000">32000 Hz</option>
                        <option value="44100">44100 Hz</option>
                        <option value="48000">48000 Hz</option>
                    </select>

                    <div class="checkbox-group">
                        <label><input type="checkbox" id="multichannel"> Multi-channel</label>
                        <label><input type="checkbox" id="punctuate" checked> Punctuation</label>
                        <label><input type="checkbox" id="dictation"> Dictation</label>
                        <label><input type="checkbox" id="paragraphs"> Paragraphs</label>
                        <label><input type="checkbox" id="smartFormat" checked> Smart Formatting</label>
                        <label><input type="checkbox" id="utterances"> Utterances</label>
                        <label><input type="checkbox" id="diarize"> Diarization</label>
                    </div>

                    <button id="transcribeBtn" disabled>Transcribe Selected Audio</button>

                    <div id="transcriptionResult" class="result-box" style="display: none;"></div>
                </div>
            </div>

            <!-- TTS Section -->
            <div class="section">
                <div class="section-header" onclick="toggleSection('tts')">
                    <span>Text-to-Speech (TTS)</span>
                    <span id="tts-toggle">▼</span>
                </div>
                <div class="section-content expanded" id="tts-content">
                    <label class="label">Select Voice:</label>
                    <select id="ttsVoice">
                        <optgroup label="Aura-1 English">
                            <option value="aura-asteria-en">Asteria</option>
                            <option value="aura-luna-en">Luna</option>
                            <option value="aura-stella-en">Stella</option>
                            <option value="aura-athena-en">Athena</option>
                            <option value="aura-hera-en">Hera</option>
                            <option value="aura-orion-en">Orion</option>
                            <option value="aura-arcas-en">Arcas</option>
                            <option value="aura-perseus-en">Perseus</option>
                            <option value="aura-angus-en">Angus</option>
                            <option value="aura-orpheus-en">Orpheus</option>
                            <option value="aura-helios-en">Helios</option>
                            <option value="aura-zeus-en">Zeus</option>
                        </optgroup>
                        <optgroup label="Aura-2 English - Featured">
                            <option value="aura-2-thalia-en">Thalia - Clear, Confident, Energetic</option>
                            <option value="aura-2-andromeda-en">Andromeda - Casual, Expressive, Comfortable</option>
                            <option value="aura-2-helena-en">Helena - Caring, Natural, Positive, Friendly</option>
                            <option value="aura-2-apollo-en">Apollo - Confident, Comfortable, Casual</option>
                            <option value="aura-2-arcas-en">Arcas - Natural, Smooth, Clear</option>
                            <option value="aura-2-aries-en">Aries - Warm, Energetic, Caring</option>
                        </optgroup>
                        <optgroup label="Aura-2 English - Additional">
                            <option value="aura-2-amalthea-en">Amalthea</option>
                            <option value="aura-2-asteria-en">Asteria</option>
                            <option value="aura-2-athena-en">Athena</option>
                            <option value="aura-2-atlas-en">Atlas</option>
                            <option value="aura-2-aurora-en">Aurora</option>
                            <option value="aura-2-callisto-en">Callisto</option>
                            <option value="aura-2-cora-en">Cora</option>
                            <option value="aura-2-cordelia-en">Cordelia</option>
                            <option value="aura-2-delia-en">Delia</option>
                            <option value="aura-2-draco-en">Draco</option>
                            <option value="aura-2-electra-en">Electra</option>
                            <option value="aura-2-harmonia-en">Harmonia</option>
                            <option value="aura-2-hera-en">Hera</option>
                            <option value="aura-2-hermes-en">Hermes</option>
                            <option value="aura-2-hyperion-en">Hyperion</option>
                            <option value="aura-2-iris-en">Iris</option>
                            <option value="aura-2-janus-en">Janus</option>
                            <option value="aura-2-juno-en">Juno</option>
                            <option value="aura-2-jupiter-en">Jupiter</option>
                            <option value="aura-2-luna-en">Luna</option>
                            <option value="aura-2-mars-en">Mars</option>
                            <option value="aura-2-minerva-en">Minerva</option>
                            <option value="aura-2-neptune-en">Neptune</option>
                            <option value="aura-2-odysseus-en">Odysseus</option>
                            <option value="aura-2-ophelia-en">Ophelia</option>
                            <option value="aura-2-orion-en">Orion</option>
                            <option value="aura-2-orpheus-en">Orpheus</option>
                            <option value="aura-2-pandora-en">Pandora</option>
                            <option value="aura-2-phoebe-en">Phoebe</option>
                            <option value="aura-2-pluto-en">Pluto</option>
                            <option value="aura-2-saturn-en">Saturn</option>
                            <option value="aura-2-selene-en">Selene</option>
                            <option value="aura-2-theia-en">Theia</option>
                            <option value="aura-2-vesta-en">Vesta</option>
                            <option value="aura-2-zeus-en">Zeus</option>
                        </optgroup>
                        <optgroup label="Aura-2 Spanish - Featured">
                            <option value="aura-2-celeste-es">Celeste - Colombian, Clear, Energetic</option>
                            <option value="aura-2-estrella-es">Estrella - Mexican, Natural, Calm</option>
                            <option value="aura-2-nestor-es">Nestor - Peninsular, Professional, Calm</option>
                        </optgroup>
                        <optgroup label="Aura-2 Spanish - Additional">
                            <option value="aura-2-sirio-es">Sirio</option>
                            <option value="aura-2-carina-es">Carina</option>
                            <option value="aura-2-alvaro-es">Alvaro</option>
                            <option value="aura-2-diana-es">Diana</option>
                            <option value="aura-2-aquila-es">Aquila</option>
                            <option value="aura-2-selena-es">Selena</option>
                            <option value="aura-2-javier-es">Javier</option>
                        </optgroup>
                    </select>

                    <label class="label">Text to Speak:</label>
                    <textarea id="ttsText" rows="4" placeholder="Enter text to convert to speech..."></textarea>

                    <button id="speakBtn">🔊 Speak</button>

                    <div id="ttsResult" style="display: none; margin-top: 10px;">
                        <audio id="ttsAudio" controls style="width: 100%;"></audio>
                    </div>
                </div>
            </div>

            <script>
                const vscode = acquireVsCodeApi();
                let audioClips = [];
                let selectedAudioId = null;
                let isRecording = false;

                // API Key handling
                document.getElementById('apiKey').addEventListener('change', (e) => {
                    vscode.postMessage({
                        type: 'setApiKey',
                        apiKey: e.target.value
                    });
                });

                document.getElementById('useShortLivedToken').addEventListener('change', (e) => {
                    vscode.postMessage({
                        type: 'setUseShortLivedToken',
                        value: e.target.checked
                    });
                });

                // Section toggle
                function toggleSection(sectionId) {
                    const content = document.getElementById(sectionId + '-content');
                    const toggle = document.getElementById(sectionId + '-toggle');
                    content.classList.toggle('expanded');
                    toggle.textContent = content.classList.contains('expanded') ? '▼' : '▶';
                }

                // Recording
                document.getElementById('recordBtn').addEventListener('click', () => {
                    if (!isRecording) {
                        vscode.postMessage({ type: 'startRecording' });
                    } else {
                        vscode.postMessage({ type: 'stopRecording' });
                    }
                });

                // Transcription
                document.getElementById('transcribeBtn').addEventListener('click', () => {
                    if (selectedAudioId) {
                        vscode.postMessage({
                            type: 'transcribeAudio',
                            audioId: selectedAudioId,
                            multichannel: document.getElementById('multichannel').checked,
                            punctuate: document.getElementById('punctuate').checked,
                            dictation: document.getElementById('dictation').checked,
                            paragraphs: document.getElementById('paragraphs').checked,
                            smartFormat: document.getElementById('smartFormat').checked,
                            utterances: document.getElementById('utterances').checked,
                            diarize: document.getElementById('diarize').checked,
                            sampleRate: parseInt(document.getElementById('sampleRate').value)
                        });
                    }
                });

                // TTS
                document.getElementById('speakBtn').addEventListener('click', () => {
                    const text = document.getElementById('ttsText').value;
                    const voice = document.getElementById('ttsVoice').value;
                    if (text) {
                        vscode.postMessage({
                            type: 'synthesizeSpeech',
                            text: text,
                            voice: voice
                        });
                    }
                });

                // Handle messages from extension
                window.addEventListener('message', event => {
                    const message = event.data;
                    switch (message.type) {
                        case 'recordingStarted':
                            isRecording = true;
                            document.getElementById('recordBtn').textContent = '⏹️ Stop Recording';
                            document.getElementById('recordingStatus').innerHTML = '<span class="recording-indicator">● Recording...</span>';
                            break;
                        case 'recordingStopped':
                            isRecording = false;
                            document.getElementById('recordBtn').textContent = '🎤 Start Recording';
                            document.getElementById('recordingStatus').textContent = '';
                            addAudioClip(message.audioId, message.duration);
                            break;
                        case 'transcriptionResult':
                            document.getElementById('transcriptionResult').textContent = message.transcript;
                            document.getElementById('transcriptionResult').style.display = 'block';
                            break;
                        case 'transcriptionError':
                            document.getElementById('transcriptionResult').textContent = 'Error: ' + message.error;
                            document.getElementById('transcriptionResult').style.display = 'block';
                            break;
                        case 'ttsResult':
                            playTTSAudio(message.audioData);
                            break;
                        case 'ttsError':
                            alert('TTS Error: ' + message.error);
                            break;
                    }
                });

                function addAudioClip(id, duration) {
                    audioClips.push({ id, duration });
                    const audioList = document.getElementById('audioList');
                    const item = document.createElement('div');
                    item.className = 'audio-item';
                    item.textContent = \`Audio \${audioClips.length} (\${duration.toFixed(1)}s)\`;
                    item.onclick = () => selectAudioClip(id, item);
                    audioList.appendChild(item);
                }

                function selectAudioClip(id, element) {
                    selectedAudioId = id;
                    document.querySelectorAll('.audio-item').forEach(item => {
                        item.classList.remove('selected');
                    });
                    element.classList.add('selected');
                    document.getElementById('transcribeBtn').disabled = false;
                }

                function playTTSAudio(audioData) {
                    const uint8Array = new Uint8Array(audioData);
                    const blob = new Blob([uint8Array], { type: 'audio/mpeg' });
                    const url = URL.createObjectURL(blob);
                    const audio = document.getElementById('ttsAudio');
                    audio.src = url;
                    document.getElementById('ttsResult').style.display = 'block';
                    audio.play();
                }
            </script>
        </body>
        </html>`;
    }
}
