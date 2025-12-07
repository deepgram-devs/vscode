# Project Instructions

Create a VSCode extension for Deepgram Voice AI.
There should be a VSCode activity bar icon to activate it.
There should be two collapsible / expandable sections, one for speech to text (STT) transcription, and one section for text-to-speech (TTS).
There should be a text field to enter the user's secret password Deepgram API key
There should be a checkbox to enable the user of short-lived Deepgram tokens when invoking STT or TTS operations
Short-lived tokens can be generated with the `v1/auth/grant` Deepgram HTTP REST API using the POST verb

## Speech-to-Text (STT) Section

- In the STT section, create a microphone button that allows the user to record audio snippets and store them in memory.
- Show the audio snippets as a list of items that the user can select one at a time.
- Add a button to submit the selected audio clip for transcription to the Deepgram API.
- Use the Deepgram batch (pre-recorded) HTTP API to perform transcription with the nova-3 model.
- Add a checkbox to enable multi-channel transcription as a boolean query string parameter `multichannel=true` or false
- Add checkbox options to enable query string features: punctuate, dictation, paragraphs, smart formatting, utterances, diarization
- Add a drop-down box to select the microphone sample rate.

## Text-to-Speech (TTS) Section

- In the TTS section, add a drop-down box that allows the user to select a Deepgram TTS voice
- Make sure all the supported Deepgram TTS voices are listed for aura-2
- Add a text field with the text that the user wants to speak with TTS
- Add a button to invoke the Deepgram TTS HTTP API, using the selected voice and the text the user provided in the text field

## Deepgram Documentation Resources

- Short-lived authentication tokens: <https://developers.deepgram.com/guides/fundamentals/token-based-authentication>
- TTS API: <https://developers.deepgram.com/reference/text-to-speech/speak-request>
- TTS Voices: <https://developers.deepgram.com/docs/tts-models>
- STT API: <https://developers.deepgram.com/reference/speech-to-text/listen-pre-recorded>
- STT Diarization: <https://developers.deepgram.com/docs/diarization>
