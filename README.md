# Deepgram Voice AI VSCode Extension

A Visual Studio Code extension that integrates Deepgram's Speech-to-Text (STT) and Text-to-Speech (TTS) capabilities directly into your development environment.

## Features

### Speech-to-Text (STT)

- Record audio snippets directly in VSCode
- Store and manage multiple audio recordings
- Transcribe audio using Deepgram's nova-3 model
- Configurable transcription options:
  - Multi-channel transcription
  - Automatic punctuation
  - Dictation mode
  - Paragraph formatting
  - Smart formatting
  - Utterance detection
  - Speaker diarization
- Adjustable sample rate (8000Hz - 48000Hz)

### Text-to-Speech (TTS)

- Convert text to speech using Deepgram's Aura 2 voices
- 12 high-quality voice options
- Real-time audio playback in the extension
- Support for various English voice models

### Authentication

- Direct API key input
- Optional short-lived token generation for enhanced security
- Automatic token management

## Prerequisites

### Audio Recording Requirements

For audio recording functionality, you need to install SoX (Sound eXchange):

**macOS:**

```bash
brew install sox
```

**Linux (Ubuntu/Debian):**

```bash
sudo apt-get install sox libsox-fmt-all
```

**Linux (Fedora/RHEL):**

```bash
sudo yum install sox
```

**Windows:**
Download and install SoX from [sourceforge.net/projects/sox](https://sourceforge.net/projects/sox/)

## Installation

### From Source

1. Clone this repository:

   ```bash
   git clone <repository-url>
   cd vscode
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Compile the extension:

   ```bash
   npm run compile
   ```

4. Open the project in VSCode and press `F5` to run the extension in a new Extension Development Host window.

### Building VSIX Package

To create an installable package:

```bash
npm install -g @vscode/vsce
vsce package
```

Then install the generated `.vsix` file in VSCode:

1. Open VSCode
2. Go to Extensions view
3. Click the `...` menu
4. Select "Install from VSIX..."
5. Choose the generated `.vsix` file

## Usage

### Getting Started

1. Click the Deepgram icon in the Activity Bar (left sidebar)
2. Enter your Deepgram API key in the text field
3. Optionally enable "Use short-lived tokens" for enhanced security

### Speech-to-Text

1. Expand the "Speech-to-Text (STT)" section
2. Click "Start Recording" to begin recording audio
3. Click "Stop Recording" when finished
4. Your recorded clips appear in the list
5. Click a clip to select it
6. Configure transcription options:
   - Select sample rate
   - Enable/disable features (punctuation, diarization, etc.)
7. Click "Transcribe Selected Audio"
8. View the transcription result below

### Text-to-Speech

1. Expand the "Text-to-Speech (TTS)" section
2. Select a voice from the dropdown
3. Enter the text you want to convert to speech
4. Click "Speak"
5. Listen to the generated audio using the built-in player

## Available Voices

The extension includes both Aura-1 and Aura-2 voice models:

### Aura-1 English Voices
Asteria, Luna, Stella, Athena, Hera, Orion, Arcas, Perseus, Angus, Orpheus, Helios, Zeus

### Aura-2 English Voices (Featured)
- **Thalia** - Clear, Confident, Energetic, Enthusiastic
- **Andromeda** - Casual, Expressive, Comfortable
- **Helena** - Caring, Natural, Positive, Friendly
- **Apollo** - Confident, Comfortable, Casual
- **Arcas** - Natural, Smooth, Clear
- **Aries** - Warm, Energetic, Caring

### Aura-2 English Voices (Additional)
Amalthea, Asteria, Athena, Atlas, Aurora, Callisto, Cora, Cordelia, Delia, Draco, Electra, Harmonia, Hera, Hermes, Hyperion, Iris, Janus, Juno, Jupiter, Luna, Mars, Minerva, Neptune, Odysseus, Ophelia, Orion, Orpheus, Pandora, Phoebe, Pluto, Saturn, Selene, Theia, Vesta, Zeus

### Aura-2 Spanish Voices (Featured)
- **Celeste** - Colombian accent, Clear, Energetic, Positive
- **Estrella** - Mexican accent, Natural, Calm, Comfortable
- **Nestor** - Peninsular accent, Professional, Calm, Confident

### Aura-2 Spanish Voices (Additional)
Sirio, Carina, Alvaro, Diana, Aquila, Selena, Javier (representing Mexican, Peninsular, Colombian, and Latin American accents)

## Configuration

### API Key

Get your Deepgram API key from [Deepgram Console](https://console.deepgram.com/)

### Short-Lived Tokens

When enabled, the extension will automatically generate short-lived tokens using your API key. This provides an additional layer of security by limiting the lifespan of authentication credentials.

## Technical Notes

### Audio Recording

The extension uses `node-record-lpcm16` for audio recording, which requires SoX to be installed on your system. Audio is captured in WAV format with configurable sample rates (8000Hz - 48000Hz).

The recording process:

1. Captures audio from your default microphone
2. Stores audio data in memory as WAV format
3. Sends the audio buffer to Deepgram's API for transcription

If you encounter recording issues, verify that:

- SoX is installed and accessible in your PATH
- Your system has microphone permissions enabled for terminal/VSCode
- Your default audio input device is properly configured

### API Integration

The extension uses:

- Deepgram batch (pre-recorded) API for transcription
- Deepgram TTS API for speech synthesis
- Token-based authentication endpoint for short-lived tokens

## Development

### Project Structure

```text
vscode/
├── src/
│   ├── extension.ts              # Extension entry point
│   ├── deepgramViewProvider.ts   # Webview UI provider
│   └── deepgramService.ts        # Deepgram API integration
├── resources/
│   ├── deepgram-icon.svg         # Activity bar icon (generated)
│   └── deepgram-logo.svg         # Activity bar icon (actual)
├── package.json                  # Extension manifest
└── tsconfig.json                 # TypeScript configuration
```

### Building

```bash
npm run compile
```

### Watching for Changes

```bash
npm run watch
```

## Resources

- [Deepgram Documentation](https://developers.deepgram.com/)
- [Speech-to-Text API](https://developers.deepgram.com/reference/speech-to-text/listen-pre-recorded)
- [Text-to-Speech API](https://developers.deepgram.com/reference/text-to-speech/speak-request)
- [TTS Voices](https://developers.deepgram.com/docs/tts-models)
- [Token Authentication](https://developers.deepgram.com/guides/fundamentals/token-based-authentication)

## License

MIT

## Support

For issues and feature requests, please open an issue on the repository.
