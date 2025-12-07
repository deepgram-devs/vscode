import * as vscode from 'vscode';
import * as recorder from 'node-record-lpcm16';
import { Writable } from 'stream';

interface AudioRecording {
    id: string;
    buffer: Buffer;
    duration: number;
    sampleRate: number;
}

interface TranscriptionOptions {
    model: string;
    multichannel?: boolean;
    punctuate?: boolean;
    dictation?: boolean;
    paragraphs?: boolean;
    smart_format?: boolean;
    utterances?: boolean;
    diarize?: boolean;
    sample_rate?: number;
    keyterms?: string[];
}

export class DeepgramService {
    private apiKey: string = '';
    private useShortLivedToken: boolean = false;
    private recordings: Map<string, AudioRecording> = new Map();
    private currentRecording: {
        chunks: Buffer[];
        startTime: number;
        stream?: any;
        sampleRate: number;
    } | null = null;
    private recordingId: number = 0;

    setApiKey(apiKey: string) {
        this.apiKey = apiKey;
    }

    setUseShortLivedToken(value: boolean) {
        this.useShortLivedToken = value;
    }

    async getAuthToken(): Promise<string> {
        if (!this.useShortLivedToken) {
            return this.apiKey;
        }

        try {
            const response = await fetch('https://api.deepgram.com/v1/auth/grant', {
                method: 'POST',
                headers: {
                    'Authorization': `Token ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    scopes: ['usage:write'],
                    ttl: 3600
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to get short-lived token: ${response.statusText}`);
            }

            const data = await response.json() as { access_token: string, expires_in: number };
            return data.access_token;
        } catch (error: any) {
            vscode.window.showErrorMessage(`Auth error: ${error.message}`);
            throw error;
        }
    }

    async startRecording(sampleRate: number = 16000): Promise<void> {
        if (!this.apiKey) {
            throw new Error('Please set your Deepgram API key first');
        }

        if (this.currentRecording) {
            throw new Error('Recording already in progress');
        }

        return new Promise((resolve, reject) => {
            try {
                const chunks: Buffer[] = [];

                // Create a writable stream to collect audio data
                const recordingStream = new Writable({
                    write(chunk: Buffer, encoding: string, callback: () => void) {
                        chunks.push(chunk);
                        callback();
                    }
                });

                // Start recording with specified parameters
                const recording = recorder.record({
                    sampleRate: sampleRate,
                    channels: 1,
                    audioType: 'wav',
                    recorder: 'sox', // Can be 'sox', 'rec', 'arecord' depending on platform
                    silence: '0', // Disable silence detection to record continuously
                });

                // Pipe the recording to our stream
                recording.stream().pipe(recordingStream);

                this.currentRecording = {
                    chunks: chunks,
                    startTime: Date.now(),
                    stream: recording,
                    sampleRate: sampleRate
                };

                vscode.window.showInformationMessage('Recording started. Click "Stop Recording" when done.');
                resolve();
            } catch (error: any) {
                // If sox/rec/arecord is not available, provide helpful error
                if (error.message?.includes('spawn') || error.code === 'ENOENT') {
                    vscode.window.showErrorMessage(
                        'Audio recording requires SoX to be installed. ' +
                        'Install with: brew install sox (macOS) or apt-get install sox (Linux)'
                    );
                }
                reject(error);
            }
        });
    }

    async stopRecording(): Promise<AudioRecording> {
        if (!this.currentRecording) {
            throw new Error('No recording in progress');
        }

        // Stop the recording stream
        if (this.currentRecording.stream) {
            this.currentRecording.stream.stop();
        }

        const duration = (Date.now() - this.currentRecording.startTime) / 1000;
        const recordingId = `recording_${++this.recordingId}`;

        // Combine all chunks into a single buffer
        const audioBuffer = Buffer.concat(this.currentRecording.chunks);

        const recording: AudioRecording = {
            id: recordingId,
            buffer: audioBuffer,
            duration: duration,
            sampleRate: this.currentRecording.sampleRate
        };

        this.recordings.set(recordingId, recording);

        vscode.window.showInformationMessage(
            `Recording saved: ${duration.toFixed(1)}s, ${audioBuffer.length} bytes`
        );

        this.currentRecording = null;

        return recording;
    }

    async getAuthHeaderValue(token: string) {
        if (this.useShortLivedToken) {
            return `Bearer ${token}`;
        }
        else {
            return `Token ${token}`;
        }
    }

    async transcribeAudio(
        audioId: string,
        options: TranscriptionOptions
    ): Promise<any> {
        const recording = this.recordings.get(audioId);
        if (!recording) {
            throw new Error('Audio recording not found');
        }

        const token = await this.getAuthToken();

        // Build query parameters
        const params = new URLSearchParams({
            model: options.model || 'nova-3',
            ...(options.sample_rate && { sample_rate: options.sample_rate.toString() })
        });

        if (options.multichannel) {params.append('multichannel', 'true');}
        if (options.punctuate) { params.append('punctuate', 'true'); }
        if (options.dictation) { params.append('dictation', 'true'); }
        if (options.paragraphs) { params.append('paragraphs', 'true'); }
        if (options.smart_format) { params.append('smart_format', 'true'); }
        if (options.utterances) { params.append('utterances', 'true'); }
        if (options.diarize) { params.append('diarize', 'true'); }

        // Add keyterms as separate parameters
        if (options.keyterms && options.keyterms.length > 0) {
            options.keyterms.forEach(keyterm => {
                params.append('keyterm', keyterm);
            });
        }

        try {
            // Check if we have audio data
            if (recording.buffer.length === 0) {
                throw new Error('No audio data recorded. Please record audio first.');
            }

            vscode.window.showInformationMessage(
                `Transcribing ${recording.buffer.length} bytes of audio...`
            );

            const response = await fetch(
                `https://api.deepgram.com/v1/listen?${params.toString()}`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': await this.getAuthHeaderValue(token),
                        'Content-Type': 'audio/wav'
                    },
                    body: recording.buffer
                }
            );

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Deepgram API error: ${response.statusText} - ${errorText}`);
            }

            const result = await response.json();
            vscode.window.showInformationMessage('Transcription completed successfully!');
            return result;
        } catch (error: any) {
            vscode.window.showErrorMessage(`Transcription failed: ${error.message}`);
            throw error;
        }
    }

    async synthesizeSpeech(text: string, voice: string): Promise<Buffer> {
        if (!this.apiKey) {
            throw new Error('Please set your Deepgram API key first');
        }

        const token = await this.getAuthToken();

        try {
            const response = await fetch(
                `https://api.deepgram.com/v1/speak?model=${voice}`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': await this.getAuthHeaderValue(token),
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ text })
                }
            );

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Deepgram TTS error: ${response.statusText} - ${errorText}`);
            }

            const arrayBuffer = await response.arrayBuffer();
            return Buffer.from(arrayBuffer);
        } catch (error: any) {
            vscode.window.showErrorMessage(`TTS failed: ${error.message}`);
            throw error;
        }
    }
}
