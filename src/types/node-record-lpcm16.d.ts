declare module 'node-record-lpcm16' {
    import { Readable } from 'stream';

    interface RecordingOptions {
        sampleRate?: number;
        channels?: number;
        compress?: boolean;
        threshold?: number;
        thresholdStart?: number;
        thresholdEnd?: number;
        silence?: string;
        recorder?: string;
        device?: string | null;
        audioType?: string;
    }

    interface Recording {
        stream(): Readable;
        stop(): void;
        pause(): void;
        resume(): void;
    }

    export function record(options?: RecordingOptions): Recording;
}
