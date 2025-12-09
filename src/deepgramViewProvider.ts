import * as vscode from 'vscode';
import { DeepgramService } from './deepgramService';

export class DeepgramViewProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private deepgramService: DeepgramService;
    private outputChannel: vscode.OutputChannel;

    constructor(private readonly _extensionUri: vscode.Uri) {
        this.deepgramService = new DeepgramService();
        this.outputChannel = vscode.window.createOutputChannel('Deepgram Voice AI');
        this.log('Deepgram Voice AI extension initialized');
    }

    private log(message: string): void {
        const timestamp = new Date().toISOString();
        this.outputChannel.appendLine(`[${timestamp}] ${message}`);
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
                case 'insertToEditor':
                    await this.handleInsertToEditor(data);
                    break;
                case 'deleteAudio':
                    this.log(`User deleted audio clip: ${data.audioId}`);
                    this.deepgramService.deleteRecording(data.audioId);
                    break;
                case 'playAudio':
                    await this.handlePlayAudio(data);
                    break;
                case 'modelChanged':
                    this.log(`User changed model: ${data.model}`);
                    break;
                case 'languageChanged':
                    this.log(`User changed language: ${data.language || 'auto-detect'}`);
                    break;
            }
        });
    }

    private async handleStartRecording() {
        try {
            this.log('User started recording audio');
            const audioData = await this.deepgramService.startRecording();
            this._view?.webview.postMessage({
                type: 'recordingStarted'
            });
        } catch (error: any) {
            this.log(`Recording start failed: ${error.message}`);
            vscode.window.showErrorMessage(`Recording error: ${error.message}`);
        }
    }

    private async handleStopRecording() {
        try {
            const audioData = await this.deepgramService.stopRecording();
            this.log(`User stopped recording: ${audioData.id} (${audioData.duration.toFixed(2)}s, ${audioData.buffer.length} bytes)`);
            this._view?.webview.postMessage({
                type: 'recordingStopped',
                audioId: audioData.id,
                duration: audioData.duration
            });
        } catch (error: any) {
            this.log(`Recording stop failed: ${error.message}`);
            vscode.window.showErrorMessage(`Recording error: ${error.message}`);
        }
    }

    private async handleTranscribe(data: any) {
        try {
            const options = {
                model: data.model || 'nova-3',
                language: data.language,
                multichannel: data.multichannel,
                punctuate: data.punctuate,
                dictation: data.dictation,
                paragraphs: data.paragraphs,
                smart_format: data.smartFormat,
                utterances: data.utterances,
                diarize: data.diarize,
                sample_rate: data.sampleRate,
                keyterms: data.keyterms
            };

            this.log(`User invoked transcription: audioId=${data.audioId}, model=${options.model}, language=${options.language || 'auto'}`);

            const result = await this.deepgramService.transcribeAudio(data.audioId, options);

            const transcript = result.results.channels[0].alternatives[0].transcript;
            this.log(`Transcription completed: ${transcript.length} characters`);

            this._view?.webview.postMessage({
                type: 'transcriptionResult',
                transcript: transcript,
                fullResult: result
            });
        } catch (error: any) {
            this.log(`Transcription failed: ${error.message}`);
            vscode.window.showErrorMessage(`Transcription error: ${error.message}`);
            this._view?.webview.postMessage({
                type: 'transcriptionError',
                error: error.message
            });
        }
    }

    private async handleTTS(data: any) {
        try {
            this.log(`User invoked text-to-speech: voice=${data.voice}, textLength=${data.text.length}`);

            const audioBuffer = await this.deepgramService.synthesizeSpeech(
                data.text,
                data.voice
            );

            this.log(`Text-to-speech completed: ${audioBuffer.length} bytes`);

            this._view?.webview.postMessage({
                type: 'ttsResult',
                audioData: Array.from(audioBuffer)
            });
        } catch (error: any) {
            this.log(`Text-to-speech failed: ${error.message}`);
            vscode.window.showErrorMessage(`TTS error: ${error.message}`);
            this._view?.webview.postMessage({
                type: 'ttsError',
                error: error.message
            });
        }
    }

    private async handleInsertToEditor(data: any) {
        try {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('No active text editor found. Please open a file first.');
                return;
            }

            const position = editor.selection.active;
            await editor.edit(editBuilder => {
                editBuilder.insert(position, data.text);
            });

            vscode.window.showInformationMessage('Transcription inserted into editor!');
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to insert text: ${error.message}`);
        }
    }

    private async handlePlayAudio(data: any) {
        try {
            this.log(`User playing audio clip: ${data.audioId}`);
            const audioBuffer = this.deepgramService.getRecordingData(data.audioId);

            this._view?.webview.postMessage({
                type: 'playAudioResult',
                audioData: Array.from(audioBuffer)
            });
        } catch (error: any) {
            this.log(`Play audio failed: ${error.message}`);
            vscode.window.showErrorMessage(`Play audio error: ${error.message}`);
            this._view?.webview.postMessage({
                type: 'playAudioError',
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
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .audio-item:hover {
                    background: var(--vscode-list-hoverBackground);
                }
                .audio-item.selected {
                    background: var(--vscode-list-activeSelectionBackground);
                    color: var(--vscode-list-activeSelectionForeground);
                }
                .audio-item-text {
                    flex: 1;
                }
                .audio-item-actions {
                    display: flex;
                    gap: 4px;
                }
                .audio-item-play {
                    padding: 4px 8px;
                    cursor: pointer;
                    opacity: 0.7;
                    font-size: 16px;
                }
                .audio-item-play:hover {
                    opacity: 1;
                }
                .audio-item-delete {
                    padding: 4px 8px;
                    cursor: pointer;
                    opacity: 0.7;
                    font-size: 16px;
                }
                .audio-item-delete:hover {
                    opacity: 1;
                    color: var(--vscode-errorForeground);
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
                .context-menu {
                    position: absolute;
                    background: var(--vscode-menu-background);
                    border: 1px solid var(--vscode-menu-border);
                    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                    padding: 4px 0;
                    z-index: 1000;
                    min-width: 180px;
                    display: none;
                }
                .context-menu-item {
                    padding: 8px 12px;
                    cursor: pointer;
                    color: var(--vscode-menu-foreground);
                }
                .context-menu-item:hover {
                    background: var(--vscode-menu-selectionBackground);
                    color: var(--vscode-menu-selectionForeground);
                }
            </style>
        </head>
        <body>
            <!-- Context Menu -->
            <div id="contextMenu" class="context-menu">
                <div class="context-menu-item" id="insertToEditor">Insert into Editor</div>
            </div>

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

                    <label class="label">Model:</label>
                    <select id="sttModel">
                        <optgroup label="Current Generation">
                            <option value="flux">Flux (English only)</option>
                            <option value="nova-3" selected>Nova-3 (Multilingual)</option>
                            <option value="nova-3-medical">Nova-3 Medical (English variants)</option>
                            <option value="nova-2">Nova-2 (Multilingual)</option>
                            <option value="nova-2-meeting">Nova-2 Meeting (English only)</option>
                            <option value="nova-2-phonecall">Nova-2 Phonecall (English only)</option>
                            <option value="nova-2-finance">Nova-2 Finance (English only)</option>
                            <option value="nova-2-conversationalai">Nova-2 Conversational AI (English only)</option>
                            <option value="nova-2-voicemail">Nova-2 Voicemail (English only)</option>
                            <option value="nova-2-video">Nova-2 Video (English only)</option>
                            <option value="nova-2-medical">Nova-2 Medical (English only)</option>
                            <option value="nova-2-drivethru">Nova-2 Drive-thru (English only)</option>
                            <option value="nova-2-automotive">Nova-2 Automotive (English only)</option>
                            <option value="nova-2-atc">Nova-2 Air Traffic Control (English only)</option>
                        </optgroup>
                        <optgroup label="Legacy Models">
                            <option value="nova">Nova (Legacy)</option>
                            <option value="nova-phonecall">Nova Phonecall (Legacy)</option>
                            <option value="nova-medical">Nova Medical (Legacy)</option>
                            <option value="enhanced">Enhanced</option>
                            <option value="enhanced-meeting">Enhanced Meeting</option>
                            <option value="enhanced-phonecall">Enhanced Phonecall</option>
                            <option value="enhanced-finance">Enhanced Finance</option>
                            <option value="base">Base</option>
                            <option value="base-meeting">Base Meeting</option>
                            <option value="base-phonecall">Base Phonecall</option>
                            <option value="base-finance">Base Finance</option>
                            <option value="base-conversationalai">Base Conversational AI</option>
                            <option value="base-voicemail">Base Voicemail</option>
                            <option value="base-video">Base Video</option>
                        </optgroup>
                        <optgroup label="Whisper Models">
                            <option value="whisper-tiny">Whisper Tiny</option>
                            <option value="whisper-base">Whisper Base</option>
                            <option value="whisper-small">Whisper Small</option>
                            <option value="whisper-medium">Whisper Medium</option>
                            <option value="whisper-large">Whisper Large</option>
                        </optgroup>
                    </select>

                    <label class="label">Language:</label>
                    <select id="sttLanguage">
                        <option value="">Auto-detect</option>
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

                    <label class="label">keyterms (optional):</label>
                    <input type="text" id="keyterms" placeholder="keyterm01, keyterm02, etc.">

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
                            <option value="aura-2-callista-en">Callista</option>
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

                // Model-Language mapping
                const modelLanguages = {
                    'flux': [
                        { code: 'en', name: 'English' }
                    ],
                    'nova-3': [
                        { code: '', name: 'Auto-detect (Multilingual)' },
                        { code: 'multi', name: 'Multilingual' },
                        { code: 'bg', name: 'Bulgarian' },
                        { code: 'ca', name: 'Catalan' },
                        { code: 'cs', name: 'Czech' },
                        { code: 'da', name: 'Danish' },
                        { code: 'da-DK', name: 'Danish (Denmark)' },
                        { code: 'nl', name: 'Dutch' },
                        { code: 'nl-BE', name: 'Flemish (Belgium)' },
                        { code: 'en', name: 'English' },
                        { code: 'en-US', name: 'English (US)' },
                        { code: 'en-AU', name: 'English (Australia)' },
                        { code: 'en-GB', name: 'English (UK)' },
                        { code: 'en-IN', name: 'English (India)' },
                        { code: 'en-NZ', name: 'English (New Zealand)' },
                        { code: 'et', name: 'Estonian' },
                        { code: 'fi', name: 'Finnish' },
                        { code: 'fr', name: 'French' },
                        { code: 'fr-CA', name: 'French (Canada)' },
                        { code: 'de', name: 'German' },
                        { code: 'de-CH', name: 'German (Switzerland)' },
                        { code: 'el', name: 'Greek' },
                        { code: 'hi', name: 'Hindi' },
                        { code: 'hu', name: 'Hungarian' },
                        { code: 'id', name: 'Indonesian' },
                        { code: 'it', name: 'Italian' },
                        { code: 'ja', name: 'Japanese' },
                        { code: 'ko', name: 'Korean' },
                        { code: 'ko-KR', name: 'Korean (South Korea)' },
                        { code: 'lv', name: 'Latvian' },
                        { code: 'lt', name: 'Lithuanian' },
                        { code: 'ms', name: 'Malay' },
                        { code: 'no', name: 'Norwegian' },
                        { code: 'pl', name: 'Polish' },
                        { code: 'pt', name: 'Portuguese' },
                        { code: 'pt-BR', name: 'Portuguese (Brazil)' },
                        { code: 'pt-PT', name: 'Portuguese (Portugal)' },
                        { code: 'ro', name: 'Romanian' },
                        { code: 'ru', name: 'Russian' },
                        { code: 'sk', name: 'Slovak' },
                        { code: 'es', name: 'Spanish' },
                        { code: 'es-419', name: 'Spanish (Latin America)' },
                        { code: 'sv', name: 'Swedish' },
                        { code: 'sv-SE', name: 'Swedish (Sweden)' },
                        { code: 'tr', name: 'Turkish' },
                        { code: 'uk', name: 'Ukrainian' },
                        { code: 'vi', name: 'Vietnamese' }
                    ],
                    'nova-3-medical': [
                        { code: 'en', name: 'English' },
                        { code: 'en-US', name: 'English (US)' },
                        { code: 'en-AU', name: 'English (Australia)' },
                        { code: 'en-CA', name: 'English (Canada)' },
                        { code: 'en-GB', name: 'English (UK)' },
                        { code: 'en-IE', name: 'English (Ireland)' },
                        { code: 'en-IN', name: 'English (India)' },
                        { code: 'en-NZ', name: 'English (New Zealand)' }
                    ],
                    'nova-2': [
                        { code: '', name: 'Auto-detect (Multilingual)' },
                        { code: 'multi', name: 'Multilingual' },
                        { code: 'bg', name: 'Bulgarian' },
                        { code: 'ca', name: 'Catalan' },
                        { code: 'cs', name: 'Czech' },
                        { code: 'da', name: 'Danish' },
                        { code: 'nl', name: 'Dutch' },
                        { code: 'en', name: 'English' },
                        { code: 'en-US', name: 'English (US)' },
                        { code: 'en-AU', name: 'English (Australia)' },
                        { code: 'en-GB', name: 'English (UK)' },
                        { code: 'en-IN', name: 'English (India)' },
                        { code: 'en-NZ', name: 'English (New Zealand)' },
                        { code: 'et', name: 'Estonian' },
                        { code: 'fi', name: 'Finnish' },
                        { code: 'fr', name: 'French' },
                        { code: 'fr-CA', name: 'French (Canada)' },
                        { code: 'de', name: 'German' },
                        { code: 'el', name: 'Greek' },
                        { code: 'hi', name: 'Hindi' },
                        { code: 'hu', name: 'Hungarian' },
                        { code: 'id', name: 'Indonesian' },
                        { code: 'it', name: 'Italian' },
                        { code: 'ja', name: 'Japanese' },
                        { code: 'ko', name: 'Korean' },
                        { code: 'lv', name: 'Latvian' },
                        { code: 'lt', name: 'Lithuanian' },
                        { code: 'ms', name: 'Malay' },
                        { code: 'no', name: 'Norwegian' },
                        { code: 'pl', name: 'Polish' },
                        { code: 'pt', name: 'Portuguese' },
                        { code: 'pt-BR', name: 'Portuguese (Brazil)' },
                        { code: 'ro', name: 'Romanian' },
                        { code: 'ru', name: 'Russian' },
                        { code: 'sk', name: 'Slovak' },
                        { code: 'es', name: 'Spanish' },
                        { code: 'sv', name: 'Swedish' },
                        { code: 'tr', name: 'Turkish' },
                        { code: 'uk', name: 'Ukrainian' },
                        { code: 'vi', name: 'Vietnamese' },
                        { code: 'zh', name: 'Chinese' },
                        { code: 'zh-CN', name: 'Chinese (Simplified)' },
                        { code: 'zh-TW', name: 'Chinese (Traditional)' },
                        { code: 'zh-HK', name: 'Chinese (Hong Kong)' },
                        { code: 'th', name: 'Thai' },
                        { code: 'th-TH', name: 'Thai (Thailand)' }
                    ],
                    'nova': [
                        { code: 'en', name: 'English' },
                        { code: 'es', name: 'Spanish' },
                        { code: 'hi-Latn', name: 'Hindi (Latin script)' }
                    ],
                    'enhanced': [
                        { code: '', name: 'Auto-detect' },
                        { code: 'en', name: 'English' },
                        { code: 'en-US', name: 'English (US)' },
                        { code: 'en-AU', name: 'English (Australia)' },
                        { code: 'en-GB', name: 'English (UK)' },
                        { code: 'en-IN', name: 'English (India)' },
                        { code: 'en-NZ', name: 'English (New Zealand)' },
                        { code: 'es', name: 'Spanish' },
                        { code: 'fr', name: 'French' },
                        { code: 'de', name: 'German' },
                        { code: 'pt', name: 'Portuguese' },
                        { code: 'pt-BR', name: 'Portuguese (Brazil)' },
                        { code: 'nl', name: 'Dutch' },
                        { code: 'ko', name: 'Korean' },
                        { code: 'hi', name: 'Hindi' }
                    ],
                    'base': [
                        { code: '', name: 'Auto-detect' },
                        { code: 'en', name: 'English' },
                        { code: 'en-US', name: 'English (US)' },
                        { code: 'en-AU', name: 'English (Australia)' },
                        { code: 'en-GB', name: 'English (UK)' },
                        { code: 'en-IN', name: 'English (India)' },
                        { code: 'en-NZ', name: 'English (New Zealand)' },
                        { code: 'es', name: 'Spanish' },
                        { code: 'fr', name: 'French' },
                        { code: 'de', name: 'German' },
                        { code: 'pt', name: 'Portuguese' },
                        { code: 'pt-BR', name: 'Portuguese (Brazil)' },
                        { code: 'nl', name: 'Dutch' },
                        { code: 'ko', name: 'Korean' },
                        { code: 'hi', name: 'Hindi' },
                        { code: 'ja', name: 'Japanese' },
                        { code: 'zh', name: 'Chinese' },
                        { code: 'ru', name: 'Russian' },
                        { code: 'it', name: 'Italian' }
                    ],
                    'whisper-tiny': [
                        { code: '', name: 'Auto-detect (100+ languages)' },
                        { code: 'en', name: 'English' },
                        { code: 'es', name: 'Spanish' },
                        { code: 'fr', name: 'French' },
                        { code: 'de', name: 'German' },
                        { code: 'it', name: 'Italian' },
                        { code: 'pt', name: 'Portuguese' },
                        { code: 'nl', name: 'Dutch' },
                        { code: 'ru', name: 'Russian' },
                        { code: 'zh', name: 'Chinese' },
                        { code: 'ja', name: 'Japanese' },
                        { code: 'ko', name: 'Korean' },
                        { code: 'ar', name: 'Arabic' },
                        { code: 'hi', name: 'Hindi' }
                    ]
                };

                // English-only models
                const englishOnlyModels = [
                    'nova-2-meeting', 'nova-2-phonecall', 'nova-2-finance', 'nova-2-conversationalai',
                    'nova-2-voicemail', 'nova-2-video', 'nova-2-medical', 'nova-2-drivethru',
                    'nova-2-automotive', 'nova-2-atc', 'nova-phonecall', 'nova-medical',
                    'enhanced-meeting', 'enhanced-phonecall', 'enhanced-finance',
                    'base-meeting', 'base-phonecall', 'base-finance', 'base-conversationalai',
                    'base-voicemail', 'base-video'
                ];

                // Initialize language dropdown on page load
                function updateLanguageOptions(model) {
                    const languageSelect = document.getElementById('sttLanguage');
                    languageSelect.innerHTML = '';

                    let languages;
                    if (englishOnlyModels.includes(model)) {
                        languages = [{ code: 'en', name: 'English' }];
                    } else if (modelLanguages[model]) {
                        languages = modelLanguages[model];
                    } else if (model.startsWith('whisper-')) {
                        languages = modelLanguages['whisper-tiny'];
                    } else {
                        // Default fallback
                        languages = [
                            { code: '', name: 'Auto-detect' },
                            { code: 'en', name: 'English' }
                        ];
                    }

                    languages.forEach(lang => {
                        const option = document.createElement('option');
                        option.value = lang.code;
                        option.textContent = lang.name;
                        if (lang.code === 'en') {
                            option.selected = true;
                        }
                        languageSelect.appendChild(option);
                    });
                }

                // Initialize with default model (nova-3)
                updateLanguageOptions('nova-3');

                // Handle model selection change
                document.getElementById('sttModel').addEventListener('change', (e) => {
                    const model = e.target.value;
                    updateLanguageOptions(model);
                    vscode.postMessage({
                        type: 'modelChanged',
                        model: model
                    });
                });

                // Handle language selection change
                document.getElementById('sttLanguage').addEventListener('change', (e) => {
                    vscode.postMessage({
                        type: 'languageChanged',
                        language: e.target.value
                    });
                });

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
                        const keytermsText = document.getElementById('keyterms').value;
                        const keyterms = keytermsText
                            ? keytermsText.split(',').map(k => k.trim()).filter(k => k.length > 0)
                            : [];

                        vscode.postMessage({
                            type: 'transcribeAudio',
                            audioId: selectedAudioId,
                            model: document.getElementById('sttModel').value,
                            language: document.getElementById('sttLanguage').value,
                            multichannel: document.getElementById('multichannel').checked,
                            punctuate: document.getElementById('punctuate').checked,
                            dictation: document.getElementById('dictation').checked,
                            paragraphs: document.getElementById('paragraphs').checked,
                            smartFormat: document.getElementById('smartFormat').checked,
                            utterances: document.getElementById('utterances').checked,
                            diarize: document.getElementById('diarize').checked,
                            sampleRate: parseInt(document.getElementById('sampleRate').value),
                            keyterms: keyterms
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
                        case 'playAudioResult':
                            playRecordedAudio(message.audioData);
                            break;
                        case 'playAudioError':
                            alert('Play Error: ' + message.error);
                            break;
                    }
                });

                function addAudioClip(id, duration) {
                    audioClips.push({ id, duration });
                    const audioList = document.getElementById('audioList');
                    const item = document.createElement('div');
                    item.className = 'audio-item';
                    item.dataset.audioId = id;

                    const textSpan = document.createElement('span');
                    textSpan.className = 'audio-item-text';
                    textSpan.textContent = \`Audio \${audioClips.length} (\${duration.toFixed(1)}s)\`;
                    textSpan.onclick = () => selectAudioClip(id, item);

                    const actionsDiv = document.createElement('div');
                    actionsDiv.className = 'audio-item-actions';

                    const playBtn = document.createElement('span');
                    playBtn.className = 'audio-item-play';
                    playBtn.innerHTML = '▶️';
                    playBtn.title = 'Play audio clip';
                    playBtn.onclick = (e) => {
                        e.stopPropagation();
                        playAudioClip(id);
                    };

                    const deleteBtn = document.createElement('span');
                    deleteBtn.className = 'audio-item-delete';
                    deleteBtn.innerHTML = '🗑️';
                    deleteBtn.title = 'Delete audio clip';
                    deleteBtn.onclick = (e) => {
                        e.stopPropagation();
                        deleteAudioClip(id, item);
                    };

                    actionsDiv.appendChild(playBtn);
                    actionsDiv.appendChild(deleteBtn);
                    item.appendChild(textSpan);
                    item.appendChild(actionsDiv);
                    audioList.appendChild(item);
                }

                function deleteAudioClip(id, element) {
                    // Notify backend to delete recording
                    vscode.postMessage({
                        type: 'deleteAudio',
                        audioId: id
                    });

                    // Remove from audioClips array
                    const index = audioClips.findIndex(clip => clip.id === id);
                    if (index !== -1) {
                        audioClips.splice(index, 1);
                    }

                    // Remove from DOM
                    element.remove();

                    // If this was the selected clip, clear selection
                    if (selectedAudioId === id) {
                        selectedAudioId = null;
                        document.getElementById('transcribeBtn').disabled = true;
                    }

                    // Renumber remaining clips
                    const audioList = document.getElementById('audioList');
                    const items = audioList.querySelectorAll('.audio-item');
                    items.forEach((item, idx) => {
                        const textSpan = item.querySelector('.audio-item-text');
                        const clipId = item.dataset.audioId;
                        const clip = audioClips.find(c => c.id === clipId);
                        if (clip) {
                            textSpan.textContent = \`Audio \${idx + 1} (\${clip.duration.toFixed(1)}s)\`;
                        }
                    });
                }

                function playAudioClip(id) {
                    // Request audio data from backend
                    vscode.postMessage({
                        type: 'playAudio',
                        audioId: id
                    });
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

                function playRecordedAudio(audioData) {
                    const uint8Array = new Uint8Array(audioData);
                    const blob = new Blob([uint8Array], { type: 'audio/wav' });
                    const url = URL.createObjectURL(blob);
                    const audio = new Audio(url);
                    audio.play();
                }

                // Context menu for transcription result
                const transcriptionResult = document.getElementById('transcriptionResult');
                const contextMenu = document.getElementById('contextMenu');
                const insertToEditorBtn = document.getElementById('insertToEditor');

                // Show context menu on right-click
                transcriptionResult.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    const text = transcriptionResult.textContent;

                    // Only show menu if there's text
                    if (text && text.trim().length > 0 && !text.startsWith('Error:')) {
                        contextMenu.style.display = 'block';
                        contextMenu.style.left = e.pageX + 'px';
                        contextMenu.style.top = e.pageY + 'px';
                    }
                });

                // Handle insert to editor action
                insertToEditorBtn.addEventListener('click', () => {
                    const text = transcriptionResult.textContent;
                    if (text && text.trim().length > 0) {
                        vscode.postMessage({
                            type: 'insertToEditor',
                            text: text
                        });
                    }
                    contextMenu.style.display = 'none';
                });

                // Hide context menu when clicking elsewhere
                document.addEventListener('click', () => {
                    contextMenu.style.display = 'none';
                });

                // Prevent context menu from closing when clicking inside it
                contextMenu.addEventListener('click', (e) => {
                    e.stopPropagation();
                });
            </script>
        </body>
        </html>`;
    }
}
