import {
  Component,
  Input,
  OnChanges,
  OnInit,
  Output,
  EventEmitter,
  SimpleChanges,
  ViewChild,
  ElementRef,
} from '@angular/core';
import {BaseComponent} from '../base/base.component';
import {MatTooltipModule, TooltipPosition} from '@angular/material/tooltip';
import {IonButton, IonIcon} from '@ionic/angular/standalone';
import {TranslocoDirective} from '@jsverse/transloco';
import {addIcons} from 'ionicons';
import {micOutline, stopCircleOutline} from 'ionicons/icons';
import * as sdk from 'microsoft-cognitiveservices-speech-sdk';
import {environment} from 'src/environments/environment'; // Correct import path

// Map language codes to Azure-compatible codes
const azureLanguageMap: {[key: string]: string} = {
  ta: 'ta-IN', // Tamil
  en: 'en-US', // English
  fr: 'fr-FR', // French
  es: 'es-ES', // Spanish
  // Add more mappings as needed
};

@Component({
  selector: 'app-speech-to-text',
  templateUrl: './speech-to-text.component.html',
  styleUrls: ['./speech-to-text.component.css'],
  imports: [IonButton, IonIcon, MatTooltipModule, TranslocoDirective],
})
export class SpeechToTextComponent extends BaseComponent implements OnInit, OnChanges {
  @Input() lang = 'en'; // Input language (e.g., 'ta' for Tamil)
  @Output() changeText = new EventEmitter<string>(); // Output for transcribed text
  @Input() matTooltipPosition: TooltipPosition = 'above';

  @ViewChild('videoElement', {static: false}) videoElement!: ElementRef<HTMLVideoElement>; // Reference to the video element

  private speechConfig!: sdk.SpeechTranslationConfig;
  private recognizer!: sdk.TranslationRecognizer;
  private mediaStream!: MediaStream;

  supportError: string | null = null;
  isRecording = false;
  transcribedText = ''; // Store the transcribed text

  constructor() {
    super();
    addIcons({stopCircleOutline, micOutline});
  }

  ngOnInit(): void {
    // Initialize Azure Speech SDK configuration
    this.speechConfig = sdk.SpeechTranslationConfig.fromSubscription(
      environment.azure.speech.subscriptionKey, // Use the subscription key from environment.ts
      environment.azure.speech.region // Use the region from environment.ts
    );

    // Set the input language
    this.updateLanguage(this.lang);

    // Add English as the target translation language
    this.speechConfig.addTargetLanguage('en');
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.lang && this.speechConfig) {
      // Update the input language when it changes
      this.updateLanguage(changes.lang.currentValue);
    }
  }

  updateLanguage(lang: string) {
    // Convert the language code to Azure-compatible format
    const azureLang = azureLanguageMap[lang] || 'en-US'; // Default to English if the language is not mapped
    this.speechConfig.speechRecognitionLanguage = azureLang;
  }

  start() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.error('navigator.mediaDevices.getUserMedia is not supported in this browser.');
      this.supportError = 'media-devices-not-supported';
      return;
    }

    // Request webcam access (video only, no audio)
    navigator.mediaDevices
      .getUserMedia({video: true, audio: false})
      .then(stream => {
        this.mediaStream = stream;

        // Bind the webcam stream to the video element
        if (this.videoElement) {
          this.videoElement.nativeElement.srcObject = stream;
        }

        // Start speech recognition
        this.startSpeechRecognition();
      })
      .catch(error => {
        console.error('Error accessing webcam:', error);
        this.supportError = 'webcam-access-denied';
      });
  }

  startSpeechRecognition() {
    // Create a translation recognizer
    const audioConfig = sdk.AudioConfig.fromDefaultMicrophoneInput();
    this.recognizer = new sdk.TranslationRecognizer(this.speechConfig, audioConfig);

    // Subscribe to recognized events
    this.recognizer.recognizing = (_, event) => {
      const result = event.result;
      if (result.reason === sdk.ResultReason.TranslatingSpeech) {
        const translation = result.translations.get('en'); // Get the English translation
        this.transcribedText = translation; // Update the transcribed text
        this.changeText.emit(translation);
      }
    };

    // Subscribe to errors
    this.recognizer.canceled = (_, event) => {
      console.error('Speech recognition canceled:', event.errorDetails);
      this.supportError = 'speech-recognition-error';
    };

    // Start recognition
    this.recognizer.startContinuousRecognitionAsync(
      () => {
        console.log('Speech recognition started.');
        this.isRecording = true;
      },
      error => {
        console.error('Error starting speech recognition:', error);
        this.supportError = 'speech-recognition-error';
      }
    );
  }

  stop() {
    if (this.recognizer) {
      // Stop speech recognition
      this.recognizer.stopContinuousRecognitionAsync(
        () => {
          console.log('Speech recognition stopped.');
          this.isRecording = false;
        },
        error => {
          console.error('Error stopping speech recognition:', error);
        }
      );
    }

    // Stop the webcam stream
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
    }

    // Clear the video stream
    if (this.videoElement) {
      this.videoElement.nativeElement.srcObject = null;
    }
  }
}
