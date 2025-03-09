import {inject, Injectable} from '@angular/core';
import {catchError, from, Observable} from 'rxjs';
import {HttpClient} from '@angular/common/http';
import {AssetsService} from '../../core/services/assets/assets.service';
import {filter, map} from 'rxjs/operators';
import {ComlinkWorkerInterface, ModelRegistry, TranslationResponse} from '@sign-mt/browsermt';

type TranslationDirection = 'spoken-to-signed' | 'signed-to-spoken';

@Injectable({
  providedIn: 'root',
})
export class SignWritingTranslationService {
  private http = inject(HttpClient);
  private assets = inject(AssetsService);

  worker: ComlinkWorkerInterface;

  loadedModel: string;

  async initWorker() {
    if (this.worker) {
      return;
    }
    const {createBergamotWorker} = await import(/* webpackChunkName: "@sign-mt/browsermt" */ '@sign-mt/browsermt');
    this.worker = createBergamotWorker('/browsermt/worker.js');

    await this.worker.importBergamotWorker('bergamot-translator-worker.js', 'bergamot-translator-worker.wasm');
  }

  async createModelRegistry(modelPath: string) {
    const modelRegistry = {};
    const modelFiles = await this.assets.getDirectory(modelPath);
    for (const [name, path] of modelFiles.entries()) {
      const fileType = name.split('.').shift();
      modelRegistry[fileType] = {name: path, size: 0, estimatedCompressedSize: 0, modelType: 'prod'};
    }
    return modelRegistry;
  }

  async loadOfflineModel(direction: TranslationDirection, from: string, to: string) {
    const modelName = `${from}${to}`;
    if (this.loadedModel === modelName) {
      return;
    }

    const modelPath = `models/browsermt/${direction}/${from}-${to}/`;
    const state = this.assets.stat(modelPath);
    if (!state.exists) {
      throw new Error(`Model '${modelPath}' not found locally`);
    }

    const modelRegistry = {[modelName]: await this.createModelRegistry(modelPath)} as ModelRegistry;

    await this.initWorker();
    await this.worker.loadModel(from, to, modelRegistry);
    this.loadedModel = modelName;
  }

  async translateOffline(
    direction: TranslationDirection,
    text: string,
    from: string,
    to: string
  ): Promise<TranslationResponse> {
    console.log('📌 Loading Offline Model for:', from, '→', to);

    await this.loadOfflineModel(direction, from, to);
    console.log('📌 Offline Model Loaded Successfully');

    console.log('📌 Sending Text to Offline Translator:', text);
    let translations = await this.worker.translate(from, to, [text], [{isHtml: false}]);

    console.log('📌 Raw Translation Response:', translations);
    if (typeof translations[0] === 'string') {
      translations = translations.map((t: any) => ({text: t}));
    }

    translations = translations.map(({text}) => ({text: this.postProcessSignWriting(text)}));

    console.log('📌 Final Processed Translation:', translations[0]);
    return translations[0];
  }

  translateOnline(
    direction: TranslationDirection,
    text: string,
    sentences: string[],
    from: string,
    to: string
  ): Observable<TranslationResponse> {
    console.log('📌 Sending Text to Online API:', text);
    console.log('📌 Sentences Array:', sentences);

    const url = 'https://sign.mt/api/spoken-text-to-signwriting';
    const body = {
      data: {
        texts: sentences.map(s => s.trim()),
        spoken_language: from,
        signed_language: to,
      },
    };

    console.log('📌 Online API Request Body:', body);
    interface SpokenToSignWritingResponse {
      result: {
        input: string[];
        output: string[];
      };
    }
    return this.http.post<SpokenToSignWritingResponse>(url, body).pipe(
      map(res => {
        console.log('📌 Online API Response:', res);
        return {text: res.result.output.join(' ')};
      })
    );
  }

  translateSpokenToSignWriting(
    text: string,
    sentences: string[],
    spokenLanguage: string,
    signedLanguage: string
  ): Observable<TranslationResponse> {
    const direction: TranslationDirection = 'spoken-to-signed';

    console.log('📌 Original Spoken Text:', text);
    console.log('📌 Sentences for Translation:', sentences);
    console.log('📌 Spoken Language:', spokenLanguage, '| Signed Language:', signedLanguage);

    const offlineSpecific = () => {
      const newText = `${this.preProcessSpokenText(text)}`;
      console.log('📌 Pre-Processed Text for Offline Translation:', newText);
      return from(this.translateOffline(direction, newText, spokenLanguage, signedLanguage));
    };

    const offlineGeneric = () => {
      const newText = `$${spokenLanguage} $${signedLanguage} ${this.preProcessSpokenText(text)}`;
      console.log('📌 Generic Offline Translation Text:', newText);
      return from(this.translateOffline(direction, newText, 'spoken', 'signed'));
    };

    const online = () => {
      console.log('📌 Attempting Online Translation...');
      return this.translateOnline(direction, text, sentences, spokenLanguage, signedLanguage);
    };

    return offlineSpecific().pipe(
      catchError(err => {
        console.error('❌ Offline-Specific Translation Failed:', err);
        return offlineGeneric();
      }),
      filter(() => !('navigator' in globalThis) || navigator.onLine),
      catchError(err => {
        console.error('❌ Offline Generic Translation Failed:', err);
        return online();
      })
    );
  }

  preProcessSpokenText(text: string) {
    console.log('📌 Pre-Processing Input Text:', text);
    return text.replace('\n', ' ');
  }

  postProcessSignWriting(text: string) {
    console.log('📌 Raw SignWriting Output:', text);

    // remove all tokens that start with a $
    text = text.replace(/\$[^\s]+/g, '');

    // space signs correctly
    text = text.replace(/ /g, '');
    text = text.replace(/(\d)M/g, '$1 M');

    console.log('📌 Processed SignWriting Output:', text);
    return text;
  }
}
